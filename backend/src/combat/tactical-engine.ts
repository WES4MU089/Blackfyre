/**
 * Tactical combat engine for multiplayer turn-based combat.
 * Resolves one action at a time (unlike duel-engine which resolves all rounds).
 * All functions are pure — they mutate the passed-in combatant state and return results.
 *
 * Attack resolution delegated to attack-resolver.ts (contested dice pools).
 */

import type {
  CombatantStats, CombatSessionCombatant, ActionResult, StatusEffect,
  StatusEffectType, RoundStartResult, AttackResult,
} from './types.js';
import { rollCombatPool } from './dice.js';
import { resolveAttack as resolveContestedAttack, type AttackContext } from './attack-resolver.js';
import { STATUS_EFFECT_CONFIG } from './equipment-data.js';
import { detectThresholdCrossed } from './combat-narrator.js';

// ============================================
// Helpers
// ============================================

function getCombatant(
  combatants: Map<number, CombatSessionCombatant>,
  characterId: number,
): CombatSessionCombatant {
  const c = combatants.get(characterId);
  if (!c) throw new Error(`Combatant ${characterId} not found`);
  return c;
}

function hasEffect(combatant: CombatSessionCombatant, type: StatusEffectType): boolean {
  return combatant.statusEffects.some(e => e.type === type);
}

function getEffectStacks(combatant: CombatSessionCombatant, type: StatusEffectType): number {
  return combatant.statusEffects.find(e => e.type === type)?.stacks ?? 0;
}

function addEffect(
  combatant: CombatSessionCombatant,
  effect: StatusEffect,
  maxStacks: number = 1,
): StatusEffect {
  const existing = combatant.statusEffects.find(e => e.type === effect.type);
  if (existing) {
    existing.stacks = Math.min(existing.stacks + effect.stacks, maxStacks);
    existing.roundsRemaining = Math.max(existing.roundsRemaining, effect.roundsRemaining);
    existing.sourceCharacterId = effect.sourceCharacterId;
    return existing;
  }
  combatant.statusEffects.push(effect);
  return effect;
}

function removeEffect(combatant: CombatSessionCombatant, type: StatusEffectType): boolean {
  const idx = combatant.statusEffects.findIndex(e => e.type === type);
  if (idx === -1) return false;
  combatant.statusEffects.splice(idx, 1);
  return true;
}

/**
 * Build a live CombatantStats view from a CombatSessionCombatant.
 * Overrides mutable fields (health, mitigation) with current session values.
 * Durability is passed by reference so mutations propagate back.
 */
function getLiveStats(c: CombatSessionCombatant): CombatantStats {
  return {
    ...c.statsSnapshot,
    currentHealth: c.currentHealth,
    totalMitigation: c.totalMitigation,
    durability: c.durability,
  };
}

/**
 * Sync mutable values back from live stats after attack resolution.
 */
function syncBack(c: CombatSessionCombatant, stats: CombatantStats): void {
  c.currentHealth = stats.currentHealth;
  // durability already mutated via reference
  if (c.currentHealth <= 0) c.isAlive = false;
}

/**
 * Build the AttackContext from session state.
 */
function buildAttackContext(
  actor: CombatSessionCombatant,
  target: CombatSessionCombatant,
  combatants: Map<number, CombatSessionCombatant>,
  alwaysHit: boolean = false,
): Partial<AttackContext> {
  const defenderGrapplePenalty = hasEffect(target, 'grappled')
    ? (STATUS_EFFECT_CONFIG.grappled.defensePenalty ?? 3)
    : 0;

  // Brace bonus: +1 die per attacker targeting this combatant
  const bracePerAttacker = STATUS_EFFECT_CONFIG.bracing.defensePerAttacker ?? 1;
  const attackerCount = target.engagedTo.filter(id => {
    const other = combatants.get(id);
    return other && other.isAlive && other.team !== target.team;
  }).length;
  const defenderBraceBonus = target.isBracing ? bracePerAttacker * Math.max(1, attackerCount) : 0;

  // Protecting bonus: +1 defense die
  const defenderProtectingBonus = hasEffect(target, 'protecting')
    ? (STATUS_EFFECT_CONFIG.protecting.defenseBonus ?? 1)
    : 0;

  return {
    attackerPressured: hasEffect(actor, 'pressured'),
    defenderPressured: hasEffect(target, 'pressured'),
    defenderGrapplePenalty,
    defenderBraceBonus,
    defenderProtectingBonus,
    alwaysHit,
  };
}

