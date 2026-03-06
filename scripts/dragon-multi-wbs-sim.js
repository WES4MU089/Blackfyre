#!/usr/bin/env node

// ═══════════════════════════════════════════════════════════════════════════
//  MULTI-DRAGON vs ARMY — WBS STRAFE SIMULATOR
//  Simulates multiple dragons strafing a large coalition army
//
//  Each dragon strafes independently per tick.
//  Combined strafe damage applied to army HP.
//  Terror drain = -2 per active dragon + sum of all Terror values.
//  Starting morale penalty = highest dragon Tier (not summed — one big
//    dragon is terrifying, two big dragons aren't twice as terrifying
//    as seeing the first one).
//  Scorpions split fire: each battery randomly targets one dragon.
//  Dragons withdraw individually at 30% HP.
// ═══════════════════════════════════════════════════════════════════════════

const SIMULATIONS = 1000;
const WITHDRAW_HP_PCT = 0.30;
const MAX_TICKS = 50; // Larger armies need more ticks
const MORALE_CAP = 20;

function clampMorale(m) { return Math.max(-MORALE_CAP, Math.min(MORALE_CAP, m)); }

// ── Army Builder ─────────────────────────────────────────────────────────

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

// ── Dragon Definitions ───────────────────────────────────────────────────

const ALL_DRAGONS = {
  'Vhagar':       { name: 'Vhagar',       tier: 5, might: 10, agility: 3,  ferocity: 10, resilience: 10 },
  'Caraxes':      { name: 'Caraxes',      tier: 5, might: 7,  agility: 9,  ferocity: 10, resilience: 6 },
  'Meleys':       { name: 'Meleys',       tier: 5, might: 7,  agility: 10, ferocity: 8,  resilience: 7 },
  'Vermithor':    { name: 'Vermithor',    tier: 5, might: 9,  agility: 5,  ferocity: 7,  resilience: 9 },
  'The Cannibal': { name: 'The Cannibal', tier: 5, might: 8,  agility: 6,  ferocity: 10, resilience: 8 },
  'Dreamfyre':    { name: 'Dreamfyre',    tier: 4, might: 7,  agility: 4,  ferocity: 5,  resilience: 8 },
  'Silverwing':   { name: 'Silverwing',   tier: 4, might: 7,  agility: 5,  ferocity: 4,  resilience: 8 },
  'Sunfyre':      { name: 'Sunfyre',      tier: 4, might: 6,  agility: 6,  ferocity: 7,  resilience: 6 },
  'Seasmoke':     { name: 'Seasmoke',     tier: 3, might: 5,  agility: 7,  ferocity: 6,  resilience: 5 },
  'Sheepstealer': { name: 'Sheepstealer', tier: 3, might: 5,  agility: 8,  ferocity: 6,  resilience: 5 },
  'Tessarion':    { name: 'Tessarion',    tier: 2, might: 4,  agility: 7,  ferocity: 5,  resilience: 4 },
  'Vermax':       { name: 'Vermax',       tier: 2, might: 4,  agility: 7,  ferocity: 6,  resilience: 4 },
  'Arrax':        { name: 'Arrax',        tier: 1, might: 2,  agility: 7,  ferocity: 4,  resilience: 2 },
  'Stormcloud':   { name: 'Stormcloud',   tier: 1, might: 2,  agility: 6,  ferocity: 6,  resilience: 2 },
};

// ── Scorpion Mechanics ───────────────────────────────────────────────────

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

// ── Derive Dragon Stats ──────────────────────────────────────────────────

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

// ── Multi-Dragon Simulation ──────────────────────────────────────────────

