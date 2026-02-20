import type {
  CombatantStats, DuelResult, RoundResult, Exchange, Actor, DuelOutcome,
} from './types.js';
import { rollPoolInitiative } from './dice.js';
import { resolveAttack as resolveContestedAttack } from './attack-resolver.js';
import { shouldAttemptYield, resolveYieldResponse, calculateDesperateStandBonus } from './yield.js';
import { calculateDuelReputationChanges } from './reputation.js';

interface MutableState {
  attackerHp: number;
  defenderHp: number;
  attackerDesperateBonus: number;
  defenderDesperateBonus: number;
}

/**
 * Resolve a full duel between two combatants.
 * Runs all rounds automatically to completion and returns the full result.
 * Uses the same contested dice pool attack resolution as tactical combat.
 */
export function resolveDuel(
  attacker: CombatantStats,
  defender: CombatantStats,
  maxRounds: number = 50,
): DuelResult {
  const state: MutableState = {
    attackerHp: attacker.currentHealth,
    defenderHp: defender.currentHealth,
    attackerDesperateBonus: 0,
    defenderDesperateBonus: 0,
  };

  const attackerHpStart = attacker.currentHealth;
  const defenderHpStart = defender.currentHealth;

  // Roll pool-based initiative once at the start — turn order is locked for the entire duel
  const attackerInit = rollPoolInitiative(
    attacker.cunning, attacker.prowess, attacker.totalEncumbrance,
  );
  const defenderInit = rollPoolInitiative(
    defender.cunning, defender.prowess, defender.totalEncumbrance,
  );
  const firstActor: Actor = attackerInit.total >= defenderInit.total ? 'attacker' : 'defender';

  const rounds: RoundResult[] = [];
  let outcome: DuelOutcome = 'draw';
  let winnerId: number | null = null;
  let loserId: number | null = null;

  for (let roundNum = 1; roundNum <= maxRounds; roundNum++) {
    const roundResult = resolveRound(
      attacker, defender, state, roundNum,
      firstActor, attackerInit.total, defenderInit.total,
    );
    rounds.push(roundResult);

    const ended = checkCombatEnd(attacker, defender, state, roundResult);
    if (ended) {
      outcome = ended.outcome;
      winnerId = ended.winnerId;
      loserId = ended.loserId;
      break;
    }
  }

  const result: DuelResult = {
    winnerId,
    loserId,
    outcome,
    rounds,
    totalRounds: rounds.length,
    attackerHpStart,
    attackerHpEnd: Math.max(0, state.attackerHp),
    defenderHpStart,
    defenderHpEnd: Math.max(0, state.defenderHp),
    reputationChanges: [],
  };

  result.reputationChanges = calculateDuelReputationChanges(result, attacker, defender);

  return result;
}

