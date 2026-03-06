#!/usr/bin/env node

// ═══════════════════════════════════════════════════════════════════════════
//  VHAGAR + 4 ARMIES  vs  CARAXES + MELEYS + 1 ARMY
//
//  Green side: Vhagar + 4 × Size 1 Military (12,000 men, 8 scorpions)
//  Black side: Caraxes + Meleys + 1 × Size 1 Military (3,000 men, 2 scorpions)
//
//  Battle flow:
//    Tick 1: Armies fight. Caraxes + Meleys intercept Vhagar (2v1 duel).
//           Duel resolves at end of tick 1 — no strafing this tick.
//    Tick 2+: Surviving dragons strafe. Armies fight. Scorpions fire.
//    Initiative: Meleys (Agi 10) → Caraxes (Agi 9) → Vhagar (Agi 3).
//    Vhagar targets the duo dragon with lowest HP% (tries to finish one off).
//    When one duo dragon dies/flees, it becomes a 1v1.
//
//  Army combat: simplified damage exchange per tick.
//  Dragon duels: full d10 pool combat (strike/evasion/wounds/bleed/crits/flee).
//  Scorpions: fire at strafing dragons each tick. No fire during duels.
//  Canonical riders (Aemond, Daemon, Rhaenys — actual stats, not equal riders).
// ═══════════════════════════════════════════════════════════════════════════

const SIMULATIONS = 10000;
const MAX_TICKS = 100;
const WITHDRAW_HP_PCT = 0.30;
const MORALE_CAP = 20;
const COMBAT_RATE = 0.015;

function clampMorale(m) { return Math.max(-MORALE_CAP, Math.min(MORALE_CAP, m)); }

// ═══════════════════════════════════════════════════════════════════════════
//  DRAGON DEFINITIONS — Canonical Riders
// ═══════════════════════════════════════════════════════════════════════════

function makeDragon(name, tier, might, agility, ferocity, resilience, rider) {
  const rOff = rider ? Math.floor(Math.max(rider.prowess, rider.command) / 2) : 0;
  const rDef = rider ? Math.floor(Math.max(rider.cunning, rider.fortitude) / 2) : 0;
  return {
    name, tier, might, agility, ferocity, resilience, rider,
    maxHp:             (might + resilience) * tier * 5,
    strike:            might + ferocity + rOff,
    evasion:           agility + Math.floor(resilience / 2) + rDef,
    damagePerHit:      tier + 3,
    critChance:        agility / 100,
    terror:            tier * 2 + Math.floor(ferocity / 2),
    strafeDmg:         tier * 500 + might * 100,
    scorpHitThreshold: getScorpionThreshold(agility),
    scorpDmgPerHit:    getScorpionDamage(tier, resilience),
  };
}

function getScorpionThreshold(agility) {
  if (agility <= 2) return 10;
  if (agility <= 4) return 12;
  if (agility <= 6) return 14;
  if (agility <= 8) return 16;
  return 18;
}

function getScorpionDamage(tier, resilience) {
  return Math.max(5, (tier + 1) * 5 - resilience);
}

const AEMOND  = { prowess: 7, command: 5, cunning: 8, fortitude: 6 };
const DAEMON  = { prowess: 9, command: 7, cunning: 7, fortitude: 6 };
const RHAENYS = { prowess: 5, command: 8, cunning: 7, fortitude: 7 };

const VHAGAR  = makeDragon('Vhagar',  5, 10, 3,  10, 10, AEMOND);
const CARAXES = makeDragon('Caraxes', 5, 7,  9,  10, 6,  DAEMON);
const MELEYS  = makeDragon('Meleys',  5, 7,  10, 8,  7,  RHAENYS);

// ═══════════════════════════════════════════════════════════════════════════
//  DRAGON DUEL ENGINE — 1v1 and 2v1
// ═══════════════════════════════════════════════════════════════════════════

const BLEED_DMG = 3;
const BLEED_MAX = 3;

function rollPool(n) {
  let s = 0;
  for (let i = 0; i < n; i++) if (Math.floor(Math.random() * 10) + 1 >= 6) s++;
  return s;
}

function getWoundPenalty(hp, maxHp) {
  const pct = hp / maxHp;
  if (pct > 0.75) return 0;
  if (pct > 0.50) return 2;
  if (pct > 0.25) return 4;
  return 6;
}

function wantsToFlee(hp, maxHp, ferocity) {
  const pct = hp / maxHp;
  if (pct > 0.50) return false;
  if (pct > 0.25) return ferocity < 5;
  return ferocity < 8;
}

function attemptDisengage(fleeAgi, pursueAgi, fleePen, pursuePen) {
  return rollPool(Math.max(0, fleeAgi - fleePen)) > rollPool(Math.max(0, pursueAgi - pursuePen));
}

// Attack resolution: attacker strikes defender
function resolveAttack(atk, def, hpDef, maxHpDef, bleedDef) {
  const penAtk = getWoundPenalty(atk.currentHp, atk.ref.maxHp);
  const penDef = getWoundPenalty(hpDef, maxHpDef);

  const strikePool = Math.max(0, atk.ref.strike - penAtk);
  const evasionPool = Math.max(0, def.ref.evasion - penDef);
  const hits = rollPool(strikePool);
  const blocks = rollPool(evasionPool);
  const unblocked = Math.max(0, hits - blocks);
  const dmg = unblocked * atk.ref.damagePerHit;

  // Crits → bleeding
  let newBleed = bleedDef;
  for (let i = 0; i < unblocked; i++) {
    if (Math.random() < atk.ref.critChance) newBleed = Math.min(BLEED_MAX, newBleed + 1);
  }

  return { dmg, newHp: Math.max(0, hpDef - dmg), newBleed, unblocked };
}

