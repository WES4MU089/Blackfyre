/**
 * Shared attack resolution — contested dice pools.
 * Used by both tactical-engine (multiplayer) and duel-engine (1v1).
 *
 * Attack pool:  Prowess + weaponTierBonus + contextDice - woundDice - pressuredDice
 * Defense pool: defenseAptitude + shieldDice + contextDice - woundDice - pressuredDice - grappleDice
 *   Heavy armor   → Fortitude
 *   Medium armor  → max(Fortitude, Cunning)
 *   Light/None    → Cunning
 *
 * Attack: Roll Xd6, count successes (4+, 50% per die).
 * Defense: Roll Xd6, count successes (5+, 33% per die).
 * Attack wins if successes > defense (ties to defender).
 *
 * Hit quality (net successes = attack - defense):
 *   1-2 net: Normal (1.0x)
 *   3-4 net: Strong (1.15x)
 *   5+ net:  Critical (1.35x) + crit effects
 *
 * Defense reversal (defense wins by 4+, or 5+ for medium armor):
 *   Light/no armor + no shield → Dodge + riposte (auto-hit, base damage, no crit)
 *   With shield → Block + counter-attack (always crits, normal pen vs mitigation)
 *
 * Dagger shield bypass: In light armor, shield dice excluded from defense pool.
 * 2H overwhelm vs shield: +2 attack dice, halve shield dice in defense pool.
 * Armor piercing (daggers): Triggers when attack pool has 3+ dice showing 6.
 */

import type {
  AttackResult,
  CounterAttackResult,
  DodgeRiposteResult,
  CombatantStats,
  CombatPoolResult,
  DurabilityChange,
  StatusEffect,
  WeaponStats,
  ArmorClass,
  HitQuality,
} from './types.js';
import { getWoundDicePenalty } from './wound-assessment.js';
import { STATUS_EFFECT_CONFIG } from './equipment-data.js';
import { rollCombatPool } from './dice.js';
import {
  rawPenetrationDifference,
  getDamageLabel,
  calculateDamageMultiplier,
  calculateFinalDamage,
  getWoundDice,
  getHitQuality,
  getHitQualityMultiplier,
} from './damage.js';

// --- Public interface for engine callers ---

export interface AttackContext {
  /** Is the attacker under the "pressured" status? -2 dice from attack pool. */
  attackerPressured: boolean;
  /** Is the defender under the "pressured" status? -2 dice from defense pool. */
  defenderPressured: boolean;
  /** Defense dice removed from grappled status (3 dice). */
  defenderGrapplePenalty: number;
  /** Extra defense dice from bracing (+1 per attacker). */
  defenderBraceBonus: number;
  /** Extra defense dice from protecting (+1 die). */
  defenderProtectingBonus: number;
  /** Extra attack dice for the attacker (desperate stand = +2). */
  attackerBonusDice: number;
  /** If true, skip defense pool — attack always hits (opportunity attacks). */
  alwaysHit: boolean;
}

const DEFAULT_CONTEXT: AttackContext = {
  attackerPressured: false,
  defenderPressured: false,
  defenderGrapplePenalty: 0,
  defenderBraceBonus: 0,
  defenderProtectingBonus: 0,
  attackerBonusDice: 0,
  alwaysHit: false,
};

// --- Blunt bonus scaling by armor class ---
// Heavy: full bonus (rigid plate amplifies concussive force)
// Medium: half bonus (chainmail absorbs some force)
// Light/None: no bonus (no rigid surface)
function getBluntBonus(weapon: WeaponStats, defenderArmorClass: ArmorClass): number {
  if (weapon.bonusVsHeavy <= 0 || weapon.noBluntBonus) return 0;
  if (defenderArmorClass === 'heavy') return weapon.bonusVsHeavy;
  if (defenderArmorClass === 'medium') return Math.floor(weapon.bonusVsHeavy / 2);
  return 0;
}

// --- Defense reversal threshold by armor class ---
// Light/None/Heavy/Shield: 4+ net defense successes
// Medium (no shield): 5+ net defense successes (harder to maneuver in chainmail)
function getReversalThreshold(defenderArmorClass: ArmorClass, hasShield: boolean): number {
  if (defenderArmorClass === 'medium' && !hasShield) return 5;
  return 4;
}

// --- Main attack resolution ---