function simulate(dragonDefs, armyDef) {
  // Dragon state
  const dragons = dragonDefs.map(d => ({
    ...d,
    hp: d.maxHp,
    active: true,
    withdrew: false,
    died: false,
    scorpionHits: 0,
    scorpionDmg: 0,
    strafeDmgDealt: 0,
  }));

  // Army state
  let levy = armyDef.levy;
  let maa = armyDef.maa;
  let elite = armyDef.elite;
  let routedLevy = 0;
  let routedMaa = 0;

  const armyMaxHp = armyDef.hp;
  // Starting morale: -highest tier among all dragons (not summed)
  const maxTier = Math.max(...dragons.map(d => d.tier));
  let morale = armyDef.baseMorale - maxTier;

  let ticks = 0;
  let totalRoutedMen = 0;

  function armyHp() { return levy * 10 + maa * 20 + elite * 30; }
  function totalActiveMen() { return levy + maa + elite; }
  function activeDragons() { return dragons.filter(d => d.active); }

  while (ticks < MAX_TICKS && totalActiveMen() > 0 && activeDragons().length > 0) {
    ticks++;

    // ── 0. Withdrawal check — each dragon checks independently ──
    for (const d of dragons) {
      if (d.active && d.hp <= d.maxHp * WITHDRAW_HP_PCT) {
        d.active = false;
        d.withdrew = true;
      }
    }
    if (activeDragons().length === 0) break;

    // ── 1. All active dragons strafe — combined fire damage ──
    const active = activeDragons();
    let totalRawDmg = 0;
    for (const d of active) {
      totalRawDmg += d.strafeDmg;
    }

    // Morale DR (positive morale only)
    if (morale > 0) {
      totalRawDmg = Math.floor(totalRawDmg * (1 - morale * 0.01));
    }

    // Distribute damage proportionally
    const currentHp = armyHp();
    if (currentHp <= 0) break;

    const levyHp = levy * 10;
    const maaHp = maa * 20;
    const eliteHp = elite * 30;

    const levyDmg = Math.floor(totalRawDmg * (levyHp / currentHp));
    const maaDmg = Math.floor(totalRawDmg * (maaHp / currentHp));
    const eliteDmg = totalRawDmg - levyDmg - maaDmg;

    const levyKilled = Math.min(levy, Math.floor(levyDmg / 10));
    const maaKilled = Math.min(maa, Math.floor(maaDmg / 20));
    const eliteKilled = Math.min(elite, Math.floor(eliteDmg / 30));

    levy -= levyKilled;
    maa -= maaKilled;
    elite -= eliteKilled;

    // Track damage per dragon (proportional share)
    for (const d of active) {
      d.strafeDmgDealt += Math.floor(totalRawDmg * (d.strafeDmg / active.reduce((s, x) => s + x.strafeDmg, 0)));
    }

    // ── 2. Morale drain — scales with number of active dragons ──
    // -2 per active dragon + sum of all active Terror values
    const terrorDrain = active.length * 2 + active.reduce((s, d) => s + d.terror, 0);
    morale = clampMorale(morale - terrorDrain);

    // HP loss morale drain
    const hpLostPct = (totalRawDmg / armyMaxHp) * 100;
    morale = clampMorale(morale - Math.floor(hpLostPct / 5));

    // ── 3. Rout check ──
    if (morale < 0) {
      let routRate = Math.abs(morale) * 0.005;
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
    }

    // ── 4. Rally (Herald) ──
    if (armyDef.heraldPresence > 0 && (routedLevy + routedMaa) > 0) {
      const rallyRate = armyDef.heraldPresence * 0.02;
      const lRally = Math.floor(routedLevy * rallyRate);
      const mRally = Math.floor(routedMaa * rallyRate);
      routedLevy -= lRally;
      routedMaa -= mRally;
      levy += lRally;
      maa += mRally;
    }

    // ── 5. Scorpions — each battery randomly targets one active dragon ──
    for (let s = 0; s < armyDef.scorpions; s++) {
      const target = active[Math.floor(Math.random() * active.length)];
      const roll = Math.floor(Math.random() * 20) + 1;
      if (roll >= target.scorpionHitThreshold) {
        const dmg = target.scorpionDmgPerHit;
        target.hp = Math.max(0, target.hp - dmg);
        target.scorpionHits++;
        target.scorpionDmg += dmg;
      }
    }

    // Check dragon deaths
    for (const d of dragons) {
      if (d.active && d.hp <= 0) {
        d.active = false;
        d.died = true;
      }
    }

    if (totalActiveMen() <= 0) break;
  }

  return {
    ticks,
    morale,
    dragons: dragons.map(d => ({
      name: d.name,
      hpPct: d.hp / d.maxHp * 100,
      hp: d.hp,
      died: d.died,
      withdrew: d.withdrew,
      active: d.active,
      scorpionHits: d.scorpionHits,
      scorpionDmg: d.scorpionDmg,
    })),
    remainingMen: totalActiveMen(),
    remainingLevy: levy,
    remainingMaa: maa,
    remainingElite: elite,
    armyHpPct: armyHp() / armyMaxHp * 100,
    armyEliminated: totalActiveMen() <= 0,
    totalRoutedMen,
    routedLevy,
    routedMaa,
  };

  function totalActiveMen() { return levy + maa + elite; }
  function armyHp() { return levy * 10 + maa * 20 + elite * 30; }
}

// ── Verbose Multi-Dragon Simulation ──────────────────────────────────────

