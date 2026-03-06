#!/usr/bin/env node

// ═══════════════════════════════════════════════════════════════════════════
//  THE CANNIBAL vs 5 FULL-STACK PLAYER ARMIES — NO DRAGONS
//
//  Scenario: The Cannibal (wild T5) attacks a coalition of 5 Size 1 armies.
//  Each army is independently composed and tracked but fights as one force.
//  The Cannibal strafes the combined force; all scorpions fire back.
//
//  Armies share a single morale value (they're fighting on the same field).
//  Rout and rally apply to each army's men independently.
//  Strafe damage is distributed proportionally across ALL armies' combined HP.
//
//  Key question: Can 5 player armies with 10 scorpions kill or drive off
//  The Cannibal before he breaks them?
// ═══════════════════════════════════════════════════════════════════════════

const SIMULATIONS = 10000;
const MAX_TICKS = 50;
const WITHDRAW_HP_PCT = 0.30;
const MORALE_CAP = 20;

function clampMorale(m) { return Math.max(-MORALE_CAP, Math.min(MORALE_CAP, m)); }

// ── The Cannibal ─────────────────────────────────────────────────────────

const CANNIBAL = {
  name: 'The Cannibal',
  tier: 5,
  might: 8,
  agility: 6,
  ferocity: 10,
  resilience: 8,
};

