/**
 * Serialization helpers for sending combat results to the frontend.
 * Flattens nested CombatPoolResult objects into flat fields
 * matching the frontend's AttackResultView / ActionResultView.
 */

import type { AttackResult, ActionResult } from './types.js';

/** Flatten AttackResult pool objects into the flat shape the frontend expects. */
function serializeAttackResult(atk: AttackResult) {
  return {
    attackerCharacterId: atk.attackerCharacterId,
    defenderCharacterId: atk.defenderCharacterId,

    // Flatten pool results
    attackPoolSize: atk.attackPoolSize,
    defensePoolSize: atk.defensePoolSize,
    attackSuccesses: atk.attackPool.successes,
    defenseSuccesses: atk.defensePool?.successes ?? 0,
    netSuccesses: atk.netSuccesses,
    attackDice: atk.attackPool.dice,
    defenseDice: atk.defensePool?.dice ?? [],

    // Outcome
    hit: atk.hit,
    defenseReversal: atk.defenseReversal,
    dodged: atk.dodged,
    hitQuality: atk.hitQuality,
    damage: atk.damage,
    damageLabel: atk.damageLabel,
    isCrit: atk.isCrit,
    critEffectsApplied: atk.critEffectsApplied,
    statusEffectsApplied: atk.statusEffectsApplied,
    bonuses: atk.bonuses,

    // Counter-attack / riposte
    counterAttack: atk.counterAttack ? {
      damage: atk.counterAttack.damage,
      targetCharacterId: atk.counterAttack.targetCharacterId,
      statusEffectsApplied: atk.counterAttack.statusEffectsApplied,
    } : null,
    dodgeRiposte: atk.dodgeRiposte ? {
      damage: atk.dodgeRiposte.damage,
      targetCharacterId: atk.dodgeRiposte.targetCharacterId,
    } : null,
  };
}

export type SerializedActionResult = {
  sessionId: number;
  roundNumber: number;
  turnNumber: number;
  actorCharacterId: number;
  actorName: string;
  actionType: string;
  targetCharacterId: number | null;
  targetName: string | null;
  attackResult: ReturnType<typeof serializeAttackResult> | null;
  statusEffectsApplied: ActionResult['statusEffectsApplied'];
  statusEffectsRemoved: ActionResult['statusEffectsRemoved'];
  narrative: string;
  opportunityAttacks: SerializedActionResult[];
};

/** Serialize an ActionResult for client broadcast, flattening nested pool objects. */
export function serializeActionResult(result: ActionResult): SerializedActionResult {
  return {
    sessionId: result.sessionId,
    roundNumber: result.roundNumber,
    turnNumber: result.turnNumber,
    actorCharacterId: result.actorCharacterId,
    actorName: result.actorName,
    actionType: result.actionType,
    targetCharacterId: result.targetCharacterId,
    targetName: result.targetName,
    attackResult: result.attackResult ? serializeAttackResult(result.attackResult) : null,
    statusEffectsApplied: result.statusEffectsApplied,
    statusEffectsRemoved: result.statusEffectsRemoved,
    narrative: result.narrative,
    opportunityAttacks: result.opportunityAttacks.map(r => serializeActionResult(r)),
  };
}
