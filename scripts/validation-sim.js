#!/usr/bin/env node
/**
 * WBS Validation Simulation
 *
 * Covers all 7 remaining simulation items:
 * 1. Fleet vs fleet outcomes at various ship counts
 * 2. Morale/routing thresholds for naval combat
 * 3. Dragon vs fleet balance (ship count to threaten T3/T5)
 * 4. Strafe damage formula validation against army compositions
 * 5. Rider survival frequency (1d20 check)
 * 6. Critical strike balance (Agility% crit asymmetry)
 * 7. Sunfyre T4 re-sim (dragon 1v1 power rankings)
 *
 * Usage: node scripts/validation-sim.js
 */

const SIMS = 5000;

// ═══════════════════════════════════════════════════════════════
// UTILITIES
// ═══════════════════════════════════════════════════════════════

function pad(s, n) { s = String(s); return s + ' '.repeat(Math.max(0, n - s.length)); }
function padL(s, n) { s = String(s); return ' '.repeat(Math.max(0, n - s.length)) + s; }
function pct(v, total) { return ((v / total) * 100).toFixed(1) + '%'; }
function roll(sides) { return Math.floor(Math.random() * sides) + 1; }
function banner(text) {
  console.log('\n' + '█'.repeat(80));
  console.log('  ' + text);
  console.log('█'.repeat(80));
}
function section(text) {
  console.log('\n' + '─'.repeat(80));
  console.log('  ' + text);
  console.log('─'.repeat(80));
}

// ═══════════════════════════════════════════════════════════════
// 1. FLEET VS FLEET — NAVAL COMBAT
// ═══════════════════════════════════════════════════════════════

const SHIP_HP = 500;
const SEA_PENALTY = 0.75; // -25%
const CREW_PER_SHIP = 30;
const NAVAL_DIVISOR = 75;
const NAVAL_ENGAGEMENTS = 4;

function createFleet(name, ships, warCouncil, options = {}) {
  const crew = ships * CREW_PER_SHIP;
  // Fleet crew composition: 60% levy, 30% MaA, 10% elite (typical naval)
  const levy = Math.round(crew * 0.60);
  const maa = Math.round(crew * 0.30);
  const elite = Math.round(crew * 0.10);
  const totalHP = ships * SHIP_HP;
  const avgATK = (levy * 10 + maa * 20 + elite * 30) / crew;

  return {
    name, ships,
    levy, maa, elite,
    totalMen: crew,
    totalHP,
    currentHP: totalHP,
    avgATK,
    morale: 10,
    routedHP: 0,
    warlord: warCouncil.command || 5,
    champion: warCouncil.prowess || 5,
    marshal: warCouncil.fortitude || 5,
    spymaster: warCouncil.cunning || 5,
    herald: warCouncil.presence || 5,
    warPriest: warCouncil.faith || 5,
    advantage: options.advantage || 0,
    hasScorpions: options.hasScorpions || false,
    scorpionTier: options.scorpionTier || 0,
  };
}

function navalEngagement(atk, def) {
  if (atk.currentHP <= 0 || def.currentHP <= 0) return { atkDmg: 0, defDmg: 0 };

  const atkShips = Math.max(1, Math.floor(atk.currentHP / SHIP_HP));
  const defShips = Math.max(1, Math.floor(def.currentHP / SHIP_HP));
  const atkCrew = atkShips * CREW_PER_SHIP;
  const defCrew = defShips * CREW_PER_SHIP;

  // Roll command dice
  const atkSuccesses = rollDicePool(atk.warlord);
  const defSuccesses = rollDicePool(def.warlord);

  // Base damage with sea penalty
  let atkBase = atkSuccesses * (atk.avgATK * atkCrew / NAVAL_DIVISOR) * SEA_PENALTY;
  let defBase = defSuccesses * (def.avgATK * defCrew / NAVAL_DIVISOR) * SEA_PENALTY;

  // Champion bonus
  atkBase *= (1 + atk.champion * 0.02);
  defBase *= (1 + def.champion * 0.02);

  // Apply reductions
  const atkFinal = atkBase * (1 - def.marshal * 0.02) * (1 - def.spymaster * 0.02) *
    (def.morale > 0 ? 1 - def.morale * 0.01 : 1);
  const defFinal = defBase * (1 - atk.marshal * 0.02) * (1 - atk.spymaster * 0.02) *
    (atk.morale > 0 ? 1 - atk.morale * 0.01 : 1);

  atk.currentHP = Math.max(0, atk.currentHP - defFinal);
  def.currentHP = Math.max(0, def.currentHP - atkFinal);

  return { atkDmg: atkFinal, defDmg: defFinal };
}

function rollDicePool(count) {
  let successes = 0;
  for (let i = 0; i < count; i++) {
    if (roll(6) >= 4) successes++;
  }
  return successes;
}

function navalRouting(fleet) {
  if (fleet.morale >= 0) return;
  const routRate = Math.abs(fleet.morale) * 0.005;
  const priestReduction = fleet.warPriest * 0.015;
  const effectiveRate = routRate * (1 - priestReduction);
  const routedHP = Math.floor(fleet.currentHP * effectiveRate * 0.8); // 80% of crew can rout (elites don't)
  fleet.routedHP += routedHP;
  fleet.currentHP = Math.max(0, fleet.currentHP - routedHP);
}

function navalRally(fleet) {
  if (fleet.routedHP <= 0) return;
  const rallyRate = fleet.herald * 0.02;
  const rallied = Math.floor(fleet.routedHP * rallyRate);
  fleet.routedHP -= rallied;
  fleet.currentHP += rallied;
}

function navalMorale(fleet, dealt, taken) {
  let change = 0;
  if (dealt > 0 || taken > 0) {
    const ratio = dealt / Math.max(1, taken);
    if (ratio >= 2.0) change += 2;
    else if (dealt > taken * 1.1) change += 1;
    else if (taken >= dealt * 2) change -= 2;
    else if (taken > dealt * 1.1) change -= 1;
  }
  fleet.morale = Math.max(-10, Math.min(10, fleet.morale + change));
}

function simNavalBattle(fleet1Template, fleet2Template, maxTicks = 40) {
  const f1 = JSON.parse(JSON.stringify(fleet1Template));
  const f2 = JSON.parse(JSON.stringify(fleet2Template));

  let tick = 0;
  while (tick < maxTicks && f1.currentHP > 0 && f2.currentHP > 0) {
    let totalF1Dmg = 0, totalF2Dmg = 0;
    for (let e = 0; e < NAVAL_ENGAGEMENTS; e++) {
      if (f1.currentHP <= 0 || f2.currentHP <= 0) break;
      const { atkDmg, defDmg } = navalEngagement(f1, f2);
      totalF1Dmg += atkDmg;
      totalF2Dmg += defDmg;
      navalRouting(f1);
      navalRouting(f2);
    }
    navalMorale(f1, totalF1Dmg, totalF2Dmg);
    navalMorale(f2, totalF2Dmg, totalF1Dmg);
    navalRally(f1);
    navalRally(f2);
    tick++;
  }

  const f1Ships = Math.floor(f1.currentHP / SHIP_HP);
  const f2Ships = Math.floor(f2.currentHP / SHIP_HP);
  let winner = 'draw';
  if (f1.currentHP <= 0 && f2.currentHP > 0) winner = f2.name;
  else if (f2.currentHP <= 0 && f1.currentHP > 0) winner = f1.name;
  else if (f1Ships > f2Ships) winner = f1.name;
  else if (f2Ships > f1Ships) winner = f2.name;

  return { winner, ticks: tick, f1Ships, f2Ships, f1Morale: f1.morale, f2Morale: f2.morale };
}