function deriveDragon(d) {
  return {
    ...d,
    maxHp: (d.might + d.resilience) * d.tier * 5,       // 400
    strafeDmg: d.tier * 500 + d.might * 100,             // 3300
    terror: d.tier * 2 + Math.floor(d.ferocity / 2),     // 15
    scorpionHitThreshold: getScorpionThreshold(d.agility), // 14+
    scorpionDmgPerHit: getScorpionDamage(d.tier, d.resilience), // 22
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

// ── Army Definition ──────────────────────────────────────────────────────

function makeArmy(name, levy, maa, elite, scorpions, opts = {}) {
  return {
    name, levy, maa, elite, scorpions,
    warPriestFaith: opts.faith || 0,
    heraldPresence: opts.herald || 0,
    // Routed pools
    routedLevy: 0,
    routedMaa: 0,
    get totalMen() { return this.levy + this.maa + this.elite; },
    get hp() { return this.levy * 10 + this.maa * 20 + this.elite * 30; },
  };
}

function cloneArmy(a) {
  return makeArmy(a.name, a.levy, a.maa, a.elite, a.scorpions, {
    faith: a.warPriestFaith,
    herald: a.heraldPresence,
  });
}

// ── 5 Full-Stack Size 1 Armies ───────────────────────────────────────────
// Each: 1200 levy + 1200 MaA + 600 elite = 3000 men, 2 scorpions
// Total: 6000 levy + 6000 MaA + 3000 elite = 15000 men, 10 scorpions
// Total HP: 60,000 + 120,000 + 90,000 = 270,000

const ARMY_TEMPLATES = [
  { name: 'Army 1', levy: 1200, maa: 1200, elite: 600, scorpions: 2, faith: 0, herald: 0 },
  { name: 'Army 2', levy: 1200, maa: 1200, elite: 600, scorpions: 2, faith: 0, herald: 0 },
  { name: 'Army 3', levy: 1200, maa: 1200, elite: 600, scorpions: 2, faith: 0, herald: 0 },
  { name: 'Army 4', levy: 1200, maa: 1200, elite: 600, scorpions: 2, faith: 0, herald: 0 },
  { name: 'Army 5', levy: 1200, maa: 1200, elite: 600, scorpions: 2, faith: 0, herald: 0 },
];

// ── Simulation ───────────────────────────────────────────────────────────

function simulate(dragon, armyTemplates, verbose) {
  const armies = armyTemplates.map(t => makeArmy(t.name, t.levy, t.maa, t.elite, t.scorpions, t));

  // Combined stats
  function totalMen() { return armies.reduce((s, a) => s + a.totalMen, 0); }
  function totalHp() { return armies.reduce((s, a) => s + a.hp, 0); }
  function totalScorpions() { return armies.reduce((s, a) => s + a.scorpions, 0); }
  const startingHp = totalHp();
  const startingMen = totalMen();

  let morale = 10 - dragon.tier; // Base 10 − T5 presence = 5
  morale = clampMorale(morale);

  let dragonHp = dragon.maxHp;
  let ticks = 0;
  let cumScorpionHits = 0;
  let cumScorpionDmg = 0;
  let cumStrafeDmg = 0;
  let cumRouted = 0;
  let dragonDied = false;
  let dragonWithdrew = false;

  if (verbose) {
    console.log('');
    console.log('='.repeat(110));
    console.log(`  ${dragon.name} (T${dragon.tier}) vs ${armies.length} Full-Stack Armies`);
    console.log(`  Dragon: ${dragon.maxHp} HP | Strafe: ${dragon.strafeDmg}/tick | Terror: ${dragon.terror}`);
    console.log(`  Scorpion hit: ${dragon.scorpionHitThreshold}+ (d20) | Dmg/hit: ${dragon.scorpionDmgPerHit}`);
    console.log(`  Combined Army: ${startingMen} men | ${startingHp} HP | ${totalScorpions()} scorpions`);
    console.log(`  Starting morale: ${morale} (base 10 − ${dragon.tier} dragon presence)`);
    console.log('='.repeat(110));
    console.log('');
    console.log(
      'Tick'.padStart(4) + ' │' +
      'Dragon HP'.padStart(11) + ' │' +
      'Army HP'.padStart(11) + ' │' +
      'Men'.padStart(7) + ' │' +
      'Morale'.padStart(7) + ' │' +
      'Strafe'.padStart(8) + ' │' +
      'Scorp Hits'.padStart(11) + ' │' +
      'Scorp Dmg'.padStart(10) + ' │' +
      'Routed'.padStart(8) + ' │ Notes'
    );
    console.log('─'.repeat(110));
  }

  while (ticks < MAX_TICKS && dragonHp > 0 && totalMen() > 0) {
    ticks++;
    let tickNotes = [];

    // ── 0. Withdrawal check ──
    if (dragonHp <= dragon.maxHp * WITHDRAW_HP_PCT) {
      dragonWithdrew = true;
      if (verbose) tickNotes.push('DRAGON WITHDRAWS');
      if (verbose) printTick(ticks, dragonHp, dragon.maxHp, totalHp(), startingHp, totalMen(), morale, 0, 0, 0, 0, tickNotes);
      break;
    }

    // ── 1. Dragon strafes — distribute damage proportionally across all armies ──
    let rawDmg = dragon.strafeDmg;

    // Morale DR (positive morale only)
    if (morale > 0) {
      rawDmg = Math.floor(rawDmg * (1 - morale * 0.01));
    }

    const combinedHp = totalHp();
    if (combinedHp <= 0) break;

    let tickStrafe = rawDmg;
    cumStrafeDmg += rawDmg;

    // Distribute damage to each army proportional to its HP share
    for (const army of armies) {
      if (army.hp <= 0) continue;
      const share = army.hp / combinedHp;
      const armyDmg = Math.floor(rawDmg * share);

      const levyHp = army.levy * 10;
      const maaHp = army.maa * 20;
      const eliteHp = army.elite * 30;
      const armyTotalHp = army.hp;
      if (armyTotalHp <= 0) continue;

      const levyDmg = Math.floor(armyDmg * (levyHp / armyTotalHp));
      const maaDmg = Math.floor(armyDmg * (maaHp / armyTotalHp));
      const eliteDmg = armyDmg - levyDmg - maaDmg;

      army.levy -= Math.min(army.levy, Math.floor(levyDmg / 10));
      army.maa -= Math.min(army.maa, Math.floor(maaDmg / 20));
      army.elite -= Math.min(army.elite, Math.floor(eliteDmg / 30));
    }

    // ── 2. Morale drain ──
    const terrorDrain = 2 + dragon.terror; // -2 active + -Terror
    morale = clampMorale(morale - terrorDrain);

    // HP loss morale drain: -1 per 5% of max HP lost this tick
    const hpLostPct = (rawDmg / startingHp) * 100;
    morale = clampMorale(morale - Math.floor(hpLostPct / 5));

    // ── 3. Rout check (negative morale) ──
    let tickRouted = 0;
    if (morale < 0) {
      const routRate = Math.abs(morale) * 0.005;

      for (const army of armies) {
        // Per-army war priest
        let armyRoutRate = routRate;
        if (army.warPriestFaith > 0) {
          armyRoutRate *= (1 - army.warPriestFaith * 0.015);
        }
        armyRoutRate = Math.max(0, armyRoutRate);

        const levyRout = Math.min(army.levy, Math.floor(army.levy * armyRoutRate));
        const maaRout = Math.min(army.maa, Math.floor(army.maa * armyRoutRate));

        army.levy -= levyRout;
        army.maa -= maaRout;
        army.routedLevy += levyRout;
        army.routedMaa += maaRout;
        tickRouted += levyRout + maaRout;
      }
      cumRouted += tickRouted;
    }

    // ── 4. Rally (Herald) ──
    for (const army of armies) {
      if (army.heraldPresence > 0 && (army.routedLevy + army.routedMaa) > 0) {
        const rallyRate = army.heraldPresence * 0.02;
        const levyRally = Math.floor(army.routedLevy * rallyRate);
        const maaRally = Math.floor(army.routedMaa * rallyRate);
        army.routedLevy -= levyRally;
        army.routedMaa -= maaRally;
        army.levy += levyRally;
        army.maa += maaRally;
      }
    }

    // ── 5. Scorpion fire ──
    let tickScorpHits = 0;
    let tickScorpDmg = 0;
    for (const army of armies) {
      for (let s = 0; s < army.scorpions; s++) {
        const roll = Math.floor(Math.random() * 20) + 1;
        if (roll >= dragon.scorpionHitThreshold) {
          tickScorpHits++;
          const dmg = dragon.scorpionDmgPerHit;
          dragonHp = Math.max(0, dragonHp - dmg);
          tickScorpDmg += dmg;
        }
      }
    }
    cumScorpionHits += tickScorpHits;
    cumScorpionDmg += tickScorpDmg;

    if (dragonHp <= 0) {
      dragonDied = true;
      tickNotes.push('DRAGON KILLED');
    }

    if (verbose) {
      printTick(ticks, dragonHp, dragon.maxHp, totalHp(), startingHp, totalMen(), morale,
        tickStrafe, tickScorpHits, tickScorpDmg, tickRouted, tickNotes);
    }

    if (dragonHp <= 0) break;
    if (totalMen() <= 0) { tickNotes.push('ARMY ELIMINATED'); break; }
  }

  return {
    ticks,
    dragonHp,
    dragonHpPct: dragonHp / dragon.maxHp * 100,
    dragonDied,
    dragonWithdrew,
    remainingMen: totalMen(),
    remainingHp: totalHp(),
    remainingHpPct: totalHp() / startingHp * 100,
    morale,
    startingMen,
    startingHp,
    cumScorpionHits,
    cumScorpionDmg,
    cumStrafeDmg,
    cumRouted,
    armies: armies.map(a => ({
      name: a.name,
      levy: a.levy, maa: a.maa, elite: a.elite,
      men: a.totalMen, hp: a.hp,
      routedLevy: a.routedLevy, routedMaa: a.routedMaa,
    })),
  };
}

function printTick(tick, dHp, dMaxHp, aHp, aMaxHp, men, morale, strafe, sHits, sDmg, routed, notes) {
  const dPct = (dHp / dMaxHp * 100).toFixed(0);
  const aPct = (aHp / aMaxHp * 100).toFixed(0);
  console.log(
    String(tick).padStart(4) + ' │' +
    `${dHp}/${dMaxHp} (${dPct}%)`.padStart(11) + ' │' +
    `${aHp} (${aPct}%)`.padStart(11) + ' │' +
    String(men).padStart(7) + ' │' +
    String(morale).padStart(7) + ' │' +
    String(strafe).padStart(8) + ' │' +
    String(sHits).padStart(11) + ' │' +
    String(sDmg).padStart(10) + ' │' +
    String(routed).padStart(8) +
    (notes.length ? ' │ ' + notes.join(', ') : '')
  );
}

// ── Run ──────────────────────────────────────────────────────────────────

const dragon = deriveDragon(CANNIBAL);

// Verbose run (1 battle)
console.log('\n╔══════════════════════════════════════════════════════════════════════════════╗');
console.log('║  THE CANNIBAL vs 5 FULL-STACK ARMIES (No Dragons)                          ║');
console.log('║                                                                              ║');
console.log('║  The Cannibal: T5 | M8/A6/F10/R8 | 400 HP                                  ║');
console.log('║  Strafe: 3,300 dmg/tick | Terror: 15                                        ║');
console.log('║  Scorpion: hit 14+ (35%), 22 dmg/hit                                        ║');
console.log('║                                                                              ║');
console.log('║  5 × Size 1 Military (1200L/1200M/600E, 2 scorpions each)                  ║');
console.log('║  Combined: 15,000 men | 270,000 HP | 10 scorpions                           ║');
console.log('╚══════════════════════════════════════════════════════════════════════════════════╝');

simulate(dragon, ARMY_TEMPLATES, true);

// Monte Carlo
console.log('\n\n' + '═'.repeat(110));
console.log('  MONTE CARLO: ' + SIMULATIONS.toLocaleString() + ' simulations');
console.log('═'.repeat(110));

const stats = {
  dragonKilled: 0,
  dragonWithdrew: 0,
  armyEliminated: 0,
  ongoing: 0,
  totalTicks: 0,
  totalScorpionHits: 0,
  totalScorpionDmg: 0,
  dragonHpSum: 0,
  armyHpPctSum: 0,
  armyMenSum: 0,
  moraleSum: 0,
  routedSum: 0,
  // Track per-army survival
  armySurvival: [0, 0, 0, 0, 0], // armies with >0 men at end
};

for (let i = 0; i < SIMULATIONS; i++) {
  const r = simulate(dragon, ARMY_TEMPLATES, false);
  stats.totalTicks += r.ticks;
  stats.totalScorpionHits += r.cumScorpionHits;
  stats.totalScorpionDmg += r.cumScorpionDmg;
  stats.dragonHpSum += r.dragonHpPct;
  stats.armyHpPctSum += r.remainingHpPct;
  stats.armyMenSum += r.remainingMen;
  stats.moraleSum += r.morale;
  stats.routedSum += r.cumRouted;

  if (r.dragonDied) stats.dragonKilled++;
  else if (r.dragonWithdrew) stats.dragonWithdrew++;
  else if (r.remainingMen <= 0) stats.armyEliminated++;
  else stats.ongoing++;

  for (let a = 0; a < r.armies.length; a++) {
    if (r.armies[a].men > 0) stats.armySurvival[a]++;
  }
}

const n = SIMULATIONS;
console.log('');
console.log('  OUTCOMES:');
console.log(`    Dragon killed:      ${stats.dragonKilled}  (${(stats.dragonKilled / n * 100).toFixed(1)}%)`);
console.log(`    Dragon withdrew:    ${stats.dragonWithdrew}  (${(stats.dragonWithdrew / n * 100).toFixed(1)}%)`);
console.log(`    Army eliminated:    ${stats.armyEliminated}  (${(stats.armyEliminated / n * 100).toFixed(1)}%)`);
console.log(`    Ongoing (${MAX_TICKS} ticks): ${stats.ongoing}  (${(stats.ongoing / n * 100).toFixed(1)}%)`);
console.log('');
console.log('  AVERAGES:');
console.log(`    Ticks to resolve:     ${(stats.totalTicks / n).toFixed(1)}`);
console.log(`    Dragon HP remaining:  ${(stats.dragonHpSum / n).toFixed(1)}%`);
console.log(`    Army HP remaining:    ${(stats.armyHpPctSum / n).toFixed(1)}%`);
console.log(`    Army men remaining:   ${Math.round(stats.armyMenSum / n).toLocaleString()} / ${ARMY_TEMPLATES.reduce((s, t) => s + t.levy + t.maa + t.elite, 0).toLocaleString()}`);
console.log(`    Final morale:         ${(stats.moraleSum / n).toFixed(1)}`);
console.log(`    Total routed:         ${Math.round(stats.routedSum / n).toLocaleString()}`);
console.log(`    Scorpion hits/battle: ${(stats.totalScorpionHits / n).toFixed(1)}`);
console.log(`    Scorpion dmg/battle:  ${(stats.totalScorpionDmg / n).toFixed(1)}`);
console.log('');
console.log('  PER-ARMY SURVIVAL (armies with >0 men at end):');
for (let a = 0; a < 5; a++) {
  console.log(`    Army ${a + 1}: ${(stats.armySurvival[a] / n * 100).toFixed(1)}%`);
}
console.log('');