// 1v1 duel tick (used after one duo dragon is eliminated)
function duelTick1v1(state) {
  let { a, b, hpA, hpB, bleedA, bleedB, ticks } = state;
  ticks++;

  // Bleeding
  if (bleedA > 0) hpA = Math.max(0, hpA - bleedA * BLEED_DMG);
  if (bleedB > 0) hpB = Math.max(0, hpB - bleedB * BLEED_DMG);
  if (hpA <= 0 && hpB <= 0) return { ...state, ticks, hpA: 0, hpB: 0, result: 'mutual_kill', winner: null, loser: null };
  if (hpA <= 0) return { ...state, ticks, hpA: 0, hpB, result: 'kill', winner: b, loser: a, winnerHp: hpB };
  if (hpB <= 0) return { ...state, ticks, hpA, hpB: 0, result: 'kill', winner: a, loser: b, winnerHp: hpA };

  // Flee checks
  const penA = getWoundPenalty(hpA, a.maxHp);
  const penB = getWoundPenalty(hpB, b.maxHp);
  const aFlee = wantsToFlee(hpA, a.maxHp, a.ferocity);
  const bFlee = wantsToFlee(hpB, b.maxHp, b.ferocity);

  if (aFlee && !bFlee) {
    if (attemptDisengage(a.agility, b.agility, penA, penB))
      return { ...state, ticks, hpA, hpB, result: 'flee', winner: b, loser: a, winnerHp: hpB, loserHp: hpA, fled: a.name };
  } else if (bFlee && !aFlee) {
    if (attemptDisengage(b.agility, a.agility, penB, penA))
      return { ...state, ticks, hpA, hpB, result: 'flee', winner: a, loser: b, winnerHp: hpA, loserHp: hpB, fled: b.name };
  } else if (aFlee && bFlee) {
    if (attemptDisengage(a.agility, b.agility, penA, penB))
      return { ...state, ticks, hpA, hpB, result: 'flee', winner: b, loser: a, winnerHp: hpB, loserHp: hpA, fled: a.name };
    if (attemptDisengage(b.agility, a.agility, penB, penA))
      return { ...state, ticks, hpA, hpB, result: 'flee', winner: a, loser: b, winnerHp: hpA, loserHp: hpB, fled: b.name };
  }

  // Initiative
  let first, second, hpFirst, hpSecond, bleedFirst, bleedSecond;
  if (a.agility > b.agility || (a.agility === b.agility && a.ferocity >= b.ferocity)) {
    first = a; second = b; hpFirst = hpA; hpSecond = hpB; bleedFirst = bleedA; bleedSecond = bleedB;
  } else {
    first = b; second = a; hpFirst = hpB; hpSecond = hpA; bleedFirst = bleedB; bleedSecond = bleedA;
  }

  const penFirst  = getWoundPenalty(hpFirst, first.maxHp);
  const penSecond = getWoundPenalty(hpSecond, second.maxHp);

  // First strikes
  const s1 = Math.max(0, first.strike - penFirst);
  const e1 = Math.max(0, second.evasion - penSecond);
  const hits1 = rollPool(s1);
  const blocks1 = rollPool(e1);
  const ub1 = Math.max(0, hits1 - blocks1);
  hpSecond = Math.max(0, hpSecond - ub1 * first.damagePerHit);
  for (let i = 0; i < ub1; i++) if (Math.random() < first.critChance) bleedSecond = Math.min(BLEED_MAX, bleedSecond + 1);

  if (hpSecond <= 0) {
    if (first === a) return { ...state, ticks, hpA: hpFirst, hpB: 0, result: 'kill', winner: a, loser: b, winnerHp: hpFirst };
    else return { ...state, ticks, hpA: 0, hpB: hpFirst, result: 'kill', winner: b, loser: a, winnerHp: hpFirst };
  }

  // Second strikes
  const penSecUpd = getWoundPenalty(hpSecond, second.maxHp);
  const s2 = Math.max(0, second.strike - penSecUpd);
  const e2 = Math.max(0, first.evasion - penFirst);
  const hits2 = rollPool(s2);
  const blocks2 = rollPool(e2);
  const ub2 = Math.max(0, hits2 - blocks2);
  hpFirst = Math.max(0, hpFirst - ub2 * second.damagePerHit);
  for (let i = 0; i < ub2; i++) if (Math.random() < second.critChance) bleedFirst = Math.min(BLEED_MAX, bleedFirst + 1);

  if (first === a) { hpA = hpFirst; hpB = hpSecond; bleedA = bleedFirst; bleedB = bleedSecond; }
  else { hpB = hpFirst; hpA = hpSecond; bleedB = bleedFirst; bleedA = bleedSecond; }

  state.hpA = hpA; state.hpB = hpB; state.bleedA = bleedA; state.bleedB = bleedB; state.ticks = ticks;
  return null;
}

// ═══════════════════════════════════════════════════════════════════════════
//  2v1 DUEL ENGINE — Caraxes + Meleys vs Vhagar
//
//  Initiative order: Meleys (Agi 10) → Caraxes (Agi 9) → Vhagar (Agi 3)
//  Both duo dragons attack Vhagar. Vhagar attacks the duo dragon with
//  lowest HP% (tries to finish one off). On ties, targets higher Strike.
//  When one duo dragon dies/flees, transitions to 1v1.
// ═══════════════════════════════════════════════════════════════════════════