function resolveRound(
  attacker: CombatantStats,
  defender: CombatantStats,
  state: MutableState,
  roundNumber: number,
  firstActor: Actor,
  attackerInit: number,
  defenderInit: number,
): RoundResult {
  const first = firstActor === 'attacker' ? attacker : defender;
  const second = firstActor === 'attacker' ? defender : attacker;

  const exchanges: Exchange[] = [];
  let yieldAttemptedBy: Actor | null = null;
  let yieldAccepted: boolean | null = null;
  let desperateStand = false;

  // --- First actor attacks ---
  const exchange1 = resolveExchange(
    first, second, state, firstActor,
    firstActor === 'attacker' ? state.attackerDesperateBonus : state.defenderDesperateBonus,
  );
  exchanges.push(exchange1);

  // Sync HP from the stats objects (attack-resolver mutates currentHealth directly)
  state.attackerHp = attacker.currentHealth;
  state.defenderHp = defender.currentHealth;

  // Check if target is dead
  const targetHpAfterFirst = firstActor === 'attacker' ? state.defenderHp : state.attackerHp;
  if (targetHpAfterFirst <= 0) {
    return buildRoundResult(
      roundNumber, attackerInit, defenderInit, firstActor,
      exchanges, state, yieldAttemptedBy, yieldAccepted, desperateStand,
      attacker, defender,
    );
  }

  // Check if target should yield
  const targetActor: Actor = firstActor === 'attacker' ? 'defender' : 'attacker';
  const target = firstActor === 'attacker' ? defender : attacker;
  const targetHp = firstActor === 'attacker' ? state.defenderHp : state.attackerHp;

  if (shouldAttemptYield(targetHp, target.maxHealth, target.yieldThreshold)) {
    yieldAttemptedBy = targetActor;
    const accepted = resolveYieldResponse(first.yieldResponse, target.isNoble);

    if (accepted) {
      yieldAccepted = true;
      return buildRoundResult(
        roundNumber, attackerInit, defenderInit, firstActor,
        exchanges, state, yieldAttemptedBy, yieldAccepted, desperateStand,
        attacker, defender,
      );
    }

    yieldAccepted = false;
    const dsBonus = calculateDesperateStandBonus(target.prowess, first.prowess);
    if (dsBonus) {
      desperateStand = true;
      if (targetActor === 'attacker') {
        state.attackerDesperateBonus = dsBonus.attackBonus;
      } else {
        state.defenderDesperateBonus = dsBonus.attackBonus;
      }
    }
  }

  // --- Second actor attacks ---
  const secondActor: Actor = firstActor === 'attacker' ? 'defender' : 'attacker';
  const exchange2 = resolveExchange(
    second, first, state, secondActor,
    secondActor === 'attacker' ? state.attackerDesperateBonus : state.defenderDesperateBonus,
  );
  exchanges.push(exchange2);

  // Sync HP
  state.attackerHp = attacker.currentHealth;
  state.defenderHp = defender.currentHealth;

  // Check if first actor should yield (after second's attack)
  const firstHpAfterSecond = firstActor === 'attacker' ? state.attackerHp : state.defenderHp;
  if (firstHpAfterSecond > 0 && yieldAttemptedBy === null) {
    if (shouldAttemptYield(firstHpAfterSecond, first.maxHealth, first.yieldThreshold)) {
      yieldAttemptedBy = firstActor;
      const accepted = resolveYieldResponse(second.yieldResponse, first.isNoble);

      if (accepted) {
        yieldAccepted = true;
      } else {
        yieldAccepted = false;
        const dsBonus = calculateDesperateStandBonus(first.prowess, second.prowess);
        if (dsBonus) {
          desperateStand = true;
          if (firstActor === 'attacker') {
            state.attackerDesperateBonus = dsBonus.attackBonus;
          } else {
            state.defenderDesperateBonus = dsBonus.attackBonus;
          }
        }
      }
    }
  }

  return buildRoundResult(
    roundNumber, attackerInit, defenderInit, firstActor,
    exchanges, state, yieldAttemptedBy, yieldAccepted, desperateStand,
    attacker, defender,
  );
}

/**
 * Resolve one exchange within a round using contested dice pool attack resolution.
 * The attack-resolver mutates actor/target currentHealth directly.
 */
function resolveExchange(
  actor: CombatantStats,
  target: CombatantStats,
  state: MutableState,
  actorRole: Actor,
  desperateAttackBonus: number,
): Exchange {
  // Sync current HP to the stats objects before attack resolution
  actor.currentHealth = actorRole === 'attacker' ? state.attackerHp : state.defenderHp;
  target.currentHealth = actorRole === 'attacker' ? state.defenderHp : state.attackerHp;

  // Resolve via the shared contested dice pool attack resolver
  const attackResult = resolveContestedAttack(actor, target, {
    attackerBonusDice: desperateAttackBonus,
  });

  return {
    actor: actorRole,
    result: attackResult,
  };
}