export function resolveAttack(
  attacker: CombatantStats,
  defender: CombatantStats,
  ctx: Partial<AttackContext> = {},
  isBonusStrike: boolean = false,
): AttackResult {
  const context = { ...DEFAULT_CONTEXT, ...ctx };
  const bonuses: string[] = [];

  // --- Build attack pool ---
  const attackerWoundDice = getWoundDice(attacker.currentHealth, attacker.maxHealth);
  let attackPoolSize = attacker.attackPoolBase;

  // 2H Overwhelm: +2 attack dice when two-handed weapon attacks a shielded target
  let overwhelmDice = 0;
  if (attacker.isTwoHanded && defender.hasShield) {
    overwhelmDice = 2;
    attackPoolSize += overwhelmDice;
    bonuses.push('2H OVERWHELM: +2 attack dice vs shield');
  }

  // Desperate stand / bonus dice
  if (context.attackerBonusDice > 0) {
    attackPoolSize += context.attackerBonusDice;
    bonuses.push(`DESPERATE STAND: +${context.attackerBonusDice} attack dice`);
  }

  // Wound penalty
  if (attackerWoundDice > 0) {
    attackPoolSize -= attackerWoundDice;
    bonuses.push(`ATTACKER WOUNDED: -${attackerWoundDice} dice`);
  }

  // Pressured: -2 dice
  if (context.attackerPressured) {
    const pressuredDice = STATUS_EFFECT_CONFIG.pressured.diceRemoved ?? 2;
    attackPoolSize -= pressuredDice;
    bonuses.push(`ATK PRESSURED: -${pressuredDice} dice`);
  }

  // Persistent wound severity penalty (light=-1, serious=-2, severe=-3)
  const attackerWoundPenalty = getWoundDicePenalty(attacker.woundSeverity);
  if (attackerWoundPenalty > 0) {
    attackPoolSize -= attackerWoundPenalty;
    bonuses.push(`WOUND PENALTY (${attacker.woundSeverity}): -${attackerWoundPenalty} dice`);
  }

  // Roll attack pool (minimum 1 die)
  const attackPool = rollCombatPool(attackPoolSize);
  bonuses.push(`ATTACK POOL: ${attackPool.effectivePool} dice → ${attackPool.successes} successes [${attackPool.dice.join(', ')}]`);

  // --- Build and roll defense pool ---
  let defensePool: CombatPoolResult | null = null;
  let defensePoolSize = 0;
  let netSuccesses: number;
  let hit: boolean;

  if (context.alwaysHit) {
    // Opportunity attack — skip defense, auto-hit
    netSuccesses = attackPool.successes; // All successes count
    hit = true;
  } else {
    defensePoolSize = defender.defensePoolBase;

    // Dagger shield bypass: exclude shield dice in light armor
    if (attacker.weaponType === 'dagger' && attacker.isLightlyArmored && defender.hasShield) {
      defensePoolSize -= defender.shieldDice; // Remove shield dice from the base
      bonuses.push(`DAGGER BYPASS: ignoring ${defender.shieldDice} shield dice (light armor)`);
    } else if (attacker.isTwoHanded && defender.hasShield && defender.shieldDice > 0) {
      // 2H Overwhelm: halve shield dice in defense pool
      const halvedShield = Math.floor(defender.shieldDice / 2);
      const reduction = defender.shieldDice - halvedShield;
      defensePoolSize -= reduction;
      bonuses.push(`2H OVERWHELM: shield dice ${defender.shieldDice} → ${halvedShield}`);
    }

    // Context bonuses
    if (context.defenderBraceBonus > 0) {
      defensePoolSize += context.defenderBraceBonus;
      bonuses.push(`BRACING: +${context.defenderBraceBonus} defense dice`);
    }
    if (context.defenderProtectingBonus > 0) {
      defensePoolSize += context.defenderProtectingBonus;
      bonuses.push(`PROTECTING: +${context.defenderProtectingBonus} defense dice`);
    }

    // Grappled penalty
    if (context.defenderGrapplePenalty > 0) {
      defensePoolSize -= context.defenderGrapplePenalty;
      bonuses.push(`GRAPPLED: -${context.defenderGrapplePenalty} defense dice`);
    }

    // Wound penalty
    const defenderWoundDice = getWoundDice(defender.currentHealth, defender.maxHealth);
    if (defenderWoundDice > 0) {
      defensePoolSize -= defenderWoundDice;
      bonuses.push(`DEFENDER WOUNDED: -${defenderWoundDice} dice`);
    }

    // Pressured: -2 dice
    if (context.defenderPressured) {
      const pressuredDice = STATUS_EFFECT_CONFIG.pressured.diceRemoved ?? 2;
      defensePoolSize -= pressuredDice;
      bonuses.push(`DEF PRESSURED: -${pressuredDice} dice`);
    }

    // Persistent wound severity penalty (light=-1, serious=-2, severe=-3)
    const defenderWoundPenalty = getWoundDicePenalty(defender.woundSeverity);
    if (defenderWoundPenalty > 0) {
      defensePoolSize -= defenderWoundPenalty;
      bonuses.push(`DEF WOUND PENALTY (${defender.woundSeverity}): -${defenderWoundPenalty} dice`);
    }

    // Defense aptitude source label
    let defenseSource: string;
    if (defender.isLightlyArmored) {
      defenseSource = 'Cunning';
    } else if (defender.armorClass === 'medium') {
      defenseSource = `max(Fort ${defender.fortitude}, Cun ${defender.cunning})`;
    } else {
      defenseSource = 'Fortitude';
    }
    bonuses.push(`DEFENSE: ${defenseSource} ${defender.defenseAptitude}`);

    // Roll defense pool (minimum 1 die, success on 5+ = 33% per die)
    defensePool = rollCombatPool(defensePoolSize, 5);
    bonuses.push(`DEFENSE POOL: ${defensePool.effectivePool} dice → ${defensePool.successes} successes [${defensePool.dice.join(', ')}] (5+)`);

    netSuccesses = attackPool.successes - defensePool.successes;
    hit = netSuccesses > 0; // Ties go to defender
  }

  // --- Check defense reversal ---
  let defenseReversal = false;
  let dodged = false;

  if (!hit && !context.alwaysHit && defensePool) {
    const defenseNet = defensePool.successes - attackPool.successes;
    const reversalThreshold = getReversalThreshold(defender.armorClass, defender.hasShield);

    if (defenseNet >= reversalThreshold) {
      defenseReversal = true;

      if (!defender.hasShield && (defender.isLightlyArmored || defender.armorClass === 'medium')) {
        dodged = true;
        bonuses.push(`DODGE: ${defender.characterName} evades! (${defenseNet} net defense successes)`);
      } else if (defender.hasShield) {
        bonuses.push(`DEFENSE REVERSAL: ${defender.characterName}'s shield creates an opening! (${defenseNet} net defense successes)`);
      }
    }
  }

  // --- Determine hit quality ---
  let hitQuality: HitQuality | null = null;
  let hitQualityMultiplier = 1.0;
  let isCrit = false;

  if (hit) {
    hitQuality = getHitQuality(netSuccesses);
    hitQualityMultiplier = getHitQualityMultiplier(netSuccesses);
    isCrit = hitQuality === 'critical';
  }

  // --- Base result ---
  const result: AttackResult = {
    attackerCharacterId: attacker.characterId,
    attackerName: attacker.characterName,
    defenderCharacterId: defender.characterId,
    defenderName: defender.characterName,
    attackPool,
    defensePool,
    attackPoolSize,
    defensePoolSize,
    netSuccesses,
    hit,
    defenseReversal,
    dodged,
    hitQuality,
    damage: 0,
    damageLabel: '',
    isCrit,
    weaponPenetration: 0,
    targetMitigation: 0,
    netPenetration: 0,
    baseDamage: 0,
    bonusDamage: 0,
    damageMultiplier: 0,
    hitQualityMultiplier,
    critEffectsApplied: [],
    statusEffectsApplied: [],
    bonuses,
    counterAttack: null,
    dodgeRiposte: null,
    bonusStrike: null,
    durabilityChanges: [],
  };

  if (dodged) {
    // --- DODGE (defense reversal, light/medium armor, no shield) ---
    result.dodgeRiposte = resolveDodgeRiposte(defender, attacker);
    return result;
  }

  if (defenseReversal && defender.hasShield) {
    // --- SHIELD REVERSAL → counter-attack ---
    applyReversalDurability(attacker, defender, result);
    result.counterAttack = resolveCounterAttack(defender, attacker);
    return result;
  }

  if (!hit) {
    // --- MISS (no reversal) ---
    applyReversalDurability(attacker, defender, result);
    return result;
  }

  // --- HIT ---
  resolveHitDamage(attacker, defender, result);
  applyHitDurability(attacker, defender, result);

  // --- Dagger crit: bonus strike (no recursion, light armor only) ---
  if (result.isCrit && attacker.weaponType === 'dagger' && !isBonusStrike && attacker.isLightlyArmored) {
    result.bonusStrike = resolveAttack(attacker, defender, ctx, true);
    result.bonuses.push('DAGGER CRIT: Bonus strike!');
  }

  return result;
}

