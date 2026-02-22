// ============================================
// Equipment Constants — from admin-battle.js bible
// ============================================

import type { WeaponType, ArmorClass, ShieldClass, WeaponStats, ArmorStats, ShieldStats } from './types.js';

// --- Weapon Tiers (material quality) ---

export interface WeaponTierData {
  name: string;
  penBase1H: number;
  penBase2H: number;
  encumbrance1H: number;
  encumbrance2H: number;
  durabilityLoss: number;
  noBluntBonus?: boolean;
}

export const WEAPON_TIERS: Record<number, WeaponTierData> = {
  1: { name: 'Rusty', penBase1H: 2, penBase2H: 5, encumbrance1H: 0, encumbrance2H: -5, durabilityLoss: 5 },
  2: { name: 'Iron', penBase1H: 7, penBase2H: 10, encumbrance1H: 0, encumbrance2H: -5, durabilityLoss: 3 },
  3: { name: 'Steel', penBase1H: 12, penBase2H: 15, encumbrance1H: 0, encumbrance2H: -5, durabilityLoss: 2 },
  4: { name: 'Castle-Forged', penBase1H: 17, penBase2H: 20, encumbrance1H: 0, encumbrance2H: -5, durabilityLoss: 1 },
  5: { name: 'Valyrian', penBase1H: 22, penBase2H: 26, encumbrance1H: 0, encumbrance2H: 0, durabilityLoss: 0, noBluntBonus: true },
};

// --- Weapon Types ---

export interface WeaponTypeData {
  name: string;
  penMod: number;
  baseDamage: number;
  twoHanded: boolean;
  critEffect: string | string[];
  critBonus?: number;
  slashing?: boolean;
  armorPiercing?: boolean;
  bonusVsHeavy?: number;
  encumbranceMod?: number;
  noEncumbrance?: boolean;
}

export const WEAPON_TYPES: Record<WeaponType, WeaponTypeData> = {
  dagger:       { name: 'Dagger', penMod: -3, baseDamage: 10, twoHanded: false, noEncumbrance: true, armorPiercing: true, slashing: true, critEffect: 'bleeding', critBonus: 5 },
  bastardSword: { name: 'Bastard Sword', penMod: -2, baseDamage: 14, twoHanded: false, slashing: true, critEffect: 'bleeding' },
  greatsword:   { name: 'Greatsword', penMod: -3, baseDamage: 15, twoHanded: true, slashing: true, critEffect: 'bleeding' },
  battleAxe1H:  { name: 'Battle Axe', penMod: 5, baseDamage: 16, twoHanded: false, encumbranceMod: -2, critEffect: 'sundered' },
  battleAxe2H:  { name: 'Greataxe', penMod: 4, baseDamage: 18, twoHanded: true, encumbranceMod: -3, critEffect: 'sundered' },
  warhammer1H:  { name: 'Warhammer', penMod: 8, baseDamage: 17, twoHanded: false, bonusVsHeavy: 5, encumbranceMod: -5, critEffect: 'stunned' },
  warhammer2H:  { name: 'Great Warhammer', penMod: 10, baseDamage: 18, twoHanded: true, bonusVsHeavy: 8, encumbranceMod: -8, critEffect: 'stunned' },
  mace1H:       { name: 'Mace', penMod: 6, baseDamage: 16, twoHanded: false, bonusVsHeavy: 5, encumbranceMod: -3, critEffect: 'stunned' },
  spear:        { name: 'Spear', penMod: 7, baseDamage: 14, twoHanded: false, critEffect: 'piercing' },
  polearm:      { name: 'Polearm', penMod: 6, baseDamage: 16, twoHanded: true, critEffect: 'piercing' },
  bow:          { name: 'Bow', penMod: 0, baseDamage: 12, twoHanded: true, critEffect: 'piercing' },
};

// --- Armor Tiers ---

export interface ArmorTierData {
  name: string;
  mitigation: number;
  encumbrance: number;
}

export const ARMOR_TIERS: Record<number, ArmorTierData> = {
  0: { name: 'Unarmored', mitigation: 0, encumbrance: 0 },
  1: { name: 'Rusty', mitigation: 5, encumbrance: -3 },
  2: { name: 'Iron', mitigation: 8, encumbrance: -5 },
  3: { name: 'Steel', mitigation: 12, encumbrance: -8 },
  4: { name: 'Castle-Forged', mitigation: 16, encumbrance: -12 },
  5: { name: 'Valyrian', mitigation: 14, encumbrance: 0 },
};

// --- Armor Classes ---

export interface ArmorClassData {
  name: string;
  mitMod: number;
  encMod: number;
}

export const ARMOR_CLASSES: Record<ArmorClass, ArmorClassData> = {
  none:   { name: 'None', mitMod: 0, encMod: 0 },
  light:  { name: 'Light', mitMod: -3, encMod: 3 },
  medium: { name: 'Medium', mitMod: 0, encMod: 0 },
  heavy:  { name: 'Heavy', mitMod: 5, encMod: -5 },
};

// --- Shield Tiers ---

export interface ShieldTierData {
  name: string;
  blockBonus: number;
}

export const SHIELD_TIERS: Record<number, ShieldTierData> = {
  0: { name: 'No Shield', blockBonus: 0 },
  1: { name: 'Rusty', blockBonus: 12 },
  2: { name: 'Iron', blockBonus: 16 },
  3: { name: 'Steel', blockBonus: 20 },
  4: { name: 'Castle-Forged', blockBonus: 24 },
  5: { name: 'Valyrian', blockBonus: 28 },
};

