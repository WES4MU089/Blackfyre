/**
 * NPC Dialog Engine — server-side dialog state machine.
 *
 * Manages active dialog sessions, resolves nodes with dynamic
 * context, validates conditions, and executes server-side actions
 * (e.g. healing, currency deduction).
 *
 * Pure in-memory session store — no DB persistence for dialog state.
 */

import { Server as SocketServer } from 'socket.io';
import { db } from '../db/connection.js';
import { logger } from '../utils/logger.js';
import { findFirstEmptySlot, fetchFullInventory } from '../api/routes/inventory.js';
import type {
  DialogTree,
  DialogNode,
  DialogOption,
  DialogContext,
  DialogSession,
  DialogPayload,
} from './types.js';

// ── Active sessions: characterId → session ─────────────────────

const activeSessions = new Map<number, DialogSession>();

// ── Tree registry ──────────────────────────────────────────────

import { healerTree } from './trees/healer.js';
import { blacksmithTree } from './trees/blacksmith.js';
import { sparringSoldierTree } from './trees/sparring-soldier.js';
import { royalTreasurerTree } from './trees/royal-treasurer.js';
import { retainerCaptainTree } from './trees/retainer-captain.js';
import { testSageTree } from './trees/test-sage.js';
import { arthurPainTree } from './trees/arthur-pain.js';

const trees: Record<string, DialogTree> = {
  healer: healerTree,
  blacksmith: blacksmithTree,
  sparring_soldier: sparringSoldierTree,
  royal_treasurer: royalTreasurerTree,
  retainer_captain: retainerCaptainTree,
  test_sage: testSageTree,
  arthur_pain: arthurPainTree,
};

export function getTree(npcType: string): DialogTree | null {
  return trees[npcType] ?? null;
}

// ── Public API ─────────────────────────────────────────────────

/**
 * Load a fresh dialog context for a character.
 */
export async function loadContext(characterId: number): Promise<DialogContext> {
  const vitals = await db.queryOne<{ health: number; max_health: number }>(
    'SELECT health, max_health FROM character_vitals WHERE character_id = ?',
    [characterId],
  );
  const finances = await db.queryOne<{ cash: number }>(
    'SELECT cash FROM character_finances WHERE character_id = ?',
    [characterId],
  );
  const occupied = await db.queryOne<{ cnt: number }>(
    'SELECT COUNT(*) AS cnt FROM character_inventory WHERE character_id = ?',
    [characterId],
  );
  const charData = await db.queryOne<{ level: number; xp_segments: number; wound_severity: string }>(
    'SELECT level, xp_segments, wound_severity FROM characters WHERE id = ?',
    [characterId],
  );

  return {
    characterId,
    currentHealth: Number(vitals?.health ?? 0),
    maxHealth: Number(vitals?.max_health ?? 100),
    cash: Number(finances?.cash ?? 0),
    inventorySlotsFree: 25 - Number(occupied?.cnt ?? 0),
    level: charData?.level ?? 1,
    xpSegments: Number(charData?.xp_segments ?? 0),
    woundSeverity: charData?.wound_severity ?? 'healthy',
  };
}

/**
 * Start a dialog session. Returns the greeting payload.
 */
export function startDialog(
  tree: DialogTree,
  context: DialogContext,
): DialogPayload {
  // Close any existing session for this character
  activeSessions.delete(context.characterId);

  const greetingNode = tree.nodes[tree.greeting];
  if (!greetingNode) {
    throw new Error(`Greeting node '${tree.greeting}' not found in tree '${tree.npcType}'`);
  }

  const session: DialogSession = {
    characterId: context.characterId,
    npcType: tree.npcType,
    tree,
    currentNodeId: greetingNode.id,
    context,
  };
  activeSessions.set(context.characterId, session);

  return resolvePayload(session, greetingNode);
}

/**
 * Process a player's option selection. May execute actions (DB writes).
 * Returns the next payload, or `{ close: true }` if the dialog should end.
 */