// --- Counter-attack (always hits, 1.35x damage, bypasses mitigation) ---

export function resolveCounterAttack(
  defender: CombatantStats,
  attacker: CombatantStats,
): CounterAttackResult {
  const bonuses: string[] = [];

  let weaponPen = defender.weapon.penetration;
  let bonusDamage = 0;
  const critEffects = normalizeCritEffects(defender.weapon.critEffect);

  // Piercing crit bonus: +10 pen
  if (critEffects.includes('piercing')) {
    weaponPen += 10;
    bonuses.push('PIERCING: +10 pen');
  }

  // Blunt bonus scaled by armor class
  const bluntBonus = getBluntBonus(defender.weapon, attacker.armorClass);
  if (bluntBonus > 0) {
    weaponPen += bluntBonus;
    const armorLabel = attacker.armorClass.charAt(0).toUpperCase() + attacker.armorClass.slice(1);
    bonuses.push(`Blunt vs ${armorLabel}: +${bluntBonus} pen`);
  }

  // Slashing vs lightly armored
  if (defender.weapon.slashing && attacker.isLightlyArmored) {
    bonusDamage = 8;
    weaponPen += 5;
    bonuses.push('Slashing vs Light: +8 dmg, +5 pen');
  }

  // Counter-attacks always crit (1.35x) but respect target's armor mitigation
  const effectiveMitigation = attacker.totalMitigation;
  const netPen = rawPenetrationDifference(weaponPen, effectiveMitigation);
  const totalBaseDamage = defender.weapon.baseDamage + bonusDamage;
  const damageMultiplier = calculateDamageMultiplier(netPen);
  const damage = calculateFinalDamage(totalBaseDamage, damageMultiplier, 1.35);
  const damageLabel = getDamageLabel(netPen);

  // Apply damage to attacker
  attacker.currentHealth = Math.max(0, attacker.currentHealth - damage);

  // Apply defender's crit effects (except piercing, already applied as +10 pen)
  const statusEffectsApplied: StatusEffect[] = [];
  const effectsToApply = critEffects.filter(e => e !== 'piercing');
  for (const effectKey of effectsToApply) {
    const effect = applyStatusEffectToTarget(attacker, effectKey, defender.characterId);
    if (effect) {
      // Dagger counter-attack: double bleed stacks
      if (defender.weaponType === 'dagger' && effect.type === 'bleeding') {
        effect.stacks = 2;
        bonuses.push('DAGGER: Double bleed (2 stacks)');
      }
      statusEffectsApplied.push(effect);
    }
  }

  // Durability: defender weapon + attacker armor
  const durabilityChanges: DurabilityChange[] = [];
  if (defender.durability.weapon.loss > 0) {
    defender.durability.weapon.current = Math.max(0,
      defender.durability.weapon.current - defender.durability.weapon.loss);
    durabilityChanges.push({
      characterId: defender.characterId,
      slot: 'mainHand',
      loss: defender.durability.weapon.loss,
      newValue: defender.durability.weapon.current,
    });
  }
  if (attacker.durability.armor.loss > 0) {
    attacker.durability.armor.current = Math.max(0,
      attacker.durability.armor.current - attacker.durability.armor.loss);
    durabilityChanges.push({
      characterId: attacker.characterId,
      slot: 'armor',
      loss: attacker.durability.armor.loss,
      newValue: attacker.durability.armor.current,
    });
  }

  return {
    attackerCharacterId: defender.characterId,
    attackerName: defender.characterName,
    targetCharacterId: attacker.characterId,
    targetName: attacker.characterName,
    damage,
    weaponPenetration: weaponPen,
    targetMitigation: effectiveMitigation,
    netPenetration: netPen,
    damageLabel,
    statusEffectsApplied,
    bonuses,
    durabilityChanges,
  };
}

