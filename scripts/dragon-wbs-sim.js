#!/usr/bin/env node

// ═══════════════════════════════════════════════════════════════════════════
//  DRAGON vs ARMY — WBS STRAFE SIMULATOR
//  Simulates a single dragon strafing an army over multiple ticks
//
//  Morale mechanics (from Warfare Foundation):
//    - Positive morale = damage resistance (morale × 1% DR)
//    - Negative morale = troops rout: |morale| × 0.5% of levy+MaA per tick
//    - Elites NEVER rout from morale
//    - War Priest reduces rout by Faith × 1.5%
//    - Herald rallies Presence × 2% of routed pool per tick
//    - Routed men rejoin as their original unit type
//
//  Dragon fire damage ignores Marshal DR but NOT morale DR
//  Scorpions fire at strafing dragons each tick
// ═══════════════════════════════════════════════════════════════════════════

const SIMULATIONS = 1000;
const MORALE_CAP = 20;

function clampMorale(m) { return Math.max(-MORALE_CAP, Math.min(MORALE_CAP, m)); }

// ── Army Definitions ───────────────────────────────────────────────────────

function makeArmy(name, levy, maa, elite, scorpions, opts = {}) {
  return {
    name, levy, maa, elite, scorpions,
    baseMorale: opts.morale || 10,
    warPriestFaith: opts.faith || 0,
    heraldPresence: opts.herald || 0,
    get totalMen() { return this.levy + this.maa + this.elite; },
    get hp() { return this.levy * 10 + this.maa * 20 + this.elite * 30; },
  };
}

const ARMIES = {
  size1:        makeArmy('Size 1 Military',  1200, 1200, 600, 2),
  size1_priest: makeArmy('Size 1 + Priest',  1200, 1200, 600, 2, { faith: 6 }),
  size1_full:   makeArmy('Size 1 + Priest + Herald', 1200, 1200, 600, 2, { faith: 6, herald: 6 }),
  size1_heavy:  makeArmy('Size 1 + 4 Scorpions', 1200, 1200, 600, 4),
  size2:        makeArmy('Size 2 Hybrid',    3000, 1400, 600, 2),
  size3:        makeArmy('Size 3 Civilian',  8000, 1700, 300, 1),
};

// ── Dragon Definitions ─────────────────────────────────────────────────────

const DRAGONS = [
  { name: 'Vhagar',       tier: 5, might: 10, agility: 3,  ferocity: 10, resilience: 10 },
  { name: 'Caraxes',      tier: 5, might: 7,  agility: 9,  ferocity: 10, resilience: 6 },
  { name: 'Meleys',       tier: 5, might: 7,  agility: 10, ferocity: 8,  resilience: 7 },
  { name: 'Vermithor',    tier: 5, might: 9,  agility: 5,  ferocity: 7,  resilience: 9 },
  { name: 'The Cannibal', tier: 5, might: 8,  agility: 6,  ferocity: 10, resilience: 8 },
  { name: 'Dreamfyre',    tier: 4, might: 7,  agility: 4,  ferocity: 5,  resilience: 8 },
  { name: 'Silverwing',   tier: 4, might: 7,  agility: 5,  ferocity: 4,  resilience: 8 },
  { name: 'Sunfyre',      tier: 4, might: 6,  agility: 6,  ferocity: 7,  resilience: 6 },
  { name: 'Seasmoke',     tier: 3, might: 5,  agility: 7,  ferocity: 6,  resilience: 5 },
  { name: 'Sheepstealer', tier: 3, might: 5,  agility: 8,  ferocity: 6,  resilience: 5 },
  { name: 'Tessarion',    tier: 2, might: 4,  agility: 7,  ferocity: 5,  resilience: 4 },
  { name: 'Vermax',       tier: 2, might: 4,  agility: 7,  ferocity: 6,  resilience: 4 },
  { name: 'Arrax',        tier: 1, might: 2,  agility: 7,  ferocity: 4,  resilience: 2 },
  { name: 'Stormcloud',   tier: 1, might: 2,  agility: 6,  ferocity: 6,  resilience: 2 },
];

// ── Derived Dragon Stats ───────────────────────────────────────────────────

function deriveDragon(d) {
  return {
    ...d,
    maxHp: (d.might + d.resilience) * d.tier * 5,
    strafeDmg: d.tier * 500 + d.might * 100,
    terror: d.tier * 2 + Math.floor(d.ferocity / 2),
    scorpionHitThreshold: getScorpionThreshold(d.agility),
    scorpionDmgPerHit: getScorpionDamage(d.tier, d.resilience),
  };
}