function runFleetVsFleet() {
  banner('1. FLEET VS FLEET — NAVAL COMBAT');
  console.log('  Ship HP: ' + SHIP_HP + ' | Crew: ' + CREW_PER_SHIP + '/ship | Sea penalty: -25%');
  console.log('  ' + SIMS + ' simulations per matchup\n');

  const council = { command: 6, prowess: 5, fortitude: 5, cunning: 5, stewardship: 5, presence: 5, faith: 5 };

  // Equal fleets at different sizes
  section('Equal Fleets (same council, same composition)');
  console.log('  ' + pad('Matchup', 25) + padL('F1 Win%', 8) + padL('F2 Win%', 8) + padL('Draw%', 7) + padL('Avg Ticks', 10) + padL('Avg Ships Left', 15));

  for (const ships of [25, 50, 75, 100, 150]) {
    const f1 = createFleet('Fleet A (' + ships + ')', ships, council);
    const f2 = createFleet('Fleet B (' + ships + ')', ships, council);
    let wins = { [f1.name]: 0, [f2.name]: 0, draw: 0 };
    let totalTicks = 0, totalShips = 0;
    for (let i = 0; i < SIMS; i++) {
      const r = simNavalBattle(f1, f2);
      wins[r.winner]++;
      totalTicks += r.ticks;
      totalShips += Math.max(r.f1Ships, r.f2Ships);
    }
    console.log('  ' + pad(ships + ' vs ' + ships, 25) +
      padL(pct(wins[f1.name], SIMS), 8) + padL(pct(wins[f2.name], SIMS), 8) +
      padL(pct(wins.draw, SIMS), 7) + padL((totalTicks / SIMS).toFixed(1), 10) +
      padL((totalShips / SIMS).toFixed(0), 15));
  }

  // Mismatched fleets
  section('Mismatched Fleets (different sizes)');
  console.log('  ' + pad('Matchup', 25) + padL('Larger Win%', 12) + padL('Smaller Win%', 13) + padL('Avg Ticks', 10));

  const matchups = [[25, 50], [50, 75], [50, 100], [75, 100], [50, 150], [100, 150]];
  for (const [s1, s2] of matchups) {
    const f1 = createFleet('Small (' + s1 + ')', s1, council);
    const f2 = createFleet('Large (' + s2 + ')', s2, council);
    let wins = { [f1.name]: 0, [f2.name]: 0, draw: 0 };
    let totalTicks = 0;
    for (let i = 0; i < SIMS; i++) {
      const r = simNavalBattle(f1, f2);
      wins[r.winner]++;
      totalTicks += r.ticks;
    }
    console.log('  ' + pad(s1 + ' vs ' + s2, 25) +
      padL(pct(wins[f2.name], SIMS), 12) + padL(pct(wins[f1.name], SIMS), 13) +
      padL((totalTicks / SIMS).toFixed(1), 10));
  }

  // War council quality impact at sea
  section('Naval War Council Quality (50 vs 50 ships)');
  const elite = { command: 9, prowess: 8, fortitude: 8, cunning: 7, presence: 7, faith: 6 };
  const poor = { command: 3, prowess: 3, fortitude: 3, cunning: 3, presence: 3, faith: 3 };
  const f1 = createFleet('Elite Council', 50, elite);
  const f2 = createFleet('Poor Council', 50, poor);
  let wins = { [f1.name]: 0, [f2.name]: 0, draw: 0 };
  let totalTicks = 0;
  for (let i = 0; i < SIMS; i++) {
    const r = simNavalBattle(f1, f2);
    wins[r.winner]++;
    totalTicks += r.ticks;
  }
  console.log('  Elite: ' + pct(wins[f1.name], SIMS) + ' | Poor: ' + pct(wins[f2.name], SIMS) +
    ' | Avg: ' + (totalTicks / SIMS).toFixed(1) + ' ticks');
}

// ═══════════════════════════════════════════════════════════════
// 2. MORALE/ROUTING THRESHOLDS AT SEA (tested above implicitly)
// ═══════════════════════════════════════════════════════════════

function runNavalMorale() {
  banner('2. NAVAL MORALE & ROUTING ANALYSIS');
  console.log('  Tracking morale progression in mismatched fleet battles\n');

  const council = { command: 6, prowess: 5, fortitude: 5, cunning: 5, presence: 5, faith: 5 };

  // Verbose single battle: 50 vs 100
  const f1 = JSON.parse(JSON.stringify(createFleet('Small (50)', 50, council)));
  const f2 = JSON.parse(JSON.stringify(createFleet('Large (100)', 100, council)));

  console.log('  Tick-by-tick: 50 ships vs 100 ships (single battle)');
  console.log('  ' + pad('Tick', 6) + padL('Small Ships', 12) + padL('Small Morale', 13) +
    padL('Large Ships', 12) + padL('Large Morale', 13));

  let tick = 0;
  while (tick < 30 && f1.currentHP > 0 && f2.currentHP > 0) {
    let d1 = 0, d2 = 0;
    for (let e = 0; e < NAVAL_ENGAGEMENTS; e++) {
      if (f1.currentHP <= 0 || f2.currentHP <= 0) break;
      const { atkDmg, defDmg } = navalEngagement(f1, f2);
      d1 += atkDmg; d2 += defDmg;
      navalRouting(f1); navalRouting(f2);
    }
    navalMorale(f1, d1, d2);
    navalMorale(f2, d2, d1);
    navalRally(f1); navalRally(f2);
    tick++;
    console.log('  ' + pad(tick, 6) +
      padL(Math.floor(f1.currentHP / SHIP_HP), 12) + padL(f1.morale, 13) +
      padL(Math.floor(f2.currentHP / SHIP_HP), 12) + padL(f2.morale, 13));
  }
}

// ═══════════════════════════════════════════════════════════════
// 3. DRAGON VS FLEET — BALANCE CHECK
// ═══════════════════════════════════════════════════════════════

const DRAGONS = [
  { name: 'Vhagar',    tier: 5, might: 10, agility: 3,  resilience: 10 },
  { name: 'Caraxes',   tier: 5, might: 7,  agility: 9,  resilience: 6 },
  { name: 'Sunfyre',   tier: 4, might: 6,  agility: 6,  resilience: 6 },
  { name: 'Seasmoke',  tier: 3, might: 5,  agility: 7,  resilience: 5 },
  { name: 'Tessarion', tier: 2, might: 4,  agility: 7,  resilience: 4 },
  { name: 'Arrax',     tier: 1, might: 2,  agility: 7,  resilience: 2 },
];

function deriveDragon(d) {
  const maxHp = (d.might + d.resilience) * d.tier * 5;
  const strafeDmg = d.tier * 500 + d.might * 100;
  const navalStrafe = Math.floor(strafeDmg * 1.5); // ×1.5 fire vs wood
  // Scorpion evasion: max(agility, resilience) — agile dragons dodge, armored dragons deflect
  const evasionStat = Math.max(d.agility, d.resilience);
  const landHitRate = getHitRate(evasionStat);
  const seaHitRate = Math.min(0.95, landHitRate * 1.5);
  const scorpDmg = Math.max(5, (d.tier + 1) * 5 - d.resilience);
  return { ...d, maxHp, strafeDmg, navalStrafe, landHitRate, seaHitRate, scorpDmg };
}

function getHitRate(agility) {
  if (agility <= 2) return 0.55;  // 10+ on d20
  if (agility <= 4) return 0.45;  // 12+
  if (agility <= 6) return 0.35;  // 14+
  if (agility <= 8) return 0.25;  // 16+
  return 0.15;                    // 18+
}

// Engagement zone: minimum 15 ships, then 20% of fleet size (larger fleets = more guns on target)
function engagementZone(fleetSize) {
  return Math.min(fleetSize, Math.max(15, Math.floor(fleetSize * 0.20)));
}

function simDragonVsFleet(dragon, fleetShips, scorpionTier) {
  let dragonHp = dragon.maxHp;
  const withdrawThreshold = dragon.maxHp * 0.30;
  let fleetHP = fleetShips * SHIP_HP;
  let tick = 0;
  let totalPasses = 0;
  let dragonDied = false, dragonWithdrew = false;

  // Each tick = one strafing pass over a SECTION of the fleet
  // Engagement zone scales with fleet size: min 25, then 33% of total
  // Dragon deals full strafe damage per pass (concentrated on engaged section)

  while (tick < 50 && dragonHp > 0 && fleetHP > 0) {
    tick++;
    totalPasses++;

    // Dragon withdrawal check (before committing to pass)
    if (dragonHp <= withdrawThreshold) { dragonWithdrew = true; break; }

    // Dragon strafes fleet — full strafe damage per pass
    let strafeDmg = dragon.navalStrafe;
    fleetHP = Math.max(0, fleetHP - strafeDmg);

    // Fire spread: 30% chance per ship destroyed in this pass
    const shipsDestroyed = Math.floor(strafeDmg / SHIP_HP);
    let fireSpreadDmg = 0;
    for (let i = 0; i < shipsDestroyed; i++) {
      if (Math.random() < 0.30) fireSpreadDmg += 100;
    }
    fleetHP = Math.max(0, fleetHP - fireSpreadDmg);

    if (fleetHP <= 0) break;

    // Engagement zone: proportional to fleet size
    const currentShips = Math.max(1, Math.floor(fleetHP / SHIP_HP));
    const engagedShips = engagementZone(currentShips);
    for (let b = 0; b < engagedShips; b++) {
      if (Math.random() < dragon.seaHitRate) {
        dragonHp = Math.max(0, dragonHp - dragon.scorpDmg);
      }
    }

    if (dragonHp <= 0) { dragonDied = true; break; }
  }

  const shipsRemaining = Math.max(0, Math.floor(fleetHP / SHIP_HP));
  return {
    tick, totalPasses, dragonDied, dragonWithdrew,
    dragonHpPct: dragonHp / dragon.maxHp * 100,
    shipsRemaining,
    shipsSunk: fleetShips - shipsRemaining,
    fleetDestroyed: fleetHP <= 0,
  };
}