function duel2v1Tick(state) {
  // state: { solo, duo1, duo2, hpSolo, hpDuo1, hpDuo2, bleedSolo, bleedDuo1, bleedDuo2, ticks, duo1Dead, duo2Dead }
  let { solo, duo1, duo2, hpSolo, hpDuo1, hpDuo2, bleedSolo, bleedDuo1, bleedDuo2, ticks, duo1Dead, duo2Dead } = state;
  ticks++;

  // ── Bleeding ──
  if (bleedSolo > 0) hpSolo = Math.max(0, hpSolo - bleedSolo * BLEED_DMG);
  if (!duo1Dead && bleedDuo1 > 0) hpDuo1 = Math.max(0, hpDuo1 - bleedDuo1 * BLEED_DMG);
  if (!duo2Dead && bleedDuo2 > 0) hpDuo2 = Math.max(0, hpDuo2 - bleedDuo2 * BLEED_DMG);

  // Check bleed deaths
  if (hpDuo1 <= 0 && !duo1Dead) duo1Dead = true;
  if (hpDuo2 <= 0 && !duo2Dead) duo2Dead = true;

  if (hpSolo <= 0) {
    state.hpSolo = 0; state.hpDuo1 = hpDuo1; state.hpDuo2 = hpDuo2; state.ticks = ticks;
    state.bleedSolo = bleedSolo; state.bleedDuo1 = bleedDuo1; state.bleedDuo2 = bleedDuo2;
    state.duo1Dead = duo1Dead; state.duo2Dead = duo2Dead;
    return { ...state, result: 'solo_killed', killedBy: 'bleed' };
  }

  if (duo1Dead && duo2Dead) {
    state.hpSolo = hpSolo; state.hpDuo1 = 0; state.hpDuo2 = 0; state.ticks = ticks;
    state.bleedSolo = bleedSolo; state.duo1Dead = true; state.duo2Dead = true;
    return { ...state, result: 'duo_eliminated' };
  }

  // If only one duo dragon remains, transition to 1v1 happens in the caller
  // But we still process this tick as 2v1 (or 1v1 if one just died to bleed)

  // ── Flee checks ──
  const penSolo = getWoundPenalty(hpSolo, solo.maxHp);

  // Duo dragons flee check (individually)
  if (!duo1Dead) {
    const penD1 = getWoundPenalty(hpDuo1, duo1.maxHp);
    if (wantsToFlee(hpDuo1, duo1.maxHp, duo1.ferocity)) {
      if (attemptDisengage(duo1.agility, solo.agility, penD1, penSolo)) {
        duo1Dead = true; // fled = effectively out
        state.duo1Fled = true;
        state.duo1FleeHp = hpDuo1;
        if (duo2Dead) {
          // Both duo dragons gone
          state.hpSolo = hpSolo; state.hpDuo1 = hpDuo1; state.hpDuo2 = hpDuo2; state.ticks = ticks;
          state.bleedSolo = bleedSolo; state.duo1Dead = true; state.duo2Dead = true;
          return { ...state, result: 'duo_eliminated' };
        }
      }
    }
  }
  if (!duo2Dead) {
    const penD2 = getWoundPenalty(hpDuo2, duo2.maxHp);
    if (wantsToFlee(hpDuo2, duo2.maxHp, duo2.ferocity)) {
      if (attemptDisengage(duo2.agility, solo.agility, penD2, penSolo)) {
        duo2Dead = true;
        state.duo2Fled = true;
        state.duo2FleeHp = hpDuo2;
        if (duo1Dead) {
          state.hpSolo = hpSolo; state.hpDuo1 = hpDuo1; state.hpDuo2 = hpDuo2; state.ticks = ticks;
          state.bleedSolo = bleedSolo; state.duo1Dead = true; state.duo2Dead = true;
          return { ...state, result: 'duo_eliminated' };
        }
      }
    }
  }

  // Solo flee check — must disengage from all remaining pursuers
  // Vhagar: Ferocity 10, will never want to flee. But handle it generically.
  if (wantsToFlee(hpSolo, solo.maxHp, solo.ferocity)) {
    let canEscape = true;
    if (!duo1Dead) {
      const penD1 = getWoundPenalty(hpDuo1, duo1.maxHp);
      if (!attemptDisengage(solo.agility, duo1.agility, penSolo, penD1)) canEscape = false;
    }
    if (canEscape && !duo2Dead) {
      const penD2 = getWoundPenalty(hpDuo2, duo2.maxHp);
      if (!attemptDisengage(solo.agility, duo2.agility, penSolo, penD2)) canEscape = false;
    }
    if (canEscape) {
      state.hpSolo = hpSolo; state.hpDuo1 = hpDuo1; state.hpDuo2 = hpDuo2; state.ticks = ticks;
      state.bleedSolo = bleedSolo; state.bleedDuo1 = bleedDuo1; state.bleedDuo2 = bleedDuo2;
      state.duo1Dead = duo1Dead; state.duo2Dead = duo2Dead;
      state.soloFled = true;
      return { ...state, result: 'solo_fled' };
    }
  }

  // ── Combat — sorted by Agility (highest first) ──
  // Build attack order: all living dragons sorted by agility desc, ferocity breaks ties
  const combatants = [];
  if (!duo1Dead) combatants.push({ type: 'duo1', ref: duo1, hp: hpDuo1, bleed: bleedDuo1 });
  if (!duo2Dead) combatants.push({ type: 'duo2', ref: duo2, hp: hpDuo2, bleed: bleedDuo2 });
  combatants.push({ type: 'solo', ref: solo, hp: hpSolo, bleed: bleedSolo });
  combatants.sort((a, b) => b.ref.agility - a.ref.agility || b.ref.ferocity - a.ref.ferocity);

  // Determine Vhagar's target: lowest HP% duo dragon. Ties → higher Strike.
  let soloTarget = null;
  if (!duo1Dead && !duo2Dead) {
    const pct1 = hpDuo1 / duo1.maxHp;
    const pct2 = hpDuo2 / duo2.maxHp;
    if (pct1 < pct2) soloTarget = 'duo1';
    else if (pct2 < pct1) soloTarget = 'duo2';
    else soloTarget = duo1.strike >= duo2.strike ? 'duo1' : 'duo2';
  } else if (!duo1Dead) {
    soloTarget = 'duo1';
  } else if (!duo2Dead) {
    soloTarget = 'duo2';
  }

  // Process attacks in initiative order
  for (const c of combatants) {
    // Skip if dead mid-round
    if (c.type === 'solo' && hpSolo <= 0) continue;
    if (c.type === 'duo1' && (duo1Dead || hpDuo1 <= 0)) continue;
    if (c.type === 'duo2' && (duo2Dead || hpDuo2 <= 0)) continue;

    // Update current HP for wound penalty calculation
    const currentHp = c.type === 'solo' ? hpSolo : c.type === 'duo1' ? hpDuo1 : hpDuo2;
    const atkPen = getWoundPenalty(currentHp, c.ref.maxHp);

    if (c.type === 'solo') {
      // Vhagar attacks her target
      if (!soloTarget) continue;
      const targetRef = soloTarget === 'duo1' ? duo1 : duo2;
      const targetHp = soloTarget === 'duo1' ? hpDuo1 : hpDuo2;
      const targetBleed = soloTarget === 'duo1' ? bleedDuo1 : bleedDuo2;
      const defPen = getWoundPenalty(targetHp, targetRef.maxHp);

      const sPool = Math.max(0, solo.strike - atkPen);
      const ePool = Math.max(0, targetRef.evasion - defPen);
      const hits = rollPool(sPool);
      const blocks = rollPool(ePool);
      const ub = Math.max(0, hits - blocks);
      const dmg = ub * solo.damagePerHit;
      let newBleed = targetBleed;
      for (let i = 0; i < ub; i++) if (Math.random() < solo.critChance) newBleed = Math.min(BLEED_MAX, newBleed + 1);

      if (soloTarget === 'duo1') { hpDuo1 = Math.max(0, hpDuo1 - dmg); bleedDuo1 = newBleed; if (hpDuo1 <= 0) duo1Dead = true; }
      else { hpDuo2 = Math.max(0, hpDuo2 - dmg); bleedDuo2 = newBleed; if (hpDuo2 <= 0) duo2Dead = true; }
    } else {
      // Duo dragon attacks Vhagar
      const defPen = getWoundPenalty(hpSolo, solo.maxHp);
      const sPool = Math.max(0, c.ref.strike - atkPen);
      const ePool = Math.max(0, solo.evasion - defPen);
      const hits = rollPool(sPool);
      const blocks = rollPool(ePool);
      const ub = Math.max(0, hits - blocks);
      const dmg = ub * c.ref.damagePerHit;
      let newBleed = bleedSolo;
      for (let i = 0; i < ub; i++) if (Math.random() < c.ref.critChance) newBleed = Math.min(BLEED_MAX, newBleed + 1);
      hpSolo = Math.max(0, hpSolo - dmg);
      bleedSolo = newBleed;
    }
  }

  // Check for deaths after combat
  if (hpDuo1 <= 0) duo1Dead = true;
  if (hpDuo2 <= 0) duo2Dead = true;

  // Update state
  state.hpSolo = hpSolo; state.hpDuo1 = hpDuo1; state.hpDuo2 = hpDuo2;
  state.bleedSolo = bleedSolo; state.bleedDuo1 = bleedDuo1; state.bleedDuo2 = bleedDuo2;
  state.ticks = ticks; state.duo1Dead = duo1Dead; state.duo2Dead = duo2Dead;

  // Check end conditions
  if (hpSolo <= 0) return { ...state, result: 'solo_killed' };
  if (duo1Dead && duo2Dead) return { ...state, result: 'duo_eliminated' };

  return null; // duel continues
}