function simulateVerbose(dragonDefs, armyDef) {
  const dragons = dragonDefs.map(d => ({ ...d, hp: d.maxHp, active: true }));

  let levy = armyDef.levy;
  let maa = armyDef.maa;
  let elite = armyDef.elite;
  let routedLevy = 0;
  let routedMaa = 0;

  const armyMaxHp = armyDef.hp;
  const maxTier = Math.max(...dragons.map(d => d.tier));
  let morale = armyDef.baseMorale - maxTier;

  function armyHp() { return levy * 10 + maa * 20 + elite * 30; }
  function totalMen() { return levy + maa + elite; }
  function activeDragons() { return dragons.filter(d => d.active); }

  const dragonNames = dragons.map(d => d.name + ' (T' + d.tier + ')').join(' + ');

  console.log('');
  console.log('='.repeat(120));
  console.log('  ' + dragonNames + '  vs  ' + armyDef.name);
  console.log('');
  for (const d of dragons) {
    console.log('  ' + d.name + ': ' + d.maxHp + ' HP | Strafe ' + d.strafeDmg + '/tick | Terror ' + d.terror +
      ' | Scorpion: hit ' + d.scorpionHitThreshold + '+, ' + d.scorpionDmgPerHit + ' dmg/hit');
  }
  console.log('');
  console.log('  Army: ' + armyMaxHp + ' HP (' + armyDef.levy + ' levy, ' + armyDef.maa + ' MaA, ' + armyDef.elite + ' elite)');
  console.log('  Scorpions: ' + armyDef.scorpions + ' batteries (split fire across active dragons)');
  console.log('  Starting morale: ' + morale + ' (base ' + armyDef.baseMorale + ' − ' + maxTier + ' dragon presence)');
  if (armyDef.warPriestFaith) console.log('  War Priest: Faith ' + armyDef.warPriestFaith);
  if (armyDef.heraldPresence) console.log('  Herald: Presence ' + armyDef.heraldPresence);
  console.log('='.repeat(120));

  for (let tick = 1; tick <= MAX_TICKS; tick++) {
    // Withdrawal check
    for (const d of dragons) {
      if (d.active && d.hp <= d.maxHp * WITHDRAW_HP_PCT) {
        d.active = false;
        console.log('  Tick ' + String(tick).padStart(2) + ': *** ' + d.name + ' WITHDRAWS at ' +
          Math.round(d.hp / d.maxHp * 100) + '% HP (' + d.hp + '/' + d.maxHp + ') ***');
      }
    }
    const active = activeDragons();
    if (active.length === 0) { console.log('  *** ALL DRAGONS WITHDRAWN ***'); break; }

    // Combined strafe
    let totalRawDmg = active.reduce((s, d) => s + d.strafeDmg, 0);
    let drNote = '';
    if (morale > 0) {
      const dr = morale * 0.01;
      totalRawDmg = Math.floor(totalRawDmg * (1 - dr));
      drNote = ' (−' + Math.round(dr * 100) + '% morale DR)';
    }

    const currentHp = armyHp();
    if (currentHp <= 0) break;

    const levyHp = levy * 10;
    const maaHp = maa * 20;
    const eliteHp = elite * 30;
    const levyDmg = Math.floor(totalRawDmg * (levyHp / currentHp));
    const maaDmg = Math.floor(totalRawDmg * (maaHp / currentHp));
    const eliteDmg = totalRawDmg - levyDmg - maaDmg;

    const levyKilled = Math.min(levy, Math.floor(levyDmg / 10));
    const maaKilled = Math.min(maa, Math.floor(maaDmg / 20));
    const eliteKilled = Math.min(elite, Math.floor(eliteDmg / 30));
    levy -= levyKilled;
    maa -= maaKilled;
    elite -= eliteKilled;
    const menKilled = levyKilled + maaKilled + eliteKilled;

    // Morale
    const terrorDrain = active.length * 2 + active.reduce((s, d) => s + d.terror, 0);
    const hpLostPct = (totalRawDmg / armyMaxHp) * 100;
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

    // Scorpions — split fire
    const scorpResults = {};
    for (const d of active) scorpResults[d.name] = { hits: 0, dmg: 0 };
    for (let s = 0; s < armyDef.scorpions; s++) {
      const target = active[Math.floor(Math.random() * active.length)];
      const roll = Math.floor(Math.random() * 20) + 1;
      if (roll >= target.scorpionHitThreshold) {
        const dmg = target.scorpionDmgPerHit;
        target.hp = Math.max(0, target.hp - dmg);
        scorpResults[target.name].hits++;
        scorpResults[target.name].dmg += dmg;
      }
    }

    // Check deaths
    for (const d of dragons) {
      if (d.active && d.hp <= 0) {
        d.active = false;
      }
    }

    // Build output line
    const armyPct = (armyHp() / armyMaxHp * 100).toFixed(1);
    const strafersStr = active.map(d => d.name.split(' ')[0]).join('+');

    let line = '  Tick ' + String(tick).padStart(2) + ': ';
    line += strafersStr + ' strafe ' + totalRawDmg + drNote + ' → ' + menKilled + ' killed';
    line += ' | Army: ' + totalMen() + ' (' + levy + 'L/' + maa + 'M/' + elite + 'E) ' + armyPct + '%';
    line += ' | Morale ' + morale;
    if (routThisTick > 0) line += ' | ROUT: ' + routThisTick;
    if (rallied > 0) line += ' | Rally: ' + rallied;

    // Scorpion summary
    const scorpParts = [];
    for (const d of active) {
      const r = scorpResults[d.name];
      if (r.hits > 0) scorpParts.push(d.name.split(' ')[0] + ':' + r.hits + '×' + d.scorpionDmgPerHit + '=' + r.dmg);
    }
    if (scorpParts.length > 0) line += ' | Scorp[' + scorpParts.join(', ') + ']';

    // Dragon HP summary
    const hpParts = dragons.map(d => {
      if (d.died) return d.name.split(' ')[0] + ':DEAD';
      if (!d.active && d.hp > 0) return d.name.split(' ')[0] + ':OUT(' + Math.round(d.hp / d.maxHp * 100) + '%)';
      return d.name.split(' ')[0] + ':' + Math.round(d.hp / d.maxHp * 100) + '%';
    });
    line += ' | Dragons[' + hpParts.join(', ') + ']';

    console.log(line);

    if (totalMen() <= 0) { console.log('  *** ARMY DESTROYED ***'); break; }
    if (levy === 0 && maa === 0 && elite > 0) {
      console.log('  *** LEVY + MAA ELIMINATED — ' + elite + ' elites remain ***');
    }

    for (const d of dragons) {
      if (d.hp <= 0 && d.active !== false) {
        console.log('  *** ' + d.name + ' KILLED BY SCORPIONS ***');
        d.active = false;
      }
    }
  }

  const finalActive = activeDragons();
  if (finalActive.length > 0 && totalMen() > 0) {
    console.log('  --- Battle ongoing after ' + MAX_TICKS + ' ticks. Army: ' + totalMen() + ' men. Morale: ' + morale + ' ---');
  }
}

