/**
 * Damage calculation functions for the combat system.
 * All pure — no DB, no side effects.
 *
 * Penetration thresholds mirror the admin-battle.js bible:
 * damage ramps through discrete tiers based on how weapon penetration
 * compares to armor mitigation (raw, unclamped difference).
 */

import type { HitQuality } from './types.js';

/**
 * Wound dice penalty based on current health percentage.
 * Dice removed from combat pool:
 * >= 75%: 0, 50-74%: 1, 25-49%: 2, <25%: 3
 */
export function getWoundDice(currentHealth: number, maxHealth: number): number {
  if (maxHealth <= 0) return 3;
  const pct = (currentHealth / maxHealth) * 100;
  if (pct >= 75) return 0;
  if (pct >= 50) return 1;
  if (pct >= 25) return 2;
  return 3;
}

/**
 * Raw penetration difference (can be negative).
 */
export function rawPenetrationDifference(weaponPen: number, armorMitigation: number): number {
  return weaponPen - armorMitigation;
}

/**
 * Flavor label based on raw (unclamped) penetration difference.
 */
export function getDamageLabel(rawPenDiff: number): string {
  if (rawPenDiff <= -15) return 'Deflected';
  if (rawPenDiff <= -10) return 'Glancing';
  if (rawPenDiff <= -5) return 'Partial';
  if (rawPenDiff <= 0) return 'Reduced';
  if (rawPenDiff <= 5) return 'Solid';
  if (rawPenDiff <= 10) return 'Clean';
  return 'Devastating';
}

/**
 * Damage multiplier from raw penetration difference (unclamped).
 * Discrete thresholds matching the admin-battle.js bible.
 *
 * penDiff <= -15:  0.40x  (Deflected)
 * penDiff <= -10:  0.50x  (Glancing)
 * penDiff <=  -5:  0.65x  (Partial)
 * penDiff <=   0:  0.80x  (Reduced)
 * penDiff <=   5:  1.00x  (Solid)
 * penDiff <=  10:  1.15x  (Clean)
 * penDiff >  10:   1.30x  (Devastating)
 */
export function calculateDamageMultiplier(rawPenDiff: number): number {
  if (rawPenDiff <= -15) return 0.40;
  if (rawPenDiff <= -10) return 0.50;
  if (rawPenDiff <= -5) return 0.65;
  if (rawPenDiff <= 0) return 0.80;
  if (rawPenDiff <= 5) return 1.00;
  if (rawPenDiff <= 10) return 1.15;
  return 1.30;
}

/**
 * Hit quality from net successes (attack successes minus defense successes).
 * 1-2 net: Normal, 3-4 net: Strong, 5+ net: Critical
 */
export function getHitQuality(netSuccesses: number): HitQuality {
  if (netSuccesses >= 5) return 'critical';
  if (netSuccesses >= 3) return 'strong';
  return 'normal';
}

/**
 * Hit quality multiplier from net successes.
 * Normal: 1.0x, Strong: 1.15x, Critical: 1.35x
 */
export function getHitQualityMultiplier(netSuccesses: number): number {
  if (netSuccesses >= 5) return 1.35;
  if (netSuccesses >= 3) return 1.15;
  return 1.0;
}

/**
 * Final damage after all multipliers. Minimum 1.
 *
 * For strong and critical hits: pen multiplier floors at 1.0x,
 * then applies the hit quality multiplier (1.15x or 1.35x).
 * Normal hits: hitQualityMultiplier is 1.0.
 */
export function calculateFinalDamage(
  baseDamage: number,
  damageMultiplier: number,
  hitQualityMultiplier: number,
): number {
  let effectiveMultiplier = damageMultiplier;

  // Strong/critical hits floor the pen multiplier at 1.0
  if (hitQualityMultiplier > 1.0) {
    effectiveMultiplier = Math.max(effectiveMultiplier, 1.0);
  }

  return Math.max(1, Math.round(baseDamage * effectiveMultiplier * hitQualityMultiplier));
}