// ═══════════════════════════════════════════════════════════════════════════
//  ARMY COMBAT
// ═══════════════════════════════════════════════════════════════════════════

function armyDamagePerTick(levy, maa, elite) {
  const totalAtk = levy * 10 + maa * 20 + elite * 30;
  return Math.floor(totalAtk * COMBAT_RATE);
}

function applyDamageToArmy(dmg, levy, maa, elite) {
  const totalHp = levy * 10 + maa * 20 + elite * 30;
  if (totalHp <= 0) return { levy: 0, maa: 0, elite: 0, killed: 0 };
  const levyHp = levy * 10;
  const maaHp = maa * 20;
  const eliteHp = elite * 30;
  const lDmg = Math.floor(dmg * (levyHp / totalHp));
  const mDmg = Math.floor(dmg * (maaHp / totalHp));
  const eDmg = dmg - lDmg - mDmg;
  const lK = Math.min(levy, Math.floor(lDmg / 10));
  const mK = Math.min(maa, Math.floor(mDmg / 20));
  const eK = Math.min(elite, Math.floor(eDmg / 30));
  return { levy: levy - lK, maa: maa - mK, elite: elite - eK, killed: lK + mK + eK };
}

// ═══════════════════════════════════════════════════════════════════════════
//  FULL DUEL RESOLVER — Runs all duel rounds to completion instantly
//  Returns: { vhagar, caraxes, meleys } with hp/died/withdrew/fled state
// ═══════════════════════════════════════════════════════════════════════════

function resolveDuelInstantly(verbose) {
  const duelState = {
    solo: VHAGAR, duo1: CARAXES, duo2: MELEYS,
    hpSolo: VHAGAR.maxHp, hpDuo1: CARAXES.maxHp, hpDuo2: MELEYS.maxHp,
    bleedSolo: 0, bleedDuo1: 0, bleedDuo2: 0,
    ticks: 0, duo1Dead: false, duo2Dead: false,
    duo1Fled: false, duo2Fled: false, soloFled: false,
  };

  const duelLog = [];
  let transitioned = false;
  let duel1v1State = null;
  const MAX_DUEL_ROUNDS = 200; // safety cap

  // Phase 1: 2v1 duel
  for (let round = 0; round < MAX_DUEL_ROUNDS; round++) {
    if (duel1v1State) break; // switched to 1v1

    const result = duel2v1Tick(duelState);

    if (verbose) {
      duelLog.push(`    Round ${duelState.ticks}: Vhagar ${Math.round(duelState.hpSolo / VHAGAR.maxHp * 100)}% | Caraxes ${duelState.duo1Dead ? 'DEAD' : Math.round(duelState.hpDuo1 / CARAXES.maxHp * 100) + '%'} | Meleys ${duelState.duo2Dead ? 'DEAD' : Math.round(duelState.hpDuo2 / MELEYS.maxHp * 100) + '%'}`);
    }

    if (result) {
      // Duel fully resolved
      return buildDuelResult(duelState, result, duelLog, verbose);
    }

    // Check if 2v1 should transition to 1v1
    if (!transitioned) {
      if ((duelState.duo1Dead || duelState.duo1Fled) && !duelState.duo2Dead) {
        transitioned = true;
        if (verbose) duelLog.push(`    ** Caraxes ${duelState.duo1Fled ? 'flees' : 'falls'}! Meleys continues 1v1 vs Vhagar **`);
        duel1v1State = { a: MELEYS, b: VHAGAR, hpA: duelState.hpDuo2, hpB: duelState.hpSolo, bleedA: duelState.bleedDuo2, bleedB: duelState.bleedSolo, ticks: 0 };
      } else if ((duelState.duo2Dead || duelState.duo2Fled) && !duelState.duo1Dead) {
        transitioned = true;
        if (verbose) duelLog.push(`    ** Meleys ${duelState.duo2Fled ? 'flees' : 'falls'}! Caraxes continues 1v1 vs Vhagar **`);
        duel1v1State = { a: CARAXES, b: VHAGAR, hpA: duelState.hpDuo1, hpB: duelState.hpSolo, bleedA: duelState.bleedDuo1, bleedB: duelState.bleedSolo, ticks: 0 };
      }
    }
  }

  // Phase 2: 1v1 continuation
  if (duel1v1State) {
    for (let round = 0; round < MAX_DUEL_ROUNDS; round++) {
      const result = duelTick1v1(duel1v1State);
      const aName = duel1v1State.a === CARAXES ? 'Caraxes' : 'Meleys';

      if (verbose) {
        duelLog.push(`    Round ${duelState.ticks + duel1v1State.ticks}: Vhagar ${Math.round(duel1v1State.hpB / VHAGAR.maxHp * 100)}% | ${aName} ${Math.round(duel1v1State.hpA / duel1v1State.a.maxHp * 100)}%`);
      }

      if (result) {
        return buildDuelResult1v1(duelState, duel1v1State, result, duelLog, verbose);
      }
    }
  }

  // Safety: should never get here, but return current state
  return buildDuelResult(duelState, { result: 'ongoing' }, duelLog, verbose);
}

