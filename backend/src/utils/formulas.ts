/**
 * Shared game formulas — single source of truth for derived stat calculations.
 */

/** Max health derived from Fortitude aptitude: 20 + (fortitude × 10) */
export function calculateMaxHealth(fortitude: number): number {
  return 20 + (fortitude * 10);
}