function getScorpionThreshold(agility) {
  if (agility <= 2) return 10;
  if (agility <= 4) return 12;
  if (agility <= 6) return 14;
  if (agility <= 8) return 16;
  return 18; // Agility 9-10: 18+ (15% hit rate, no longer "nat 20 only")
}

function getScorpionDamage(tier, resilience) {
  // Formula: (Tier + 1) × 5 − Resilience, minimum 5
  // Damage scales UP with Tier (bigger target = more mass to tear through)
  // Resilience provides modest resistance (thicker scales)
  return Math.max(5, (tier + 1) * 5 - resilience);
}

// ── Simulation ─────────────────────────────────────────────────────────────

const MAX_TICKS = 30;
const WITHDRAW_HP_PCT = 0.30; // Dragons withdraw at 30% HP

function simulate(dragon, armyDef) {
  // Army state — track actual men, not just HP
  let levy = armyDef.levy;
  let maa = armyDef.maa;
  let elite = armyDef.elite;
  let routedLevy = 0;
  let routedMaa = 0;

  const armyMaxHp = armyDef.hp;
  let morale = armyDef.baseMorale - dragon.tier; // -Tier for enemy dragon present

  let dragonHp = dragon.maxHp;
  let ticks = 0;
  let totalScorpionHits = 0;
  let totalScorpionDmg = 0;
  let totalStrafeDmg = 0;
  let totalRoutedMen = 0;
  let totalRalliedMen = 0;
  let dragonDied = false;
  let dragonWithdrew = false;

  function armyHp() { return levy * 10 + maa * 20 + elite * 30; }
  function totalActiveMen() { return levy + maa + elite; }

  while (ticks < MAX_TICKS && dragonHp > 0 && totalActiveMen() > 0) {
    ticks++;

    // ── 0. Withdrawal check — dragon retreats at 30% HP ──
    if (dragonHp <= dragon.maxHp * WITHDRAW_HP_PCT) {
      dragonWithdrew = true;
      break;
    }

    // ── 1. Dragon strafes — fire damage to army HP ──
    let rawDmg = dragon.strafeDmg;

    // Morale DR (positive morale only): morale × 1% reduction
    if (morale > 0) {
      rawDmg = Math.floor(rawDmg * (1 - morale * 0.01));
    }

    // Apply damage proportionally across unit types by HP share
    const currentHp = armyHp();
    if (currentHp <= 0) break;

    const levyHp = levy * 10;
    const maaHp = maa * 20;
    const eliteHp = elite * 30;

    const levyDmg = Math.floor(rawDmg * (levyHp / currentHp));
    const maaDmg = Math.floor(rawDmg * (maaHp / currentHp));
    const eliteDmg = rawDmg - levyDmg - maaDmg; // remainder to elite

    // Convert HP damage to men killed
    const levyKilled = Math.min(levy, Math.floor(levyDmg / 10));
    const maaKilled = Math.min(maa, Math.floor(maaDmg / 20));
    const eliteKilled = Math.min(elite, Math.floor(eliteDmg / 30));

    levy -= levyKilled;
    maa -= maaKilled;
    elite -= eliteKilled;
    totalStrafeDmg += rawDmg;

    // ── 2. Morale drain from strafe ──
    // -2 (active dragon) + -Terror value
    const terrorDrain = 2 + dragon.terror;
    morale = clampMorale(morale - terrorDrain);

    // HP loss morale drain: -1 per 5% of max HP lost this tick
    const hpLostPct = (rawDmg / armyMaxHp) * 100;
    morale = clampMorale(morale - Math.floor(hpLostPct / 5));

    // ── 3. Rout check (negative morale only) ──
    if (morale < 0) {
      // Rout rate: |morale| × 0.5% of levy+MaA per tick
      let routRate = Math.abs(morale) * 0.005;

      // War Priest reduces rout by Faith × 1.5%
      if (armyDef.warPriestFaith > 0) {
        routRate *= (1 - armyDef.warPriestFaith * 0.015);
      }
      routRate = Math.max(0, routRate);

      const levyRout = Math.min(levy, Math.floor(levy * routRate));
      const maaRout = Math.min(maa, Math.floor(maa * routRate));

      levy -= levyRout;
      maa -= maaRout;
      routedLevy += levyRout;
      routedMaa += maaRout;
      totalRoutedMen += levyRout + maaRout;
      // Elites NEVER rout from morale
    }

    // ── 4. Rally (Herald) ──
    if (armyDef.heraldPresence > 0 && (routedLevy + routedMaa) > 0) {
      const rallyRate = armyDef.heraldPresence * 0.02;
      const levyRally = Math.floor(routedLevy * rallyRate);
      const maaRally = Math.floor(routedMaa * rallyRate);

      routedLevy -= levyRally;
      routedMaa -= maaRally;
      levy += levyRally;
      maa += maaRally;
      totalRalliedMen += levyRally + maaRally;
    }

    // ── 5. Scorpion fire at dragon ──
    for (let s = 0; s < armyDef.scorpions; s++) {
      const roll = Math.floor(Math.random() * 20) + 1;
      if (roll >= dragon.scorpionHitThreshold) {
        totalScorpionHits++;
        const dmg = dragon.scorpionDmgPerHit;
        dragonHp = Math.max(0, dragonHp - dmg);
        totalScorpionDmg += dmg;
      }
    }

    if (dragonHp <= 0) { dragonDied = true; break; }
    if (totalActiveMen() <= 0) break;
  }

  // Outcome
  const remainingMen = totalActiveMen();
  const armyEliminated = remainingMen <= 0;
  const eliteOnly = levy === 0 && maa === 0 && elite > 0;

  return {
    ticks,
    dragonHp,
    dragonHpPct: dragonHp / dragon.maxHp * 100,
    dragonDied,
    dragonWithdrew,
    remainingMen,
    remainingLevy: levy,
    remainingMaa: maa,
    remainingElite: elite,
    armyHpRemaining: armyHp(),
    armyHpPct: armyHp() / armyMaxHp * 100,
    morale,
    armyEliminated,
    eliteOnly,
    totalScorpionHits,
    totalScorpionDmg,
    totalStrafeDmg,
    totalRoutedMen,
    totalRalliedMen,
    routedLevy,
    routedMaa,
  };
}