function buildDuelResult(duelState, result, duelLog, verbose) {
  const out = {
    duelRounds: duelState.ticks,
    duelLog,
    vhagar: { hp: duelState.hpSolo, died: false, withdrew: false, fled: false, strafing: false },
    caraxes: { hp: duelState.hpDuo1, died: false, withdrew: false, fled: false, strafing: false },
    meleys: { hp: duelState.hpDuo2, died: false, withdrew: false, fled: false, strafing: false },
  };

  if (result.result === 'solo_killed') {
    out.vhagar = { hp: 0, died: true, withdrew: false, fled: false, strafing: false };
    // Caraxes
    if (duelState.duo1Dead && !duelState.duo1Fled) out.caraxes = { hp: 0, died: true, withdrew: false, fled: false, strafing: false };
    else if (duelState.duo1Fled) out.caraxes = { hp: duelState.duo1FleeHp || 0, died: false, withdrew: true, fled: true, strafing: false };
    else out.caraxes = { hp: duelState.hpDuo1, died: false, withdrew: duelState.hpDuo1 / CARAXES.maxHp <= WITHDRAW_HP_PCT, fled: false, strafing: duelState.hpDuo1 / CARAXES.maxHp > WITHDRAW_HP_PCT };
    // Meleys
    if (duelState.duo2Dead && !duelState.duo2Fled) out.meleys = { hp: 0, died: true, withdrew: false, fled: false, strafing: false };
    else if (duelState.duo2Fled) out.meleys = { hp: duelState.duo2FleeHp || 0, died: false, withdrew: true, fled: true, strafing: false };
    else out.meleys = { hp: duelState.hpDuo2, died: false, withdrew: duelState.hpDuo2 / MELEYS.maxHp <= WITHDRAW_HP_PCT, fled: false, strafing: duelState.hpDuo2 / MELEYS.maxHp > WITHDRAW_HP_PCT };
  } else if (result.result === 'duo_eliminated') {
    out.vhagar = { hp: duelState.hpSolo, died: false, withdrew: duelState.hpSolo / VHAGAR.maxHp <= WITHDRAW_HP_PCT, fled: false, strafing: duelState.hpSolo / VHAGAR.maxHp > WITHDRAW_HP_PCT };
    if (duelState.duo1Fled) out.caraxes = { hp: duelState.duo1FleeHp || 0, died: false, withdrew: true, fled: true, strafing: false };
    else out.caraxes = { hp: 0, died: true, withdrew: false, fled: false, strafing: false };
    if (duelState.duo2Fled) out.meleys = { hp: duelState.duo2FleeHp || 0, died: false, withdrew: true, fled: true, strafing: false };
    else out.meleys = { hp: 0, died: true, withdrew: false, fled: false, strafing: false };
  } else if (result.result === 'solo_fled') {
    out.vhagar = { hp: duelState.hpSolo, died: false, withdrew: true, fled: true, strafing: false };
    if (!duelState.duo1Dead) out.caraxes = { hp: duelState.hpDuo1, died: false, withdrew: duelState.hpDuo1 / CARAXES.maxHp <= WITHDRAW_HP_PCT, fled: false, strafing: duelState.hpDuo1 / CARAXES.maxHp > WITHDRAW_HP_PCT };
    if (!duelState.duo2Dead) out.meleys = { hp: duelState.hpDuo2, died: false, withdrew: duelState.hpDuo2 / MELEYS.maxHp <= WITHDRAW_HP_PCT, fled: false, strafing: duelState.hpDuo2 / MELEYS.maxHp > WITHDRAW_HP_PCT };
  }

  return out;
}

function buildDuelResult1v1(duelState2v1, duel1v1State, result, duelLog, verbose) {
  const aKey = duel1v1State.a === CARAXES ? 'caraxes' : 'meleys';
  const totalRounds = duelState2v1.ticks + duel1v1State.ticks;

  const out = {
    duelRounds: totalRounds,
    duelLog,
    vhagar: { hp: 0, died: false, withdrew: false, fled: false, strafing: false },
    caraxes: { hp: 0, died: false, withdrew: false, fled: false, strafing: false },
    meleys: { hp: 0, died: false, withdrew: false, fled: false, strafing: false },
  };

  // The dragon that was eliminated in the 2v1 phase
  const eliminatedKey = aKey === 'caraxes' ? 'meleys' : 'caraxes';
  if (duelState2v1[aKey === 'caraxes' ? 'duo2Fled' : 'duo1Fled']) {
    out[eliminatedKey] = { hp: (aKey === 'caraxes' ? duelState2v1.duo2FleeHp : duelState2v1.duo1FleeHp) || 0, died: false, withdrew: true, fled: true, strafing: false };
  } else {
    out[eliminatedKey] = { hp: 0, died: true, withdrew: false, fled: false, strafing: false };
  }

  if (result.result === 'mutual_kill') {
    out.vhagar = { hp: 0, died: true, withdrew: false, fled: false, strafing: false };
    out[aKey] = { hp: 0, died: true, withdrew: false, fled: false, strafing: false };
  } else if (result.result === 'kill' || result.result === 'flee') {
    const winKey = result.winner === VHAGAR ? 'vhagar' : aKey;
    const loseKey = winKey === 'vhagar' ? aKey : 'vhagar';

    if (result.result === 'flee') {
      out[loseKey] = { hp: result.loserHp || 0, died: false, withdrew: true, fled: true, strafing: false };
    } else {
      out[loseKey] = { hp: 0, died: true, withdrew: false, fled: false, strafing: false };
    }
    const whp = result.winnerHp;
    out[winKey] = { hp: whp, died: false, withdrew: whp / result.winner.maxHp <= WITHDRAW_HP_PCT, fled: false, strafing: whp / result.winner.maxHp > WITHDRAW_HP_PCT };
  }

  return out;
}

