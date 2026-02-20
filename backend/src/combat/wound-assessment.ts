/**
 * Post-combat wound assessment.
 *
 * Determines wound severity from a character's final HP percentage
 * after a combat session ends. Pure function — no DB access.
 *
 * Replaces the old survival.ts Fortitude-dice system.
 */

import type { WoundSeverity, WoundAssessmentResult } from './types.js';

/**
 * Wound severity thresholds (end-of-combat HP percentage):
 *   > 75%  → healthy
 *   51-75% → light
 *   26-50% → serious
 *   1-25%  → severe
 *   0%     → grave
 */
export function assessWound(
  characterId: number,
  characterName: string,
  currentHealth: number,
  maxHealth: number,
): WoundAssessmentResult {
  const healthPercent = maxHealth > 0
    ? Math.round((currentHealth / maxHealth) * 100)
    : 0;

  let severity: WoundSeverity;
  if (healthPercent > 75) severity = 'healthy';
  else if (healthPercent > 50) severity = 'light';
  else if (healthPercent > 25) severity = 'serious';
  else if (healthPercent > 0) severity = 'severe';
  else severity = 'grave';

  return {
    characterId,
    characterName,
    currentHealth,
    maxHealth,
    healthPercent,
    severity,
    dicePenalty: getWoundDicePenalty(severity),
    requiresTending: severityRequiresTending(severity),
    infectionRisk: severityHasInfectionRisk(severity),
  };
}

/**
 * Combat dice penalty for persistent wound severity.
 * Returns -1 for grave (blocked from combat entirely).
 */
export function getWoundDicePenalty(severity: WoundSeverity): number {
  switch (severity) {
    case 'healthy': return 0;
    case 'light':   return 1;
    case 'serious': return 2;
    case 'severe':  return 3;
    case 'grave':   return -1; // blocked from combat
  }
}

/** Whether this severity level requires active tending to heal. */
export function severityRequiresTending(severity: WoundSeverity): boolean {
  return severity === 'serious' || severity === 'severe' || severity === 'grave';
}

/** Whether untended wounds at this severity will develop infection. */
export function severityHasInfectionRisk(severity: WoundSeverity): boolean {
  return severity === 'serious' || severity === 'severe' || severity === 'grave';
}