function verboseDragonVsFleet(dragon, fleetShips) {
  let dragonHp = dragon.maxHp;
  const withdrawThreshold = dragon.maxHp * 0.30;
  let fleetHP = fleetShips * SHIP_HP;
  const totalCrew = fleetShips * CREW_PER_SHIP;

  console.log('\n  ┌─ ' + dragon.name + ' (T' + dragon.tier + ') vs Fleet (' + fleetShips + ' ships, ' + totalCrew + ' crew)');
  console.log('  │  Dragon: ' + dragon.maxHp + ' HP, strafe ' + dragon.navalStrafe + '/pass, withdraws at ≤' + Math.floor(withdrawThreshold) + ' HP');
  console.log('  │  Fleet:  ' + fleetShips + ' ships (' + fleetHP + ' HP), scorpion hit rate ' +
    (dragon.seaHitRate * 100).toFixed(0) + '%, ' + dragon.scorpDmg + ' dmg/hit');
  console.log('  │');
  console.log('  │  ' + pad('Pass', 6) + pad('Action', 58) + padL('Dragon', 12) + padL('Fleet', 12));
  console.log('  │  ' + '─'.repeat(88));

  let tick = 0;
  while (tick < 50 && dragonHp > 0 && fleetHP > 0) {
    tick++;

    // Withdrawal check
    if (dragonHp <= withdrawThreshold) {
      const shipsLost = fleetShips - Math.floor(fleetHP / SHIP_HP);
      const crewLost = shipsLost * CREW_PER_SHIP;
      console.log('  │');
      console.log('  │  ' + pad(tick, 6) + '>>> Dragon breaks off — HP too low');
      console.log('  │');
      console.log('  ├─ WINNER: FLEET (Dragon forced to withdraw)');
      console.log('  │');
      console.log('  │  Dragon Casualties:  Wounded (' + Math.floor(dragonHp) + '/' + dragon.maxHp + ' HP remaining, ' +
        (100 - Math.floor(dragonHp / dragon.maxHp * 100)) + '% damaged)');
      console.log('  │  Fleet Casualties:   ' + shipsLost + '/' + fleetShips + ' ships sunk, ' +
        crewLost + '/' + totalCrew + ' sailors killed');
      console.log('  │  Engagement:         ' + (tick - 1) + ' strafing passes');
      console.log('  └─');
      return;
    }

    // Dragon strafes
    const preFleetHP = fleetHP;
    const preShips = Math.floor(preFleetHP / SHIP_HP);
    let strafeDmg = dragon.navalStrafe;
    fleetHP = Math.max(0, fleetHP - strafeDmg);
    const shipsDestroyed = Math.floor(strafeDmg / SHIP_HP);

    // Fire spread
    let fireSpreadDmg = 0;
    let fireCount = 0;
    for (let i = 0; i < shipsDestroyed; i++) {
      if (Math.random() < 0.30) { fireSpreadDmg += 100; fireCount++; }
    }
    fleetHP = Math.max(0, fleetHP - fireSpreadDmg);

    const shipsAfterStrafe = Math.max(0, Math.floor(fleetHP / SHIP_HP));
    const shipsSunkThisPass = preShips - shipsAfterStrafe;
    let strafeMsg = dragon.name + ' strafes → ' + shipsSunkThisPass + ' ships sunk';
    if (fireCount > 0) strafeMsg += ' (' + fireCount + ' catch fire)';

    console.log('  │  ' + pad(tick, 6) + pad(strafeMsg, 58) +
      padL(Math.floor(dragonHp) + ' HP', 12) +
      padL(shipsAfterStrafe + ' ships', 12));

    if (fleetHP <= 0) {
      const crewLost = fleetShips * CREW_PER_SHIP;
      console.log('  │');
      console.log('  ├─ WINNER: DRAGON (Fleet destroyed)');
      console.log('  │');
      console.log('  │  Dragon Casualties:  ' + (dragon.maxHp - Math.floor(dragonHp)) + ' damage taken (' +
        Math.floor(dragonHp) + '/' + dragon.maxHp + ' HP remaining)');
      console.log('  │  Fleet Casualties:   ALL ' + fleetShips + ' ships sunk, ' +
        crewLost + ' sailors killed (total loss)');
      console.log('  │  Engagement:         ' + tick + ' strafing passes');
      console.log('  └─');
      return;
    }

    // Fleet fires back
    const currentShips = Math.max(1, Math.floor(fleetHP / SHIP_HP));
    const engagedShips = engagementZone(currentShips);
    let hits = 0;
    let totalScorpDmg = 0;
    for (let b = 0; b < engagedShips; b++) {
      if (Math.random() < dragon.seaHitRate) {
        hits++;
        totalScorpDmg += dragon.scorpDmg;
        dragonHp = Math.max(0, dragonHp - dragon.scorpDmg);
      }
    }

    console.log('  │  ' + pad('', 6) + pad('Fleet returns fire: ' + engagedShips + ' scorpions, ' +
      hits + ' hit → ' + totalScorpDmg + ' dmg', 58) +
      padL(Math.floor(dragonHp) + ' HP', 12) +
      padL(currentShips + ' ships', 12));

    if (dragonHp <= 0) {
      const shipsLost = fleetShips - currentShips;
      const crewLost = shipsLost * CREW_PER_SHIP;
      console.log('  │');
      console.log('  ├─ WINNER: FLEET (Dragon killed)');
      console.log('  │');
      console.log('  │  Dragon Casualties:  KILLED (' + dragon.name + ' is dead)');
      console.log('  │  Fleet Casualties:   ' + shipsLost + '/' + fleetShips + ' ships sunk, ' +
        crewLost + '/' + totalCrew + ' sailors killed');
      console.log('  │  Engagement:         ' + tick + ' strafing passes');
      console.log('  └─');
      return;
    }
  }

  console.log('  └─ Result: TIMEOUT after ' + tick + ' passes');
}

function runDragonVsFleet() {
  banner('3. DRAGON VS FLEET BALANCE (Strafing Run Model)');
  console.log('  Naval strafe: ×1.5 | Sea scorpion accuracy: +25% | Fire spread: 30%/100dmg');
  console.log('  Engagement zone: min(fleet, max(25, 20% of fleet)) | Dragon withdraws at 30% HP');
  console.log('  ' + SIMS + ' sims per matchup');

  const dragons = DRAGONS.map(deriveDragon);

  console.log('\n  Dragon Stats at Sea:');
  console.log('  ' + pad('Dragon', 12) + padL('Tier', 5) + padL('HP', 5) + padL('Naval Strafe', 13) +
    padL('Sea Hit%', 9) + padL('Scorp Dmg', 10));
  for (const d of dragons) {
    console.log('  ' + pad(d.name, 12) + padL('T' + d.tier, 5) + padL(d.maxHp, 5) +
      padL(d.navalStrafe, 13) + padL((d.seaHitRate * 100).toFixed(0) + '%', 9) +
      padL(d.scorpDmg, 10));
  }

  // ── Verbose single-battle traces ──
  section('Verbose Battle Traces (single battle each, to show mechanics)');

  const vhagar = dragons.find(d => d.name === 'Vhagar');
  const caraxes = dragons.find(d => d.name === 'Caraxes');
  const sunfyre = dragons.find(d => d.name === 'Sunfyre');
  const seasmoke = dragons.find(d => d.name === 'Seasmoke');
  const arrax = dragons.find(d => d.name === 'Arrax');

  verboseDragonVsFleet(vhagar, 25);     // Dragon dominates small fleet
  verboseDragonVsFleet(vhagar, 100);    // Large fleet vs the biggest dragon
  verboseDragonVsFleet(vhagar, 150);    // Massive fleet vs Vhagar
  verboseDragonVsFleet(caraxes, 75);    // Agile dragon vs medium fleet
  verboseDragonVsFleet(sunfyre, 50);    // T4 vs medium fleet
  verboseDragonVsFleet(seasmoke, 25);   // T3 coinflip
  verboseDragonVsFleet(arrax, 25);      // T1 suicide run

  // ── Aggregate stats ──
  section('Aggregate Results (' + SIMS + ' sims per matchup)');
  console.log('  Outcomes: Dragon Wins = fleet destroyed | Fleet Wins = dragon killed or withdrew');
  console.log('');
  console.log('  ' + pad('Matchup', 22) +
    padL('Dragon Wins', 12) + padL('Fleet Wins', 12) +
    pad('  How Fleet Wins', 28) +
    padL('Avg Ships Lost', 15) + padL('Avg Crew Lost', 14));

  const keyMatchups = [
    ['Vhagar', 25], ['Vhagar', 50], ['Vhagar', 100], ['Vhagar', 150],
    ['Caraxes', 25], ['Caraxes', 50], ['Caraxes', 75], ['Caraxes', 100],
    ['Sunfyre', 25], ['Sunfyre', 50], ['Sunfyre', 75],
    ['Seasmoke', 25], ['Seasmoke', 50],
    ['Tessarion', 25], ['Tessarion', 50],
    ['Arrax', 25],
  ];

  for (const [dname, ships] of keyMatchups) {
    const d = dragons.find(x => x.name === dname);
    let dragonKills = 0, dragonWithdraws = 0, fleetWiped = 0, totalSunk = 0, totalPasses = 0;
    for (let i = 0; i < SIMS; i++) {
      const r = simDragonVsFleet(d, ships, 3);
      if (r.dragonDied) dragonKills++;
      if (r.dragonWithdrew) dragonWithdraws++;
      if (r.fleetDestroyed) fleetWiped++;
      totalSunk += r.shipsSunk;
      totalPasses += r.totalPasses;
    }
    const dragonWinPct = fleetWiped;
    const fleetWinPct = dragonKills + dragonWithdraws;
    const avgSunk = totalSunk / SIMS;
    const avgCrewLost = Math.round(avgSunk * CREW_PER_SHIP);
    const howFleetWins = dragonKills > 0 && dragonWithdraws > 0
      ? 'killed ' + pct(dragonKills, SIMS) + ' / fled ' + pct(dragonWithdraws, SIMS)
      : dragonKills > 0 ? 'killed ' + pct(dragonKills, SIMS)
      : dragonWithdraws > 0 ? 'fled ' + pct(dragonWithdraws, SIMS)
      : '—';
    console.log('  ' + pad(dname + ' vs ' + ships, 22) +
      padL(pct(dragonWinPct, SIMS), 12) + padL(pct(fleetWinPct, SIMS), 12) +
      pad('  ' + howFleetWins, 28) +
      padL(avgSunk.toFixed(1) + '/' + ships, 15) +
      padL(avgCrewLost + '/' + (ships * CREW_PER_SHIP), 14));
  }
}

