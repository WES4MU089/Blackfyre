import crypto from 'crypto';
import type { CombatPoolResult, DiceRollResult } from './types.js';

/** Roll a single d6 (1-6). */
export function rollD6(): number {
  return crypto.randomInt(1, 7);
}

/** Roll a single d10 (1-10). Used for non-combat skill checks. */
export function rollD10(): number {
  return crypto.randomInt(1, 11);
}

/**
 * Roll a combat dice pool. Roll `poolSize` d6s, count successes.
 * Pool is clamped to minimum 1 die.
 *
 * @param poolSize    Number of dice to roll
 * @param threshold   Minimum die value for a success (default 4 for attack, 5 for defense)
 */
export function rollCombatPool(poolSize: number, threshold: number = 4): CombatPoolResult {
  const effectivePool = Math.max(1, poolSize);
  const dice: number[] = [];
  let successes = 0;
  let sixes = 0;
  for (let i = 0; i < effectivePool; i++) {
    const die = rollD6();
    dice.push(die);
    if (die >= threshold) successes++;
    if (die === 6) sixes++;
  }
  return { poolSize, effectivePool, dice, successes, sixes };
}

/**
 * Pool-based initiative: Roll (Cunning + floor(Prowess / 2)) d6s,
 * SUM all dice + encumbrance modifier.
 */
export function rollPoolInitiative(
  cunning: number,
  prowess: number,
  totalEncumbrance: number,
): { dice: number[]; total: number } {
  const poolSize = cunning + Math.floor(prowess / 2);
  const effectivePool = Math.max(1, poolSize);
  const dice: number[] = [];
  let sum = 0;
  for (let i = 0; i < effectivePool; i++) {
    const die = rollD6();
    dice.push(die);
    sum += die;
  }
  return { dice, total: sum + totalEncumbrance };
}

/**
 * Aptitude + Experience dice pool (non-combat skill checks only).
 *
 * Roll (aptitude + experience) d10s, keep best (aptitude + floor(experience/2)) dice.
 * Sum kept dice + modifier = total.
 */
export function rollAptitudeExperience(
  aptitude: number,
  experience: number,
  modifier: number = 0,
): DiceRollResult {
  const totalDice = aptitude + experience;
  const keepCount = aptitude + Math.floor(experience / 2);

  const allDice: number[] = [];
  for (let i = 0; i < totalDice; i++) {
    allDice.push(rollD10());
  }

  allDice.sort((a, b) => b - a);

  const keptDice = allDice.slice(0, keepCount);
  const discardedDice = allDice.slice(keepCount);

  const diceSum = keptDice.reduce((sum, d) => sum + d, 0);
  const total = diceSum + modifier;

  return {
    total,
    keptDice,
    discardedDice,
    aptitudeDiceCount: aptitude,
    experienceDiceCount: experience,
    modifier,
  };
}
