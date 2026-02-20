/**
 * Retainer Manager — hire, list, dismiss, and ownership queries for retainers.
 *
 * Tiered system: 5 tiers with player-allocated aptitude points.
 * Retainers are full character records owned by a player's character.
 * They reuse the entire character/aptitudes/equipment/vitals pipeline
 * so the combat engine treats them identically to any other combatant.
 */

import { db } from '../db/connection.js';
import { logger } from '../utils/logger.js';
import { calculateMaxHealth } from '../utils/formulas.js';

// ── Constants ────────────────────────────────────────────────

const VALID_APTITUDES = ['prowess', 'fortitude', 'command', 'cunning', 'stewardship', 'presence', 'lore', 'faith'] as const;
const MAX_RETAINERS = 4;
const RETAINER_APT_MIN = 1;
/** Default fallback; actual cap comes from retainer_tiers.aptitude_cap */
const RETAINER_APT_MAX = 7;
const TIER_APT_CAPS: Record<number, number> = { 1: 4, 2: 5, 3: 6, 4: 7, 5: 8 };
const RETAINER_LEVEL_CAP = 10;

// ── Types ─────────────────────────────────────────────────────

export interface RetainerTier {
  tier: number;
  name: string;
  hireCost: number;
  aptitudeBudget: number;
  aptitudeCap: number;
  weaponKey: string;
  armorKey: string | null;
  shieldKey: string | null;
  description: string | null;
}

export interface RetainerInfo {
  characterId: number;
  name: string;
  tier: number;
  tierName: string;
  level: number;
  health: number;
  maxHealth: number;
}

export interface RetainerDetail {
  characterId: number;
  name: string;
  tier: number;
  tierName: string;
  aptitudeCap: number;
  level: number;
  xpSegments: number;
  health: number;
  maxHealth: number;
  unspentAptitudePoints: number;
  aptitudes: { key: string; baseValue: number; currentValue: number }[];
  equipment: { slotId: string; itemId: number; itemKey: string; itemName: string; iconUrl: string | null }[];
  inventory: { id: number; itemId: number; itemKey: string; itemName: string; iconUrl: string | null; quantity: number; slotNumber: number }[];
}

interface TierRow {
  tier: number;
  name: string;
  hire_cost: number;
  aptitude_budget: number;
  aptitude_cap: number;
  weapon_key: string;
  armor_key: string | null;
  shield_key: string | null;
  description: string | null;
}

// ── Ownership cache ───────────────────────────────────────────

const ownerCache = new Map<number, number | null>();

// ── Public API ────────────────────────────────────────────────

/**
 * Get all retainer tiers available for hire.
 */
export async function getRetainerTiers(): Promise<RetainerTier[]> {
  const rows = await db.query<TierRow>(
    'SELECT tier, name, hire_cost, aptitude_budget, aptitude_cap, weapon_key, armor_key, shield_key, description FROM retainer_tiers ORDER BY tier ASC',
  );

  return rows.map(r => ({
    tier: r.tier,
    name: r.name,
    hireCost: Number(r.hire_cost),
    aptitudeBudget: r.aptitude_budget,
    aptitudeCap: r.aptitude_cap,
    weaponKey: r.weapon_key,
    armorKey: r.armor_key,
    shieldKey: r.shield_key,
    description: r.description,
  }));
}

/**
 * Get all active retainers owned by a character.
 */
export async function getPlayerRetainers(ownerCharacterId: number): Promise<RetainerInfo[]> {
  const rows = await db.query<{
    id: number; name: string; retainer_tier: number;
    tier_name: string; level: number; health: number; max_health: number;
  }>(
    `SELECT c.id, c.name, c.retainer_tier,
            rt.name AS tier_name, c.level,
            COALESCE(cv.health, 0) AS health,
            COALESCE(cv.max_health, 0) AS max_health
     FROM characters c
     JOIN retainer_tiers rt ON c.retainer_tier = rt.tier
     LEFT JOIN character_vitals cv ON c.id = cv.character_id
     WHERE c.owner_character_id = ? AND c.is_active = TRUE
     ORDER BY c.id ASC`,
    [ownerCharacterId],
  );

  return rows.map(r => ({
    characterId: r.id,
    name: r.name,
    tier: r.retainer_tier,
    tierName: r.tier_name,
    level: r.level,
    health: Number(r.health),
    maxHealth: Number(r.max_health),
  }));
}

/**
 * Get all active retainer characters owned by an NPC (no tier join needed).
 */