// ═══════════════════════════════════════════════════════════════
// 3b. FLEET + DRAGON vs FLEET (Combined Naval Battle)
// ═══════════════════════════════════════════════════════════════

function simFleetWithDragon(allyShips, enemyShips, dragon, council) {
  // Both fleets fight normally. Dragon strafes enemy fleet each tick.
  // Enemy fleet splits scorpion fire: engagement zone fires at dragon, rest fight fleet.
  const ally = JSON.parse(JSON.stringify(createFleet('Ally', allyShips, council)));
  const enemy = JSON.parse(JSON.stringify(createFleet('Enemy', enemyShips, council)));

  let dragonHp = dragon.maxHp;
  const withdrawThreshold = dragon.maxHp * 0.30;
  let dragonDied = false, dragonWithdrew = false, dragonActive = true;
  let tick = 0;

  while (tick < 40 && ally.currentHP > 0 && enemy.currentHP > 0) {
    tick++;

    // Dragon strafe phase (if still active)
    if (dragonActive) {
      if (dragonHp <= withdrawThreshold) {
        dragonWithdrew = true; dragonActive = false;
      } else {
        // Dragon strafes enemy fleet
        enemy.currentHP = Math.max(0, enemy.currentHP - dragon.navalStrafe);

        // Fire spread
        const destroyed = Math.floor(dragon.navalStrafe / SHIP_HP);
        for (let i = 0; i < destroyed; i++) {
          if (Math.random() < 0.30) enemy.currentHP = Math.max(0, enemy.currentHP - 100);
        }

        if (enemy.currentHP <= 0) break;

        // Enemy scorpions fire at dragon (engagement zone)
        const enemyShipsNow = Math.max(1, Math.floor(enemy.currentHP / SHIP_HP));
        const engagedVsDragon = engagementZone(enemyShipsNow);
        for (let b = 0; b < engagedVsDragon; b++) {
          if (Math.random() < dragon.seaHitRate) {
            dragonHp = Math.max(0, dragonHp - dragon.scorpDmg);
          }
        }
        if (dragonHp <= 0) { dragonDied = true; dragonActive = false; }
      }
    }

    if (enemy.currentHP <= 0) break;

    // Fleet vs fleet combat phase (normal naval engagement)
    let totalAllyDmg = 0, totalEnemyDmg = 0;
    for (let e = 0; e < NAVAL_ENGAGEMENTS; e++) {
      if (ally.currentHP <= 0 || enemy.currentHP <= 0) break;
      const { atkDmg, defDmg } = navalEngagement(ally, enemy);
      totalAllyDmg += atkDmg; totalEnemyDmg += defDmg;
      navalRouting(ally); navalRouting(enemy);
    }
    navalMorale(ally, totalAllyDmg, totalEnemyDmg);
    navalMorale(enemy, totalEnemyDmg, totalAllyDmg);
    navalRally(ally); navalRally(enemy);
  }

  const allyShipsLeft = Math.max(0, Math.floor(ally.currentHP / SHIP_HP));
  const enemyShipsLeft = Math.max(0, Math.floor(enemy.currentHP / SHIP_HP));
  const allyWon = enemy.currentHP <= 0 || (ally.currentHP > 0 && allyShipsLeft > enemyShipsLeft);
  const enemyWon = ally.currentHP <= 0 || (enemy.currentHP > 0 && enemyShipsLeft > allyShipsLeft);

  return {
    tick, allyWon, enemyWon,
    allyShipsLeft, enemyShipsLeft,
    allyShipsLost: allyShips - allyShipsLeft,
    enemyShipsLost: enemyShips - enemyShipsLeft,
    dragonHp, dragonDied, dragonWithdrew, dragonActive,
  };
}