// ═══════════════════════════════════════════════════════════════════════════
//  BATTLE SIMULATION
//  Duel resolves at END of tick 1 (armies still fight that tick).
//  Surviving dragons strafe from tick 2 onward.
// ═══════════════════════════════════════════════════════════════════════════

function simulateBattle(verbose) {
  // Green: 4 × Size 1 Military = 4800L + 4800M + 2400E = 12,000 men
  let gLevy = 4800, gMaa = 4800, gElite = 2400;
  const gMaxHp = gLevy * 10 + gMaa * 20 + gElite * 30;
  const gScorpions = 8;

  // Black: 1 × Size 1 Military = 1200L + 1200M + 600E = 3,000 men
  let bLevy = 1200, bMaa = 1200, bElite = 600;
  const bMaxHp = bLevy * 10 + bMaa * 20 + bElite * 30;
  const bScorpions = 2;

  // Dragon state — all start in duel on tick 1
  const dragons = {
    vhagar:  { ref: VHAGAR,  hp: VHAGAR.maxHp,  active: false, strafing: false, inDuel: true, withdrew: false, died: false, fled: false, scorpHits: 0 },
    caraxes: { ref: CARAXES, hp: CARAXES.maxHp, active: false, strafing: false, inDuel: true, withdrew: false, died: false, fled: false, scorpHits: 0 },
    meleys:  { ref: MELEYS,  hp: MELEYS.maxHp,  active: false, strafing: false, inDuel: true, withdrew: false, died: false, fled: false, scorpHits: 0 },
  };

  // Morale — both sides know enemy dragons are present
  let gMorale = clampMorale(10 - 5); // enemy T5 presence
  let bMorale = clampMorale(10 - 5);

  let tick = 0;
  let duelResolved = false;
  let duelResult = null;

  function gTotalMen() { return gLevy + gMaa + gElite; }
  function bTotalMen() { return bLevy + bMaa + bElite; }

  function greenStrafing() {
    return dragons.vhagar.active && dragons.vhagar.strafing ? [dragons.vhagar] : [];
  }
  function blackStrafing() {
    const r = [];
    if (dragons.caraxes.active && dragons.caraxes.strafing) r.push(dragons.caraxes);
    if (dragons.meleys.active && dragons.meleys.strafing) r.push(dragons.meleys);
    return r;
  }

  while (tick < MAX_TICKS && gTotalMen() > 0 && bTotalMen() > 0) {
    tick++;
    const events = [];

    // ── Dragon strafing (no strafing on tick 1 — all dragons are dueling) ──
    const gStrafing = greenStrafing();
    const bStrafing = blackStrafing();

    let gStrafeDmg = gStrafing.reduce((s, d) => s + d.ref.strafeDmg, 0);
    if (bMorale > 0 && gStrafeDmg > 0) gStrafeDmg = Math.floor(gStrafeDmg * (1 - bMorale * 0.01));

    let bStrafeDmg = bStrafing.reduce((s, d) => s + d.ref.strafeDmg, 0);
    if (gMorale > 0 && bStrafeDmg > 0) bStrafeDmg = Math.floor(bStrafeDmg * (1 - gMorale * 0.01));

    // ── Army conventional combat ──
    const gArmyDmg = armyDamagePerTick(gLevy, gMaa, gElite);
    const bArmyDmg = armyDamagePerTick(bLevy, bMaa, bElite);

    const totalDmgToGreen = bArmyDmg + bStrafeDmg;
    const gResult = applyDamageToArmy(totalDmgToGreen, gLevy, gMaa, gElite);
    gLevy = gResult.levy; gMaa = gResult.maa; gElite = gResult.elite;

    const totalDmgToBlack = gArmyDmg + gStrafeDmg;
    const bResult = applyDamageToArmy(totalDmgToBlack, bLevy, bMaa, bElite);
    bLevy = bResult.levy; bMaa = bResult.maa; bElite = bResult.elite;

    // ── Morale: dragon terror drain (only from STRAFING dragons) ──
    if (bStrafing.length > 0) {
      const terrorDrain = bStrafing.length * 2 + bStrafing.reduce((s, d) => s + d.ref.terror, 0);
      gMorale = clampMorale(gMorale - terrorDrain);
    }
    if (gStrafing.length > 0) {
      const terrorDrain = gStrafing.length * 2 + gStrafing.reduce((s, d) => s + d.ref.terror, 0);
      bMorale = clampMorale(bMorale - terrorDrain);
    }

    // HP loss morale drain
    if (totalDmgToGreen > 0) gMorale = clampMorale(gMorale - Math.floor((totalDmgToGreen / gMaxHp) * 100 / 5));
    if (totalDmgToBlack > 0) bMorale = clampMorale(bMorale - Math.floor((totalDmgToBlack / bMaxHp) * 100 / 5));

    // ── Rout ──
    if (gMorale < 0) {
      const routRate = Math.abs(gMorale) * 0.005;
      gLevy -= Math.min(gLevy, Math.floor(gLevy * routRate));
      gMaa -= Math.min(gMaa, Math.floor(gMaa * routRate));
    }
    if (bMorale < 0) {
      const routRate = Math.abs(bMorale) * 0.005;
      bLevy -= Math.min(bLevy, Math.floor(bLevy * routRate));
      bMaa -= Math.min(bMaa, Math.floor(bMaa * routRate));
    }

    // ── Scorpions fire at strafing dragons (NOT dueling) ──
    if (bStrafing.length > 0 && gScorpions > 0) {
      for (let s = 0; s < gScorpions; s++) {
        const target = bStrafing[Math.floor(Math.random() * bStrafing.length)];
        if (Math.floor(Math.random() * 20) + 1 >= target.ref.scorpHitThreshold) {
          target.hp = Math.max(0, target.hp - target.ref.scorpDmgPerHit);
          target.scorpHits++;
        }
      }
    }
    if (gStrafing.length > 0 && bScorpions > 0) {
      for (let s = 0; s < bScorpions; s++) {
        const target = gStrafing[Math.floor(Math.random() * gStrafing.length)];
        if (Math.floor(Math.random() * 20) + 1 >= target.ref.scorpHitThreshold) {
          target.hp = Math.max(0, target.hp - target.ref.scorpDmgPerHit);
          target.scorpHits++;
        }
      }
    }

    // ── Strafing dragon withdrawal/death check ──
    for (const [key, d] of Object.entries(dragons)) {
      if (d.active && d.strafing && d.hp <= 0) {
        d.strafing = false; d.active = false; d.died = true;
        events.push(`${d.ref.name} killed by scorpions!`);
      } else if (d.active && d.strafing && d.hp <= d.ref.maxHp * WITHDRAW_HP_PCT) {
        d.strafing = false; d.active = false; d.withdrew = true;
        events.push(`${d.ref.name} withdraws from strafing at ${Math.round(d.hp / d.ref.maxHp * 100)}% HP`);
      }
    }

    // ── Duel resolution (end of tick 1) ──
    if (!duelResolved) {
      duelResolved = true;
      duelResult = resolveDuelInstantly(verbose);

      if (verbose) {
        console.log('  ─── DUEL RESOLVES (end of tick 1) ───');
        for (const line of duelResult.duelLog) console.log(line);
        console.log(`  ─── DUEL COMPLETE in ${duelResult.duelRounds} rounds ───`);
        console.log(`    Vhagar:  ${duelResult.vhagar.died ? 'DEAD' : duelResult.vhagar.withdrew ? 'WITHDREW (' + Math.round(duelResult.vhagar.hp / VHAGAR.maxHp * 100) + '%)' : 'ACTIVE (' + Math.round(duelResult.vhagar.hp / VHAGAR.maxHp * 100) + '%)'}`);
        console.log(`    Caraxes: ${duelResult.caraxes.died ? 'DEAD' : duelResult.caraxes.withdrew ? 'WITHDREW (' + Math.round(duelResult.caraxes.hp / CARAXES.maxHp * 100) + '%)' : 'ACTIVE (' + Math.round(duelResult.caraxes.hp / CARAXES.maxHp * 100) + '%)'}`);
        console.log(`    Meleys:  ${duelResult.meleys.died ? 'DEAD' : duelResult.meleys.withdrew ? 'WITHDREW (' + Math.round(duelResult.meleys.hp / MELEYS.maxHp * 100) + '%)' : 'ACTIVE (' + Math.round(duelResult.meleys.hp / MELEYS.maxHp * 100) + '%)'}`);
      }

      // Apply duel results to dragon state — survivors strafe starting next tick
      function applyDuelOutcome(key, result) {
        const d = dragons[key];
        d.inDuel = false;
        d.hp = result.hp;
        d.died = result.died;
        d.withdrew = result.withdrew;
        d.fled = result.fled;
        d.active = !result.died && !result.withdrew;
        d.strafing = result.strafing; // will be true if HP > 30%
      }
      applyDuelOutcome('vhagar', duelResult.vhagar);
      applyDuelOutcome('caraxes', duelResult.caraxes);
      applyDuelOutcome('meleys', duelResult.meleys);
    }

    if (verbose) {
      function dStat(name, d) {
        if (d.died) return `${name}:DEAD`;
        if (d.withdrew || d.fled) return `${name}:OUT(${Math.round(d.hp / d.ref.maxHp * 100)}%)`;
        if (d.inDuel) return `${name}:DUEL(${Math.round(d.hp / d.ref.maxHp * 100)}%)`;
        if (d.strafing) return `${name}:STRAFE(${Math.round(d.hp / d.ref.maxHp * 100)}%)`;
        if (!d.active) return `${name}:INACTIVE`;
        return `${name}:IDLE(${Math.round(d.hp / d.ref.maxHp * 100)}%)`;
      }

      for (const e of events) console.log(`  Tick ${String(tick).padStart(2)}: ${e}`);

      let line = `  Tick ${String(tick).padStart(2)}: `;
      line += `GREEN ${gLevy}L/${gMaa}M/${gElite}E=${gTotalMen()} (M:${gMorale})`;
      line += `  vs  `;
      line += `BLACK ${bLevy}L/${bMaa}M/${bElite}E=${bTotalMen()} (M:${bMorale})`;
      if (bStrafeDmg > 0) line += ` | B.strafe:${bStrafeDmg}`;
      if (gStrafeDmg > 0) line += ` | G.strafe:${gStrafeDmg}`;
      line += ` | ${dStat('Vhagar', dragons.vhagar)}`;
      line += ` ${dStat('Caraxes', dragons.caraxes)}`;
      line += ` ${dStat('Meleys', dragons.meleys)}`;
      console.log(line);
    }

    if (gTotalMen() <= 0 || bTotalMen() <= 0) break;
  }

  return {
    ticks: tick,
    greenMen: gTotalMen(), greenLevy: gLevy, greenMaa: gMaa, greenElite: gElite, greenMorale: gMorale,
    blackMen: bTotalMen(), blackLevy: bLevy, blackMaa: bMaa, blackElite: bElite, blackMorale: bMorale,
    greenWin: bTotalMen() <= 0 && gTotalMen() > 0,
    blackWin: gTotalMen() <= 0 && bTotalMen() > 0,
    greenHp: gLevy * 10 + gMaa * 20 + gElite * 30,
    blackHp: bLevy * 10 + bMaa * 20 + bElite * 30,
    gMaxHp, bMaxHp,
    vhagar:  { hp: dragons.vhagar.hp, hpPct: dragons.vhagar.hp / VHAGAR.maxHp * 100, died: dragons.vhagar.died, withdrew: dragons.vhagar.withdrew, fled: dragons.vhagar.fled },
    caraxes: { hp: dragons.caraxes.hp, hpPct: dragons.caraxes.hp / CARAXES.maxHp * 100, died: dragons.caraxes.died, withdrew: dragons.caraxes.withdrew, fled: dragons.caraxes.fled },
    meleys:  { hp: dragons.meleys.hp, hpPct: dragons.meleys.hp / MELEYS.maxHp * 100, died: dragons.meleys.died, withdrew: dragons.meleys.withdrew, fled: dragons.meleys.fled },
  };
}