export async function getNpcRetainers(npcCharacterId: number): Promise<{
  characterId: number;
  name: string;
}[]> {
  const rows = await db.query<{ id: number; name: string }>(
    `SELECT id, name FROM characters
     WHERE owner_character_id = ? AND is_npc = 1 AND is_active = TRUE
     ORDER BY id ASC`,
    [npcCharacterId],
  );
  return rows.map(r => ({ characterId: r.id, name: r.name }));
}

/**
 * Get full retainer detail for the management window.
 * Validates ownership before returning data.
 */
export async function getRetainerDetail(
  ownerCharacterId: number,
  retainerCharacterId: number,
): Promise<RetainerDetail> {
  // Validate ownership
  const charRow = await db.queryOne<{
    id: number; name: string; retainer_tier: number; level: number;
    xp_segments: number; owner_character_id: number;
    unspent_aptitude_points: number;
  }>(
    `SELECT id, name, retainer_tier, level, xp_segments, owner_character_id, unspent_aptitude_points
     FROM characters WHERE id = ? AND is_active = TRUE`,
    [retainerCharacterId],
  );
  if (!charRow || Number(charRow.owner_character_id) !== ownerCharacterId) {
    throw new Error('NOT_YOUR_RETAINER');
  }

  // Tier info
  const tierRow = await db.queryOne<{ name: string; aptitude_cap: number }>(
    'SELECT name, aptitude_cap FROM retainer_tiers WHERE tier = ?',
    [charRow.retainer_tier],
  );

  // Vitals
  const vitals = await db.queryOne<{ health: number; max_health: number }>(
    'SELECT health, max_health FROM character_vitals WHERE character_id = ?',
    [retainerCharacterId],
  );

  // Aptitudes
  const aptitudes = await db.query<{ aptitude_key: string; base_value: number; current_value: number }>(
    `SELECT aptitude_key, base_value, current_value FROM character_aptitudes
     WHERE character_id = ?
     ORDER BY FIELD(aptitude_key, 'prowess','fortitude','command','cunning','stewardship','presence','lore','faith')`,
    [retainerCharacterId],
  );

  // Equipment
  const equipment = await db.query<{
    slot_id: string; item_id: number; item_key: string; name: string; icon_url: string | null;
  }>(
    `SELECT ce.slot_id, ce.item_id, i.item_key, i.name, i.icon_url
     FROM character_equipment ce
     JOIN items i ON ce.item_id = i.id
     WHERE ce.character_id = ?`,
    [retainerCharacterId],
  );

  // Inventory
  const inventory = await db.query<{
    id: number; item_id: number; item_key: string; name: string;
    icon_url: string | null; quantity: number; slot_number: number;
  }>(
    `SELECT ci.id, ci.item_id, i.item_key, i.name, i.icon_url, ci.quantity, ci.slot_number
     FROM character_inventory ci
     JOIN items i ON ci.item_id = i.id
     WHERE ci.character_id = ?
     ORDER BY ci.slot_number ASC`,
    [retainerCharacterId],
  );

  return {
    characterId: charRow.id,
    name: charRow.name,
    tier: charRow.retainer_tier,
    tierName: tierRow?.name ?? `Tier ${charRow.retainer_tier}`,
    aptitudeCap: tierRow?.aptitude_cap ?? TIER_APT_CAPS[charRow.retainer_tier] ?? RETAINER_APT_MAX,
    level: charRow.level,
    xpSegments: Number(charRow.xp_segments),
    health: Number(vitals?.health ?? 0),
    maxHealth: Number(vitals?.max_health ?? 0),
    unspentAptitudePoints: charRow.unspent_aptitude_points ?? 0,
    aptitudes: aptitudes.map(a => ({
      key: a.aptitude_key,
      baseValue: a.base_value,
      currentValue: a.current_value,
    })),
    equipment: equipment.map(e => ({
      slotId: e.slot_id,
      itemId: e.item_id,
      itemKey: e.item_key,
      itemName: e.name,
      iconUrl: e.icon_url,
    })),
    inventory: inventory.map(inv => ({
      id: inv.id,
      itemId: inv.item_id,
      itemKey: inv.item_key,
      itemName: inv.name,
      iconUrl: inv.icon_url,
      quantity: inv.quantity,
      slotNumber: inv.slot_number,
    })),
  };
}

/**
 * Hire a retainer. Player allocates aptitude points from the tier's budget.
 * Creates a full character record with aptitudes, equipment, vitals, and finances.
 * Deducts gold from the owner.
 */