/**
 * Apply status effects from an AttackResult to the CombatSessionCombatant.
 * Handles stacking (bleeding, sundered) and mitigation reduction.
 */
function applyAttackStatusEffects(
  target: CombatSessionCombatant,
  attackResult: AttackResult,
): void {
  for (const effect of attackResult.statusEffectsApplied) {
    const config = STATUS_EFFECT_CONFIG[effect.type];
    const maxStacks = config?.maxStacks ?? 1;
    addEffect(target, effect, maxStacks);

    // Sundered: reduce totalMitigation
    if (effect.type === 'sundered') {
      const sunderedStacks = getEffectStacks(target, 'sundered');
      const mitLoss = (config?.mitigationLoss ?? 5) * sunderedStacks;
      target.totalMitigation = Math.max(0, target.statsSnapshot.baseMitigation - mitLoss);
    }
  }
}

function emptyActionResult(
  sessionId: number, roundNumber: number, turnNumber: number,
  actor: CombatSessionCombatant,
): ActionResult {
  return {
    sessionId, roundNumber, turnNumber,
    actorCharacterId: actor.characterId,
    actorName: actor.characterName,
    actionType: 'skip',
    targetCharacterId: null,
    targetName: null,
    attackResult: null,
    statusEffectsApplied: [],
    statusEffectsRemoved: [],
    opportunityAttacks: [],
    narrative: '',
  };
}

// ============================================
// Tactical Actions
// ============================================

/**
 * Resolve an attack action. Handles engagement, protection, and opportunity attacks.
 */
