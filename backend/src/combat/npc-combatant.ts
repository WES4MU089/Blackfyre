/**
 * NPC Combatant AI — handles automated turn-taking for NPC characters in combat.
 *
 * - `scheduleNpcTurn()` fires after a 1.5–2s delay to simulate "thinking".
 * - `processNpcAction()` uses an AI decision tree (protect leader, smart targeting).
 * - `triggerPostCombatDialog()` opens a win/loss dialog with the player.
 * - `resetNpcVitals()` restores HP to max after combat.
 * - `isNpcCharacter()` checks the DB `is_npc` flag (cached in-memory).
 */

import { Server as SocketServer } from 'socket.io';
import { db } from '../db/connection.js';
import { logger } from '../utils/logger.js';
import * as sessionManager from './session-manager.js';
import { generateCombatEmotes, decorateRetainerInEmote } from './combat-narrator.js';
import { broadcastProximityEmote } from '../websocket/proximity-broadcast.js';
import type { TacticalAction, CombatSessionCombatant } from './types.js';
import { serializeActionResult } from './serialize-result.js';

// ── NPC flag cache ───────────────────────────────────────────

const npcCache = new Map<number, boolean>();

/**
 * Check if a character is an NPC. Caches the result after first lookup.
 */
export async function isNpcCharacter(characterId: number): Promise<boolean> {
  const cached = npcCache.get(characterId);
  if (cached !== undefined) return cached;

  const row = await db.queryOne<{ is_npc: number }>(
    'SELECT is_npc FROM characters WHERE id = ?',
    [characterId],
  );

  const isNpc = row?.is_npc === 1;
  npcCache.set(characterId, isNpc);
  return isNpc;
}

/**
 * Check if a character is a retainer (has a non-null owner_character_id).
 * Retainers are NPCs but should NOT auto-act — they're player-controlled.
 */
export async function isRetainerCharacter(characterId: number): Promise<boolean> {
  const { isRetainerCharacter: check } = await import('../retainers/retainer-manager.js');
  return check(characterId);
}

/**
 * Check if a character should auto-act in combat.
 * True for:
 *   - NPC leaders (is_npc + no owner)
 *   - Retainers whose owner is an NPC (NPC-owned retainers)
 * False for:
 *   - Player characters
 *   - Player-owned retainers (player controls them manually)
 */
export async function isAutoNpc(characterId: number): Promise<boolean> {
  const isNpc = await isNpcCharacter(characterId);
  if (!isNpc) return false;

  const isRetainer = await isRetainerCharacter(characterId);
  if (!isRetainer) return true; // NPC leader — auto-act

  // It's a retainer. Check if the owner is also an NPC.
  const { getRetainerOwner } = await import('../retainers/retainer-manager.js');
  const ownerId = await getRetainerOwner(characterId);
  if (ownerId === null) return true; // Shouldn't happen, but safe fallback

  return isNpcCharacter(ownerId);
}

// ── Turn scheduling ──────────────────────────────────────────

const activeTimers = new Map<string, ReturnType<typeof setTimeout>>();

/**
 * Schedule an NPC turn with a 1.5–2s delay to simulate reaction time.
 */
export function scheduleNpcTurn(
  sessionId: number,
  characterId: number,
  io: SocketServer,
): void {
  const key = `${sessionId}:${characterId}`;

  // Clear any existing timer for this NPC turn
  const existing = activeTimers.get(key);
  if (existing) clearTimeout(existing);

  const delay = 1500 + Math.random() * 500; // 1.5–2.0 seconds

  const timer = setTimeout(() => {
    activeTimers.delete(key);
    processNpcAction(sessionId, characterId, io).catch(err => {
      logger.error(`NPC turn failed (session ${sessionId}, char ${characterId}):`, err);
    });
  }, delay);

  activeTimers.set(key, timer);
}

/**
 * Cancel any pending NPC timers for a session (e.g. on session end).
 */
export function cancelNpcTimers(sessionId: number): void {
  for (const [key, timer] of activeTimers) {
    if (key.startsWith(`${sessionId}:`)) {
      clearTimeout(timer);
      activeTimers.delete(key);
    }
  }
}

// ── NPC AI decision tree ─────────────────────────────────────

interface NpcDecision {
  actionType: TacticalAction;
  targetCharacterId: number;
}

/**
 * Choose an NPC's action based on combat state.
 *
 * Decision tree:
 * 1. Retainers: if leader is alive and unprotected → PROTECT leader.
 * 2. Otherwise: ATTACK using smart targeting (lowest-health priority).
 */