function simulateVerbose(dragon, armyDef) {
  let levy = armyDef.levy;
  let maa = armyDef.maa;
  let elite = armyDef.elite;
  let routedLevy = 0;
  let routedMaa = 0;

  const armyMaxHp = armyDef.hp;
  let morale = armyDef.baseMorale - dragon.tier;
  let dragonHp = dragon.maxHp;

  function armyHp() { return levy * 10 + maa * 20 + elite * 30; }
  function totalMen() { return levy + maa + elite; }

  console.log('');
  console.log('='.repeat(100));
  console.log('  ' + dragon.name + ' (T' + dragon.tier + ') vs ' + armyDef.name);
  console.log('  Dragon: ' + dragon.maxHp + ' HP | Strafe: ' + dragon.strafeDmg + '/tick | Terror: ' + dragon.terror);
  console.log('  Army: ' + armyMaxHp + ' HP (' + armyDef.levy + ' levy, ' + armyDef.maa + ' MaA, ' + armyDef.elite + ' elite)');
  console.log('  Scorpions: ' + armyDef.scorpions + ' (hit ' + dragon.scorpionHitThreshold + '+, ' +
    dragon.scorpionDmgPerHit + ' dmg/hit)');
  console.log('  Starting morale: ' + morale + ' (base ' + armyDef.baseMorale + ' − ' + dragon.tier + ' dragon presence)');
  if (armyDef.warPriestFaith) console.log('  War Priest: Faith ' + armyDef.warPriestFaith + ' (rout reduction ' + (armyDef.warPriestFaith * 1.5).toFixed(1) + '%)');
  if (armyDef.heraldPresence) console.log('  Herald: Presence ' + armyDef.heraldPresence + ' (rally ' + (armyDef.heraldPresence * 2) + '% of routed/tick)');
  console.log('='.repeat(100));

  for (let tick = 1; tick <= MAX_TICKS; tick++) {
    // Withdrawal check
    if (dragonHp <= dragon.maxHp * WITHDRAW_HP_PCT) {
      console.log('  *** DRAGON WITHDRAWS AT ' + Math.round(dragonHp / dragon.maxHp * 100) + '% HP (' + dragonHp + '/' + dragon.maxHp + ') ***');
      break;
    }

    // Strafe
    let rawDmg = dragon.strafeDmg;
    let drNote = '';
    if (morale > 0) {
      const dr = morale * 0.01;
      rawDmg = Math.floor(rawDmg * (1 - dr));
      drNote = ' (−' + Math.round(dr * 100) + '% morale DR)';
    }

    const currentHp = armyHp();
    if (currentHp <= 0) break;

    const levyHp = levy * 10;
    const maaHp = maa * 20;
    const eliteHp = elite * 30;
    const levyDmg = Math.floor(rawDmg * (levyHp / currentHp));
    const maaDmg = Math.floor(rawDmg * (maaHp / currentHp));
    const eliteDmg = rawDmg - levyDmg - maaDmg;

    const levyKilled = Math.min(levy, Math.floor(levyDmg / 10));
    const maaKilled = Math.min(maa, Math.floor(maaDmg / 20));
    const eliteKilled = Math.min(elite, Math.floor(eliteDmg / 30));

    levy -= levyKilled;
    maa -= maaKilled;
    elite -= eliteKilled;
    const menKilled = levyKilled + maaKilled + eliteKilled;

    // Morale
    const terrorDrain = 2 + dragon.terror;
    const hpLostPct = (rawDmg / armyMaxHp) * 100;
    const hpDrain = Math.floor(hpLostPct / 5);
    morale = clampMorale(morale - terrorDrain - hpDrain);

    // Rout
    let routThisTick = 0;
    if (morale < 0) {
      let routRate = Math.abs(morale) * 0.005;
      if (armyDef.warPriestFaith > 0) routRate *= (1 - armyDef.warPriestFaith * 0.015);
      routRate = Math.max(0, routRate);
      const lR = Math.min(levy, Math.floor(levy * routRate));
      const mR = Math.min(maa, Math.floor(maa * routRate));
      levy -= lR;
      maa -= mR;
      routedLevy += lR;
      routedMaa += mR;
      routThisTick = lR + mR;
    }

    // Rally
    let rallied = 0;
    if (armyDef.heraldPresence > 0 && (routedLevy + routedMaa) > 0) {
      const rallyRate = armyDef.heraldPresence * 0.02;
      const lRally = Math.floor(routedLevy * rallyRate);
      const mRally = Math.floor(routedMaa * rallyRate);
      routedLevy -= lRally;
      routedMaa -= mRally;
      levy += lRally;
      maa += mRally;
      rallied = lRally + mRally;
    }

    // Scorpions
    let scorpHits = 0;
    let scorpDmg = 0;
    for (let s = 0; s < armyDef.scorpions; s++) {
      const roll = Math.floor(Math.random() * 20) + 1;
      if (roll >= dragon.scorpionHitThreshold) {
        scorpHits++;
        scorpDmg += dragon.scorpionDmgPerHit;
      }
    }
    dragonHp = Math.max(0, dragonHp - scorpDmg);

    const armyPct = (armyHp() / armyMaxHp * 100).toFixed(1);
    const dragonPct = (dragonHp / dragon.maxHp * 100).toFixed(0);

    let line = '  Tick ' + String(tick).padStart(2) + ': ';
    line += 'Strafe ' + rawDmg + drNote + ' → ' + menKilled + ' killed';
    line += ' | Army: ' + totalMen() + ' men (' + levy + 'L/' + maa + 'M/' + elite + 'E) ' + armyPct + '% HP';
    line += ' | Morale ' + morale;
    if (routThisTick > 0) line += ' | ROUT: ' + routThisTick + ' fled';
    if (rallied > 0) line += ' | Rally: ' + rallied + ' return';
    if (scorpHits > 0) line += ' | Scorpion: ' + scorpHits + '×' + dragon.scorpionDmgPerHit + '=' + scorpDmg + ' dmg';
    line += ' | Dragon ' + dragonPct + '% HP';
    console.log(line);

    if (totalMen() <= 0) { console.log('  *** ARMY DESTROYED ***'); break; }
    if (levy === 0 && maa === 0 && elite > 0) {
      console.log('  *** LEVY + MAA ELIMINATED — ' + elite + ' elites remain (never rout) ***');
      // Continue — elites still fight
    }
    if (dragonHp <= 0) { console.log('  *** DRAGON KILLED BY SCORPIONS ***'); break; }
  }

  if (dragonHp > 0 && totalMen() > 0) {
    console.log('  --- Battle ongoing after ' + MAX_TICKS + ' ticks. Army: ' + totalMen() + ' men. Dragon: ' + Math.round(dragonHp / dragon.maxHp * 100) + '% HP. Morale: ' + morale + ' ---');
  }
}