export function resolveAttack(
  sessionId: number,
  actor: CombatSessionCombatant,
  targetId: number,
  combatants: Map<number, CombatSessionCombatant>,
  roundNumber: number,
  turnNumber: number,
): ActionResult {
  const target = getCombatant(combatants, targetId);
  const result = emptyActionResult(sessionId, roundNumber, turnNumber, actor);
  result.actionType = 'attack';
  result.targetCharacterId = targetId;
  result.targetName = target.characterName;


  // Engagement opportunity attacks: only trigger when actor attacks a target they
  // are NOT already engaged with (i.e. breaking engagement to reach someone new).
  if (!actor.engagedTo.includes(targetId)) {
    for (const engagerId of actor.engagedTo) {
      const engager = combatants.get(engagerId);
      if (engager && engager.isAlive) {
        const opp = resolveOpportunityAttack(sessionId, engager, actor, combatants, roundNumber, turnNumber);
        result.opportunityAttacks.push(opp);
        if (!actor.isAlive) {
          result.narrative = `${actor.characterName} fell before completing their attack.`;
          return result;
        }
      }
    }
  }

  // Check protection: if target is being protected, protectors get opportunity attacks
  const protectors = Array.from(combatants.values()).filter(
    c => c.isAlive && c.protectingId === targetId && c.characterId !== actor.characterId,
  );
  for (const protector of protectors) {
    const opp = resolveOpportunityAttack(sessionId, protector, actor, combatants, roundNumber, turnNumber);
    result.opportunityAttacks.push(opp);
    if (!actor.isAlive) {
      result.narrative = `${actor.characterName} fell before completing their attack.`;
      return result;
    }
  }

  // Resolve the contested attack
  const targetHealthBefore = target.currentHealth;
  const attackerStats = getLiveStats(actor);
  const defenderStats = getLiveStats(target);
  const ctx = buildAttackContext(actor, target, combatants);

  const attackRes = resolveContestedAttack(attackerStats, defenderStats, ctx);
  result.attackResult = attackRes;

  // Sync health/durability back to session combatants
  syncBack(actor, attackerStats);   // counter-attack may have hurt actor
  syncBack(target, defenderStats);

  // Detect health threshold crossing
  result.targetThresholdCrossed = target.isAlive
    ? detectThresholdCrossed(targetHealthBefore, target.currentHealth, target.maxHealth)
    : null;

  // Apply status effects from the attack
  if (attackRes.hit && attackRes.statusEffectsApplied.length > 0) {
    applyAttackStatusEffects(target, attackRes);
    result.statusEffectsApplied.push(...attackRes.statusEffectsApplied);
  }

  // Apply counter-attack status effects to actor
  if (attackRes.counterAttack) {
    for (const effect of attackRes.counterAttack.statusEffectsApplied) {
      const config = STATUS_EFFECT_CONFIG[effect.type];
      const maxStacks = config?.maxStacks ?? 1;
      addEffect(actor, effect, maxStacks);
      result.statusEffectsApplied.push(effect);

      if (effect.type === 'sundered') {
        const sunderedStacks = getEffectStacks(actor, 'sundered');
        const mitLoss = (config?.mitigationLoss ?? 5) * sunderedStacks;
        actor.totalMitigation = Math.max(0, actor.statsSnapshot.baseMitigation - mitLoss);
      }
    }
  }

  // Process dagger crit bonus strike
  if (attackRes.bonusStrike) {
    syncBack(actor, attackerStats);
    syncBack(target, defenderStats);

    if (attackRes.bonusStrike.hit && attackRes.bonusStrike.statusEffectsApplied.length > 0) {
      applyAttackStatusEffects(target, attackRes.bonusStrike);
      result.statusEffectsApplied.push(...attackRes.bonusStrike.statusEffectsApplied);
    }

    if (attackRes.bonusStrike.counterAttack) {
      for (const effect of attackRes.bonusStrike.counterAttack.statusEffectsApplied) {
        const config = STATUS_EFFECT_CONFIG[effect.type];
        const maxStacks = config?.maxStacks ?? 1;
        addEffect(actor, effect, maxStacks);
        result.statusEffectsApplied.push(effect);

        if (effect.type === 'sundered') {
          const sunderedStacks = getEffectStacks(actor, 'sundered');
          const mitLoss = (config?.mitigationLoss ?? 5) * sunderedStacks;
          actor.totalMitigation = Math.max(0, actor.statsSnapshot.baseMitigation - mitLoss);
        }
      }
    }
  }

  // Apply engagement
  if (!actor.engagedTo.includes(targetId)) {
    actor.engagedTo.push(targetId);
  }
  if (!target.engagedTo.includes(actor.characterId)) {
    target.engagedTo.push(actor.characterId);
  }

  // Build narrative
  const mainNarrativeParts: string[] = [];
  if (attackRes.dodged) {
    let line = `${target.characterName} dodges ${actor.characterName}'s attack!`;
    if (attackRes.dodgeRiposte) {
      line += ` ${target.characterName} ripostes for ${attackRes.dodgeRiposte.damage} damage (${attackRes.dodgeRiposte.damageLabel})!`;
    }
    mainNarrativeParts.push(line);
  } else if (attackRes.defenseReversal && attackRes.counterAttack) {
    let line = `${actor.characterName} strikes at ${target.characterName} but the blow is turned aside!`;
    line += ` ${target.characterName} counter-attacks for ${attackRes.counterAttack.damage} damage!`;
    mainNarrativeParts.push(line);
  } else if (!attackRes.hit) {
    mainNarrativeParts.push(`${actor.characterName} attacks ${target.characterName} but misses.`);
  } else if (attackRes.hit) {
    let line = `${actor.characterName} hits ${target.characterName} for ${attackRes.damage} damage (${attackRes.damageLabel}).`;
    if (attackRes.hitQuality === 'strong') {
      line += ` A strong blow!`;
    } else if (attackRes.isCrit && attackRes.critEffectsApplied.length > 0) {
      line += ` CRITICAL HIT!`;
    }
    mainNarrativeParts.push(line);

    // Dagger crit bonus strike narrative
    if (attackRes.bonusStrike) {
      if (attackRes.bonusStrike.hit) {
        let bonusLine = `Bonus strike hits for ${attackRes.bonusStrike.damage} damage (${attackRes.bonusStrike.damageLabel})!`;
        if (attackRes.bonusStrike.isCrit) bonusLine = `Bonus strike CRITS for ${attackRes.bonusStrike.damage} damage!`;
        mainNarrativeParts.push(bonusLine);
      } else {
        mainNarrativeParts.push(`Bonus strike is deflected!`);
        if (attackRes.bonusStrike.counterAttack) {
          mainNarrativeParts.push(`${target.characterName} counter-attacks for ${attackRes.bonusStrike.counterAttack.damage} damage!`);
        }
      }
    }
  }

  // Health threshold flavor for the combat log
  if (result.targetThresholdCrossed) {
    const thresholdLog: Record<number, string> = {
      4: `${target.characterName} shrugs off the blow.`,
      3: `${target.characterName} fights on through the pain.`,
      2: `${target.characterName} stands through sheer determination.`,
      1: `${target.characterName} refuses to fall, bloodied but unbowed.`,
    };
    const logText = thresholdLog[result.targetThresholdCrossed];
    if (logText) mainNarrativeParts.push(logText);
  }

  if (!target.isAlive) {
    mainNarrativeParts.push(`${target.characterName} has fallen!`);
  }
  if (attackRes.counterAttack && !actor.isAlive) {
    mainNarrativeParts.push(`${actor.characterName} has fallen to the counter-attack!`);
  }
  if (attackRes.dodgeRiposte && !actor.isAlive) {
    mainNarrativeParts.push(`${actor.characterName} has fallen to the riposte!`);
  }

  result.narrative = mainNarrativeParts.join(' ');

  // Update pressured status for target
  recalculatePressured(target, combatants);

  return result;
}