function chooseNpcAction(
  actor: CombatSessionCombatant,
  combatants: Map<number, CombatSessionCombatant>,
): NpcDecision | null {
  const enemies = Array.from(combatants.values()).filter(
    c => c.team !== actor.team && c.isAlive && !c.isYielded,
  );
  if (enemies.length === 0) return null;

  // Retainers: protect leader if unprotected
  if (actor.ownerCharacterId !== null) {
    const leader = combatants.get(actor.ownerCharacterId);
    if (leader && leader.isAlive && !leader.isYielded) {
      const leaderAlreadyProtected = Array.from(combatants.values()).some(
        c => c.characterId !== actor.characterId
          && c.isAlive
          && c.protectingId === leader.characterId,
      );

      if (!leaderAlreadyProtected) {
        return {
          actionType: 'protect',
          targetCharacterId: leader.characterId,
        };
      }
    }
  }

  // Smart attack targeting
  return {
    actionType: 'attack',
    targetCharacterId: chooseAttackTarget(actor, enemies),
  };
}

/**
 * Pick the best attack target.
 * If engaged → lowest-health engaged enemy.
 * If not engaged → lowest-health enemy globally.
 */
function chooseAttackTarget(
  actor: CombatSessionCombatant,
  enemies: CombatSessionCombatant[],
): number {
  const engagedEnemies = enemies.filter(e => actor.engagedTo.includes(e.characterId));

  if (engagedEnemies.length > 0) {
    engagedEnemies.sort((a, b) => a.currentHealth - b.currentHealth);
    return engagedEnemies[0].characterId;
  }

  enemies.sort((a, b) => a.currentHealth - b.currentHealth);
  return enemies[0].characterId;
}

// ── NPC action processing ────────────────────────────────────

/**
 * Process an NPC's combat turn using the AI decision tree.
 */
async function processNpcAction(
  sessionId: number,
  characterId: number,
  io: SocketServer,
): Promise<void> {
  const session = sessionManager.getSession(sessionId);
  if (!session || session.status !== 'active') return;

  // Verify it's still this NPC's turn
  const currentTurnId = sessionManager.getCurrentTurnCharacterId(sessionId);
  if (currentTurnId !== characterId) return;

  const actor = session.combatants.get(characterId);
  if (!actor || !actor.isAlive || actor.isYielded) return;

  // Note: stun is handled by advanceTurn() which auto-skips stunned combatants,
  // so by the time we get here the NPC is guaranteed not to be stunned.

  // AI decision tree: protect leader or smart attack targeting
  const decision = chooseNpcAction(actor, session.combatants);
  if (!decision) return;

  try {
    const { result, roundStart, sessionEnded, nextTurnCharacterId } =
      await sessionManager.processAction(sessionId, characterId, decision.actionType, decision.targetCharacterId);

    const combatRoom = `combat:${sessionId}`;

    // Broadcast action result with updated combatant state
    const updatedCombatants = Array.from(session.combatants.values()).map(c => ({
      characterId: c.characterId,
      characterName: c.characterName,
      team: c.team,
      initiative: c.initiative,
      currentHealth: c.currentHealth,
      maxHealth: c.maxHealth,
      isAlive: c.isAlive,
      isYielded: c.isYielded,
      statusEffects: c.statusEffects,
      engagedTo: c.engagedTo,
      protectingId: c.protectingId,
      isBracing: c.isBracing,
      ownerCharacterId: c.ownerCharacterId,
    }));
    io.to(combatRoom).emit('combat:action-result', { sessionId, result: serializeActionResult(result), combatants: updatedCombatants });

    // Generate and broadcast IC emotes
    try {
      const targetFallen = result.targetCharacterId !== null &&
        session.combatants.get(result.targetCharacterId!)?.isAlive === false;
      const emotes = generateCombatEmotes(result, { targetFallen });

      // Build name→team and retainer→owner maps for chat highlighting
      const combatantTeams: Record<string, number> = {};
      const retainerOwners: Record<string, string> = {};
      for (const [, c] of session.combatants) {
        combatantTeams[c.characterName] = c.team;
        if (c.ownerCharacterId !== null) {
          const owner = session.combatants.get(c.ownerCharacterId);
          if (owner) retainerOwners[c.characterName] = owner.characterName;
        }
      }

      for (let emoteText of emotes) {
        emoteText = decorateRetainerInEmote(emoteText, result.actorName, retainerOwners);
        await broadcastProximityEmote(
          io, result.actorCharacterId, emoteText,
          'Combat', null,
          session.region, 50, 0,
          { combatantTeams, retainerOwners },
        );
      }
    } catch (emoteErr) {
      logger.error('NPC combat emote broadcast failed:', emoteErr);
    }

    // Broadcast round start if new round (with combatant state)
    if (roundStart) {
      const roundCombatants = Array.from(session.combatants.values()).map(c => ({
        characterId: c.characterId,
        characterName: c.characterName,
        team: c.team,
        initiative: c.initiative,
        currentHealth: c.currentHealth,
        maxHealth: c.maxHealth,
        isAlive: c.isAlive,
        isYielded: c.isYielded,
        statusEffects: c.statusEffects,
        engagedTo: c.engagedTo,
        protectingId: c.protectingId,
        isBracing: c.isBracing,
        ownerCharacterId: c.ownerCharacterId,
      }));
      io.to(combatRoom).emit('combat:round-start', { sessionId, ...roundStart, combatants: roundCombatants });
    }

    // Check for defeated combatants
    for (const [, c] of session.combatants) {
      if (!c.isAlive && result.targetCharacterId === c.characterId) {
        io.to(combatRoom).emit('combat:combatant-defeated', {
          sessionId,
          characterId: c.characterId,
          killedBy: result.actorCharacterId,
        });
      }
    }

    if (sessionEnded) {
      io.to(combatRoom).emit('combat:session-end', {
        sessionId,
        winningTeam: session.winningTeam ?? null,
      });

      // Handle NPC post-combat (dialog + vitals reset)
      await handleNpcPostCombat(sessionId, session.winningTeam, io);
    } else if (nextTurnCharacterId !== null) {
      io.to(combatRoom).emit('combat:turn-start', {
        sessionId,
        characterId: nextTurnCharacterId,
        round: session.currentRound ?? 1,
      });

      // If the next turn is also an auto-AI NPC (not a retainer), schedule their turn
      if (await isAutoNpc(nextTurnCharacterId)) {
        scheduleNpcTurn(sessionId, nextTurnCharacterId, io);
      }
    }
  } catch (err) {
    logger.error(`NPC action error (session ${sessionId}, char ${characterId}):`, err);
  }
}