function runFleetWithDragon() {
  banner('3b. FLEET + DRAGON vs FLEET (Combined Naval)');
  console.log('  One side has fleet + dragon support. Enemy has fleet only (with scorpions).');
  console.log('  Dragon strafes each tick. Enemy engagement zone fires at dragon.');
  console.log('  Equal war councils. ' + SIMS + ' sims per matchup.\n');

  const council = { command: 6, prowess: 5, fortitude: 5, cunning: 5, presence: 5, faith: 5 };
  const dragons = DRAGONS.map(deriveDragon);

  // Scenarios: equal fleets + dragon advantage, and underdog + dragon
  const scenarios = [
    // [dragon, ally ships, enemy ships, label]
    ['Vhagar',   50,  50,  'Equal fleets (50v50) + Vhagar'],
    ['Vhagar',   50, 100,  'Underdog (50v100) + Vhagar'],
    ['Vhagar',   75, 100,  'Slight underdog (75v100) + Vhagar'],
    ['Caraxes',  50,  50,  'Equal fleets (50v50) + Caraxes'],
    ['Caraxes',  50, 100,  'Underdog (50v100) + Caraxes'],
    ['Sunfyre',  50,  50,  'Equal fleets (50v50) + Sunfyre'],
    ['Sunfyre',  50, 100,  'Underdog (50v100) + Sunfyre'],
    ['Seasmoke', 50,  50,  'Equal fleets (50v50) + Seasmoke'],
    ['Seasmoke', 25,  50,  'Underdog (25v50) + Seasmoke'],
    ['Arrax',    50,  50,  'Equal fleets (50v50) + Arrax'],
  ];

  console.log('  ' + pad('Scenario', 42) +
    padL('Ally Wins', 10) + padL('Enemy Wins', 11) +
    padL('Dragon Dies', 12) + padL('Dragon Flees', 13) +
    padL('Ally Ships Left', 16) + padL('Enemy Ships Left', 17));

  for (const [dname, allyN, enemyN, label] of scenarios) {
    const d = dragons.find(x => x.name === dname);
    let allyWins = 0, enemyWins = 0, dKills = 0, dFlees = 0;
    let totalAllyLeft = 0, totalEnemyLeft = 0;

    for (let i = 0; i < SIMS; i++) {
      const r = simFleetWithDragon(allyN, enemyN, d, council);
      if (r.allyWon) allyWins++;
      if (r.enemyWon) enemyWins++;
      if (r.dragonDied) dKills++;
      if (r.dragonWithdrew) dFlees++;
      totalAllyLeft += r.allyShipsLeft;
      totalEnemyLeft += r.enemyShipsLeft;
    }

    console.log('  ' + pad(label, 42) +
      padL(pct(allyWins, SIMS), 10) + padL(pct(enemyWins, SIMS), 11) +
      padL(pct(dKills, SIMS), 12) + padL(pct(dFlees, SIMS), 13) +
      padL((totalAllyLeft / SIMS).toFixed(1) + '/' + allyN, 16) +
      padL((totalEnemyLeft / SIMS).toFixed(1) + '/' + enemyN, 17));
  }

  // Verbose: 50v100 + Vhagar
  section('Verbose: 50 vs 100 ships + Vhagar supporting the 50');
  const vhagar = dragons.find(d => d.name === 'Vhagar');
  const ally = createFleet('Ally (50)', 50, council);
  const enemy = createFleet('Enemy (100)', 100, council);

  let dragonHp = vhagar.maxHp;
  let dragonActive = true;
  const allyF = JSON.parse(JSON.stringify(ally));
  const enemyF = JSON.parse(JSON.stringify(enemy));

  console.log('  ' + pad('Tick', 6) +
    padL('Ally Ships', 11) + padL('Enemy Ships', 12) +
    padL('Vhagar HP', 12) + pad('  Events', 50));

  for (let tick = 1; tick <= 20 && allyF.currentHP > 0 && enemyF.currentHP > 0; tick++) {
    let events = [];

    // Dragon phase
    if (dragonActive) {
      if (dragonHp <= vhagar.maxHp * 0.30) {
        dragonActive = false;
        events.push('Vhagar withdraws');
      } else {
        enemyF.currentHP = Math.max(0, enemyF.currentHP - vhagar.navalStrafe);
        const destroyed = Math.floor(vhagar.navalStrafe / SHIP_HP);
        for (let i = 0; i < destroyed; i++) {
          if (Math.random() < 0.30) enemyF.currentHP = Math.max(0, enemyF.currentHP - 100);
        }
        const sunk = Math.floor(vhagar.navalStrafe / SHIP_HP);
        events.push('Vhagar sinks ~' + sunk + ' ships');

        if (enemyF.currentHP > 0) {
          const eShips = Math.floor(enemyF.currentHP / SHIP_HP);
          const engaged = engagementZone(eShips);
          let hits = 0;
          for (let b = 0; b < engaged; b++) {
            if (Math.random() < vhagar.seaHitRate) {
              hits++; dragonHp = Math.max(0, dragonHp - vhagar.scorpDmg);
            }
          }
          if (hits > 0) events.push(engaged + ' scorpions → ' + hits + ' hit Vhagar');
          if (dragonHp <= 0) { dragonActive = false; events.push('VHAGAR KILLED'); }
        }
      }
    }

    if (enemyF.currentHP <= 0) {
      console.log('  ' + pad(tick, 6) +
        padL(Math.floor(allyF.currentHP / SHIP_HP), 11) +
        padL(0, 12) +
        padL(dragonActive ? Math.floor(dragonHp) : 'OUT', 12) +
        '  ' + events.join('; '));
      break;
    }

    // Fleet combat
    let d1 = 0, d2 = 0;
    for (let e = 0; e < NAVAL_ENGAGEMENTS; e++) {
      if (allyF.currentHP <= 0 || enemyF.currentHP <= 0) break;
      const r = navalEngagement(allyF, enemyF);
      d1 += r.atkDmg; d2 += r.defDmg;
      navalRouting(allyF); navalRouting(enemyF);
    }
    navalMorale(allyF, d1, d2);
    navalMorale(enemyF, d2, d1);
    navalRally(allyF); navalRally(enemyF);

    console.log('  ' + pad(tick, 6) +
      padL(Math.floor(allyF.currentHP / SHIP_HP), 11) +
      padL(Math.floor(enemyF.currentHP / SHIP_HP), 12) +
      padL(dragonActive ? Math.floor(dragonHp) : 'OUT', 12) +
      '  ' + events.join('; '));
  }
}

// ═══════════════════════════════════════════════════════════════
// 4. STRAFE DAMAGE VS ARMY COMPOSITIONS
// ═══════════════════════════════════════════════════════════════

function runStrafeValidation() {
  banner('4. STRAFE DAMAGE vs ARMY COMPOSITIONS');
  console.log('  Formula: (Tier × 500) + (Might × 100)');
  console.log('  Checking % of army HP destroyed per tick of strafing\n');

  const armies = [
    { name: 'Military S1 (1,500)',  levy: 600,  maa: 600,  elite: 300,  hp: 600*10 + 600*20 + 300*30 },
    { name: 'Military S2 (3,000)',  levy: 1200, maa: 1200, elite: 600,  hp: 1200*10 + 1200*20 + 600*30 },
    { name: 'Military S3 (5,000)',  levy: 2000, maa: 2000, elite: 1000, hp: 2000*10 + 2000*20 + 1000*30 },
    { name: 'Hybrid S3 (6,000)',    levy: 3600, maa: 1680, elite: 720,  hp: 3600*10 + 1680*20 + 720*30 },
    { name: 'Civilian S3 (10,000)', levy: 8000, maa: 1700, elite: 300,  hp: 8000*10 + 1700*20 + 300*30 },
    { name: 'Huge Host (20,000)',   levy: 12000,maa: 5600, elite: 2400, hp: 12000*10 + 5600*20 + 2400*30 },
  ];

  const dragonList = [
    { name: 'Vhagar (T5)',  strafe: 5*500 + 10*100 },
    { name: 'Caraxes (T5)', strafe: 5*500 + 7*100 },
    { name: 'Sunfyre (T4)', strafe: 4*500 + 6*100 },
    { name: 'Seasmoke (T3)',strafe: 3*500 + 5*100 },
    { name: 'Tessarion(T2)',strafe: 2*500 + 4*100 },
    { name: 'Arrax (T1)',   strafe: 1*500 + 2*100 },
  ];

  console.log('  ' + pad('Dragon', 16) + armies.map(a => padL(a.name.split('(')[0].trim(), 12)).join(''));
  console.log('  ' + pad('', 16) + armies.map(a => padL('(' + a.hp + ' HP)', 12)).join(''));
  console.log('  ' + '-'.repeat(16 + armies.length * 12));

  for (const d of dragonList) {
    let row = '  ' + pad(d.name, 16);
    for (const a of armies) {
      const pctDmg = (d.strafe / a.hp * 100).toFixed(1) + '%';
      const ticks = Math.ceil(a.hp / d.strafe);
      row += padL(pctDmg + '/' + ticks + 't', 12);
    }
    console.log(row);
  }

  console.log('\n  Format: X%/Yt = X% HP per tick / Y ticks to destroy (raw, no morale DR or rout)');
  console.log('  Design target: T5 should threaten but not instantly destroy S3 armies (5-15% per tick)');
  console.log('  Design target: T1-T2 should be negligible against large armies (<2% per tick)');
}

// ═══════════════════════════════════════════════════════════════
// 5. RIDER SURVIVAL FREQUENCY
// ═══════════════════════════════════════════════════════════════

function runRiderSurvival() {
  banner('5. RIDER SURVIVAL CHECK (1d20)');
  console.log('  Roll: 1d20 + Dragon Bonus + Rider Bonus vs DC 15 (land) / DC 20 (sea)');
  console.log('  Dragon Bonus: floor(max(Agility, Resilience) / 2)');
  console.log('  Rider Bonus: floor(max(Prowess, Command, Cunning, Fortitude) / 2)\n');

  const riders = [
    { name: 'Daemon on Caraxes', dragonBonus: Math.floor(Math.max(9, 6) / 2), riderBonus: Math.floor(9 / 2) }, // Agility 9, Prowess 9
    { name: 'Aegon on Sunfyre', dragonBonus: Math.floor(Math.max(6, 6) / 2), riderBonus: Math.floor(6 / 2) }, // Agility 6, Prowess 6
    { name: 'Rhaenyra on Syrax', dragonBonus: Math.floor(Math.max(5, 5) / 2), riderBonus: Math.floor(6 / 2) }, // Agility 5, Cunning 6
    { name: 'Baela on Moondancer', dragonBonus: Math.floor(Math.max(8, 3) / 2), riderBonus: Math.floor(6 / 2) }, // Agility 8, Cunning 6
    { name: 'Jace on Vermax', dragonBonus: Math.floor(Math.max(7, 4) / 2), riderBonus: Math.floor(6 / 2) }, // Agility 7, Prowess 6
    { name: 'Aemond on Vhagar', dragonBonus: Math.floor(Math.max(3, 10) / 2), riderBonus: Math.floor(8 / 2) }, // Resilience 10, Prowess 8
    { name: 'Weak rider, T1 dragon', dragonBonus: 1, riderBonus: 1 },
  ];

  console.log('  ' + pad('Rider', 28) + padL('Mod', 5) + padL('Need', 6) +
    padL('Survive%', 9) + padL('Wounded%', 9) + padL('Dead%', 7) +
    padL('Sea Surv%', 10) + padL('Sea Dead%', 10));

  for (const r of riders) {
    const mod = r.dragonBonus + r.riderBonus;
    const landNeed = 15 - mod; // Need this or higher on d20
    let survive = 0, wounded = 0, dead = 0;
    let seaSurvive = 0, seaDead = 0;

    for (let i = 0; i < SIMS; i++) {
      const d20 = roll(20);
      const total = d20 + mod;
      if (total >= 15) survive++;
      else if (total >= 10) wounded++;
      else dead++;

      // Sea: DC 20
      if (total >= 20) seaSurvive++;
      else if (total < 10) seaDead++; // same dead threshold
    }

    console.log('  ' + pad(r.name, 28) + padL('+' + mod, 5) + padL(Math.max(1, landNeed) + '+', 6) +
      padL(pct(survive, SIMS), 9) + padL(pct(wounded, SIMS), 9) + padL(pct(dead, SIMS), 7) +
      padL(pct(seaSurvive, SIMS), 10) + padL(pct(seaDead, SIMS), 10));
  }
}