/**
 * Resolve a protect action — guard an ally.
 */
export function resolveProtect(
  sessionId: number,
  actor: CombatSessionCombatant,
  wardId: number,
  combatants: Map<number, CombatSessionCombatant>,
  roundNumber: number,
  turnNumber: number,
): ActionResult {
  const ward = getCombatant(combatants, wardId);
  const result = emptyActionResult(sessionId, roundNumber, turnNumber, actor);
  result.actionType = 'protect';
  result.targetCharacterId = wardId;
  result.targetName = ward.characterName;

  actor.protectingId = wardId;
  const effect: StatusEffect = {
    type: 'protecting',
    stacks: 1,
    roundsRemaining: 1,
    sourceCharacterId: actor.characterId,
  };
  addEffect(actor, effect);
  result.statusEffectsApplied.push({ ...effect });

  result.narrative = `${actor.characterName} moves to protect ${ward.characterName}.`;
  return result;
}

/**
 * Resolve a grapple action — contested Prowess pool vs Prowess pool.
 */
export function resolveGrapple(
  sessionId: number,
  actor: CombatSessionCombatant,
  targetId: number,
  combatants: Map<number, CombatSessionCombatant>,
  roundNumber: number,
  turnNumber: number,
): ActionResult {
  const target = getCombatant(combatants, targetId);
  const result = emptyActionResult(sessionId, roundNumber, turnNumber, actor);
  result.actionType = 'grapple';
  result.targetCharacterId = targetId;
  result.targetName = target.characterName;

  const actorStats = actor.statsSnapshot;
  const targetStats = target.statsSnapshot;

  // Contested Prowess pool
  const actorPool = rollCombatPool(actorStats.prowess);
  const targetPool = rollCombatPool(targetStats.prowess);
  const success = actorPool.successes > targetPool.successes; // Ties go to defender

  if (success) {
    // Apply grappled/grappling effects
    const grappledEffect: StatusEffect = {
      type: 'grappled',
      stacks: 1,
      roundsRemaining: -1,
      sourceCharacterId: actor.characterId,
    };
    const grapplingEffect: StatusEffect = {
      type: 'grappling',
      stacks: 1,
      roundsRemaining: -1,
      sourceCharacterId: target.characterId,
    };
    addEffect(target, grappledEffect);
    addEffect(actor, grapplingEffect);
    result.statusEffectsApplied.push({ ...grappledEffect }, { ...grapplingEffect });

    // Engage both
    if (!actor.engagedTo.includes(targetId)) actor.engagedTo.push(targetId);
    if (!target.engagedTo.includes(actor.characterId)) target.engagedTo.push(actor.characterId);

    result.narrative = `${actor.characterName} grapples ${target.characterName}! [${actorPool.successes} vs ${targetPool.successes} successes] (${target.characterName} suffers -3 defense dice)`;
  } else {
    result.narrative = `${actor.characterName} attempts to grapple ${target.characterName} but fails! [${actorPool.successes} vs ${targetPool.successes} successes]`;
  }

  return result;
}