// --- Shield Classes ---

export interface ShieldClassData {
  name: string;
  blockMod: number;
  encumbrance: number;
}

export const SHIELD_CLASSES: Record<ShieldClass, ShieldClassData> = {
  none:   { name: 'None', blockMod: 0, encumbrance: 0 },
  light:  { name: 'Buckler', blockMod: -8, encumbrance: 0 },
  medium: { name: 'Heater', blockMod: 0, encumbrance: -3 },
  heavy:  { name: 'Tower', blockMod: 8, encumbrance: -8 },
};

// --- Durability Loss by Tier ---

export const DURABILITY_LOSS: Record<number, number> = {
  1: 5, 2: 3, 3: 2, 4: 1, 5: 0,
};

// --- Status Effect Configuration ---

export interface StatusEffectConfig {
  dotDamage?: number;
  duration: number | 'combat';
  stackable: boolean;
  maxStacks?: number;
  skipTurn?: boolean;
  mitigationLoss?: number;
  defenseBonus?: number;        // dice added to ally's defense pool (protecting)
  disadvantage?: boolean;
  diceRemoved?: number;         // dice removed from pool (pressured)
  defensePenalty?: number;      // dice removed from defense pool (grappled)
  defensePerAttacker?: number;  // dice added per engaged attacker (bracing)
}

export const STATUS_EFFECT_CONFIG: Record<string, StatusEffectConfig> = {
  bleeding:   { dotDamage: 5, duration: 'combat', stackable: true, maxStacks: 3 },
  stunned:    { duration: 1, stackable: false, skipTurn: true },
  sundered:   { mitigationLoss: 5, duration: 'combat', stackable: true, maxStacks: 3 },
  engaged:    { duration: 'combat', stackable: false },
  protecting: { duration: 1, stackable: false, defenseBonus: 1 },
  pressured:  { duration: 1, stackable: false, disadvantage: true, diceRemoved: 2 },
  grappled:   { duration: 'combat', stackable: false, defensePenalty: 3 },
  grappling:  { duration: 'combat', stackable: false },
  bracing:    { duration: 1, stackable: false, defensePerAttacker: 1 },
};

// --- Compute functions ---

export function calculateWeaponStats(
  weaponType: WeaponType,
  tier: number,
  isTwoHanded: boolean,
): WeaponStats {
  const tierData = WEAPON_TIERS[tier] ?? WEAPON_TIERS[1];
  const typeData = WEAPON_TYPES[weaponType];

  const penBase = isTwoHanded ? tierData.penBase2H : tierData.penBase1H;
  const tierEnc = isTwoHanded ? tierData.encumbrance2H : tierData.encumbrance1H;
  const typeEnc = typeData.encumbranceMod ?? 0;

  return {
    penetration: penBase + typeData.penMod,
    baseDamage: typeData.baseDamage,
    encumbrance: typeData.noEncumbrance ? 0 : tierEnc + typeEnc,
    twoHanded: isTwoHanded,
    slashing: typeData.slashing ?? false,
    armorPiercing: typeData.armorPiercing ?? false,
    bonusVsHeavy: typeData.bonusVsHeavy ?? 0,
    noBluntBonus: tierData.noBluntBonus ?? false,
    noEncumbrance: typeData.noEncumbrance ?? false,
    critEffect: typeData.critEffect,
    critBonus: typeData.critBonus ?? 0,
    durabilityLoss: tierData.durabilityLoss,
  };
}

export function calculateArmorStats(tier: number, armorClass: ArmorClass): ArmorStats {
  const tierData = ARMOR_TIERS[tier] ?? ARMOR_TIERS[0];
  const classData = ARMOR_CLASSES[armorClass];

  return {
    mitigation: tierData.mitigation + classData.mitMod,
    encumbrance: tierData.encumbrance + classData.encMod,
    isHeavy: armorClass === 'heavy',
  };
}

export function calculateShieldStats(tier: number, shieldClass: ShieldClass): ShieldStats {
  const tierData = SHIELD_TIERS[tier] ?? SHIELD_TIERS[0];
  const classData = SHIELD_CLASSES[shieldClass];

  return {
    blockBonus: tierData.blockBonus + classData.blockMod,
    encumbrance: classData.encumbrance,
  };
}

// --- Dice Pool Bonus Functions ---

/** Weapon tier -> attack bonus dice: T1=0, T2=1, T3=2, T4=3, T5=4 */
export function getWeaponTierDice(tier: number): number {
  return Math.max(0, tier - 1);
}

/** Shield class -> dice modifier: Buckler=-1, Heater=0, Tower=+2 */
const SHIELD_CLASS_DICE_MOD: Record<ShieldClass, number> = {
  none: 0,
  light: -1,   // Buckler
  medium: 0,   // Heater
  heavy: 2,    // Tower
};

/** Shield tier + class -> defense bonus dice. */
export function getShieldDice(tier: number, shieldClass: ShieldClass): number {
  if (tier === 0 || shieldClass === 'none') return 0;
  // Tier: T1=1, T2=2, T3=3, T4=4, T5=5
  const classMod = SHIELD_CLASS_DICE_MOD[shieldClass] ?? 0;
  return Math.max(0, tier + classMod);
}
