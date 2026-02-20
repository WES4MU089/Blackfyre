import { db } from '../db/connection.js';
import { calculateMaxHealth } from '../utils/formulas.js';
import type {
  CombatantStats,
  WoundSeverity,
  YieldThreshold,
  YieldResponse,
  WeaponType,
  ArmorClass,
  ShieldClass,
} from './types.js';
import {
  calculateWeaponStats,
  calculateArmorStats,
  calculateShieldStats,
  getWeaponTierDice,
  getShieldDice,
  DURABILITY_LOSS,
} from './equipment-data.js';

// ============================================
// DB row interfaces
// ============================================

interface CharacterRow {
  id: number;
  name: string;
  yield_threshold: YieldThreshold;
  yield_response: YieldResponse;
}

interface AptitudeRow {
  aptitude_key: string;
  current_value: number;
}

interface EquipmentRow {
  slot_id: string;
  item_id: number;
  tier: number;
  material: string | null;
  is_two_handed: boolean;
  model_data: string | null;
  durability: number | null;
}

interface VitalsRow {
  health: number;
  max_health: number;
}

// ============================================
// Shared loadCombatantStats
// ============================================

/**
 * Load all stats needed by the combat engine for one character.
 * Used by both the REST combat route and WebSocket combat handlers.
 *
 * Equipment stats are computed from tier + class constants (equipment-data.ts),
 * not read directly from model_data. The model_data provides weaponType,
 * armorClass, and shieldClass to feed the compute functions.
 */