/**
 * Resolve a disengage action — contested Cunning pool vs Prowess pool.
 * On failure, the engager gets a free opportunity attack.
 */
export function resolveDisengage(
  sessionId: number,
  actor: CombatSessionCombatant,
  engagerId: number,
  combatants: Map<number, CombatSessionCombatant>,
  roundNumber: number,
  turnNumber: number,
): ActionResult {
  const engager = getCombatant(combatants, engagerId);
  const result = emptyActionResult(sessionId, roundNumber, turnNumber, actor);
  result.actionType = 'disengage';
  result.targetCharacterId = engagerId;
  result.targetName = engager.characterName;

  const actorStats = actor.statsSnapshot;
  const engagerStats = engager.statsSnapshot;

  // Contested: Cunning pool vs Prowess pool
  const actorPool = rollCombatPool(actorStats.cunning);
  const engagerPool = rollCombatPool(engagerStats.prowess);
  const success = actorPool.successes > engagerPool.successes;

  if (success) {
    // Successfully disengaged — remove engagement
    actor.engagedTo = actor.engagedTo.filter(id => id !== engagerId);
    engager.engagedTo = engager.engagedTo.filter(id => id !== actor.characterId);

    // Remove grapple if present
    if (hasEffect(actor, 'grappled')) {
      removeEffect(actor, 'grappled');
      removeEffect(engager, 'grappling');
      result.statusEffectsRemoved.push(
        { characterId: actor.characterId, type: 'grappled' },
        { characterId: engager.characterId, type: 'grappling' },
      );
    }

    recalculatePressured(actor, combatants);
    recalculatePressured(engager, combatants);

    result.narrative = `${actor.characterName} disengages from ${engager.characterName}! [${actorPool.successes} vs ${engagerPool.successes} successes]`;
  } else {
    // Failed — engager gets free opportunity attack
    const opp = resolveOpportunityAttack(sessionId, engager, actor, combatants, roundNumber, turnNumber);
    result.opportunityAttacks.push(opp);

    result.narrative = `${actor.characterName} fails to disengage from ${engager.characterName}! [${actorPool.successes} vs ${engagerPool.successes} successes]`;
  }

  return result;
}

/**
 * Resolve a brace action — skip attacking, gain +1 defense die per incoming attack this round.
 */
export function resolveBrace(
  sessionId: number,
  actor: CombatSessionCombatant,
  roundNumber: number,
  turnNumber: number,
): ActionResult {
  const result = emptyActionResult(sessionId, roundNumber, turnNumber, actor);
  result.actionType = 'brace';

  actor.isBracing = true;
  const effect: StatusEffect = {
    type: 'bracing',
    stacks: 1,
    roundsRemaining: 1,
    sourceCharacterId: actor.characterId,
  };
  addEffect(actor, effect);
  result.statusEffectsApplied.push({ ...effect });

  result.narrative = `${actor.characterName} braces for impact, bolstering defenses.`;
  return result;
}

/**
 * Resolve an opportunity attack — always hits, uses contested attack pipeline.
 */