export async function selectOption(
  characterId: number,
  optionId: string,
  io: SocketServer,
): Promise<DialogPayload | { close: true }> {
  const session = activeSessions.get(characterId);
  if (!session) throw new Error('NO_ACTIVE_DIALOG');

  // Use stored dynamic node if available, otherwise look up from tree
  const currentNode = session.currentDynamicNode ?? session.tree.nodes[session.currentNodeId];
  if (!currentNode) throw new Error('INVALID_NODE');

  const option = currentNode.options.find(o => o.id === optionId);
  if (!option) throw new Error('INVALID_OPTION');

  // Clear dynamic node — it's been consumed
  session.currentDynamicNode = undefined;

  // Refresh context before checking conditions
  session.context = await loadContext(characterId);

  // Check conditions
  if (option.conditions && option.conditions.length > 0) {
    const failedCondition = checkConditions(option.conditions, session.context);
    if (failedCondition) {
      // Navigate to condition-specific fail node or generic fail node
      const failNodeId = resolveFailNode(failedCondition, option);
      return navigateTo(session, failNodeId);
    }
  }

  // Execute action if present
  if (option.action) {
    const result = await executeAction(option.action, session, io);
    if ('close' in result) {
      closeDialog(characterId);
      return { close: true };
    }
    if ('dynamicNode' in result) {
      session.currentNodeId = result.dynamicNode.id;
      session.currentDynamicNode = result.dynamicNode;
      return resolvePayload(session, result.dynamicNode);
    }
    return navigateTo(session, result.nextNodeId);
  }

  // Navigate to next node
  if (option.nextNodeId) {
    return navigateTo(session, option.nextNodeId);
  }

  // No next node → close
  closeDialog(characterId);
  return { close: true };
}

/**
 * Close and clean up a dialog session.
 */
export function closeDialog(characterId: number): void {
  activeSessions.delete(characterId);
}

/**
 * Check if a character has an active dialog.
 */
export function getActiveSession(characterId: number): DialogSession | null {
  return activeSessions.get(characterId) ?? null;
}

// ── Condition checking ─────────────────────────────────────────

/**
 * Returns the first failed condition string, or null if all pass.
 */
function checkConditions(conditions: string[], ctx: DialogContext): string | null {
  for (const cond of conditions) {
    if (cond === 'health_not_full') {
      if (ctx.currentHealth >= ctx.maxHealth) return 'health_not_full';
    } else if (cond === 'needs_healing') {
      if (ctx.currentHealth >= ctx.maxHealth && ctx.woundSeverity === 'healthy') return 'needs_healing';
    } else if (cond.startsWith('has_cash:')) {
      const amount = parseInt(cond.split(':')[1], 10);
      if (ctx.cash < amount) return cond;
    } else if (cond === 'has_inventory_space') {
      if (ctx.inventorySlotsFree <= 0) return 'has_inventory_space';
    }
  }
  return null;
}

/**
 * Map a failed condition to the appropriate fail node.
 */
function resolveFailNode(failedCondition: string, option: DialogOption): string {
  if (failedCondition === 'health_not_full') return 'already_healed';
  if (failedCondition === 'needs_healing') return 'already_healed';
  if (failedCondition.startsWith('has_cash:')) return 'insufficient_gold';
  if (failedCondition === 'has_inventory_space') return 'inventory_full';
  return option.conditionFailNodeId ?? 'farewell';
}

// ── Action execution ───────────────────────────────────────────

type ActionResult = { nextNodeId: string } | { dynamicNode: DialogNode } | { close: true };

const actionHandlers: Record<
  string,
  (session: DialogSession, io: SocketServer) => Promise<ActionResult>
