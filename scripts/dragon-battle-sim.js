#!/usr/bin/env node

// ═══════════════════════════════════════════════════════════════════════════
//  FULL BATTLE SIMULATOR — Dragons + Armies
//
//  Scenario: 20k army (Greens) + Vhagar & Cannibal
//            vs 40k army (Blacks) + Meleys & Caraxes (arrive mid-battle)
//
//  Phase 1 (ticks 1-5): Vhagar+Cannibal strafe the 40k army unopposed.
//    Meanwhile both armies fight each other conventionally.
//
//  Phase 2 (tick 6+): Meleys+Caraxes arrive and intercept:
//    Caraxes → Vhagar duel,  Meleys → Cannibal duel.
//    Duels resolve tick-by-tick. Surviving dragons return to strafe.
//
//  Army combat: simplified damage exchange per tick.
//  Dragon duels: full d10 pool combat (strike/evasion/wounds/bleed/flee).
//  Scorpions: fire at strafing dragons (split fire). No fire during duels.
//  Equal riders on all dragons (P6/Co6/Cu6/F6 → +3/+3).
// ═══════════════════════════════════════════════════════════════════════════

const SIMULATIONS = 1000;
const MAX_TICKS = 100;
const WITHDRAW_HP_PCT = 0.30;
const ARRIVAL_TICK = 5; // Meleys+Caraxes arrive at start of this tick
const MORALE_CAP = 20;

function clampMorale(m) { return Math.max(-MORALE_CAP, Math.min(MORALE_CAP, m)); }

// ═══════════════════════════════════════════════════════════════════════════
//  DRAGON DEFINITIONS
// ═══════════════════════════════════════════════════════════════════════════

const EQUAL_RIDER = { prowess: 6, command: 6, cunning: 6, fortitude: 6 };

function riderOff(r) { return Math.floor(Math.max(r.prowess, r.command) / 2); }
function riderDef(r) { return Math.floor(Math.max(r.cunning, r.fortitude) / 2); }