// --- Dodge riposte (free counter-strike on dodge) ---

/**
 * Dodge riposte — free counter-strike when a light/medium-armored defender dodges.
 * Auto-hit, base damage only, normal pen vs mitigation (does NOT bypass), no crit, no status effects.
 */
function resolveDodgeRiposte(
  defender: CombatantStats,
  attacker: CombatantStats,
): DodgeRiposteResult {
  const bonuses: string[] = [];

  let weaponPen = defender.weapon.penetration;
  let bonusDamage = 0;

  // Blunt bonus scaled by armor class
  const bluntBonus = getBluntBonus(defender.weapon, attacker.armorClass);
  if (bluntBonus > 0) {
    weaponPen += bluntBonus;
    const armorLabel = attacker.armorClass.charAt(0).toUpperCase() + attacker.armorClass.slice(1);
    bonuses.push(`Blunt vs ${armorLabel}: +${bluntBonus} pen`);
  }

  // Slashing vs lightly armored (weapon property, not crit-dependent)
  if (defender.weapon.slashing && attacker.isLightlyArmored) {
    bonusDamage = 8;
    weaponPen += 5;
    bonuses.push('Slashing vs Light: +8 dmg, +5 pen');
  }

  // Normal pen vs mitigation (NOT bypassed — unlike crit counter-attacks)
  const netPen = rawPenetrationDifference(weaponPen, attacker.totalMitigation);
  const totalBaseDamage = defender.weapon.baseDamage + bonusDamage;
  const mult = calculateDamageMultiplier(netPen);
  const damage = calculateFinalDamage(totalBaseDamage, mult, 1.0);
  const label = getDamageLabel(netPen);

  // Apply damage to the attacker
  attacker.currentHealth = Math.max(0, attacker.currentHealth - damage);

  // Durability: defender weapon + attacker armor
  const durabilityChanges: DurabilityChange[] = [];
  if (defender.durability.weapon.loss > 0) {
    defender.durability.weapon.current = Math.max(0,
      defender.durability.weapon.current - defender.durability.weapon.loss);
    durabilityChanges.push({
      characterId: defender.characterId,
      slot: 'mainHand',
      loss: defender.durability.weapon.loss,
      newValue: defender.durability.weapon.current,
    });
  }
  if (attacker.durability.armor.loss > 0) {
    attacker.durability.armor.current = Math.max(0,
      attacker.durability.armor.current - attacker.durability.armor.loss);
    durabilityChanges.push({
      characterId: attacker.characterId,
      slot: 'armor',
      loss: attacker.durability.armor.loss,
      newValue: attacker.durability.armor.current,
    });
  }

  bonuses.push('DODGE RIPOSTE: auto-hit, no crit, normal pen vs mitigation');

  return {
    attackerCharacterId: defender.characterId,
    attackerName: defender.characterName,
    targetCharacterId: attacker.characterId,
    targetName: attacker.characterName,
    damage,
    weaponPenetration: weaponPen,
    targetMitigation: attacker.totalMitigation,
    netPenetration: netPen,
    damageLabel: label,
    bonuses,
    durabilityChanges,
  };
}