// ═══════════════════════════════════════════════════════════════════════════
//  RUN
// ═══════════════════════════════════════════════════════════════════════════

function pad(s, n) { s = String(s); return s + ' '.repeat(Math.max(0, n - s.length)); }
function padL(s, n) { s = String(s); return ' '.repeat(Math.max(0, n - s.length)) + s; }

console.log('');
console.log('='.repeat(130));
console.log('  VHAGAR + 4 ARMIES  vs  CARAXES + MELEYS + 1 ARMY  (2v1 Dragon Duel)');
console.log('  ' + SIMULATIONS.toLocaleString() + ' simulations | Canonical riders | Dragons withdraw at ' + (WITHDRAW_HP_PCT * 100) + '% HP');
console.log('');
console.log('  GREEN: 4 × Size 1 Military (4800L/4800M/2400E = 12,000 men) — 216,000 HP — 8 scorpions');
console.log('    Vhagar (Aemond): 500 HP | Strike 23 | Evasion 12 | Terror 15 | Strafe 3,500');
console.log('');
console.log('  BLACK: 1 × Size 1 Military (1200L/1200M/600E = 3,000 men) — 54,000 HP — 2 scorpions');
console.log('    Caraxes (Daemon): 325 HP | Strike 21 | Evasion 15 | Terror 15 | Strafe 3,200');
console.log('    Meleys (Rhaenys): 350 HP | Strike 19 | Evasion 16 | Terror 14 | Strafe 3,200');
console.log('');
console.log('  BATTLE PLAN:');
console.log('    Tick 1: Armies fight conventionally. Caraxes + Meleys intercept Vhagar (2v1 duel).');
console.log('    Duel resolves at end of tick 1 — no dragon strafing on tick 1.');
console.log('    Tick 2+: Surviving dragons strafe. Initiative: Meleys (Agi 10) → Caraxes (Agi 9) → Vhagar (Agi 3).');
console.log('    Vhagar targets the duo dragon with lowest HP% (tries to finish one off).');
console.log('    When duel ends, surviving dragons strafe enemy army from next tick.');
console.log('='.repeat(130));

