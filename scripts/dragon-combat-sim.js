#!/usr/bin/env node

/**
 * Dragon Combat Simulator
 * Simulates 1v1 aerial combat per dragon-system.md rules (tier-based redesign)
 *
 * Rules:
 *   - d10 dice pools, 6+ = hit (50% success rate)
 *   - Strike (Might + Ferocity) vs Evasion (Agility + floor(Resilience/2))
 *   - Damage per unblocked hit = Tier + 3
 *   - HP = (Might + Resilience) × Tier × 5
 *   - Wound thresholds: 75%+ healthy, 50-74% wounded (-2 dice), 25-49% grievous (-4), 1-24% dying (-6)
 *   - Ferocity governs flee: Grievous needs 5+ to stay, Dying needs 8+
 *   - Disengage: Agility d10 pools opposed roll, more successes = escape
 *   - Initiative: Higher Agility first, Ferocity breaks ties
 */

const SIMULATIONS = 100;

// ── Dragon Roster ──────────────────────────────────────────────────────────

// Rider aptitudes: { prowess, command, cunning, fortitude }
// Offense bonus: floor(max(prowess, command) / 2) added to Strike
// Defense bonus: floor(max(cunning, fortitude) / 2) added to Evasion
// null = riderless (no bonus)

const DRAGONS = [
  // T5 — Apex
  { name: 'Vhagar',       tier: 5, might: 10, agility: 3,  ferocity: 10, resilience: 10, rider: { name: 'Aemond',     prowess: 7, command: 5, cunning: 8, fortitude: 6 } },
  { name: 'Caraxes',      tier: 5, might: 7,  agility: 9,  ferocity: 10, resilience: 6,  rider: { name: 'Daemon',     prowess: 9, command: 7, cunning: 7, fortitude: 6 } },
  { name: 'Meleys',       tier: 5, might: 7,  agility: 10, ferocity: 8,  resilience: 7,  rider: { name: 'Rhaenys',    prowess: 5, command: 8, cunning: 7, fortitude: 7 } },
  { name: 'Vermithor',    tier: 5, might: 9,  agility: 5,  ferocity: 7,  resilience: 9,  rider: null },
  { name: 'The Cannibal', tier: 5, might: 8,  agility: 6,  ferocity: 10, resilience: 8,  rider: null },

  // T4 — Formidable
  { name: 'Dreamfyre',    tier: 4, might: 7,  agility: 4,  ferocity: 5,  resilience: 8,  rider: { name: 'Helaena',    prowess: 2, command: 2, cunning: 3, fortitude: 3 } },
  { name: 'Silverwing',   tier: 4, might: 7,  agility: 5,  ferocity: 4,  resilience: 8,  rider: null },

  // T4 — Formidable (promoted from T3)
  { name: 'Sunfyre',      tier: 4, might: 6,  agility: 6,  ferocity: 7,  resilience: 6,  rider: { name: 'Aegon II',   prowess: 6, command: 5, cunning: 5, fortitude: 5 } },
  { name: 'Seasmoke',     tier: 3, might: 5,  agility: 7,  ferocity: 6,  resilience: 5,  rider: { name: 'Addam',      prowess: 6, command: 5, cunning: 5, fortitude: 4 } },
  { name: 'Sheepstealer', tier: 3, might: 5,  agility: 8,  ferocity: 6,  resilience: 5,  rider: null },
  { name: 'Grey Ghost',   tier: 3, might: 5,  agility: 9,  ferocity: 2,  resilience: 5,  rider: null },

  // T2 — Blooded
  { name: 'Tessarion',    tier: 2, might: 4,  agility: 7,  ferocity: 5,  resilience: 4,  rider: { name: 'Daeron',     prowess: 5, command: 6, cunning: 4, fortitude: 5 } },
  { name: 'Syrax',        tier: 2, might: 6,  agility: 5,  ferocity: 3,  resilience: 6,  rider: { name: 'Rhaenyra',   prowess: 3, command: 5, cunning: 6, fortitude: 4 } },
  { name: 'Vermax',       tier: 2, might: 4,  agility: 7,  ferocity: 6,  resilience: 4,  rider: { name: 'Jacaerys',   prowess: 6, command: 5, cunning: 5, fortitude: 5 } },
  { name: 'Moondancer',   tier: 2, might: 3,  agility: 8,  ferocity: 7,  resilience: 3,  rider: { name: 'Baela',      prowess: 5, command: 4, cunning: 6, fortitude: 5 } },

  // T1 — Fledgling
  { name: 'Arrax',        tier: 1, might: 2,  agility: 7,  ferocity: 4,  resilience: 2,  rider: { name: 'Lucerys',    prowess: 3, command: 3, cunning: 4, fortitude: 3 } },
  { name: 'Tyraxes',      tier: 1, might: 2,  agility: 5,  ferocity: 3,  resilience: 2,  rider: { name: 'Joffrey',    prowess: 2, command: 2, cunning: 3, fortitude: 2 } },
  { name: 'Stormcloud',   tier: 1, might: 2,  agility: 6,  ferocity: 6,  resilience: 2,  rider: { name: 'Aegon III',  prowess: 2, command: 2, cunning: 3, fortitude: 3 } },
];