> = {
  heal: async (session, io) => {
    const { characterId, maxHealth } = session.context;

    await db.transaction(async (conn) => {
      // Restore health to max
      await conn.query(
        'UPDATE character_vitals SET health = max_health WHERE character_id = ?',
        [characterId],
      );
      // Clear wound severity and timers
      await conn.query(
        `UPDATE characters SET wound_severity = 'healthy', wound_received_at = NULL, wound_heals_at = NULL WHERE id = ?`,
        [characterId],
      );
      // Clear any active ailments (infections from wounds)
      await conn.query(
        'DELETE FROM character_ailments WHERE character_id = ?',
        [characterId],
      );
      // Deduct 50 stars (copper)
      await conn.query(
        'UPDATE character_finances SET cash = cash - 50 WHERE character_id = ?',
        [characterId],
      );
      // Log the transaction
      await conn.query(
        `INSERT INTO transactions (character_id, transaction_type, amount, currency_type, description)
         VALUES (?, 'purchase', 50, 'cash', 'Healer — full restoration (50 stars)')`,
        [characterId],
      );
    });

    // Broadcast vitals update to the character's HUD
    io.to(`character:${characterId}`).emit('vitals:changed', {
      health: maxHealth,
    });

    // Broadcast finances update
    const finances = await db.queryOne(
      'SELECT * FROM character_finances WHERE character_id = ?',
      [characterId],
    );
    io.to(`character:${characterId}`).emit('finances:changed', finances);

    // Refresh context
    session.context = await loadContext(characterId);

    logger.info(`Healer: character ${characterId} healed to full, wounds cleared (50 stars deducted)`);

    return { nextNodeId: 'healed' };
  },

  list_retainer_tiers: async (session) => {
    const { getRetainerTiers, getPlayerRetainers } = await import('../retainers/retainer-manager.js');
    const tiers = await getRetainerTiers();
    const owned = await getPlayerRetainers(session.context.characterId);

    if (owned.length >= 4) {
      return { nextNodeId: 'too_many' };
    }

    const options: DialogOption[] = tiers.map(t => ({
      id: `tier_${t.tier}`,
      text: `${t.name} — ${formatCurrency(t.hireCost)} (${t.aptitudeBudget} pts, max ${t.aptitudeCap}/apt)`,
      action: `select_tier:${t.tier}`,
    }));
    options.push({ id: 'back', text: 'Go back.', nextNodeId: 'greeting' });

    const dynamicNode: DialogNode = {
      id: 'browse_tiers',
      npcText: `Here's what caliber of fighter I can find for you. You currently have ${owned.length}/4 retainers. You hold ${formatCurrency(session.context.cash)}.`,
      options,
    };

    return { dynamicNode };
  },

  list_owned_retainers: async (session) => {
    const { getPlayerRetainers } = await import('../retainers/retainer-manager.js');
    const owned = await getPlayerRetainers(session.context.characterId);

    if (owned.length === 0) {
      return { nextNodeId: 'no_retainers' };
    }

    const options: DialogOption[] = owned.map(r => ({
      id: `dismiss_${r.characterId}`,
      text: `${r.name} (${r.tierName})`,
      action: `dismiss_retainer:${r.characterId}`,
    }));
    options.push({ id: 'back', text: 'Go back.', nextNodeId: 'greeting' });

    const dynamicNode: DialogNode = {
      id: 'dismiss_select',
      npcText: 'Which of your retainers do you want to let go? No refunds, mind you.',
      options,
    };

    return { dynamicNode };
  },

  join_spar: async (session, io) => {
    return npcJoinSpar(session, io, 'Ser Rodrik');
  },

  join_spar_arthur: async (session, io) => {
    return npcJoinSpar(session, io, 'Ser Arthur Pain');
  },
};