export async function hireRetainer(
  ownerCharacterId: number,
  tier: number,
  retainerName: string,
  aptitudes: Record<string, number>,
): Promise<RetainerInfo> {
  // 1. Load tier definition
  const tierDef = await db.queryOne<TierRow>(
    'SELECT * FROM retainer_tiers WHERE tier = ?',
    [tier],
  );
  if (!tierDef) throw new Error('INVALID_TIER');

  // 2. Validate aptitudes (per-tier cap)
  const aptCap = tierDef.aptitude_cap ?? TIER_APT_CAPS[tier] ?? RETAINER_APT_MAX;
  for (const key of VALID_APTITUDES) {
    if (aptitudes[key] === undefined) throw new Error(`MISSING_APTITUDE:${key}`);
    const val = aptitudes[key];
    if (typeof val !== 'number' || !Number.isInteger(val)) throw new Error(`INVALID_APTITUDE:${key}`);
    if (val < RETAINER_APT_MIN || val > aptCap) {
      throw new Error(`APTITUDE_OUT_OF_RANGE:${key}`);
    }
  }
  const total = VALID_APTITUDES.reduce((sum, key) => sum + aptitudes[key], 0);
  if (total !== tierDef.aptitude_budget) {
    throw new Error(`WRONG_POINT_TOTAL:expected=${tierDef.aptitude_budget},got=${total}`);
  }

  // 3. Check retainer limit (max 4)
  const countRow = await db.queryOne<{ cnt: number }>(
    'SELECT COUNT(*) AS cnt FROM characters WHERE owner_character_id = ? AND is_active = TRUE',
    [ownerCharacterId],
  );
  if (Number(countRow?.cnt ?? 0) >= MAX_RETAINERS) throw new Error('RETAINER_LIMIT_REACHED');

  // 4. Check owner can afford it
  const finances = await db.queryOne<{ cash: number }>(
    'SELECT cash FROM character_finances WHERE character_id = ?',
    [ownerCharacterId],
  );
  if (Number(finances?.cash ?? 0) < tierDef.hire_cost) throw new Error('INSUFFICIENT_GOLD');

  // 5. Get the owner's player_id and position
  const owner = await db.queryOne<{ player_id: number }>(
    'SELECT player_id FROM characters WHERE id = ?',
    [ownerCharacterId],
  );
  if (!owner) throw new Error('OWNER_NOT_FOUND');

  const ownerPos = await db.queryOne<{ region: string; pos_x: number; pos_y: number; pos_z: number }>(
    'SELECT region, pos_x, pos_y, pos_z FROM character_positions WHERE character_id = ?',
    [ownerCharacterId],
  );

  // 6. Create retainer in a transaction
  const maxHealth = calculateMaxHealth(aptitudes.fortitude);

  const retainerId = await db.transaction(async (conn) => {
    // Deduct gold from owner
    await conn.query(
      'UPDATE character_finances SET cash = cash - ? WHERE character_id = ?',
      [tierDef.hire_cost, ownerCharacterId],
    );

    // Log transaction
    await conn.query(
      `INSERT INTO transactions (character_id, transaction_type, amount, currency_type, description)
       VALUES (?, 'purchase', ?, 'cash', ?)`,
      [ownerCharacterId, tierDef.hire_cost, `Hired retainer: ${retainerName} (${tierDef.name})`],
    );

    // Create character record
    const result = await conn.query(
      `INSERT INTO characters (player_id, name, level, xp_segments, is_active, is_npc,
                               owner_character_id, retainer_tier,
                               yield_threshold, yield_response)
       VALUES (?, ?, 1, 0, TRUE, 1, ?, ?, 'brave', 'pragmatic')`,
      [owner.player_id, retainerName, ownerCharacterId, tier],
    );
    const charId = Number(result.insertId);

    // Insert aptitudes
    for (const key of VALID_APTITUDES) {
      await conn.query(
        'INSERT INTO character_aptitudes (character_id, aptitude_key, base_value, current_value) VALUES (?, ?, ?, ?)',
        [charId, key, aptitudes[key], aptitudes[key]],
      );
    }

    // Insert vitals
    await conn.query(
      `INSERT INTO character_vitals (character_id, health, max_health, armor, max_armor,
                                     stamina, max_stamina, hunger, thirst, stress, oxygen)
       VALUES (?, ?, ?, 0.00, 100.00, 100.00, 100.00, 100.00, 100.00, 0.00, 100.00)`,
      [charId, maxHealth, maxHealth],
    );

    // Equip starting gear from tier definition
    if (tierDef.weapon_key) {
      const item = await conn.query('SELECT id FROM items WHERE item_key = ?', [tierDef.weapon_key]);
      if (item.length > 0) {
        await conn.query(
          'INSERT INTO character_equipment (character_id, slot_id, item_id, durability) VALUES (?, ?, ?, 100.00)',
          [charId, 'mainHand', item[0].id],
        );
      }
    }
    if (tierDef.armor_key) {
      const item = await conn.query('SELECT id FROM items WHERE item_key = ?', [tierDef.armor_key]);
      if (item.length > 0) {
        await conn.query(
          'INSERT INTO character_equipment (character_id, slot_id, item_id, durability) VALUES (?, ?, ?, 100.00)',
          [charId, 'armor', item[0].id],
        );
      }
    }
    if (tierDef.shield_key) {
      const item = await conn.query('SELECT id FROM items WHERE item_key = ?', [tierDef.shield_key]);
      if (item.length > 0) {
        await conn.query(
          'INSERT INTO character_equipment (character_id, slot_id, item_id, durability) VALUES (?, ?, ?, 100.00)',
          [charId, 'offHand', item[0].id],
        );
      }
    }

    // Insert finances (0 — retainers don't have their own money)
    await conn.query(
      'INSERT INTO character_finances (character_id, cash, bank, crypto, dirty_money) VALUES (?, 0, 0, 0, 0)',
      [charId],
    );

    // Copy owner's position
    if (ownerPos) {
      await conn.query(
        'INSERT INTO character_positions (character_id, region, pos_x, pos_y, pos_z) VALUES (?, ?, ?, ?, ?)',
        [charId, ownerPos.region, ownerPos.pos_x, ownerPos.pos_y, ownerPos.pos_z],
      );
    }

    // Insert reputation (neutral)
    await conn.query(
      'INSERT INTO character_reputation (character_id, honor, chivalry, dread, renown) VALUES (?, 0, 0, 0, 0)',
      [charId],
    );

    return charId;
  });

  // Update ownership cache
  ownerCache.set(retainerId, ownerCharacterId);

  logger.info(
    `Retainer hired: "${retainerName}" (T${tier} ${tierDef.name}) for character ${ownerCharacterId}, ` +
    `cost ${tierDef.hire_cost} gold, new char ID ${retainerId}`,
  );

  return {
    characterId: retainerId,
    name: retainerName,
    tier,
    tierName: tierDef.name,
    level: 1,
    health: maxHealth,
    maxHealth,
  };
}