// ── Helpers ────────────────────────────────────────────────────────────────

function pad(s, n) { s = String(s); return s + ' '.repeat(Math.max(0, n - s.length)); }
function padL(s, n) { s = String(s); return ' '.repeat(Math.max(0, n - s.length)) + s; }

// ── Main ───────────────────────────────────────────────────────────────────

const dragons = DRAGONS.map(deriveDragon);
const armySets = [
  ARMIES.size1,
  ARMIES.size2,
  ARMIES.size3,
];

console.log('');
console.log('='.repeat(130));
console.log('  DRAGON vs ARMY — WBS STRAFE SIMULATOR');
console.log('  ' + SIMULATIONS + ' sims/dragon | Dragons withdraw at ' + (WITHDRAW_HP_PCT * 100) + '% HP');
console.log('  Morale: positive = DR (morale×1%), negative = rout (|morale|×0.5% levy+MaA/tick). Elites never rout.');
console.log('  Scorpion damage: (Tier+1)×5 − Resilience (min 5). Agility determines hit threshold.');
console.log('='.repeat(130));

// ── Stat Cards ──

console.log('');
console.log(
  pad('Dragon', 16) + padL('Tier', 5) + padL('HP', 6) + padL('Strafe', 8) + padL('Terror', 7) +
  padL('Scorp Dmg', 10) + padL('Hit Thr', 8) + padL('Terror/Tk', 10)
);
console.log('-'.repeat(70));