function makeDragon(name, tier, might, agility, ferocity, resilience) {
  const d = { name, tier, might, agility, ferocity, resilience };
  return {
    ...d,
    maxHp:            (might + resilience) * tier * 5,
    strike:           might + ferocity + riderOff(EQUAL_RIDER),
    evasion:          agility + Math.floor(resilience / 2) + riderDef(EQUAL_RIDER),
    damagePerHit:     tier + 3,
    critChance:       agility / 100,
    terror:           tier * 2 + Math.floor(ferocity / 2),
    strafeDmg:        tier * 500 + might * 100,
    scorpHitThreshold: getScorpionThreshold(agility),
    scorpDmgPerHit:   getScorpionDamage(tier, resilience),
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

const VHAGAR   = makeDragon('Vhagar',       5, 10, 3,  10, 10);
const CANNIBAL = makeDragon('The Cannibal', 5, 8,  6,  10, 8);
const CARAXES  = makeDragon('Caraxes',      5, 7,  9,  10, 6);
const MELEYS   = makeDragon('Meleys',       5, 7,  10, 8,  7);

// ═══════════════════════════════════════════════════════════════════════════
//  DRAGON DUEL ENGINE (from dragon-combat-sim-equal.js)
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

// Resolve ONE tick of a dragon duel. Returns null if ongoing, or result object if concluded.
function duelTick(state) {
  let { a, b, hpA, hpB, bleedA, bleedB, ticks } = state;
  ticks++;

  // Bleeding
  if (bleedA > 0) hpA = Math.max(0, hpA - bleedA * BLEED_DMG);
  if (bleedB > 0) hpB = Math.max(0, hpB - bleedB * BLEED_DMG);
  if (hpA <= 0 && hpB <= 0) return { ...state, ticks, hpA: 0, hpB: 0, result: 'mutual_kill', winner: null, loser: null, fled: null };
  if (hpA <= 0) return { ...state, ticks, hpA: 0, hpB, result: 'kill', winner: b, loser: a, winnerHp: hpB, fled: null };
  if (hpB <= 0) return { ...state, ticks, hpA, hpB: 0, result: 'kill', winner: a, loser: b, winnerHp: hpA, fled: null };

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

  // Determine initiative
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
  let c1 = 0;
  for (let i = 0; i < ub1; i++) if (Math.random() < first.critChance) c1++;
  if (c1 > 0) bleedSecond = Math.min(BLEED_MAX, bleedSecond + c1);

  if (hpSecond <= 0) {
    if (first === a) return { ...state, ticks, hpA: hpFirst, hpB: 0, bleedA: bleedFirst, bleedB: bleedSecond, result: 'kill', winner: a, loser: b, winnerHp: hpFirst, fled: null };
    else return { ...state, ticks, hpA: 0, hpB: hpFirst, bleedA: bleedSecond, bleedB: bleedFirst, result: 'kill', winner: b, loser: a, winnerHp: hpFirst, fled: null };
  }

  // Second strikes back
  const penSecUpd = getWoundPenalty(hpSecond, second.maxHp);
  const s2 = Math.max(0, second.strike - penSecUpd);
  const e2 = Math.max(0, first.evasion - penFirst);
  const hits2 = rollPool(s2);
  const blocks2 = rollPool(e2);
  const ub2 = Math.max(0, hits2 - blocks2);
  hpFirst = Math.max(0, hpFirst - ub2 * second.damagePerHit);
  let c2 = 0;
  for (let i = 0; i < ub2; i++) if (Math.random() < second.critChance) c2++;
  if (c2 > 0) bleedFirst = Math.min(BLEED_MAX, bleedFirst + c2);

  // Assign back
  if (first === a) { hpA = hpFirst; hpB = hpSecond; bleedA = bleedFirst; bleedB = bleedSecond; }
  else { hpB = hpFirst; hpA = hpSecond; bleedB = bleedFirst; bleedA = bleedSecond; }

  // Still going
  state.hpA = hpA; state.hpB = hpB; state.bleedA = bleedA; state.bleedB = bleedB; state.ticks = ticks;
  return null; // duel continues
}

// ═══════════════════════════════════════════════════════════════════════════
//  ARMY DEFINITIONS
// ═══════════════════════════════════════════════════════════════════════════

function makeArmy(name, levy, maa, elite, scorpions, morale) {
  return {
    name, levy, maa, elite, scorpions, baseMorale: morale,
    get totalMen() { return this.levy + this.maa + this.elite; },
    get hp() { return this.levy * 10 + this.maa * 20 + this.elite * 30; },
    get avgAtk() {
      const total = this.levy * 10 + this.maa * 20 + this.elite * 30;
      return this.totalMen > 0 ? total / this.totalMen : 0;
    },
  };
}

// Army damage per tick: simplified model.
// Each army deals damage = currentMen × avgATK × COMBAT_RATE to the other.
// Calibrated so a balanced 10k vs 10k battle lasts ~20 ticks.
const COMBAT_RATE = 0.015;

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
//  BATTLE SIMULATION
// ═══════════════════════════════════════════════════════════════════════════

function simulateBattle() {
  // Green Army: 20,000 men — military-heavy (professional force)
  let gLevy = 8000, gMaa = 6000, gElite = 6000;
  const gMaxHp = gLevy * 10 + gMaa * 20 + gElite * 30;

  // Black Army: 40,000 men — coalition (levy-heavy)
  let bLevy = 25000, bMaa = 9000, bElite = 6000;
  const bMaxHp = bLevy * 10 + bMaa * 20 + bElite * 30;

  const gScorpions = 6;
  const bScorpions = 8;

  // Dragon state
  const greenDragons = {
    vhagar:   { ref: VHAGAR,   hp: VHAGAR.maxHp,   active: true, strafing: true, inDuel: false, withdrew: false, died: false, scorpHits: 0 },
    cannibal: { ref: CANNIBAL, hp: CANNIBAL.maxHp, active: true, strafing: true, inDuel: false, withdrew: false, died: false, scorpHits: 0 },
  };
  const blackDragons = {
    caraxes: { ref: CARAXES, hp: CARAXES.maxHp, active: false, strafing: false, inDuel: false, withdrew: false, died: false, scorpHits: 0 },
    meleys:  { ref: MELEYS,  hp: MELEYS.maxHp,  active: false, strafing: false, inDuel: false, withdrew: false, died: false, scorpHits: 0 },
  };

  // Morale: green side starts with morale penalty from facing a 2:1 numbers disadvantage
  // Black side starts with terror penalty from 2 T5 dragons
  let gMorale = 10; // Greens have dragon advantage initially
  let bMorale = 10 - 5; // Blacks face T5 dragon terror (highest tier = -5)

  // Duel states
  let duel1 = null; // Caraxes vs Vhagar
  let duel2 = null; // Meleys vs Cannibal

  let tick = 0;
  const log = [];

  function gTotalMen() { return gLevy + gMaa + gElite; }
  function bTotalMen() { return bLevy + bMaa + bElite; }
  function gArmyHp() { return gLevy * 10 + gMaa * 20 + gElite * 30; }
  function bArmyHp() { return bLevy * 10 + bMaa * 20 + bElite * 30; }

  function strafingGreen() { return Object.values(greenDragons).filter(d => d.active && d.strafing); }
  function strafingBlack() { return Object.values(blackDragons).filter(d => d.active && d.strafing); }

  while (tick < MAX_TICKS && gTotalMen() > 0 && bTotalMen() > 0) {
    tick++;
    const events = [];

    // ── Phase 2 trigger: Black dragons arrive ──
    if (tick === ARRIVAL_TICK) {
      blackDragons.caraxes.active = true;
      blackDragons.meleys.active = true;
      events.push('*** CARAXES + MELEYS ARRIVE ON THE BATTLEFIELD ***');

      // Initiate duels if green dragons are still strafing
      if (greenDragons.vhagar.active && greenDragons.vhagar.strafing) {
        greenDragons.vhagar.strafing = false;
        greenDragons.vhagar.inDuel = true;
        blackDragons.caraxes.strafing = false;
        blackDragons.caraxes.inDuel = true;
        duel1 = { a: CARAXES, b: VHAGAR, hpA: blackDragons.caraxes.hp, hpB: greenDragons.vhagar.hp, bleedA: 0, bleedB: 0, ticks: 0 };
        events.push('DUEL: Caraxes intercepts Vhagar!');
      }
      if (greenDragons.cannibal.active && greenDragons.cannibal.strafing) {
        greenDragons.cannibal.strafing = false;
        greenDragons.cannibal.inDuel = true;
        blackDragons.meleys.strafing = false;
        blackDragons.meleys.inDuel = true;
        duel2 = { a: MELEYS, b: CANNIBAL, hpA: blackDragons.meleys.hp, hpB: greenDragons.cannibal.hp, bleedA: 0, bleedB: 0, ticks: 0 };
        events.push('DUEL: Meleys intercepts The Cannibal!');
      }

      // Morale shift: Black side gains courage from their dragons arriving
      bMorale = clampMorale(bMorale + 5); // +Tier one-time arrival boost
      // Green side morale hit: now enemy has dragons too
      gMorale = clampMorale(gMorale - 5);
      events.push('Morale shift: Blacks +5 (dragon arrival), Greens -5 (enemy dragons)');
    }

    // ── Duel resolution ──
    if (duel1) {
      const result = duelTick(duel1);
      if (result) {
        duel1 = null;
        if (result.result === 'kill' || result.result === 'flee') {
          const winnerName = result.winner.name;
          const loserName = result.loser.name;
          const hpPct = Math.round((result.winnerHp || 0) / result.winner.maxHp * 100);
          if (result.result === 'flee') {
            events.push('DUEL ENDS: ' + loserName + ' flees! ' + winnerName + ' wins at ' + hpPct + '% HP');
          } else {
            events.push('DUEL ENDS: ' + winnerName + ' kills ' + loserName + '! ' + winnerName + ' at ' + hpPct + '% HP');
          }
          // Update dragon states
          if (winnerName === 'Caraxes') {
            blackDragons.caraxes.hp = result.winnerHp;
            blackDragons.caraxes.inDuel = false;
            blackDragons.caraxes.strafing = (result.winnerHp / CARAXES.maxHp) > WITHDRAW_HP_PCT;
            if (!blackDragons.caraxes.strafing) { blackDragons.caraxes.withdrew = true; blackDragons.caraxes.active = false; }
            greenDragons.vhagar.hp = result.loserHp || 0;
            greenDragons.vhagar.inDuel = false;
            greenDragons.vhagar.active = false;
            greenDragons.vhagar.died = result.result === 'kill';
            greenDragons.vhagar.withdrew = result.result === 'flee';
          } else { // Vhagar won
            greenDragons.vhagar.hp = result.winnerHp;
            greenDragons.vhagar.inDuel = false;
            greenDragons.vhagar.strafing = (result.winnerHp / VHAGAR.maxHp) > WITHDRAW_HP_PCT;
            if (!greenDragons.vhagar.strafing) { greenDragons.vhagar.withdrew = true; greenDragons.vhagar.active = false; }
            blackDragons.caraxes.hp = result.loserHp || 0;
            blackDragons.caraxes.inDuel = false;
            blackDragons.caraxes.active = false;
            blackDragons.caraxes.died = result.result === 'kill';
            blackDragons.caraxes.withdrew = result.result === 'flee';
          }
        } else if (result.result === 'mutual_kill') {
          events.push('DUEL ENDS: Caraxes and Vhagar kill each other!');
          blackDragons.caraxes.hp = 0; blackDragons.caraxes.died = true; blackDragons.caraxes.active = false; blackDragons.caraxes.inDuel = false;
          greenDragons.vhagar.hp = 0; greenDragons.vhagar.died = true; greenDragons.vhagar.active = false; greenDragons.vhagar.inDuel = false;
        }
      }
    }

    if (duel2) {
      const result = duelTick(duel2);
      if (result) {
        duel2 = null;
        if (result.result === 'kill' || result.result === 'flee') {
          const winnerName = result.winner.name;
          const loserName = result.loser.name;
          const hpPct = Math.round((result.winnerHp || 0) / result.winner.maxHp * 100);
          if (result.result === 'flee') {
            events.push('DUEL ENDS: ' + loserName + ' flees! ' + winnerName + ' wins at ' + hpPct + '% HP');
          } else {
            events.push('DUEL ENDS: ' + winnerName + ' kills ' + loserName + '! ' + winnerName + ' at ' + hpPct + '% HP');
          }
          if (winnerName === 'Meleys') {
            blackDragons.meleys.hp = result.winnerHp;
            blackDragons.meleys.inDuel = false;
            blackDragons.meleys.strafing = (result.winnerHp / MELEYS.maxHp) > WITHDRAW_HP_PCT;
            if (!blackDragons.meleys.strafing) { blackDragons.meleys.withdrew = true; blackDragons.meleys.active = false; }
            greenDragons.cannibal.hp = result.loserHp || 0;
            greenDragons.cannibal.inDuel = false;
            greenDragons.cannibal.active = false;
            greenDragons.cannibal.died = result.result === 'kill';
            greenDragons.cannibal.withdrew = result.result === 'flee';
          } else { // Cannibal won
            greenDragons.cannibal.hp = result.winnerHp;
            greenDragons.cannibal.inDuel = false;
            greenDragons.cannibal.strafing = (result.winnerHp / CANNIBAL.maxHp) > WITHDRAW_HP_PCT;
            if (!greenDragons.cannibal.strafing) { greenDragons.cannibal.withdrew = true; greenDragons.cannibal.active = false; }
            blackDragons.meleys.hp = result.loserHp || 0;
            blackDragons.meleys.inDuel = false;
            blackDragons.meleys.active = false;
            blackDragons.meleys.died = result.result === 'kill';
            blackDragons.meleys.withdrew = result.result === 'flee';
          }
        } else if (result.result === 'mutual_kill') {
          events.push('DUEL ENDS: Meleys and The Cannibal kill each other!');
          blackDragons.meleys.hp = 0; blackDragons.meleys.died = true; blackDragons.meleys.active = false; blackDragons.meleys.inDuel = false;
          greenDragons.cannibal.hp = 0; greenDragons.cannibal.died = true; greenDragons.cannibal.active = false; greenDragons.cannibal.inDuel = false;
        }
      }
    }

    // ── Dragon strafing ──
    const gStrafing = strafingGreen();
    const bStrafing = strafingBlack();

    // Green dragons strafe Black army
    let gStrafeDmg = gStrafing.reduce((s, d) => s + d.ref.strafeDmg, 0);
    if (bMorale > 0 && gStrafeDmg > 0) gStrafeDmg = Math.floor(gStrafeDmg * (1 - bMorale * 0.01));

    // Black dragons strafe Green army
    let bStrafeDmg = bStrafing.reduce((s, d) => s + d.ref.strafeDmg, 0);
    if (gMorale > 0 && bStrafeDmg > 0) bStrafeDmg = Math.floor(bStrafeDmg * (1 - gMorale * 0.01));

    // ── Army conventional combat ──
    const gArmyDmg = armyDamagePerTick(gLevy, gMaa, gElite); // Greens deal to Blacks
    const bArmyDmg = armyDamagePerTick(bLevy, bMaa, bElite); // Blacks deal to Greens

    // Apply damage: Green army takes (Black army + Black dragon strafe)
    const totalDmgToGreen = bArmyDmg + bStrafeDmg;
    const gResult = applyDamageToArmy(totalDmgToGreen, gLevy, gMaa, gElite);
    gLevy = gResult.levy; gMaa = gResult.maa; gElite = gResult.elite;

    // Apply damage: Black army takes (Green army + Green dragon strafe)
    const totalDmgToBlack = gArmyDmg + gStrafeDmg;
    const bResult = applyDamageToArmy(totalDmgToBlack, bLevy, bMaa, bElite);
    bLevy = bResult.levy; bMaa = bResult.maa; bElite = bResult.elite;

    // ── Morale effects from dragons ──
    if (gStrafing.length > 0) {
      const terrorDrain = gStrafing.length * 2 + gStrafing.reduce((s, d) => s + d.ref.terror, 0);
      bMorale = clampMorale(bMorale - terrorDrain);
    }
    if (bStrafing.length > 0) {
      const terrorDrain = bStrafing.length * 2 + bStrafing.reduce((s, d) => s + d.ref.terror, 0);
      gMorale = clampMorale(gMorale - terrorDrain);
    }

    // HP loss morale drain for both sides
    if (totalDmgToBlack > 0) bMorale = clampMorale(bMorale - Math.floor((totalDmgToBlack / bMaxHp) * 100 / 5));
    if (totalDmgToGreen > 0) gMorale = clampMorale(gMorale - Math.floor((totalDmgToGreen / gMaxHp) * 100 / 5));

    // ── Rout (both sides) ──
    if (bMorale < 0) {
      const routRate = Math.abs(bMorale) * 0.005;
      const lR = Math.min(bLevy, Math.floor(bLevy * routRate));
      const mR = Math.min(bMaa, Math.floor(bMaa * routRate));
      bLevy -= lR; bMaa -= mR;
    }
    if (gMorale < 0) {
      const routRate = Math.abs(gMorale) * 0.005;
      const lR = Math.min(gLevy, Math.floor(gLevy * routRate));
      const mR = Math.min(gMaa, Math.floor(gMaa * routRate));
      gLevy -= lR; gMaa -= mR;
    }

    // ── Scorpions fire at strafing dragons ──
    if (gStrafing.length > 0) {
      for (let s = 0; s < bScorpions; s++) {
        const target = gStrafing[Math.floor(Math.random() * gStrafing.length)];
        if (Math.floor(Math.random() * 20) + 1 >= target.ref.scorpHitThreshold) {
          target.hp = Math.max(0, target.hp - target.ref.scorpDmgPerHit);
          target.scorpHits++;
        }
      }
    }
    if (bStrafing.length > 0) {
      for (let s = 0; s < gScorpions; s++) {
        const target = bStrafing[Math.floor(Math.random() * bStrafing.length)];
        if (Math.floor(Math.random() * 20) + 1 >= target.ref.scorpHitThreshold) {
          target.hp = Math.max(0, target.hp - target.ref.scorpDmgPerHit);
          target.scorpHits++;
        }
      }
    }

    // ── Strafing dragon withdrawal check ──
    for (const d of [...Object.values(greenDragons), ...Object.values(blackDragons)]) {
      if (d.active && d.strafing && d.hp <= d.ref.maxHp * WITHDRAW_HP_PCT) {
        d.strafing = false; d.active = false; d.withdrew = true;
        events.push(d.ref.name + ' withdraws from strafing at ' + Math.round(d.hp / d.ref.maxHp * 100) + '% HP');
      }
      if (d.active && d.strafing && d.hp <= 0) {
        d.strafing = false; d.active = false; d.died = true;
        events.push(d.ref.name + ' killed by scorpions!');
      }
    }

    log.push({ tick, events, gLevy, gMaa, gElite, bLevy, bMaa, bElite, gMorale, bMorale,
      gStrafeDmg, bStrafeDmg, gArmyDmg, bArmyDmg,
      vhagar: { ...greenDragons.vhagar }, cannibal: { ...greenDragons.cannibal },
      caraxes: { ...blackDragons.caraxes }, meleys: { ...blackDragons.meleys },
      duel1Active: duel1 !== null, duel2Active: duel2 !== null,
    });

    if (gTotalMen() <= 0 || bTotalMen() <= 0) break;
  }

  return {
    ticks: tick,
    greenMen: gTotalMen(), greenLevy: gLevy, greenMaa: gMaa, greenElite: gElite, greenMorale: gMorale,
    blackMen: bTotalMen(), blackLevy: bLevy, blackMaa: bMaa, blackElite: bElite, blackMorale: bMorale,
    greenWin: bTotalMen() <= 0 && gTotalMen() > 0,
    blackWin: gTotalMen() <= 0 && bTotalMen() > 0,
    vhagar: { hp: greenDragons.vhagar.hp, hpPct: greenDragons.vhagar.hp / VHAGAR.maxHp * 100, died: greenDragons.vhagar.died, withdrew: greenDragons.vhagar.withdrew },
    cannibal: { hp: greenDragons.cannibal.hp, hpPct: greenDragons.cannibal.hp / CANNIBAL.maxHp * 100, died: greenDragons.cannibal.died, withdrew: greenDragons.cannibal.withdrew },
    caraxes: { hp: blackDragons.caraxes.hp, hpPct: blackDragons.caraxes.hp / CARAXES.maxHp * 100, died: blackDragons.caraxes.died, withdrew: blackDragons.caraxes.withdrew },
    meleys: { hp: blackDragons.meleys.hp, hpPct: blackDragons.meleys.hp / MELEYS.maxHp * 100, died: blackDragons.meleys.died, withdrew: blackDragons.meleys.withdrew },
    log,
  };
}

// ═══════════════════════════════════════════════════════════════════════════
//  RUN
// ═══════════════════════════════════════════════════════════════════════════

function pad(s, n) { s = String(s); return s + ' '.repeat(Math.max(0, n - s.length)); }
function padL(s, n) { s = String(s); return ' '.repeat(Math.max(0, n - s.length)) + s; }

// ── Statistical Run ──

console.log('');
console.log('='.repeat(130));
console.log('  FULL BATTLE SIMULATOR — 20,000 (Greens) + Vhagar & Cannibal  vs  40,000 (Blacks) + Caraxes & Meleys (arrive tick ' + ARRIVAL_TICK + ')');
console.log('  ' + SIMULATIONS + ' simulations | Equal riders (P6/Co6/Cu6/F6) | Dragons withdraw at ' + (WITHDRAW_HP_PCT * 100) + '% HP');
console.log('');
console.log('  GREEN ARMY: 20,000 men (8k levy / 6k MaA / 6k elite) — 380,000 HP — 6 scorpions');
console.log('  BLACK ARMY: 40,000 men (25k levy / 9k MaA / 6k elite) — 610,000 HP — 8 scorpions');
console.log('');
console.log('  Phase 1 (ticks 1-' + (ARRIVAL_TICK - 1) + '): Vhagar + Cannibal strafe Black army. Armies fight.');
console.log('  Phase 2 (tick ' + ARRIVAL_TICK + '+): Caraxes → Vhagar duel, Meleys → Cannibal duel. Survivors strafe.');
console.log('='.repeat(130));

let stats = {
  totalTicks: 0, greenWins: 0, blackWins: 0, draws: 0,
  vhagarDied: 0, vhagarWithdrew: 0, vhagarSurvived: 0,
  cannibalDied: 0, cannibalWithdrew: 0, cannibalSurvived: 0,
  caraxesDied: 0, caraxesWithdrew: 0, caraxesSurvived: 0,
  meleysDied: 0, meleysWithdrew: 0, meleysSurvived: 0,
  totalGreenMen: 0, totalBlackMen: 0,
  totalGreenElite: 0, totalBlackElite: 0,
};

for (let i = 0; i < SIMULATIONS; i++) {
  const r = simulateBattle();
  stats.totalTicks += r.ticks;
  if (r.greenWin) stats.greenWins++;
  else if (r.blackWin) stats.blackWins++;
  else stats.draws++;

  stats.totalGreenMen += r.greenMen; stats.totalBlackMen += r.blackMen;
  stats.totalGreenElite += r.greenElite; stats.totalBlackElite += r.blackElite;

  if (r.vhagar.died) stats.vhagarDied++; else if (r.vhagar.withdrew) stats.vhagarWithdrew++; else stats.vhagarSurvived++;
  if (r.cannibal.died) stats.cannibalDied++; else if (r.cannibal.withdrew) stats.cannibalWithdrew++; else stats.cannibalSurvived++;
  if (r.caraxes.died) stats.caraxesDied++; else if (r.caraxes.withdrew) stats.caraxesWithdrew++; else stats.caraxesSurvived++;
  if (r.meleys.died) stats.meleysDied++; else if (r.meleys.withdrew) stats.meleysWithdrew++; else stats.meleysSurvived++;
}

const n = SIMULATIONS;
console.log('');
console.log('  BATTLE OUTCOMES (' + n + ' sims):');
console.log('    Avg ticks:   ' + (stats.totalTicks / n).toFixed(1));
console.log('    Green wins:  ' + (stats.greenWins / n * 100).toFixed(1) + '%');
console.log('    Black wins:  ' + (stats.blackWins / n * 100).toFixed(1) + '%');
console.log('    Ongoing/Draw:' + (stats.draws / n * 100).toFixed(1) + '%');
console.log('');
console.log('  ARMY SURVIVORS (avg):');
console.log('    Green: ' + Math.round(stats.totalGreenMen / n) + ' men (' + Math.round(stats.totalGreenElite / n) + ' elite)');
console.log('    Black: ' + Math.round(stats.totalBlackMen / n) + ' men (' + Math.round(stats.totalBlackElite / n) + ' elite)');
console.log('');
console.log('  DRAGON FATES:');
console.log('    ' + pad('Dragon', 16) + padL('Died', 8) + padL('Withdrew', 10) + padL('Active', 8));
console.log('    ' + '-'.repeat(42));
console.log('    ' + pad('Vhagar', 16) + padL((stats.vhagarDied / n * 100).toFixed(1) + '%', 8) + padL((stats.vhagarWithdrew / n * 100).toFixed(1) + '%', 10) + padL((stats.vhagarSurvived / n * 100).toFixed(1) + '%', 8));
console.log('    ' + pad('The Cannibal', 16) + padL((stats.cannibalDied / n * 100).toFixed(1) + '%', 8) + padL((stats.cannibalWithdrew / n * 100).toFixed(1) + '%', 10) + padL((stats.cannibalSurvived / n * 100).toFixed(1) + '%', 8));
console.log('    ' + pad('Caraxes', 16) + padL((stats.caraxesDied / n * 100).toFixed(1) + '%', 8) + padL((stats.caraxesWithdrew / n * 100).toFixed(1) + '%', 10) + padL((stats.caraxesSurvived / n * 100).toFixed(1) + '%', 8));
console.log('    ' + pad('Meleys', 16) + padL((stats.meleysDied / n * 100).toFixed(1) + '%', 8) + padL((stats.meleysWithdrew / n * 100).toFixed(1) + '%', 10) + padL((stats.meleysSurvived / n * 100).toFixed(1) + '%', 8));

// ── Verbose Run ──

console.log('');
console.log('');
console.log('='.repeat(130));
console.log('  VERBOSE BATTLE — Single Run');
console.log('='.repeat(130));

const verbose = simulateBattle();
for (const entry of verbose.log) {
  const t = entry.tick;
  for (const e of entry.events) {
    console.log('  Tick ' + String(t).padStart(2) + ': ' + e);
  }

  // Dragon status
  const dragonParts = [];
  function dStatus(name, d) {
    if (d.died) return name + ':DEAD';
    if (d.withdrew) return name + ':OUT';
    if (d.inDuel) return name + ':DUEL(' + Math.round(d.hp / d.ref.maxHp * 100) + '%)';
    if (d.strafing) return name + ':STRAFE(' + Math.round(d.hp / d.ref.maxHp * 100) + '%)';
    return name + ':IDLE(' + Math.round(d.hp / d.ref.maxHp * 100) + '%)';
  }

  let line = '  Tick ' + String(t).padStart(2) + ': ';
  line += 'GREEN ' + entry.gLevy + 'L/' + entry.gMaa + 'M/' + entry.gElite + 'E=' + (entry.gLevy + entry.gMaa + entry.gElite) + ' (M:' + entry.gMorale + ')';
  line += '  vs  ';
  line += 'BLACK ' + entry.bLevy + 'L/' + entry.bMaa + 'M/' + entry.bElite + 'E=' + (entry.bLevy + entry.bMaa + entry.bElite) + ' (M:' + entry.bMorale + ')';

  if (entry.gStrafeDmg > 0) line += ' | G.strafe:' + entry.gStrafeDmg;
  if (entry.bStrafeDmg > 0) line += ' | B.strafe:' + entry.bStrafeDmg;

  line += ' | ' + dStatus('Vhg', entry.vhagar) + ' ' + dStatus('Can', entry.cannibal);
  line += ' ' + dStatus('Crx', entry.caraxes) + ' ' + dStatus('Mly', entry.meleys);

  console.log(line);
}

console.log('');
console.log('  FINAL: Green ' + verbose.greenMen + ' men, Black ' + verbose.blackMen + ' men.');
if (verbose.greenWin) console.log('  *** GREEN VICTORY ***');
else if (verbose.blackWin) console.log('  *** BLACK VICTORY ***');
else console.log('  *** BATTLE ONGOING ***');

console.log('');
console.log('Simulation complete.');