/**
 * Dismiss a retainer. Sets is_active = FALSE. No gold refund.
 */
export async function dismissRetainer(
  ownerCharacterId: number,
  retainerCharacterId: number,
): Promise<void> {
  // Validate ownership
  const row = await db.queryOne<{ owner_character_id: number }>(
    'SELECT owner_character_id FROM characters WHERE id = ? AND is_active = TRUE',
    [retainerCharacterId],
  );
  if (!row || Number(row.owner_character_id) !== ownerCharacterId) {
    throw new Error('NOT_YOUR_RETAINER');
  }

  await db.execute(
    'UPDATE characters SET is_active = FALSE WHERE id = ?',
    [retainerCharacterId],
  );

  // Clear cache
  ownerCache.delete(retainerCharacterId);

  logger.info(`Retainer ${retainerCharacterId} dismissed by owner ${ownerCharacterId}`);
}

/**
 * Check if a character is a retainer owned by a specific owner.
 * Result is cached after first lookup.
 */
export async function isRetainerOf(
  characterId: number,
  ownerCharacterId: number,
): Promise<boolean> {
  const ownerId = await getRetainerOwner(characterId);
  return ownerId === ownerCharacterId;
}

/**
 * Get the owner character ID for a retainer, or null if not a retainer.
 * Result is cached after first lookup.
 */
export async function getRetainerOwner(characterId: number): Promise<number | null> {
  if (ownerCache.has(characterId)) {
    return ownerCache.get(characterId)!;
  }

  const row = await db.queryOne<{ owner_character_id: number | null }>(
    'SELECT owner_character_id FROM characters WHERE id = ?',
    [characterId],
  );

  const ownerId = row?.owner_character_id ?? null;
  ownerCache.set(characterId, ownerId);
  return ownerId;
}

/**
 * Check if a character is any player's retainer (has a non-null owner).
 * Uses the ownership cache.
 */
export async function isRetainerCharacter(characterId: number): Promise<boolean> {
  const owner = await getRetainerOwner(characterId);
  return owner !== null;
}

// ── Exported constants for other modules ─────────────────────

/**
 * Get the aptitude cap for a specific retainer tier.
 * Falls back to RETAINER_APT_MAX if tier is unknown.
 */
export function getRetainerAptCap(tier: number): number {
  return TIER_APT_CAPS[tier] ?? RETAINER_APT_MAX;
}

export { RETAINER_APT_MAX, RETAINER_LEVEL_CAP, TIER_APT_CAPS };
