import type { YieldThreshold, YieldResponse, DesperateStandBonus } from './types.js';

/**
 * Check if a combatant should attempt to yield based on their health and personality.
 *
 * - heroic: never yields (threshold 0%)
 * - brave: yields at <= 25% HP
 * - cautious: yields at <= 50% HP
 * - cowardly: yields at <= 75% HP
 */
export function shouldAttemptYield(
  currentHealth: number,
  maxHealth: number,
  yieldThreshold: YieldThreshold,
): boolean {
  if (yieldThreshold === 'heroic') return false;
  if (maxHealth <= 0) return true;

  const healthPct = currentHealth / maxHealth;

  switch (yieldThreshold) {
    case 'brave': return healthPct <= 0.25;
    case 'cautious': return healthPct <= 0.50;
    case 'cowardly': return healthPct <= 0.75;
    default: return false;
  }
}

/**
 * Determine if the captor accepts the yield.
 *
 * - merciful: always accepts
 * - pragmatic: accepts only if yielder is noble
 * - ruthless: never accepts
 */
export function resolveYieldResponse(
  yieldResponse: YieldResponse,
  yielderIsNoble: boolean,
): boolean {
  switch (yieldResponse) {
    case 'merciful': return true;
    case 'pragmatic': return yielderIsNoble;
    case 'ruthless': return false;
  }
}

/**
 * Calculate desperate last stand bonus.
 * Triggers when a yielder's prowess exceeds the captor's — they fight on with fury.
 *
 * Returns null if yielder's prowess is not higher (no desperate stand).
 * Returns { attackBonus: 2, initiativeBonus: 3 } if triggered (2 extra attack dice).
 */
export function calculateDesperateStandBonus(
  yielderProwess: number,
  captorProwess: number,
): DesperateStandBonus | null {
  if (yielderProwess > captorProwess) {
    return { attackBonus: 2, initiativeBonus: 3 };
  }
  return null;
}