export function resolveOpportunityAttack(
  sessionId: number,
  attacker: CombatSessionCombatant,
  target: CombatSessionCombatant,
  combatants: Map<number, CombatSessionCombatant>,
  roundNumber: number,
  turnNumber: number,
): ActionResult {
  const result = emptyActionResult(sessionId, roundNumber, turnNumber, attacker);
  result.actionType = 'opportunity_attack';
  result.targetCharacterId = target.characterId;
  result.targetName = target.characterName;

  const targetHealthBefore = target.currentHealth;
  const attackerStats = getLiveStats(attacker);
  const defenderStats = getLiveStats(target);
  const ctx = buildAttackContext(attacker, target, combatants, true);

  const attackRes = resolveContestedAttack(attackerStats, defenderStats, ctx);
  result.attackResult = attackRes;

  syncBack(attacker, attackerStats);
  syncBack(target, defenderStats);

  // Detect health threshold crossing
  result.targetThresholdCrossed = target.isAlive
    ? detectThresholdCrossed(targetHealthBefore, target.currentHealth, target.maxHealth)
    : null;

  // Apply status effects
  if (attackRes.statusEffectsApplied.length > 0) {
    applyAttackStatusEffects(target, attackRes);
    result.statusEffectsApplied.push(...attackRes.statusEffectsApplied);
  }

  // Process dagger crit bonus strike
  if (attackRes.bonusStrike) {
    syncBack(attacker, attackerStats);
    syncBack(target, defenderStats);

    if (attackRes.bonusStrike.hit && attackRes.bonusStrike.statusEffectsApplied.length > 0) {
      applyAttackStatusEffects(target, attackRes.bonusStrike);
      result.statusEffectsApplied.push(...attackRes.bonusStrike.statusEffectsApplied);
    }
  }

  let narrative = `${attacker.characterName} strikes ${target.characterName} with an opportunity attack for ${attackRes.damage} damage (${attackRes.damageLabel})!`;
  if (attackRes.isCrit) {
    narrative += ` CRITICAL HIT!`;
  } else if (attackRes.hitQuality === 'strong') {
    narrative += ` A strong blow!`;
  }
  if (attackRes.bonusStrike) {
    if (attackRes.bonusStrike.hit) {
      narrative += ` Bonus strike hits for ${attackRes.bonusStrike.damage} damage!`;
    } else {
      narrative += ` Bonus strike is deflected!`;
    }
  }

  // Health threshold flavor for the combat log
  if (result.targetThresholdCrossed) {
    const thresholdLog: Record<number, string> = {
      4: `${target.characterName} shrugs off the blow.`,
      3: `${target.characterName} fights on through the pain.`,
      2: `${target.characterName} stands through sheer determination.`,
      1: `${target.characterName} refuses to fall, bloodied but unbowed.`,
    };
    const logText = thresholdLog[result.targetThresholdCrossed];
    if (logText) narrative += ` ${logText}`;
  }

  if (!target.isAlive) {
    narrative += ` ${target.characterName} has fallen!`;
  }
  result.narrative = narrative;

  return result;
}

// ============================================
// Round processing
// ============================================

/**
 * Process the start of a new round:
 * 1. Apply bleeding damage
 * 2. Decrement/remove timed effects
 * 3. Clear bracing/protecting flags
 * 4. Recalculate pressured status
 * 5. Check for deaths from bleeding
 */