// --- Internal helpers ---

function resolveHitDamage(
  attacker: CombatantStats,
  defender: CombatantStats,
  result: AttackResult,
): void {
  let weaponPen = attacker.weapon.penetration;
  let bonusDamage = 0;
  const critEffects = normalizeCritEffects(attacker.weapon.critEffect);
  const isCrit = result.isCrit;

  // Piercing crit: +10 pen (applied during damage, not as status)
  if (isCrit && critEffects.includes('piercing')) {
    weaponPen += 10;
    result.bonuses.push('PIERCING CRIT: +10 pen');
  }

  // Blunt bonus scaled by armor class
  const bluntBonus = getBluntBonus(attacker.weapon, defender.armorClass);
  if (bluntBonus > 0) {
    weaponPen += bluntBonus;
    const armorLabel = defender.armorClass.charAt(0).toUpperCase() + defender.armorClass.slice(1);
    result.bonuses.push(`Blunt vs ${armorLabel}: +${bluntBonus} pen`);
  }

  // Slashing vs lightly armored: +8 dmg, +5 pen
  if (attacker.weapon.slashing && defender.isLightlyArmored) {
    bonusDamage = 8;
    weaponPen += 5;
    result.bonuses.push('Slashing vs Light: +8 dmg, +5 pen');
  }

  // Armor piercing (daggers): triggers when 3+ dice show 6 (pool-emergent)
  if (attacker.weapon.armorPiercing && result.attackPool.sixes >= 3) {
    weaponPen += 5;
    result.bonuses.push(`Armor Piercing: +5 pen (${result.attackPool.sixes} sixes in pool)`);
  }

  // Calculate damage — pen vs mit still applies, hit quality multiplier replaces old crit
  const effectiveMitigation = defender.totalMitigation;
  const netPen = rawPenetrationDifference(weaponPen, effectiveMitigation);
  const totalBaseDamage = attacker.weapon.baseDamage + bonusDamage;
  const damageMultiplier = calculateDamageMultiplier(netPen);
  const damage = calculateFinalDamage(totalBaseDamage, damageMultiplier, result.hitQualityMultiplier);
  const damageLabel = getDamageLabel(netPen);

  result.weaponPenetration = weaponPen;
  result.targetMitigation = effectiveMitigation;
  result.netPenetration = netPen;
  result.baseDamage = attacker.weapon.baseDamage;
  result.bonusDamage = bonusDamage;
  result.damageMultiplier = damageMultiplier;
  result.damage = damage;
  result.damageLabel = damageLabel;

  // Apply damage to defender
  defender.currentHealth = Math.max(0, defender.currentHealth - damage);

  // Apply crit status effects (except piercing, already applied as +10 pen)
  if (isCrit) {
    const effectsToApply = critEffects.filter(e => e !== 'piercing');
    for (const effectKey of effectsToApply) {
      const effect = applyStatusEffectToTarget(defender, effectKey, attacker.characterId);
      if (effect) {
        // Dagger crit: double bleed stacks
        if (attacker.weaponType === 'dagger' && effect.type === 'bleeding') {
          effect.stacks = 2;
          result.bonuses.push('DAGGER CRIT: Double bleed (2 stacks)');
        }
        result.statusEffectsApplied.push(effect);
        result.critEffectsApplied.push(effectKey);
      }
    }
  }
}