// ═══════════════════════════════════════════════════════════════
// 6. CRITICAL STRIKE BALANCE (Agility% crit)
// ═══════════════════════════════════════════════════════════════

function runCritBalance() {
  banner('6. CRITICAL STRIKE BALANCE (Agility% Crit Chance)');
  console.log('  Crit chance = Agility% per attack. Crits apply 1 bleed stack.');
  console.log('  High-Agility dragons accumulate bleed faster in long fights.\n');

  const dragons = [
    { name: 'Meleys',       agility: 10, tier: 5, ferocity: 8 },
    { name: 'Caraxes',      agility: 9,  tier: 5, ferocity: 10 },
    { name: 'Sheepstealer', agility: 8,  tier: 3, ferocity: 6 },
    { name: 'Tessarion',    agility: 7,  tier: 2, ferocity: 5 },
    { name: 'Sunfyre',      agility: 6,  tier: 4, ferocity: 7 },
    { name: 'Vermithor',    agility: 5,  tier: 5, ferocity: 7 },
    { name: 'Vhagar',       agility: 3,  tier: 5, ferocity: 10 },
  ];

  // Simulate 20 ticks of attacks, count crits
  console.log('  ' + pad('Dragon', 14) + padL('Agility', 8) + padL('Crit%', 6) +
    padL('Avg Crits/10t', 14) + padL('Avg Crits/20t', 14) + padL('Bleed@10t', 10) + padL('Bleed@20t', 10));

  for (const d of dragons) {
    const critRate = d.agility / 100; // Agility%
    let total10 = 0, total20 = 0;

    for (let i = 0; i < SIMS; i++) {
      let crits10 = 0, crits20 = 0;
      for (let t = 0; t < 20; t++) {
        if (Math.random() < critRate) {
          if (t < 10) crits10++;
          crits20++;
        }
      }
      total10 += crits10;
      total20 += crits10 + (crits20 - crits10);
    }

    // Recount properly
    let c10sum = 0, c20sum = 0;
    for (let i = 0; i < SIMS; i++) {
      let c = 0;
      for (let t = 0; t < 20; t++) {
        if (Math.random() < critRate) c++;
      }
      c20sum += c;
      // Approximate first 10
      let c10 = 0;
      for (let t = 0; t < 10; t++) {
        if (Math.random() < critRate) c10++;
      }
      c10sum += c10;
    }

    const avg10 = c10sum / SIMS;
    const avg20 = c20sum / SIMS;
    // Each bleed stack = 2 damage per tick (from dragon-system.md)
    const bleed10 = (avg10 * 2).toFixed(1);
    const bleed20 = (avg20 * 2).toFixed(1);

    console.log('  ' + pad(d.name, 14) + padL(d.agility, 8) + padL(d.agility + '%', 6) +
      padL(avg10.toFixed(2), 14) + padL(avg20.toFixed(2), 14) +
      padL(bleed10 + '/tick', 10) + padL(bleed20 + '/tick', 10));
  }

  console.log('\n  Design intent: High-Agility dragons win long fights via bleed accumulation.');
  console.log('  Vhagar (3%) rarely crits — wins via raw damage. Meleys (10%) stacks bleed fast.');
  console.log('  At Agility 10, expect ~1 crit per 10 ticks and ~2 per 20 ticks.');
}

// ═══════════════════════════════════════════════════════════════
// 7. SUNFYRE T4 RE-SIM (1v1 Power Rankings)
// ═══════════════════════════════════════════════════════════════

function runSunfyreResim() {
  banner('7. SUNFYRE T4 — 1v1 POWER RANKING RE-SIM');
  console.log('  All dragons with equal rider (+3 Strike, +3 Evasion)');
  console.log('  ' + SIMS + ' fights per matchup\n');

  const allDragons = [
    { name: 'The Cannibal', tier: 5, might: 8,  agility: 6,  ferocity: 10, resilience: 8 },
    { name: 'Caraxes',      tier: 5, might: 7,  agility: 9,  ferocity: 10, resilience: 6 },
    { name: 'Meleys',       tier: 5, might: 7,  agility: 10, ferocity: 8,  resilience: 7 },
    { name: 'Vhagar',       tier: 5, might: 10, agility: 3,  ferocity: 10, resilience: 10 },
    { name: 'Vermithor',    tier: 5, might: 9,  agility: 5,  ferocity: 7,  resilience: 9 },
    { name: 'Dreamfyre',    tier: 4, might: 7,  agility: 4,  ferocity: 5,  resilience: 8 },
    { name: 'Silverwing',   tier: 4, might: 7,  agility: 5,  ferocity: 4,  resilience: 8 },
    { name: 'Sunfyre',      tier: 4, might: 6,  agility: 6,  ferocity: 7,  resilience: 6 },
    { name: 'Sheepstealer', tier: 3, might: 5,  agility: 8,  ferocity: 6,  resilience: 5 },
    { name: 'Seasmoke',     tier: 3, might: 5,  agility: 7,  ferocity: 6,  resilience: 5 },
    { name: 'Grey Ghost',   tier: 3, might: 3,  agility: 8,  ferocity: 2,  resilience: 5 },
    { name: 'Vermax',       tier: 2, might: 4,  agility: 7,  ferocity: 6,  resilience: 4 },
    { name: 'Moondancer',   tier: 2, might: 3,  agility: 8,  ferocity: 7,  resilience: 3 },
    { name: 'Syrax',        tier: 2, might: 6,  agility: 5,  ferocity: 3,  resilience: 5 },
    { name: 'Tessarion',    tier: 2, might: 4,  agility: 7,  ferocity: 5,  resilience: 4 },
    { name: 'Stormcloud',   tier: 1, might: 2,  agility: 6,  ferocity: 6,  resilience: 2 },
    { name: 'Arrax',        tier: 1, might: 2,  agility: 7,  ferocity: 4,  resilience: 2 },
    { name: 'Tyraxes',      tier: 1, might: 2,  agility: 4,  ferocity: 3,  resilience: 2 },
  ];

  // Derive combat stats with equal rider (+3/+3)
  const combatDragons = allDragons.map(d => ({
    ...d,
    hp: (d.might + d.resilience) * d.tier * 5,
    strike: d.might + d.ferocity + 3, // +3 rider
    evasion: d.agility + Math.floor(d.resilience / 2) + 3, // +3 rider
    critRate: d.agility / 100,
    dmgPerHit: d.tier + 3,
  }));

  // Run round-robin
  const records = {};
  for (const d of combatDragons) records[d.name] = { wins: 0, losses: 0 };

  for (let i = 0; i < combatDragons.length; i++) {
    for (let j = i + 1; j < combatDragons.length; j++) {
      const d1 = combatDragons[i];
      const d2 = combatDragons[j];
      let d1wins = 0, d2wins = 0;

      for (let s = 0; s < SIMS; s++) {
        const winner = simDragonDuel(d1, d2);
        if (winner === d1.name) d1wins++;
        else d2wins++;
      }
      records[d1.name].wins += d1wins;
      records[d1.name].losses += d2wins;
      records[d2.name].wins += d2wins;
      records[d2.name].losses += d1wins;
    }
  }

  // Sort by win%
  const ranked = combatDragons.map(d => ({
    ...d,
    winPct: records[d.name].wins / (records[d.name].wins + records[d.name].losses) * 100,
    record: records[d.name].wins + '-' + records[d.name].losses,
  })).sort((a, b) => b.winPct - a.winPct);

  console.log('  ' + pad('#', 3) + pad('Dragon', 16) + padL('Tier', 5) + padL('Strike', 7) +
    padL('Evasion', 8) + padL('HP', 5) + padL('Win%', 7) + padL('Record', 14));
  console.log('  ' + '-'.repeat(65));

  ranked.forEach((d, idx) => {
    console.log('  ' + pad(idx + 1, 3) + pad(d.name, 16) + padL('T' + d.tier, 5) +
      padL(d.strike, 7) + padL(d.evasion, 8) + padL(d.hp, 5) +
      padL(d.winPct.toFixed(1) + '%', 7) + padL(d.record, 14));
  });

  // Sunfyre head-to-head vs T4 peers
  section('Sunfyre T4 vs T4 Peers (head-to-head)');
  const sunfyre = combatDragons.find(d => d.name === 'Sunfyre');
  const peers = combatDragons.filter(d => d.tier === 4 && d.name !== 'Sunfyre');

  for (const peer of peers) {
    let sWins = 0;
    for (let i = 0; i < SIMS; i++) {
      if (simDragonDuel(sunfyre, peer) === 'Sunfyre') sWins++;
    }
    console.log('  Sunfyre vs ' + pad(peer.name, 12) + ': Sunfyre wins ' + pct(sWins, SIMS));
  }
}