async function npcJoinSpar(
  session: DialogSession,
  io: SocketServer,
  npcName: string,
): Promise<ActionResult> {
  const { characterId } = session.context;

  const { findLobbyByHost, npcJoinLobby, addRetainerToLobby } = await import('../combat/lobby-manager.js');
  const { getNpcRetainers } = await import('../retainers/retainer-manager.js');

  const lobby = findLobbyByHost(characterId);
  if (!lobby) {
    return { nextNodeId: 'no_lobby' };
  }

  const npcRow = await db.queryOne<{ id: number; name: string }>(
    'SELECT id, name FROM characters WHERE is_npc = 1 AND name = ? LIMIT 1',
    [npcName],
  );
  if (!npcRow) {
    logger.error(`npcJoinSpar: NPC '${npcName}' not found in DB`);
    return { nextNodeId: 'farewell' };
  }

  try {
    let updatedLobby = await npcJoinLobby(lobby.lobbyId, npcRow.id, npcRow.name);

    const team1Size = updatedLobby.members.filter(m => m.team === 1).length;
    const retainersNeeded = team1Size - 1;

    if (retainersNeeded > 0) {
      const availableRetainers = await getNpcRetainers(npcRow.id);
      const retainersToAdd = availableRetainers.slice(0, retainersNeeded);

      for (const retainer of retainersToAdd) {
        updatedLobby = await addRetainerToLobby(
          lobby.lobbyId,
          retainer.characterId,
          retainer.name,
          npcRow.id,
          2,
        );
      }
    }

    io.to(`lobby:${lobby.lobbyId}`).emit('lobby:state', {
      lobbyId: updatedLobby.lobbyId,
      hostCharacterId: updatedLobby.hostCharacterId,
      hostName: updatedLobby.hostName,
      region: updatedLobby.region,
      status: updatedLobby.status,
      maxPlayers: updatedLobby.maxPlayers,
      members: updatedLobby.members.map(m => ({
        characterId: m.characterId,
        characterName: m.characterName,
        team: m.team,
        isReady: m.isReady,
        ownerCharacterId: m.ownerCharacterId,
        isRetainer: m.isRetainer,
      })),
    });

    const retainersAdded = retainersNeeded > 0
      ? Math.min(retainersNeeded, (updatedLobby.members.filter(m => m.isRetainer && m.ownerCharacterId === npcRow.id)).length)
      : 0;
    logger.info(`${npcRow.name} joined lobby ${lobby.lobbyId} with ${retainersAdded} retainers for player ${characterId}`);
    return { nextNodeId: 'joining' };
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'unknown';
    logger.error(`npcJoinSpar failed for ${npcName}: ${msg}`);
    return { nextNodeId: 'farewell' };
  }
}

async function executeAction(
  action: string,
  session: DialogSession,
  io: SocketServer,
): Promise<ActionResult> {
  // Shop action: query items and emit shop:open
  if (action === 'open_shop') {
    return openShop(session, io);
  }

  // Parameterized actions
  if (action.startsWith('buy:')) {
    const itemKey = action.slice(4);
    return buyItem(itemKey, session, io);
  }

  if (action.startsWith('give_gold:')) {
    const amount = parseInt(action.split(':')[1], 10);
    return giveGold(amount, session, io);
  }

  if (action.startsWith('select_tier:')) {
    const tier = parseInt(action.split(':')[1], 10);
    return handleSelectTier(tier, session, io);
  }

  if (action.startsWith('dismiss_retainer:')) {
    const retainerId = parseInt(action.split(':')[1], 10);
    return handleDismissRetainer(retainerId, session, io);
  }

  if (action.startsWith('grant_xp:')) {
    const segments = parseInt(action.split(':')[1], 10);
    return grantXpAction(segments, session, io);
  }

  if (action === 'grant_levelup') {
    return grantLevelUpAction(session, io);
  }

  const handler = actionHandlers[action];
  if (!handler) {
    logger.error(`Unknown NPC action: ${action}`);
    return { nextNodeId: 'farewell' };
  }
  return handler(session, io);
}

/**
 * Give gold to a character (Royal Treasurer test action).
 */