// ── Post-combat ──────────────────────────────────────────────

/**
 * After a combat session ends, check for NPC combatants, reset their vitals,
 * and trigger post-combat dialog with the player(s).
 */
export async function handleNpcPostCombat(
  sessionId: number,
  winningTeam: number | null,
  io: SocketServer,
): Promise<void> {
  const session = sessionManager.getSession(sessionId);
  // Session may already be cleaned up by completeSession(); use combatants from before
  // We need to find which characters were NPC and which were players.
  // Since the session might be gone, we query the DB.
  try {
    const combatants = await db.query<{
      character_id: number; team: number;
    }>(
      'SELECT character_id, team FROM combat_session_combatants WHERE session_id = ?',
      [sessionId],
    );

    const npcIds: number[] = [];
    const playerIds: number[] = [];

    for (const c of combatants) {
      if (await isNpcCharacter(c.character_id)) {
        npcIds.push(c.character_id);
      } else {
        playerIds.push(c.character_id);
      }
    }

    if (npcIds.length === 0) return;

    // Reset NPC vitals
    for (const npcId of npcIds) {
      await resetNpcVitals(npcId);
    }

    // Trigger post-combat dialog with each player
    // NPC was on team 2, so if team 1 won, the player won
    for (const playerId of playerIds) {
      const playerCombatant = combatants.find(c => c.character_id === playerId);
      if (!playerCombatant) continue;

      const playerWon = winningTeam === playerCombatant.team;
      await triggerPostCombatDialog(playerId, playerWon, io);
    }
  } catch (err) {
    logger.error(`NPC post-combat handling failed for session ${sessionId}:`, err);
  }
}

/**
 * Trigger a post-combat dialog with a player. Sends the NPC dialog event
 * to the player's character socket channel.
 */
async function triggerPostCombatDialog(
  playerCharacterId: number,
  playerWon: boolean,
  io: SocketServer,
): Promise<void> {
  // Import dialog engine lazily to avoid circular dependencies
  const { startDialog, loadContext, getTree } = await import('../npc/dialog-engine.js');

  const tree = getTree('sparring_soldier');
  if (!tree) {
    logger.error('sparring_soldier dialog tree not found');
    return;
  }

  const context = await loadContext(playerCharacterId);
  const nodeId = playerWon ? 'post_combat_win' : 'post_combat_loss';

  // Start dialog at the appropriate post-combat node
  const session = {
    characterId: context.characterId,
    npcType: tree.npcType,
    tree,
    currentNodeId: nodeId,
    context,
  };

  // We need to send the dialog payload directly since startDialog starts at greeting
  const node = tree.nodes[nodeId];
  if (!node) {
    logger.error(`Post-combat node '${nodeId}' not found in sparring_soldier tree`);
    return;
  }

  // Emit dialog payload to player
  io.to(`character:${playerCharacterId}`).emit('npc:dialog', {
    npcType: tree.npcType,
    npcName: tree.npcName,
    npcPortrait: tree.npcPortrait ?? null,
    nodeId: node.id,
    npcText: node.npcText,
    options: node.options.map(o => ({ id: o.id, text: o.text })),
    closeAfter: node.closeAfter ?? false,
  });

  logger.info(`Post-combat dialog sent to character ${playerCharacterId} (${playerWon ? 'win' : 'loss'})`);
}

/**
 * Reset an NPC's vitals to full health after combat.
 */
export async function resetNpcVitals(characterId: number): Promise<void> {
  await db.execute(
    'UPDATE character_vitals SET health = max_health WHERE character_id = ?',
    [characterId],
  );

  // Also reset durability to 100 for NPC equipment
  await db.execute(
    'UPDATE character_equipment SET durability = 100.00 WHERE character_id = ?',
    [characterId],
  );

  logger.info(`NPC vitals reset for character ${characterId}`);
}