function applyReversalDurability(
  attacker: CombatantStats,
  defender: CombatantStats,
  result: AttackResult,
): void {
  // Attacker weapon degrades
  if (attacker.durability.weapon.loss > 0) {
    attacker.durability.weapon.current = Math.max(0,
      attacker.durability.weapon.current - attacker.durability.weapon.loss);
    result.durabilityChanges.push({
      characterId: attacker.characterId,
      slot: 'mainHand',
      loss: attacker.durability.weapon.loss,
      newValue: attacker.durability.weapon.current,
    });
  }

  // Defender: shield degrades if they have one, otherwise weapon degrades
  if (defender.hasShield) {
    if (defender.durability.shield.loss > 0) {
      defender.durability.shield.current = Math.max(0,
        defender.durability.shield.current - defender.durability.shield.loss);
      result.durabilityChanges.push({
        characterId: defender.characterId,
        slot: 'offHand',
        loss: defender.durability.shield.loss,
        newValue: defender.durability.shield.current,
      });
    }
  } else {
    if (defender.durability.weapon.loss > 0) {
      defender.durability.weapon.current = Math.max(0,
        defender.durability.weapon.current - defender.durability.weapon.loss);
      result.durabilityChanges.push({
        characterId: defender.characterId,
        slot: 'mainHand',
        loss: defender.durability.weapon.loss,
        newValue: defender.durability.weapon.current,
      });
    }
  }
}

function applyHitDurability(
  attacker: CombatantStats,
  defender: CombatantStats,
  result: AttackResult,
): void {
  // Attacker weapon degrades
  if (attacker.durability.weapon.loss > 0) {
    attacker.durability.weapon.current = Math.max(0,
      attacker.durability.weapon.current - attacker.durability.weapon.loss);
    result.durabilityChanges.push({
      characterId: attacker.characterId,
      slot: 'mainHand',
      loss: attacker.durability.weapon.loss,
      newValue: attacker.durability.weapon.current,
    });
  }

  // Defender armor degrades
  if (defender.durability.armor.loss > 0) {
    defender.durability.armor.current = Math.max(0,
      defender.durability.armor.current - defender.durability.armor.loss);
    result.durabilityChanges.push({
      characterId: defender.characterId,
      slot: 'armor',
      loss: defender.durability.armor.loss,
      newValue: defender.durability.armor.current,
    });
  }
}

/**
 * Apply a status effect to a target combatant.
 * Returns the StatusEffect if successfully applied, null if config missing.
 */
function applyStatusEffectToTarget(
  target: CombatantStats,
  effectKey: string,
  sourceCharacterId: number,
): StatusEffect | null {
  const config = STATUS_EFFECT_CONFIG[effectKey];
  if (!config) return null;

  const roundsRemaining = typeof config.duration === 'number' ? config.duration : -1;

  return {
    type: effectKey as any,
    stacks: 1,
    roundsRemaining,
    sourceCharacterId,
  };
}

function normalizeCritEffects(critEffect: string | string[]): string[] {
  return Array.isArray(critEffect) ? critEffect : [critEffect];
}