// Monte Carlo
const stats = {
  totalTicks: 0, greenWins: 0, blackWins: 0, draws: 0,
  vhagarDied: 0, vhagarWithdrew: 0, vhagarSurvived: 0,
  caraxesDied: 0, caraxesWithdrew: 0, caraxesSurvived: 0,
  meleysDied: 0, meleysWithdrew: 0, meleysSurvived: 0,
  totalGreenMen: 0, totalBlackMen: 0,
  totalGreenElite: 0, totalBlackElite: 0,
  totalGreenHpPct: 0, totalBlackHpPct: 0,
};

for (let i = 0; i < SIMULATIONS; i++) {
  const r = simulateBattle(false);
  stats.totalTicks += r.ticks;
  if (r.greenWin) stats.greenWins++;
  else if (r.blackWin) stats.blackWins++;
  else stats.draws++;

  stats.totalGreenMen += r.greenMen; stats.totalBlackMen += r.blackMen;
  stats.totalGreenElite += r.greenElite; stats.totalBlackElite += r.blackElite;
  stats.totalGreenHpPct += r.greenHp / r.gMaxHp * 100;
  stats.totalBlackHpPct += r.blackHp / r.bMaxHp * 100;

  if (r.vhagar.died) stats.vhagarDied++; else if (r.vhagar.withdrew) stats.vhagarWithdrew++; else stats.vhagarSurvived++;
  if (r.caraxes.died) stats.caraxesDied++; else if (r.caraxes.withdrew) stats.caraxesWithdrew++; else stats.caraxesSurvived++;
  if (r.meleys.died) stats.meleysDied++; else if (r.meleys.withdrew) stats.meleysWithdrew++; else stats.meleysSurvived++;
}

const n = SIMULATIONS;
console.log('');
console.log('  BATTLE OUTCOMES:');
console.log(`    Avg ticks:     ${(stats.totalTicks / n).toFixed(1)}`);
console.log(`    Green wins:    ${(stats.greenWins / n * 100).toFixed(1)}%  (Black army eliminated)`);
console.log(`    Black wins:    ${(stats.blackWins / n * 100).toFixed(1)}%  (Green army eliminated)`);
console.log(`    Ongoing/Draw:  ${(stats.draws / n * 100).toFixed(1)}%  (${MAX_TICKS} tick cap)`);
console.log('');
console.log('  ARMY SURVIVORS (avg):');
console.log(`    Green: ${Math.round(stats.totalGreenMen / n).toLocaleString()} / 12,000 men  (${(stats.totalGreenHpPct / n).toFixed(1)}% HP)  [${Math.round(stats.totalGreenElite / n)} elite]`);
console.log(`    Black: ${Math.round(stats.totalBlackMen / n).toLocaleString()} / 3,000 men   (${(stats.totalBlackHpPct / n).toFixed(1)}% HP)  [${Math.round(stats.totalBlackElite / n)} elite]`);
console.log('');
console.log('  DRAGON FATES:');
console.log('    ' + pad('Dragon', 16) + padL('Died', 8) + padL('Withdrew', 10) + padL('Active', 8));
console.log('    ' + '-'.repeat(42));
console.log('    ' + pad('Vhagar', 16) + padL((stats.vhagarDied / n * 100).toFixed(1) + '%', 8) + padL((stats.vhagarWithdrew / n * 100).toFixed(1) + '%', 10) + padL((stats.vhagarSurvived / n * 100).toFixed(1) + '%', 8));
console.log('    ' + pad('Caraxes', 16) + padL((stats.caraxesDied / n * 100).toFixed(1) + '%', 8) + padL((stats.caraxesWithdrew / n * 100).toFixed(1) + '%', 10) + padL((stats.caraxesSurvived / n * 100).toFixed(1) + '%', 8));
console.log('    ' + pad('Meleys', 16) + padL((stats.meleysDied / n * 100).toFixed(1) + '%', 8) + padL((stats.meleysWithdrew / n * 100).toFixed(1) + '%', 10) + padL((stats.meleysSurvived / n * 100).toFixed(1) + '%', 8));

// Verbose run
console.log('');
console.log('');
console.log('='.repeat(130));
console.log('  VERBOSE BATTLE — Single Run');
console.log('='.repeat(130));
console.log('');

simulateBattle(true);
console.log('');