for (const d of dragons) {
  const terrorPerTick = 2 + d.terror;
  console.log(
    pad(d.name, 16) + padL('T' + d.tier, 5) + padL(d.maxHp, 6) + padL(d.strafeDmg, 8) + padL(d.terror, 7) +
    padL(d.scorpionDmgPerHit, 10) + padL(d.scorpionHitThreshold + '+', 8) + padL('-' + terrorPerTick, 10)
  );
}

// ── Run Simulations Per Army Size ──

function runArmySim(army) {
  const hdr =
    pad('Dragon', 16) + padL('Tier', 5) +
    padL('AvgTk', 6) + padL('Morale', 7) +
    padL('ArmyHP%', 8) + padL('Men Left', 9) + padL('Elite', 6) +
    padL('Routed', 7) +
    padL('DrgnHP%', 8) + padL('Die%', 6) + padL('Wdraw%', 7) + padL('Wins%', 7) +
    padL('ScorpHit', 9);

  console.log('');
  console.log('='.repeat(130));
  console.log('  ' + army.name + ' — ' + army.totalMen + ' men (' + army.levy + 'L/' + army.maa + 'M/' +
    army.elite + 'E) | ' + army.hp + ' HP | ' + army.scorpions + ' scorpions | Morale ' + army.baseMorale);
  console.log('='.repeat(130));
  console.log('');
  console.log(hdr);
  console.log('-'.repeat(130));

  for (const d of dragons) {
    let totalTicks = 0, totalMorale = 0, totalArmyPct = 0;
    let totalMen = 0, totalElite = 0, totalRouted = 0;
    let totalDragonPct = 0, dragonDeaths = 0, dragonWithdraws = 0, armyWins = 0, totalScorpHits = 0;

    for (let i = 0; i < SIMULATIONS; i++) {
      const r = simulate(d, army);
      totalTicks += r.ticks;
      totalMorale += r.morale;
      totalArmyPct += r.armyHpPct;
      totalMen += r.remainingMen;
      totalElite += r.remainingElite;
      totalRouted += r.totalRoutedMen;
      totalDragonPct += r.dragonHpPct;
      if (r.dragonDied) dragonDeaths++;
      if (r.dragonWithdrew) dragonWithdraws++;
      if (r.armyEliminated) armyWins++;
      totalScorpHits += r.totalScorpionHits;
    }

    const n = SIMULATIONS;
    console.log(
      pad(d.name, 16) + padL('T' + d.tier, 5) +
      padL((totalTicks / n).toFixed(1), 6) +
      padL((totalMorale / n).toFixed(0), 7) +
      padL((totalArmyPct / n).toFixed(1), 8) +
      padL(Math.round(totalMen / n), 9) +
      padL(Math.round(totalElite / n), 6) +
      padL(Math.round(totalRouted / n), 7) +
      padL((totalDragonPct / n).toFixed(0), 8) +
      padL((dragonDeaths / n * 100).toFixed(1), 6) +
      padL((dragonWithdraws / n * 100).toFixed(1), 7) +
      padL((armyWins / n * 100).toFixed(1), 7) +
      padL((totalScorpHits / n).toFixed(1), 9)
    );
  }
}

for (const army of armySets) {
  runArmySim(army);
}

// ── Verbose Examples — one per tier vs Size 1 ──

const verboseArmy = ARMIES.size1;
simulateVerbose(dragons[0], verboseArmy);                                 // Vhagar (T5)
simulateVerbose(dragons.find(d => d.name === 'Dreamfyre'), verboseArmy);  // Dreamfyre (T4)
simulateVerbose(dragons.find(d => d.name === 'Sunfyre'), verboseArmy);    // Sunfyre (T3)
simulateVerbose(dragons.find(d => d.name === 'Tessarion'), verboseArmy);  // Tessarion (T2)
simulateVerbose(dragons.find(d => d.name === 'Arrax'), verboseArmy);      // Arrax (T1)

console.log('');
console.log('Simulation complete.');