// ── Derived Stats ──────────────────────────────────────────────────────────

function riderOffense(r) { return r ? Math.floor(Math.max(r.prowess, r.command) / 2) : 0; }
function riderDefense(r) { return r ? Math.floor(Math.max(r.cunning, r.fortitude) / 2) : 0; }

function derive(d) {
  const offBonus = riderOffense(d.rider);
  const defBonus = riderDefense(d.rider);
  return {
    ...d,
    maxHp:        (d.might + d.resilience) * d.tier * 5,
    strike:       d.might + d.ferocity + offBonus,
    evasion:      d.agility + Math.floor(d.resilience / 2) + defBonus,
    terror:       d.tier * 2 + Math.floor(d.ferocity / 2),
    damagePerHit: d.tier + 3,
    critChance:   d.agility / 100,
    riderOff:     offBonus,
    riderDef:     defBonus,
    riderName:    d.rider ? d.rider.name : '-',
  };
}

// ── Dice Mechanics ─────────────────────────────────────────────────────────

function rollPool(n) {
  let successes = 0;
  for (let i = 0; i < n; i++) {
    if (Math.floor(Math.random() * 10) + 1 >= 6) successes++;
  }
  return successes;
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

function attemptDisengage(fleeAgility, pursueAgility, fleePenalty, pursuePenalty) {
  const fleePool    = Math.max(0, fleeAgility - fleePenalty);
  const pursuePool  = Math.max(0, pursueAgility - pursuePenalty);
  const fleeSuc     = rollPool(fleePool);
  const pursueSuc   = rollPool(pursuePool);
  return fleeSuc > pursueSuc; // strictly more to escape
}

// ── Combat Simulation ──────────────────────────────────────────────────────

function countCrits(unblocked, critChance) {
  let crits = 0;
  for (let i = 0; i < unblocked; i++) {
    if (Math.random() < critChance) crits++;
  }
  return crits;
}

const BLEED_DMG_PER_STACK = 3;
const BLEED_MAX_STACKS    = 3;

function simulateFight(a, b) {
  let hpA = a.maxHp;
  let hpB = b.maxHp;
  let bleedA = 0; // bleed stacks on dragon A
  let bleedB = 0; // bleed stacks on dragon B
  let ticks = 0;
  const MAX_TICKS = 200;

  while (hpA > 0 && hpB > 0 && ticks < MAX_TICKS) {
    ticks++;

    // ── Bleed Damage (start of tick, before attacks) ──
    if (bleedA > 0) hpA = Math.max(0, hpA - bleedA * BLEED_DMG_PER_STACK);
    if (bleedB > 0) hpB = Math.max(0, hpB - bleedB * BLEED_DMG_PER_STACK);
    if (hpA <= 0 || hpB <= 0) break;

    const penA = getWoundPenalty(hpA, a.maxHp);
    const penB = getWoundPenalty(hpB, b.maxHp);

    // ── Flee Phase ──
    const aFlee = wantsToFlee(hpA, a.maxHp, a.ferocity);
    const bFlee = wantsToFlee(hpB, b.maxHp, b.ferocity);

    if (aFlee && !bFlee) {
      if (attemptDisengage(a.agility, b.agility, penA, penB))
        return result(b, hpB, a, hpA, ticks, a.name);
    } else if (bFlee && !aFlee) {
      if (attemptDisengage(b.agility, a.agility, penB, penA))
        return result(a, hpA, b, hpB, ticks, b.name);
    } else if (aFlee && bFlee) {
      if (attemptDisengage(a.agility, b.agility, penA, penB))
        return result(b, hpB, a, hpA, ticks, a.name);
      if (attemptDisengage(b.agility, a.agility, penB, penA))
        return result(a, hpA, b, hpB, ticks, b.name);
    }

    // ── Initiative ──
    let first, second, hpFirst, hpSecond, bleedFirst, bleedSecond;
    if (a.agility > b.agility || (a.agility === b.agility && a.ferocity >= b.ferocity)) {
      first = a; second = b; hpFirst = hpA; hpSecond = hpB; bleedFirst = bleedA; bleedSecond = bleedB;
    } else {
      first = b; second = a; hpFirst = hpB; hpSecond = hpA; bleedFirst = bleedB; bleedSecond = bleedA;
    }

    const penFirst  = getWoundPenalty(hpFirst, first.maxHp);
    const penSecond = getWoundPenalty(hpSecond, second.maxHp);

    // ── First Striker ──
    const strikePool1  = Math.max(0, first.strike  - penFirst);
    const evasionPool1 = Math.max(0, second.evasion - penSecond);
    const hits1   = rollPool(strikePool1);
    const blocks1 = rollPool(evasionPool1);
    const unblocked1 = Math.max(0, hits1 - blocks1);
    const dmg1    = unblocked1 * first.damagePerHit;
    hpSecond = Math.max(0, hpSecond - dmg1);

    // Critical strikes — each unblocked hit has critChance to apply bleed
    const crits1 = countCrits(unblocked1, first.critChance);
    if (crits1 > 0) bleedSecond = Math.min(BLEED_MAX_STACKS, bleedSecond + crits1);

    if (hpSecond <= 0) {
      return first === a
        ? result(a, hpFirst, b, 0, ticks, null)
        : result(b, hpFirst, a, 0, ticks, null);
    }

    // ── Second Striker (updated wound penalty after taking damage) ──
    const penSecondUpd  = getWoundPenalty(hpSecond, second.maxHp);
    const strikePool2   = Math.max(0, second.strike  - penSecondUpd);
    const evasionPool2  = Math.max(0, first.evasion  - penFirst);
    const hits2   = rollPool(strikePool2);
    const blocks2 = rollPool(evasionPool2);
    const unblocked2 = Math.max(0, hits2 - blocks2);
    const dmg2    = unblocked2 * second.damagePerHit;
    hpFirst = Math.max(0, hpFirst - dmg2);

    // Critical strikes from second striker
    const crits2 = countCrits(unblocked2, second.critChance);
    if (crits2 > 0) bleedFirst = Math.min(BLEED_MAX_STACKS, bleedFirst + crits2);

    // Write back
    if (first === a) { hpA = hpFirst; hpB = hpSecond; bleedA = bleedFirst; bleedB = bleedSecond; }
    else             { hpB = hpFirst; hpA = hpSecond; bleedB = bleedFirst; bleedA = bleedSecond; }
  }

  // End conditions
  if (hpA > 0 && hpB <= 0) return result(a, hpA, b, 0, ticks, null);
  if (hpB > 0 && hpA <= 0) return result(b, hpB, a, 0, ticks, null);
  if (hpA <= 0 && hpB <= 0) return { winner: null, winnerName: 'MUTUAL KILL', winnerHp: 0, winnerMax: 0, loserName: '-', loserHp: 0, loserMax: 0, ticks, fled: null };
  return { winner: null, winnerName: 'STALEMATE', winnerHp: hpA, winnerMax: a.maxHp, loserName: '-', loserHp: hpB, loserMax: b.maxHp, ticks, fled: null };
}

function result(winner, winHp, loser, loseHp, ticks, fled) {
  return { winner, winnerName: winner.name, winnerHp: winHp, winnerMax: winner.maxHp, loserName: loser.name, loserHp: loseHp, loserMax: loser.maxHp, ticks, fled };
}

// ── Helpers ─────────────────────────────────────────────────────────────────

function pad(s, n) { s = String(s); return s + ' '.repeat(Math.max(0, n - s.length)); }
function padL(s, n) { s = String(s); return ' '.repeat(Math.max(0, n - s.length)) + s; }

// ── Main ────────────────────────────────────────────────────────────────────

const dragons = DRAGONS.map(derive);

console.log('');
console.log('='.repeat(110));
console.log('  DRAGON COMBAT SIMULATOR');
console.log('  ' + SIMULATIONS + ' fights per matchup | d10 pools, 6+ hit | Tier+3 dmg | wound penalties -2/-4/-6 | crit=Agi% bleed 3/stack/tick');
console.log('='.repeat(110));

// ── Stat Sheet ──

console.log('');
console.log('DRAGON STAT SHEET (with rider bonuses)');
console.log('-'.repeat(130));
console.log(pad('Dragon', 16) + pad('Rider', 10) + padL('Tier', 5) + padL('M', 4) + padL('A', 4) + padL('F', 4) + padL('R', 4) +
            padL('HP', 6) + padL('Str', 7) + padL('Eva', 7) + padL('Ter', 5) + padL('Dmg', 5) + padL('Crit', 6));
console.log('-'.repeat(130));

for (const d of dragons) {
  const strLabel = d.riderOff > 0 ? (d.strike - d.riderOff) + '+' + d.riderOff : String(d.strike);
  const evaLabel = d.riderDef > 0 ? (d.evasion - d.riderDef) + '+' + d.riderDef : String(d.evasion);
  console.log(
    pad(d.name, 16) + pad(d.riderName, 10) + padL('T' + d.tier, 5) +
    padL(d.might, 4) + padL(d.agility, 4) + padL(d.ferocity, 4) + padL(d.resilience, 4) +
    padL(d.maxHp, 6) + padL(strLabel, 7) + padL(evaLabel, 7) + padL(d.terror, 5) + padL(d.damagePerHit, 5) +
    padL(Math.round(d.critChance * 100) + '%', 6)
  );
}

// ── Run Simulations ──

const matchups = [];

for (let i = 0; i < dragons.length; i++) {
  for (let j = i + 1; j < dragons.length; j++) {
    const a = dragons[i];
    const b = dragons[j];

    let winsA = 0, winsB = 0, mutual = 0, stalemate = 0;
    let totalTicks = 0;
    let fleeA = 0, fleeB = 0;
    let winnerHpPctSum = 0;

    for (let s = 0; s < SIMULATIONS; s++) {
      const r = simulateFight(a, b);
      totalTicks += r.ticks;

      if (r.winnerName === a.name) {
        winsA++;
        winnerHpPctSum += r.winnerHp / r.winnerMax;
      } else if (r.winnerName === b.name) {
        winsB++;
        winnerHpPctSum += r.winnerHp / r.winnerMax;
      } else if (r.winnerName === 'MUTUAL KILL') {
        mutual++;
      } else {
        stalemate++;
      }

      if (r.fled === a.name) fleeA++;
      if (r.fled === b.name) fleeB++;
    }

    matchups.push({
      a: a.name, tierA: a.tier,
      b: b.name, tierB: b.tier,
      winsA, winsB, mutual, stalemate,
      avgTicks: totalTicks / SIMULATIONS,
      fleeA, fleeB,
      avgWinHpPct: (winsA + winsB > 0) ? (winnerHpPctSum / (winsA + winsB) * 100) : 0,
    });
  }
}

// ── Build win rate lookup for the full matrix ──

// winRate[i][j] = % of times dragon i beats dragon j (out of SIMULATIONS)
const winRate = Array.from({ length: dragons.length }, () => Array(dragons.length).fill(null));
const avgTicks = Array.from({ length: dragons.length }, () => Array(dragons.length).fill(null));
const avgWinHp = Array.from({ length: dragons.length }, () => Array(dragons.length).fill(null));
const fleeCount = Array.from({ length: dragons.length }, () => Array(dragons.length).fill(0));

for (const m of matchups) {
  const ai = dragons.findIndex(d => d.name === m.a);
  const bi = dragons.findIndex(d => d.name === m.b);

  winRate[ai][bi] = m.winsA;
  winRate[bi][ai] = m.winsB;
  avgTicks[ai][bi] = m.avgTicks;
  avgTicks[bi][ai] = m.avgTicks;
  fleeCount[ai][bi] = m.fleeA;
  fleeCount[bi][ai] = m.fleeB;

  // avg winner HP% when dragon i wins vs j
  if (m.winsA > 0) {
    // We need per-direction HP tracking — recalc from raw data isn't stored,
    // so we'll use the combined avg as an approximation and note it
  }
}

// ── COMPLETE MATCHUP CHART ──

// Use short names for column headers
const shortNames = dragons.map(d => {
  const abbrevs = {
    'Vhagar': 'Vhgr', 'Caraxes': 'Crxs', 'Meleys': 'Mlys', 'Vermithor': 'Vrmt',
    'The Cannibal': 'Canb', 'Dreamfyre': 'Drmf', 'Silverwing': 'Slvw',
    'Sunfyre': 'Snfr', 'Seasmoke': 'Ssmo', 'Sheepstealer': 'Shps', 'Grey Ghost': 'GrGh',
    'Tessarion': 'Tess', 'Syrax': 'Syrx', 'Vermax': 'Vrmx', 'Moondancer': 'Moon',
    'Arrax': 'Arrx', 'Tyraxes': 'Tyrx', 'Stormcloud': 'Strm',
  };
  return abbrevs[d.name] || d.name.substring(0, 4);
});

const COL = 6; // column width for matrix cells

console.log('');
console.log('='.repeat(130));
console.log('  COMPLETE MATCHUP CHART — Win rates (row dragon wins X out of ' + SIMULATIONS + ' fights vs column dragon)');
console.log('  Diagonal is "—". Read as: row dragon wins N% against column dragon.');
console.log('='.repeat(130));
console.log('');

// Header row
let header = pad('', 16);
for (let j = 0; j < dragons.length; j++) {
  header += padL(shortNames[j], COL);
}
header += padL('W%', 7);
console.log(header);
console.log('-'.repeat(16 + dragons.length * COL + 7));

// Data rows
for (let i = 0; i < dragons.length; i++) {
  let row = pad(dragons[i].name, 16);
  let totalWins = 0, totalFights = 0;

  for (let j = 0; j < dragons.length; j++) {
    if (i === j) {
      row += padL('—', COL);
    } else {
      const w = winRate[i][j];
      row += padL(w, COL);
      totalWins += w;
      totalFights += SIMULATIONS;
    }
  }

  const overallPct = totalFights > 0 ? (totalWins / totalFights * 100).toFixed(1) : '0.0';
  row += padL(overallPct, 7);
  console.log(row);

  // Print tier separator lines
  const nextTier = (i + 1 < dragons.length) ? dragons[i + 1].tier : null;
  if (nextTier !== null && nextTier !== dragons[i].tier) {
    console.log('-'.repeat(16 + dragons.length * COL + 7));
  }
}

// ── COMPLETE MATCHUP CHART — AVERAGE TICKS ──

console.log('');
console.log('='.repeat(130));
console.log('  FIGHT DURATION — Average ticks to resolve each matchup');
console.log('='.repeat(130));
console.log('');

header = pad('', 16);
for (let j = 0; j < dragons.length; j++) {
  header += padL(shortNames[j], COL);
}
console.log(header);
console.log('-'.repeat(16 + dragons.length * COL));

for (let i = 0; i < dragons.length; i++) {
  let row = pad(dragons[i].name, 16);
  for (let j = 0; j < dragons.length; j++) {
    if (i === j) {
      row += padL('—', COL);
    } else {
      const t = avgTicks[i][j];
      row += padL(t !== null ? t.toFixed(0) : '—', COL);
    }
  }
  console.log(row);

  const nextTier = (i + 1 < dragons.length) ? dragons[i + 1].tier : null;
  if (nextTier !== null && nextTier !== dragons[i].tier) {
    console.log('-'.repeat(16 + dragons.length * COL));
  }
}

// ── FLEE CHART ──

console.log('');
console.log('='.repeat(130));
console.log('  FLEE COUNT — Times row dragon fled from column dragon (out of ' + SIMULATIONS + ' fights)');
console.log('='.repeat(130));
console.log('');

// Only print if any flees exist
let anyFlees = false;
for (let i = 0; i < dragons.length; i++)
  for (let j = 0; j < dragons.length; j++)
    if (fleeCount[i][j] > 0) anyFlees = true;

if (anyFlees) {
  header = pad('', 16);
  for (let j = 0; j < dragons.length; j++) {
    header += padL(shortNames[j], COL);
  }
  header += padL('Total', 7);
  console.log(header);
  console.log('-'.repeat(16 + dragons.length * COL + 7));

  for (let i = 0; i < dragons.length; i++) {
    let row = pad(dragons[i].name, 16);
    let totalFlees = 0;
    for (let j = 0; j < dragons.length; j++) {
      if (i === j) {
        row += padL('—', COL);
      } else {
        const f = fleeCount[i][j];
        row += padL(f > 0 ? f : '.', COL);
        totalFlees += f;
      }
    }
    row += padL(totalFlees, 7);
    console.log(row);

    const nextTier = (i + 1 < dragons.length) ? dragons[i + 1].tier : null;
    if (nextTier !== null && nextTier !== dragons[i].tier) {
      console.log('-'.repeat(16 + dragons.length * COL + 7));
    }
  }
} else {
  console.log('No flee events recorded.');
}

// ── DETAILED MATCHUP LIST ──

console.log('');
console.log('='.repeat(130));
console.log('  EVERY MATCHUP — Detailed results');
console.log('='.repeat(130));
console.log('');

console.log(
  pad('#', 5) +
  pad('Dragon A', 16) + pad('Dragon B', 16) +
  padL('A wins', 8) + padL('B wins', 8) + padL('Mutual', 8) +
  padL('Avg Tix', 8) +
  pad('  Fled by', 20) +
  padL('Winner HP%', 12)
);
console.log('-'.repeat(101));

let matchNum = 0;
let prevTierPair = '';

for (const m of matchups) {
  matchNum++;
  const tierPair = `${Math.max(m.tierA, m.tierB)}v${Math.min(m.tierA, m.tierB)}`;
  if (tierPair !== prevTierPair && prevTierPair !== '') {
    console.log('-'.repeat(101));
  }
  prevTierPair = tierPair;

  const fleeStr = formatFlee(m);
  console.log(
    pad(matchNum, 5) +
    pad(`${m.a} (T${m.tierA})`, 16) + pad(`${m.b} (T${m.tierB})`, 16) +
    padL(m.winsA, 8) + padL(m.winsB, 8) + padL(m.mutual, 8) +
    padL(m.avgTicks.toFixed(1), 8) +
    pad('  ' + fleeStr, 20) +
    padL(m.avgWinHpPct.toFixed(1) + '%', 12)
  );
}

// ── Power Rankings ──

console.log('');
console.log('='.repeat(130));
console.log('  OVERALL POWER RANKINGS');
console.log('='.repeat(130));
console.log('');

const stats = {};
for (const d of dragons) stats[d.name] = { wins: 0, losses: 0, fights: 0, tier: d.tier, flees: 0 };

for (const m of matchups) {
  stats[m.a].wins   += m.winsA;
  stats[m.a].losses += m.winsB + m.mutual;
  stats[m.a].fights += SIMULATIONS;
  stats[m.a].flees  += m.fleeA;

  stats[m.b].wins   += m.winsB;
  stats[m.b].losses += m.winsA + m.mutual;
  stats[m.b].fights += SIMULATIONS;
  stats[m.b].flees  += m.fleeB;
}

const rankings = Object.entries(stats)
  .map(([name, s]) => ({ name, ...s, rate: s.wins / s.fights * 100 }))
  .sort((a, b) => b.rate - a.rate);

console.log(pad('#', 4) + pad('Dragon', 18) + pad('Tier', 6) + padL('Win%', 7) + padL('W', 6) + padL('L', 6) + padL('Fled', 6) + '   Record');
console.log('-'.repeat(80));

rankings.forEach((r, i) => {
  console.log(
    pad(i + 1, 4) + pad(r.name, 18) + pad('T' + r.tier, 6) +
    padL(r.rate.toFixed(1), 7) + padL(r.wins, 6) + padL(r.losses, 6) + padL(r.flees, 6) +
    `   ${r.wins}-${r.losses} / ${r.fights}`
  );
});

// ── Cross-Tier Summary ──

console.log('');
console.log('='.repeat(130));
console.log('  CROSS-TIER WIN RATE MATRIX (row tier wins % against column tier)');
console.log('='.repeat(130));
console.log('');

const tierWins = {};
for (let a = 1; a <= 5; a++) {
  tierWins[a] = {};
  for (let b = 1; b <= 5; b++) tierWins[a][b] = { wins: 0, total: 0 };
}

for (const m of matchups) {
  tierWins[m.tierA][m.tierB].wins  += m.winsA;
  tierWins[m.tierA][m.tierB].total += SIMULATIONS;
  tierWins[m.tierB][m.tierA].wins  += m.winsB;
  tierWins[m.tierB][m.tierA].total += SIMULATIONS;
}

console.log(pad('', 8) + padL('vs T1', 9) + padL('vs T2', 9) + padL('vs T3', 9) + padL('vs T4', 9) + padL('vs T5', 9));
console.log('-'.repeat(53));

for (let a = 5; a >= 1; a--) {
  let row = pad('T' + a, 8);
  for (let b = 1; b <= 5; b++) {
    const { wins, total } = tierWins[a][b];
    if (total === 0) row += padL('—', 9);
    else row += padL((wins / total * 100).toFixed(1) + '%', 9);
  }
  console.log(row);
}

console.log('');
console.log('Simulation complete. ' + matchups.length + ' matchups × ' + SIMULATIONS + ' fights = ' + (matchups.length * SIMULATIONS) + ' total fights simulated.');

// ── Helpers ──

function formatFlee(m) {
  if (m.fleeA === 0 && m.fleeB === 0) return '-';
  const parts = [];
  if (m.fleeA > 0) parts.push(m.a.substring(0, 8) + ':' + m.fleeA);
  if (m.fleeB > 0) parts.push(m.b.substring(0, 8) + ':' + m.fleeB);
  return parts.join(' ');
}