export function processRoundStart(
  combatants: Map<number, CombatSessionCombatant>,
  roundNumber: number,
): RoundStartResult {
  const result: RoundStartResult = {
    roundNumber,
    bleedingDamage: [],
    expiredEffects: [],
    deaths: [],
  };

  const bleedDmgPerStack = STATUS_EFFECT_CONFIG.bleeding.dotDamage ?? 5;

  for (const [, combatant] of combatants) {
    if (!combatant.isAlive) continue;

    // 1. Bleeding damage
    const bleedingStacks = getEffectStacks(combatant, 'bleeding');
    if (bleedingStacks > 0) {
      const bleedDmg = bleedDmgPerStack * bleedingStacks;
      combatant.currentHealth = Math.max(0, combatant.currentHealth - bleedDmg);
      result.bleedingDamage.push({
        characterId: combatant.characterId,
        damage: bleedDmg,
        stacks: bleedingStacks,
      });
      if (combatant.currentHealth <= 0) {
        combatant.isAlive = false;
        result.deaths.push({ characterId: combatant.characterId, cause: 'bleeding' });
      }
    }

    // 2. Decrement timed effects (skip 'stunned' — consumed at the character's turn)
    const toRemove: StatusEffectType[] = [];
    for (const effect of combatant.statusEffects) {
      if (effect.type === 'stunned') continue;
      if (effect.roundsRemaining > 0) {
        effect.roundsRemaining--;
        if (effect.roundsRemaining <= 0) {
          toRemove.push(effect.type);
        }
      }
    }
    for (const type of toRemove) {
      removeEffect(combatant, type);
      result.expiredEffects.push({ characterId: combatant.characterId, type });
    }

    // 3. Clear bracing and protecting
    combatant.isBracing = false;
    combatant.protectingId = null;
    removeEffect(combatant, 'bracing');
    removeEffect(combatant, 'protecting');
  }

  // 4. Recalculate pressured for all alive combatants
  for (const [, combatant] of combatants) {
    if (combatant.isAlive) {
      recalculatePressured(combatant, combatants);
    }
  }

  return result;
}

/**
 * Recalculate whether a combatant is pressured (2+ enemies engaging).
 */
function recalculatePressured(
  combatant: CombatSessionCombatant,
  combatants: Map<number, CombatSessionCombatant>,
): void {
  const enemyEngagers = combatant.engagedTo.filter(id => {
    const other = combatants.get(id);
    return other && other.isAlive && other.team !== combatant.team;
  });

  if (enemyEngagers.length >= 2) {
    if (!hasEffect(combatant, 'pressured')) {
      combatant.statusEffects.push({
        type: 'pressured',
        stacks: 1,
        roundsRemaining: -1,
        sourceCharacterId: 0,
      });
    }
  } else {
    removeEffect(combatant, 'pressured');
  }
}

// ============================================
// Action validation
// ============================================

/**
 * Validate that an action is legal for the given combatant state.
 * Returns null if valid, or an error message string.
 */
export function validateAction(
  actor: CombatSessionCombatant,
  actionType: string,
  targetId: number | undefined,
  combatants: Map<number, CombatSessionCombatant>,
): string | null {
  if (!actor.isAlive) return 'You are dead';
  if (actor.isYielded) return 'You have yielded';
  if (hasEffect(actor, 'stunned')) return 'You are stunned';

  switch (actionType) {
    case 'attack': {
      if (targetId === undefined) return 'Attack requires a target';
      const target = combatants.get(targetId);
      if (!target) return 'Target not found';
      if (!target.isAlive) return 'Target is already dead';
      if (target.team === actor.team) return 'Cannot attack allies';
      return null;
    }
    case 'protect': {
      if (targetId === undefined) return 'Protect requires a target';
      const ward = combatants.get(targetId);
      if (!ward) return 'Target not found';
      if (!ward.isAlive) return 'Target is already dead';
      if (ward.team !== actor.team) return 'Can only protect allies';
      if (ward.characterId === actor.characterId) return 'Cannot protect yourself';
      return null;
    }
    case 'grapple': {
      if (targetId === undefined) return 'Grapple requires a target';
      const target = combatants.get(targetId);
      if (!target) return 'Target not found';
      if (!target.isAlive) return 'Target is already dead';
      if (target.team === actor.team) return 'Cannot grapple allies';
      if (hasEffect(actor, 'grappling')) return 'Already grappling someone';
      return null;
    }
    case 'disengage': {
      if (actor.engagedTo.length === 0) return 'Not engaged with anyone';
      if (targetId !== undefined) {
        if (!actor.engagedTo.includes(targetId)) return 'Not engaged with that target';
      }
      return null;
    }
    case 'brace': {
      return null;
    }
    default:
      return `Unknown action: ${actionType}`;
  }
}
