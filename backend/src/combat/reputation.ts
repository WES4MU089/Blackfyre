import type { DuelResult, CombatantStats, ReputationDelta } from './types.js';

/**
 * Calculate reputation changes for both combatants based on duel outcome.
 *
 * | Outcome               | Winner                    | Loser      |
 * |-----------------------|---------------------------|------------|
 * | victory               | +3 honor, +2 renown       | —          |
 * | yield_accepted        | +5 chivalry               | -5 honor   |
 * | yield_rejected_slain  | +20 dread, -20 honor      | -5 honor   |
 * | desperate_stand_win   | +5 honor, +5 renown       | —          |
 * | upset (lower prowess) | +5 renown bonus           | —          |
 */
export function calculateDuelReputationChanges(
  result: DuelResult,
  attacker: CombatantStats,
  defender: CombatantStats,
): ReputationDelta[] {
  const deltas: ReputationDelta[] = [];

  if (result.outcome === 'draw' || !result.winnerId) {
    return deltas;
  }

  const winner = result.winnerId === attacker.characterId ? attacker : defender;
  const loser = result.loserId === attacker.characterId ? attacker : defender;

  switch (result.outcome) {
    case 'victory': {
      deltas.push({
        characterId: winner.characterId,
        honor: 3,
        chivalry: 0,
        dread: 0,
        renown: 2,
        reason: 'Duel victory',
      });
      break;
    }

    case 'yield_accepted': {
      // Captor (winner) gains chivalry for mercy
      deltas.push({
        characterId: winner.characterId,
        honor: 0,
        chivalry: 5,
        dread: 0,
        renown: 0,
        reason: 'Accepted yield with mercy',
      });
      // Yielder (loser) loses honor
      deltas.push({
        characterId: loser.characterId,
        honor: -5,
        chivalry: 0,
        dread: 0,
        renown: 0,
        reason: 'Yielded in combat',
      });
      break;
    }

    case 'yield_rejected_slain': {
      // Captor gains dread, loses honor
      deltas.push({
        characterId: winner.characterId,
        honor: -20,
        chivalry: 0,
        dread: 20,
        renown: 0,
        reason: 'Slew opponent who yielded',
      });
      // Yielder still loses honor
      deltas.push({
        characterId: loser.characterId,
        honor: -5,
        chivalry: 0,
        dread: 0,
        renown: 0,
        reason: 'Yielded and was slain',
      });
      break;
    }

    case 'desperate_stand_win': {
      // Desperate fighter who overcame gets extra honor + renown
      deltas.push({
        characterId: winner.characterId,
        honor: 5,
        chivalry: 0,
        dread: 0,
        renown: 5,
        reason: 'Won desperate last stand',
      });
      break;
    }
  }

  // Upset bonus: winner had lower prowess than loser
  const winnerCombat = winner.prowess;
  const loserCombat = loser.prowess;
  if (winnerCombat < loserCombat) {
    deltas.push({
      characterId: winner.characterId,
      honor: 0,
      chivalry: 0,
      dread: 0,
      renown: 5,
      reason: 'Upset victory against superior opponent',
    });
  }

  return deltas;
}