function simDragonDuel(d1, d2) {
  let hp1 = d1.hp, hp2 = d2.hp;
  let bleed1 = 0, bleed2 = 0;
  let wounds1 = 0, wounds2 = 0; // wound thresholds at 75%, 50%, 25%

  for (let tick = 0; tick < 30; tick++) {
    // Apply bleed
    hp1 -= bleed1;
    hp2 -= bleed2;
    if (hp1 <= 0) return d2.name;
    if (hp2 <= 0) return d1.name;

    // Ferocity check: flee at 25% HP if ferocity < 8
    if (hp1 <= d1.hp * 0.25 && d1.ferocity < 8) return d2.name;
    if (hp2 <= d2.hp * 0.25 && d2.ferocity < 8) return d1.name;

    // Wound penalties
    wounds1 = hp1 <= d1.hp * 0.25 ? 3 : hp1 <= d1.hp * 0.50 ? 2 : hp1 <= d1.hp * 0.75 ? 1 : 0;
    wounds2 = hp2 <= d2.hp * 0.25 ? 3 : hp2 <= d2.hp * 0.50 ? 2 : hp2 <= d2.hp * 0.75 ? 1 : 0;

    // D1 attacks D2
    const strike1 = Math.max(1, d1.strike - wounds1 * 2);
    const evasion2 = Math.max(1, d2.evasion - wounds2 * 2);
    const hits1 = rollDicePool(strike1) - rollDicePool(evasion2);
    if (hits1 > 0) {
      hp2 -= hits1 * d1.dmgPerHit;
      // Crit check
      if (Math.random() < d1.critRate) bleed2 += 2;
    }

    // D2 attacks D1
    const strike2 = Math.max(1, d2.strike - wounds2 * 2);
    const evasion1 = Math.max(1, d1.evasion - wounds1 * 2);
    const hits2 = rollDicePool(strike2) - rollDicePool(evasion1);
    if (hits2 > 0) {
      hp1 -= hits2 * d2.dmgPerHit;
      if (Math.random() < d2.critRate) bleed1 += 2;
    }

    if (hp1 <= 0 && hp2 <= 0) return Math.random() < 0.5 ? d1.name : d2.name; // mutual kill
    if (hp1 <= 0) return d2.name;
    if (hp2 <= 0) return d1.name;
  }

  // Timeout: whoever has more HP% wins
  return (hp1 / d1.hp) >= (hp2 / d2.hp) ? d1.name : d2.name;
}

// ═══════════════════════════════════════════════════════════════
// 8. DRAGON VS LAND ARMY (with Scorpion Wagon return fire)
// ═══════════════════════════════════════════════════════════════

// Scorpion Wagon — army Special Equipment slot (produced at Siege Workshop)
// Lighter than siege batteries: portable, fewer bolts, same hit mechanics
const SCORPION_WAGON = {
  0: { bolts: 0, dmgPerBolt: 0 },   // No wagon (massed archery only)
  1: { bolts: 1, dmgPerBolt: 15 },
  2: { bolts: 2, dmgPerBolt: 20 },
  3: { bolts: 2, dmgPerBolt: 25 },
  4: { bolts: 3, dmgPerBolt: 30 },
  5: { bolts: 3, dmgPerBolt: 40 },
};

// Massed archery: armies without scorpion wagons get a tiny chance to wound
// 1 damage per 1,000 troops per tick (thousands of arrows, one might get lucky)
function massedArcheryDmg(troops) {
  const arrows = Math.floor(troops / 1000);
  let dmg = 0;
  for (let i = 0; i < arrows; i++) {
    if (Math.random() < 0.10) dmg += 1; // 10% chance per 1k troops to deal 1 dmg
  }
  return dmg;
}

function simDragonVsArmy(dragon, armyHP, armyTroops, wagonTier) {
  const d = deriveDragon(dragon);
  let dragonHp = d.maxHp;
  const withdrawHP = d.maxHp * 0.30;
  let currentArmyHP = armyHP;
  const hitRate = d.landHitRate; // Uses land hit rate (no sea ×1.5)
  const wagon = SCORPION_WAGON[wagonTier];
  let tick = 0;
  let dragonDied = false, dragonWithdrew = false;

  while (tick < 100 && dragonHp > 0 && currentArmyHP > 0) {
    tick++;

    // Dragon withdrawal check
    if (dragonHp <= withdrawHP) { dragonWithdrew = true; break; }

    // Dragon strafes army (land strafe — no ×1.5 fire bonus)
    currentArmyHP = Math.max(0, currentArmyHP - d.strafeDmg);
    if (currentArmyHP <= 0) break;

    // Scorpion wagon fires back
    if (wagon.bolts > 0) {
      for (let b = 0; b < wagon.bolts; b++) {
        if (Math.random() < hitRate) {
          dragonHp -= wagon.dmgPerBolt;
        }
      }
    }

    // Massed archery (even without wagon, large armies get a tiny chance)
    const remainingTroops = Math.max(1, Math.floor(currentArmyHP / 15)); // rough troop estimate
    dragonHp -= massedArcheryDmg(remainingTroops);

    if (dragonHp <= 0) { dragonDied = true; break; }
  }

  return {
    tick, dragonDied, dragonWithdrew,
    dragonHpPct: Math.max(0, dragonHp) / d.maxHp * 100,
    armyHPRemaining: Math.max(0, currentArmyHP),
    armyDmgDealt: armyHP - Math.max(0, currentArmyHP),
    armyDestroyed: currentArmyHP <= 0,
  };
}