async function giveGold(
  amount: number,
  session: DialogSession,
  io: SocketServer,
): Promise<ActionResult> {
  const { characterId } = session.context;

  await db.execute(
    'UPDATE character_finances SET cash = cash + ? WHERE character_id = ?',
    [amount, characterId],
  );

  // Broadcast finances update
  const finances = await db.queryOne(
    'SELECT * FROM character_finances WHERE character_id = ?',
    [characterId],
  );
  io.to(`character:${characterId}`).emit('finances:changed', finances);

  // Refresh context
  session.context = await loadContext(characterId);

  logger.info(`Royal Treasurer: gave ${formatCurrency(amount)} to character ${characterId}`);

  return { nextNodeId: 'gold_given' };
}

/**
 * Grant XP segments to a character (Test Sage action). Bypasses daily cap via dm_award source.
 */
async function grantXpAction(
  segments: number,
  session: DialogSession,
  io: SocketServer,
): Promise<ActionResult> {
  const { characterId } = session.context;
  const { grantCharacterXp } = await import('../xp/xp-service.js');

  for (let i = 0; i < segments; i++) {
    await grantCharacterXp(characterId, 'dm_award', 1, { source: 'test_sage' });
  }

  session.context = await loadContext(characterId);
  logger.info(`Test Sage: granted ${segments} XP segment(s) to character ${characterId}`);
  return { nextNodeId: 'xp_granted' };
}

/**
 * Grant enough XP to level up (Test Sage action). Bypasses daily cap via dm_award source.
 */
async function grantLevelUpAction(
  session: DialogSession,
  io: SocketServer,
): Promise<ActionResult> {
  const { characterId, xpSegments } = session.context;
  const { grantCharacterXp } = await import('../xp/xp-service.js');
  const { getXpConfig } = await import('../xp/xp-config.js');

  const segmentsPerLevel = getXpConfig('char_segments_per_level', 10);
  const remaining = segmentsPerLevel - xpSegments;

  if (remaining <= 0) {
    // Already full — grant 1 to trigger the level-up
    await grantCharacterXp(characterId, 'dm_award', 1, { source: 'test_sage' });
  } else {
    for (let i = 0; i < remaining; i++) {
      await grantCharacterXp(characterId, 'dm_award', 1, { source: 'test_sage' });
    }
  }

  session.context = await loadContext(characterId);
  logger.info(`Test Sage: leveled up character ${characterId} to level ${session.context.level}`);
  return { nextNodeId: 'leveled_up' };
}

/**
 * Select a retainer tier (Retainer Captain action).
 * Validates gold/count, then emits retainer:open-hire to open the frontend hiring UI.
 * The actual hire goes through the REST API (POST /retainers/:characterId/hire).
 */
async function handleSelectTier(
  tier: number,
  session: DialogSession,
  io: SocketServer,
): Promise<ActionResult> {
  const { characterId, cash } = session.context;

  const { getRetainerTiers, getPlayerRetainers } = await import('../retainers/retainer-manager.js');
  const tiers = await getRetainerTiers();
  const tierDef = tiers.find(t => t.tier === tier);
  if (!tierDef) {
    logger.error(`select_tier: invalid tier ${tier}`);
    return { nextNodeId: 'farewell' };
  }

  // Check gold
  if (cash < tierDef.hireCost) {
    return { nextNodeId: 'no_gold' };
  }

  // Check retainer limit
  const owned = await getPlayerRetainers(characterId);
  if (owned.length >= 4) {
    return { nextNodeId: 'too_many' };
  }

  // Emit event to open the frontend hiring UI with tier data
  io.to(`character:${characterId}`).emit('retainer:open-hire', {
    tier: tierDef.tier,
    name: tierDef.name,
    hireCost: tierDef.hireCost,
    aptitudeBudget: tierDef.aptitudeBudget,
    aptitudeCap: tierDef.aptitudeCap,
    weaponKey: tierDef.weaponKey,
    armorKey: tierDef.armorKey,
    shieldKey: tierDef.shieldKey,
    description: tierDef.description,
  });

  logger.info(`Retainer Captain: character ${characterId} selected T${tier} ${tierDef.name}`);

  // Close dialog — the hiring flow continues in the frontend UI
  return { close: true };
}

/**
 * Dismiss a retainer (Retainer Captain action).
 */