export async function loadCombatantStats(characterId: number): Promise<CombatantStats | null> {
  // 1. Character info
  const char = await db.queryOne<CharacterRow>(
    `SELECT id, name, yield_threshold, yield_response FROM characters WHERE id = ? AND is_active = TRUE`,
    [characterId],
  );
  if (!char) return null;

  // 2. Aptitudes (prowess, fortitude, cunning)
  const aptitudes = await db.query<AptitudeRow>(
    `SELECT aptitude_key, current_value FROM character_aptitudes
     WHERE character_id = ? AND aptitude_key IN ('prowess', 'fortitude', 'cunning', 'lore')`,
    [characterId],
  );
  const prowess = aptitudes.find(a => a.aptitude_key === 'prowess')?.current_value ?? 3;
  const fortitude = aptitudes.find(a => a.aptitude_key === 'fortitude')?.current_value ?? 3;
  const cunning = aptitudes.find(a => a.aptitude_key === 'cunning')?.current_value ?? 3;
  const lore = aptitudes.find(a => a.aptitude_key === 'lore')?.current_value ?? 3;

  // 3. Equipment (weapon, armor, shield) — now includes durability
  const equipment = await db.query<EquipmentRow>(
    `SELECT ce.slot_id, ce.item_id, i.tier, i.material, i.is_two_handed, i.model_data,
            ce.durability
     FROM character_equipment ce
     JOIN items i ON ce.item_id = i.id
     WHERE ce.character_id = ? AND ce.slot_id IN ('mainHand', 'armor', 'offHand')`,
    [characterId],
  );

  const mainHand = equipment.find(e => e.slot_id === 'mainHand');
  const armorSlot = equipment.find(e => e.slot_id === 'armor');
  const offHand = equipment.find(e => e.slot_id === 'offHand');

  const parseJson = (raw: string | null): Record<string, unknown> => {
    if (!raw) return {};
    try { return typeof raw === 'string' ? JSON.parse(raw) : raw; }
    catch { return {}; }
  };

  const weaponData = parseJson(mainHand?.model_data ?? null);
  const armorData = parseJson(armorSlot?.model_data ?? null);
  const shieldData = parseJson(offHand?.model_data ?? null);

  // --- Extract type/class from model_data ---
  const weaponType = (weaponData.weaponType as WeaponType) || 'bastardSword';
  const weaponTier = mainHand?.tier ?? 0;
  const isTwoHanded = mainHand?.is_two_handed ?? false;

  const armorTier = armorSlot?.tier ?? 0;
  const armorClass = (armorData.armorClass as ArmorClass) || (armorTier === 0 ? 'none' : 'medium');

  const shieldTier = offHand?.tier ?? 0;
  const shieldClass = (shieldData.shieldClass as ShieldClass) || (shieldTier === 0 ? 'none' : 'medium');
  const hasShield = shieldTier > 0 && !isTwoHanded;

  // --- Compute stats from constants ---
  const weapon = weaponTier > 0
    ? calculateWeaponStats(weaponType, weaponTier, isTwoHanded)
    : calculateWeaponStats(weaponType, 1, isTwoHanded); // fallback to rusty if no weapon tier

  const armor = calculateArmorStats(armorTier, armorClass);
  const shield = hasShield
    ? calculateShieldStats(shieldTier, shieldClass)
    : calculateShieldStats(0, 'none');

  // 4. Vitals
  const vitals = await db.queryOne<VitalsRow>(
    `SELECT health, max_health FROM character_vitals WHERE character_id = ?`,
    [characterId],
  );
  const maxHealth = vitals?.max_health ?? calculateMaxHealth(fortitude);

  // 6. Noble check (for pragmatic yield response)
  const nobleJob = await db.queryOne(
    `SELECT 1 FROM character_jobs cj
     JOIN jobs j ON cj.job_id = j.id
     WHERE cj.character_id = ? AND j.job_key IN ('lord', 'knight')
     LIMIT 1`,
    [characterId],
  );

  // 7. Wound severity (persistent wound state from prior combat)
  const woundRow = await db.queryOne<{ wound_severity: WoundSeverity }>(
    `SELECT wound_severity FROM characters WHERE id = ?`,
    [characterId],
  );

  // --- Derived values (dice pool system) ---
  const totalEncumbrance = weapon.encumbrance + armor.encumbrance + shield.encumbrance;
  const isLightlyArmored = armorTier === 0 || armorClass === 'none' || armorClass === 'light';
  const baseMitigation = armor.mitigation;

  // Defense aptitude: Heavy -> Fortitude, Medium -> max(Fort,Cun), Light/None -> Cunning
  let defenseAptitude: number;
  if (isLightlyArmored) {
    defenseAptitude = cunning;
  } else if (armorClass === 'medium') {
    defenseAptitude = Math.max(fortitude, cunning);
  } else {
    defenseAptitude = fortitude;
  }

  // Pool construction values
  const weaponTierBonus = getWeaponTierDice(weaponTier);
  const shieldDice = hasShield ? getShieldDice(shieldTier, shieldClass) : 0;
  const attackPoolBase = prowess + weaponTierBonus;
  const defensePoolBase = defenseAptitude + shieldDice;

  // --- Durability ---
  const weaponDurLoss = weaponTier > 0 ? (DURABILITY_LOSS[weaponTier] ?? 3) : 0;
  const armorDurLoss = armorTier > 0 ? (DURABILITY_LOSS[armorTier] ?? 3) : 0;
  const shieldDurLoss = hasShield && shieldTier > 0 ? (DURABILITY_LOSS[shieldTier] ?? 3) : 0;

  return {
    characterId: char.id,
    characterName: char.name,
    prowess,
    fortitude,
    cunning,
    lore,

    weaponType,
    weaponTier,
    weaponMaterial: mainHand?.material ?? '',
    isTwoHanded,
    weapon,

    armorTier,
    armorClass,
    armor,

    shieldTier,
    shieldClass,
    shield,
    hasShield,

    attackPoolBase,
    defensePoolBase,
    defenseAptitude,
    weaponTierBonus,
    shieldDice,
    totalEncumbrance,
    isLightlyArmored,
    baseMitigation,
    totalMitigation: baseMitigation,

    durability: {
      weapon: { current: Number(mainHand?.durability ?? 100), loss: weaponDurLoss },
      armor: { current: Number(armorSlot?.durability ?? 100), loss: armorDurLoss },
      shield: { current: Number(offHand?.durability ?? 100), loss: shieldDurLoss },
    },

    currentHealth: Number(vitals?.health ?? maxHealth),
    maxHealth: Number(maxHealth),
    yieldThreshold: char.yield_threshold || 'brave',
    yieldResponse: char.yield_response || 'pragmatic',
    isNoble: !!nobleJob,
    woundSeverity: woundRow?.wound_severity ?? 'healthy',
  };
}