function verboseDragonVsArmy(dragon, armyHP, armyTroops, armyLabel, wagonTier) {
  const d = deriveDragon(dragon);
  let dragonHp = d.maxHp;
  const withdrawHP = d.maxHp * 0.30;
  let currentArmyHP = armyHP;
  const hitRate = d.landHitRate;
  const wagon = SCORPION_WAGON[wagonTier];

  const wagonLabel = wagonTier > 0 ? 'T' + wagonTier + ' Scorpion Wagon' : 'No scorpion wagon';
  console.log('\n  ┌─ ' + d.name + ' (T' + d.tier + ') vs ' + armyLabel + ' (' + armyTroops + ' troops)');
  console.log('  │  Dragon: ' + d.maxHp + ' HP, strafe ' + d.strafeDmg + '/tick, withdraws at ≤' + Math.floor(withdrawHP) + ' HP');
  console.log('  │  Army:   ' + armyHP + ' HP, ' + wagonLabel + ', hit rate ' + (hitRate * 100).toFixed(0) + '%');
  if (wagonTier > 0) {
    console.log('  │  Wagon:  ' + wagon.bolts + ' bolts × ' + wagon.dmgPerBolt + ' dmg/bolt');
  }
  console.log('  │');
  console.log('  │  ' + pad('Tick', 6) + pad('Action', 55) + padL('Dragon', 12) + padL('Army', 12));
  console.log('  │  ' + '─'.repeat(85));

  for (let tick = 1; tick <= 50 && dragonHp > 0 && currentArmyHP > 0; tick++) {
    if (dragonHp <= withdrawHP) {
      const pctDestroyed = ((armyHP - currentArmyHP) / armyHP * 100).toFixed(0);
      console.log('  │');
      console.log('  │  ' + pad(tick, 6) + '>>> Dragon breaks off — HP too low');
      console.log('  │');
      console.log('  ├─ WINNER: ARMY (Dragon forced to withdraw)');
      console.log('  │  Dragon:  ' + Math.floor(dragonHp) + '/' + d.maxHp + ' HP remaining');
      console.log('  │  Army:    ' + Math.floor(currentArmyHP) + '/' + armyHP + ' HP remaining (' + pctDestroyed + '% destroyed)');
      console.log('  │  Duration: ' + (tick - 1) + ' strafing ticks');
      console.log('  └─');
      return;
    }

    // Dragon strafes
    currentArmyHP = Math.max(0, currentArmyHP - d.strafeDmg);
    let action = d.name + ' strafes → -' + d.strafeDmg + ' army HP';

    if (currentArmyHP <= 0) {
      console.log('  │  ' + pad(tick, 6) + pad(action + ' → ARMY DESTROYED', 55) +
        padL(Math.floor(dragonHp) + ' HP', 12) + padL('0 HP', 12));
      console.log('  │');
      console.log('  ├─ WINNER: DRAGON (Army destroyed)');
      console.log('  │  Dragon:  ' + Math.floor(dragonHp) + '/' + d.maxHp + ' HP remaining');
      console.log('  │  Duration: ' + tick + ' strafing ticks');
      console.log('  └─');
      return;
    }

    console.log('  │  ' + pad(tick, 6) + pad(action, 55) +
      padL(Math.floor(dragonHp) + ' HP', 12) +
      padL(Math.floor(currentArmyHP) + ' HP', 12));

    // Scorpion wagon
    if (wagon.bolts > 0) {
      let hits = 0, wDmg = 0;
      for (let b = 0; b < wagon.bolts; b++) {
        if (Math.random() < hitRate) { hits++; wDmg += wagon.dmgPerBolt; dragonHp -= wagon.dmgPerBolt; }
      }
      if (hits > 0) {
        console.log('  │  ' + pad('', 6) + pad('  Scorpion wagon: ' + wagon.bolts + ' bolts, ' + hits + ' hit → ' + wDmg + ' dmg', 55) +
          padL(Math.floor(dragonHp) + ' HP', 12) + padL('', 12));
      }
    }

    // Massed archery
    const remainingTroops = Math.max(1, Math.floor(currentArmyHP / 15));
    const archeryDmg = massedArcheryDmg(remainingTroops);
    if (archeryDmg > 0) {
      dragonHp -= archeryDmg;
      console.log('  │  ' + pad('', 6) + pad('  Massed archery: ' + archeryDmg + ' dmg (lucky shots)', 55) +
        padL(Math.floor(dragonHp) + ' HP', 12) + padL('', 12));
    }

    if (dragonHp <= 0) {
      console.log('  │');
      console.log('  ├─ WINNER: ARMY (Dragon killed)');
      console.log('  │  Army:    ' + Math.floor(currentArmyHP) + '/' + armyHP + ' HP remaining');
      console.log('  │  Duration: ' + tick + ' strafing ticks');
      console.log('  └─');
      return;
    }
  }

  console.log('  └─ TIMEOUT');
}

function runDragonVsArmy() {
  banner('8. DRAGON VS LAND ARMY (Scorpion Wagon Return Fire)');
  console.log('  Land strafe: (Tier × 500) + (Might × 100) — no fire bonus');
  console.log('  Scorpion Wagon: army Special Equipment slot (produced at Siege Workshop)');
  console.log('  Hit rate: getHitRate(max(agility, resilience)) — same as naval/siege');
  console.log('  Massed archery: 10% chance per 1k troops to deal 1 dmg (symbolic)');
  console.log('  Dragon withdraws at 30% HP. ' + SIMS + ' sims per matchup.\n');

  // Wagon stats
  console.log('  Scorpion Wagon Stats (army Special Equipment slot):');
  console.log('  ' + pad('Tier', 6) + padL('Bolts', 6) + padL('Dmg/Bolt', 9) + padL('Max Dmg/Tick', 13));
  for (let t = 1; t <= 5; t++) {
    const w = SCORPION_WAGON[t];
    console.log('  ' + pad('T' + t, 6) + padL(w.bolts, 6) + padL(w.dmgPerBolt, 9) + padL(w.bolts * w.dmgPerBolt, 13));
  }

  const armies = [
    { label: 'Military S1 (1,500)', troops: 1500, hp: 600*10 + 600*20 + 300*30 },
    { label: 'Military S2 (3,000)', troops: 3000, hp: 1200*10 + 1200*20 + 600*30 },
    { label: 'Military S3 (5,000)', troops: 5000, hp: 2000*10 + 2000*20 + 1000*30 },
    { label: 'Huge Host (20,000)',  troops: 20000, hp: 12000*10 + 5600*20 + 2400*30 },
  ];

  const testDragons = ['Vhagar', 'Caraxes', 'Sunfyre', 'Seasmoke', 'Arrax'];

  // ── No wagon vs wagon comparison ──
  for (const wagonTier of [0, 3, 5]) {
    const wLabel = wagonTier === 0 ? 'No Scorpion Wagon (massed archery only)' :
      'T' + wagonTier + ' Scorpion Wagon (' + SCORPION_WAGON[wagonTier].bolts + '×' + SCORPION_WAGON[wagonTier].dmgPerBolt + ')';
    section(wLabel);

    console.log('  ' + pad('Matchup', 28) +
      padL('Dragon Wins', 12) + padL('Army Wins', 10) +
      padL('How Army Wins', 26) +
      padL('Avg Ticks', 10) + padL('Army % Lost', 12));

    for (const dname of testDragons) {
      const d = DRAGONS.find(x => x.name === dname);
      for (const army of armies) {
        let dragonWins = 0, dragonKills = 0, dragonWithdraws = 0;
        let totalTicks = 0, totalArmyDmg = 0;

        for (let i = 0; i < SIMS; i++) {
          const r = simDragonVsArmy(d, army.hp, army.troops, wagonTier);
          if (r.armyDestroyed) dragonWins++;
          if (r.dragonDied) dragonKills++;
          if (r.dragonWithdrew) dragonWithdraws++;
          totalTicks += r.tick;
          totalArmyDmg += r.armyDmgDealt;
        }

        const armyWins = dragonKills + dragonWithdraws;
        const howArmyWins = dragonKills > 0 && dragonWithdraws > 0
          ? 'killed ' + pct(dragonKills, SIMS) + ' / fled ' + pct(dragonWithdraws, SIMS)
          : dragonKills > 0 ? 'killed ' + pct(dragonKills, SIMS)
          : dragonWithdraws > 0 ? 'fled ' + pct(dragonWithdraws, SIMS)
          : '—';
        const avgTicks = (totalTicks / SIMS).toFixed(1);
        const avgArmyPctLost = (totalArmyDmg / SIMS / army.hp * 100).toFixed(1) + '%';

        console.log('  ' + pad(dname + ' vs ' + army.troops, 28) +
          padL(pct(dragonWins, SIMS), 12) + padL(pct(armyWins, SIMS), 10) +
          padL(howArmyWins, 26) +
          padL(avgTicks, 10) + padL(avgArmyPctLost, 12));
      }
      if (dname !== testDragons[testDragons.length - 1]) console.log('');
    }
  }

  // ── Verbose traces ──
  section('Verbose Battle Traces');
  const vhagar = DRAGONS.find(d => d.name === 'Vhagar');
  const caraxes = DRAGONS.find(d => d.name === 'Caraxes');
  const milS3 = armies[2]; // Military S3

  verboseDragonVsArmy(vhagar, milS3.hp, milS3.troops, milS3.label, 0);   // No wagon
  verboseDragonVsArmy(vhagar, milS3.hp, milS3.troops, milS3.label, 5);   // T5 wagon
  verboseDragonVsArmy(caraxes, milS3.hp, milS3.troops, milS3.label, 5);  // Agile dragon vs T5 wagon
  verboseDragonVsArmy(vhagar, armies[3].hp, armies[3].troops, armies[3].label, 3); // Vhagar vs huge host + T3 wagon
}

// ═══════════════════════════════════════════════════════════════
// RUN ALL
// ═══════════════════════════════════════════════════════════════

console.log('\n' + '█'.repeat(80));
console.log('  WBS VALIDATION SIMULATION — ALL 8 ITEMS');
console.log('  ' + SIMS + ' simulations per data point');
console.log('█'.repeat(80));

runFleetVsFleet();
runNavalMorale();
runDragonVsFleet();
runFleetWithDragon();
runStrafeValidation();
runRiderSurvival();
runCritBalance();
runSunfyreResim();
runDragonVsArmy();

console.log('\n\n' + '█'.repeat(80));
console.log('  SIMULATION COMPLETE');
console.log('█'.repeat(80) + '\n');