async function handleDismissRetainer(
  retainerId: number,
  session: DialogSession,
  io: SocketServer,
): Promise<ActionResult> {
  const { characterId } = session.context;

  try {
    const { dismissRetainer, getPlayerRetainers } = await import('../retainers/retainer-manager.js');
    await dismissRetainer(characterId, retainerId);

    // Broadcast retainer list update
    const retainerRows = await getPlayerRetainers(characterId);
    io.to(`character:${characterId}`).emit('retainers:changed', retainerRows.map(r => ({
      id: r.characterId, name: r.name, tier: r.tier, tierName: r.tierName,
      level: r.level, health: r.health, maxHealth: r.maxHealth, isAvailable: r.health > 0,
    })));

    logger.info(`Retainer Captain: retainer ${retainerId} dismissed by character ${characterId}`);
    return { nextNodeId: 'dismissed' };
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'unknown';
    logger.error(`dismiss_retainer failed: ${msg}`);
    return { nextNodeId: 'farewell' };
  }
}

/**
 * Buy an item by item_key: deduct cash, add to inventory, log transaction.
 */
async function buyItem(
  itemKey: string,
  session: DialogSession,
  io: SocketServer,
): Promise<ActionResult> {
  const { characterId } = session.context;

  // Look up item definition
  const item = await db.queryOne<{ id: number; name: string; base_price: number }>(
    'SELECT id, name, base_price FROM items WHERE item_key = ?',
    [itemKey],
  );
  if (!item) {
    logger.error(`Buy action: item '${itemKey}' not found in DB`);
    return { nextNodeId: 'farewell' };
  }

  const price = Number(item.base_price);

  // Find an empty inventory slot
  const slot = await findFirstEmptySlot(characterId);
  if (slot === null) {
    return { nextNodeId: 'inventory_full' };
  }

  await db.transaction(async (conn) => {
    // Deduct price
    await conn.query(
      'UPDATE character_finances SET cash = cash - ? WHERE character_id = ?',
      [price, characterId],
    );
    // Add item to inventory
    await conn.query(
      'INSERT INTO character_inventory (character_id, item_id, quantity, slot_number) VALUES (?, ?, 1, ?)',
      [characterId, item.id, slot],
    );
    // Log the transaction
    await conn.query(
      `INSERT INTO transactions (character_id, transaction_type, amount, currency_type, description)
       VALUES (?, 'purchase', ?, 'cash', ?)`,
      [characterId, price, `Blacksmith \u2014 ${item.name} (${formatCurrency(price)})`],
    );
  });

  // Broadcast finances update
  const finances = await db.queryOne(
    'SELECT * FROM character_finances WHERE character_id = ?',
    [characterId],
  );
  io.to(`character:${characterId}`).emit('finances:changed', finances);

  // Broadcast inventory update
  const inventory = await fetchFullInventory(characterId);
  io.to(`character:${characterId}`).emit('inventory:changed', inventory);

  // Refresh context
  session.context = await loadContext(characterId);

  logger.info(`Blacksmith: character ${characterId} purchased ${item.name} (${formatCurrency(price)} deducted)`);

  return { nextNodeId: 'purchase_complete' };
}

/**
 * Open a shop interface: query the NPC's shop items and emit to the player.
 */