// ── Helpers ──────────────────────────────────────────────────────────────

function pad(s, n) { s = String(s); return s + ' '.repeat(Math.max(0, n - s.length)); }
function padL(s, n) { s = String(s); return ' '.repeat(Math.max(0, n - s.length)) + s; }

// ═══════════════════════════════════════════════════════════════════════════
//  SCENARIO: Caraxes + Meleys vs 40,000 man coalition
//
//  40k army composition (large Westerosi coalition):
//    Multiple castles + towns + cities joining forces.
//    Estimated blend: ~62% levy, ~23% MaA, ~15% elite
//    Levy: 25,000  MaA: 9,000  Elite: 6,000
//    HP: 250,000 + 225,000 + 600,000 = 1,075,000
//    Scorpions: 8 batteries (multiple castles contributing)
//
//  This represents a massive mustered host — think the combined armies
//  at the Battle of the Trident or the Targaryen host at the Field of Fire.
// ═══════════════════════════════════════════════════════════════════════════

const caraxes = deriveDragon(ALL_DRAGONS['Caraxes']);
const meleys = deriveDragon(ALL_DRAGONS['Meleys']);
const dragonTeam = [caraxes, meleys];

// Coalition armies at different configurations
const coalition40k = makeArmy('40k Coalition', 25000, 9000, 6000, 8);
const coalition40k_priest = makeArmy('40k + War Priest', 25000, 9000, 6000, 8, { faith: 6 });
const coalition40k_full = makeArmy('40k + Priest + Herald', 25000, 9000, 6000, 8, { faith: 6, herald: 6 });
const coalition40k_heavy = makeArmy('40k + 12 Scorpions', 25000, 9000, 6000, 12);

const scenarios = [coalition40k, coalition40k_priest, coalition40k_full, coalition40k_heavy];