function checkCombatEnd(
  attacker: CombatantStats,
  defender: CombatantStats,
  state: MutableState,
  round: RoundResult,
): { outcome: DuelOutcome; winnerId: number; loserId: number } | null {
  if (state.attackerHp <= 0 && state.defenderHp <= 0) {
    return {
      outcome: 'victory',
      winnerId: state.attackerHp >= state.defenderHp ? attacker.characterId : defender.characterId,
      loserId: state.attackerHp >= state.defenderHp ? defender.characterId : attacker.characterId,
    };
  }

  if (state.attackerHp <= 0) {
    if (round.yieldAttemptedBy === 'attacker' && round.yieldAccepted === false) {
      return { outcome: 'yield_rejected_slain', winnerId: defender.characterId, loserId: attacker.characterId };
    }
    return { outcome: 'victory', winnerId: defender.characterId, loserId: attacker.characterId };
  }

  if (state.defenderHp <= 0) {
    if (round.yieldAttemptedBy === 'defender' && round.yieldAccepted === false) {
      return { outcome: 'yield_rejected_slain', winnerId: attacker.characterId, loserId: defender.characterId };
    }
    return { outcome: 'victory', winnerId: attacker.characterId, loserId: defender.characterId };
  }

  if (round.yieldAccepted === true) {
    if (round.yieldAttemptedBy === 'attacker') {
      return { outcome: 'yield_accepted', winnerId: defender.characterId, loserId: attacker.characterId };
    }
    return { outcome: 'yield_accepted', winnerId: attacker.characterId, loserId: defender.characterId };
  }

  return null;
}

function buildRoundResult(
  roundNumber: number,
  attackerInit: number,
  defenderInit: number,
  firstActor: Actor,
  exchanges: Exchange[],
  state: MutableState,
  yieldAttemptedBy: Actor | null,
  yieldAccepted: boolean | null,
  desperateStand: boolean,
  attacker: CombatantStats,
  defender: CombatantStats,
): RoundResult {
  const narrative = generateNarrative(
    roundNumber, exchanges, attacker, defender, firstActor,
    yieldAttemptedBy, yieldAccepted, desperateStand, state,
  );

  return {
    roundNumber,
    firstActorInitiative: attackerInit,
    secondActorInitiative: defenderInit,
    firstActor,
    exchanges,
    attackerHpAfter: Math.max(0, state.attackerHp),
    defenderHpAfter: Math.max(0, state.defenderHp),
    yieldAttemptedBy,
    yieldAccepted,
    desperateStand,
    narrative,
  };
}

function generateNarrative(
  roundNumber: number,
  exchanges: Exchange[],
  attacker: CombatantStats,
  defender: CombatantStats,
  firstActor: Actor,
  yieldAttemptedBy: Actor | null,
  yieldAccepted: boolean | null,
  desperateStand: boolean,
  state: MutableState,
): string {
  const parts: string[] = [`Round ${roundNumber}:`];

  for (const ex of exchanges) {
    const actorName = ex.actor === 'attacker' ? attacker.characterName : defender.characterName;
    const targetName = ex.actor === 'attacker' ? defender.characterName : attacker.characterName;
    const res = ex.result;

    if (res.dodged) {
      let line = `${targetName} sidesteps ${actorName}'s blow!`;
      if (res.dodgeRiposte) {
        line += ` ${targetName} ripostes for ${res.dodgeRiposte.damage} damage!`;
      }
      parts.push(line);
    } else if (res.defenseReversal && res.counterAttack) {
      let line = `${actorName} strikes but ${targetName} turns the blow aside!`;
      line += ` ${targetName} counter-attacks for ${res.counterAttack.damage} damage!`;
      parts.push(line);
    } else if (!res.hit) {
      parts.push(`${actorName} attacks but ${targetName} deflects the blow.`);
    } else if (res.hit) {
      let line = `${actorName} strikes ${targetName} for ${res.damage} damage (${res.damageLabel}).`;
      if (res.hitQuality === 'strong') {
        line += ` A strong blow!`;
      } else if (res.isCrit && res.critEffectsApplied.length > 0) {
        line += ` CRITICAL HIT!`;
      }
      parts.push(line);
    }
  }

  if (yieldAttemptedBy) {
    const yielderName = yieldAttemptedBy === 'attacker' ? attacker.characterName : defender.characterName;
    if (yieldAccepted) {
      parts.push(`${yielderName} yields and the yield is accepted.`);
    } else if (desperateStand) {
      parts.push(`${yielderName} yields but is refused. Fights on in desperate fury!`);
    } else {
      parts.push(`${yielderName} yields but is refused mercy.`);
    }
  }

  if (state.attackerHp <= 0) {
    parts.push(`${attacker.characterName} falls!`);
  } else if (state.defenderHp <= 0) {
    parts.push(`${defender.characterName} falls!`);
  }

  return parts.join(' ');
}