async function openShop(
  session: DialogSession,
  io: SocketServer,
): Promise<ActionResult> {
  const { characterId, cash } = session.context;
  const itemKeys = session.tree.shopItems;

  if (!itemKeys || itemKeys.length === 0) {
    logger.error(`open_shop: tree '${session.npcType}' has no shopItems defined`);
    return { nextNodeId: 'farewell' };
  }

  // Query all items this shop sells
  const placeholders = itemKeys.map(() => '?').join(', ');
  const items = await db.query(
    `SELECT id, item_key, name, description, icon_url, category, rarity,
            tier, material, slot_type, is_two_handed, weight, base_price, model_data
     FROM items WHERE item_key IN (${placeholders})`,
    itemKeys,
  );

  // Transform for frontend
  const shopItems = (items as Array<{
    id: number; item_key: string; name: string; description: string | null;
    icon_url: string | null; category: string; rarity: string; tier: number;
    material: string | null; slot_type: string | null; is_two_handed: boolean;
    weight: number; base_price: number; model_data: string | null;
  }>).map(row => ({
    id: row.id,
    item_key: row.item_key,
    name: row.name,
    description: row.description,
    icon_url: row.icon_url,
    category: row.category,
    rarity: row.rarity,
    tier: row.tier,
    material: row.material,
    slot_type: row.slot_type,
    is_two_handed: !!row.is_two_handed,
    weight: Number(row.weight),
    base_price: Number(row.base_price),
    model_data: row.model_data
      ? (typeof row.model_data === 'string' ? JSON.parse(row.model_data) : row.model_data)
      : null,
  }));

  // Emit shop data to the character's socket
  io.to(`character:${characterId}`).emit('shop:open', {
    npcName: session.tree.npcName,
    npcType: session.tree.npcType,
    items: shopItems,
    cash,
  });

  // Track open shop for purchase validation
  activeShops.set(characterId, itemKeys);

  logger.info(`Shop opened: ${session.tree.npcName} → character ${characterId} (${shopItems.length} items)`);

  return { close: true };
}

// ── Active shops: characterId → allowed item_keys ────────────

const activeShops = new Map<number, string[]>();

export function getActiveShop(characterId: number): string[] | null {
  return activeShops.get(characterId) ?? null;
}

export function closeShop(characterId: number): void {
  activeShops.delete(characterId);
}

// ── Node resolution ────────────────────────────────────────────

function navigateTo(
  session: DialogSession,
  nodeId: string,
): DialogPayload | { close: true } {
  const node = session.tree.nodes[nodeId];
  if (!node) {
    logger.error(`Dialog node '${nodeId}' not found in tree '${session.npcType}'`);
    closeDialog(session.characterId);
    return { close: true };
  }

  session.currentNodeId = nodeId;
  return resolvePayload(session, node);
}

function resolvePayload(session: DialogSession, node: DialogNode): DialogPayload {
  return {
    npcType: session.tree.npcType,
    npcName: session.tree.npcName,
    npcPortrait: session.tree.npcPortrait ?? null,
    nodeId: node.id,
    npcText: resolvePlaceholders(node.npcText, session.context),
    options: node.options.map(o => ({ id: o.id, text: o.text })),
    closeAfter: node.closeAfter ?? false,
  };
}

function resolvePlaceholders(text: string, ctx: DialogContext): string {
  return text
    .replace(/\{cash\}/g, String(ctx.cash))
    .replace(/\{cashFormatted\}/g, formatCurrency(ctx.cash))
    .replace(/\{health\}/g, String(Math.round(ctx.currentHealth)))
    .replace(/\{maxHealth\}/g, String(Math.round(ctx.maxHealth)))
    .replace(/\{inventorySlots\}/g, String(ctx.inventorySlotsFree))
    .replace(/\{level\}/g, String(ctx.level))
    .replace(/\{xpSegments\}/g, String(ctx.xpSegments));
}

/**
 * Format a cash value (stored in stars) into Dragon/Stag/Star denominations.
 * 1 Dragon = 10,000 Stars, 1 Stag = 100 Stars.
 */
function formatCurrency(stars: number): string {
  const dragons = Math.floor(stars / 10000);
  const stags = Math.floor((stars % 10000) / 100);
  const remaining = stars % 100;

  const parts: string[] = [];
  if (dragons > 0) parts.push(`${dragons} dragon${dragons !== 1 ? 's' : ''}`);
  if (stags > 0) parts.push(`${stags} stag${stags !== 1 ? 's' : ''}`);
  if (remaining > 0 || parts.length === 0) parts.push(`${remaining} star${remaining !== 1 ? 's' : ''}`);

  return parts.join(', ');
}