// Header
console.log('');
console.log('='.repeat(130));
console.log('  MULTI-DRAGON vs ARMY — Caraxes + Meleys vs 40,000 Man Coalition');
console.log('  ' + SIMULATIONS + ' sims/scenario | Dragons withdraw at ' + (WITHDRAW_HP_PCT * 100) + '% HP | Max ' + MAX_TICKS + ' ticks');
console.log('  Scorpion damage: (Tier+1)×5 − Resilience. Split fire across active dragons.');
console.log('='.repeat(130));

console.log('');
console.log('  Caraxes: ' + caraxes.maxHp + ' HP | Strafe ' + caraxes.strafeDmg + ' | Terror ' + caraxes.terror +
  ' | Scorp: hit ' + caraxes.scorpionHitThreshold + '+, ' + caraxes.scorpionDmgPerHit + ' dmg');
console.log('  Meleys:  ' + meleys.maxHp + ' HP | Strafe ' + meleys.strafeDmg + ' | Terror ' + meleys.terror +
  ' | Scorp: hit ' + meleys.scorpionHitThreshold + '+, ' + meleys.scorpionDmgPerHit + ' dmg');
console.log('  Combined strafe: ' + (caraxes.strafeDmg + meleys.strafeDmg) + '/tick | Combined terror: -' +
  (2 * 2 + caraxes.terror + meleys.terror) + '/tick');

// ── Run Simulations ──

for (const army of scenarios) {
  console.log('');
  console.log('='.repeat(130));
  console.log('  vs ' + army.name + ' — ' + army.totalMen + ' men (' + army.levy + 'L/' + army.maa + 'M/' +
    army.elite + 'E) | ' + army.hp.toLocaleString() + ' HP | ' + army.scorpions + ' scorpions');
  if (army.warPriestFaith) console.log('  War Priest Faith ' + army.warPriestFaith + ' | Herald Presence ' + (army.heraldPresence || 0));
  console.log('='.repeat(130));

  let totalTicks = 0, totalMorale = 0, totalArmyPct = 0, totalMen = 0, totalElite = 0, totalRouted = 0;
  let armyWins = 0;
  const dragonStats = {};
  for (const d of dragonTeam) {
    dragonStats[d.name] = { totalHpPct: 0, deaths: 0, withdrawals: 0, totalScorpHits: 0 };
  }

  for (let i = 0; i < SIMULATIONS; i++) {
    const r = simulate(dragonTeam, army);
    totalTicks += r.ticks;
    totalMorale += r.morale;
    totalArmyPct += r.armyHpPct;
    totalMen += r.remainingMen;
    totalElite += r.remainingElite;
    totalRouted += r.totalRoutedMen;
    if (r.armyEliminated) armyWins++;

    for (const dr of r.dragons) {
      const s = dragonStats[dr.name];
      s.totalHpPct += dr.hpPct;
      if (dr.died) s.deaths++;
      if (dr.withdrew) s.withdrawals++;
      s.totalScorpHits += dr.scorpionHits;
    }
  }

  const n = SIMULATIONS;
  console.log('');
  console.log('  ARMY RESULTS:');
  console.log('    Avg ticks:     ' + (totalTicks / n).toFixed(1));
  console.log('    Avg morale:    ' + (totalMorale / n).toFixed(0));
  console.log('    Army HP%:      ' + (totalArmyPct / n).toFixed(1) + '%');
  console.log('    Men remaining: ' + Math.round(totalMen / n) + ' (elite: ' + Math.round(totalElite / n) + ')');
  console.log('    Routed:        ' + Math.round(totalRouted / n));
  console.log('    Army wiped:    ' + (armyWins / n * 100).toFixed(1) + '%');
  console.log('');
  console.log('  DRAGON RESULTS:');
  for (const d of dragonTeam) {
    const s = dragonStats[d.name];
    console.log('    ' + pad(d.name, 14) +
      'HP: ' + padL((s.totalHpPct / n).toFixed(0), 3) + '%  ' +
      'Died: ' + padL((s.deaths / n * 100).toFixed(1), 5) + '%  ' +
      'Withdrew: ' + padL((s.withdrawals / n * 100).toFixed(1), 5) + '%  ' +
      'Survived: ' + padL((((n - s.deaths - s.withdrawals) / n) * 100).toFixed(1), 5) + '%  ' +
      'Scorp hits: ' + (s.totalScorpHits / n).toFixed(1));
  }
  console.log('    Both survive & army wiped: ' + (armyWins / n * 100).toFixed(1) + '%');
}

// ── Verbose Run — base scenario ──

simulateVerbose(dragonTeam, coalition40k);

console.log('');
console.log('Simulation complete.');
