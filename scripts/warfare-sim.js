/**
 * Warfare Foundation Simulation
 *
 * Simulates the WBS tick-based warfare system from warfare-foundation.md
 * Tests damage divisor tuning, morale, routing, siege fortification balance,
 * and naval combat.
 *
 * Usage: node scripts/warfare-sim.js
 */

// ============================================================
// CONFIGURATION
// ============================================================

const CONFIG = {
  DIVISOR: 75,                // The primary balance knob (/75)
  ENGAGEMENTS_PER_TICK: 4,    // 4-5 based on attacker size
  DICE_SIDES: 6,              // d6 (unified dice system)
  DICE_SUCCESS: 4,            // success on 4+ (50% per die)
  MORALE_CAP: 10,
  MORALE_FLOOR: -10,
  MORALE_DR_PER_POINT: 0.01,    // 1% DR per positive morale
  ROUT_RATE_PER_POINT: 0.005,   // 0.5% per negative morale point
  ADVANTAGE_PER_POINT: 0.03,    // 3% damage per net advantage
  RALLY_RATE_PER_PRESENCE: 0.02, // 2% of routed pool per Presence level
  SIMULATIONS: 1000,
  SEA_COMBAT_PENALTY: 0.25,     // -25% effectiveness at sea
};

// ============================================================
// UNIT TYPES
// ============================================================

const UNIT_TYPES = {
  levy:    { hp: 10, atk: 10, canRout: true,  label: 'Levy' },
  maa:     { hp: 20, atk: 20, canRout: true,  label: 'Men-at-Arms' },
  elite:   { hp: 30, atk: 30, canRout: false, label: 'Elite' },
};

// ============================================================
// ARMY BUILDER
// ============================================================

function createArmy(name, composition, warCouncil, options = {}) {
  const { levy = 0, maa = 0, elite = 0 } = composition;
  const totalMen = levy + maa + elite;
  const totalHP = levy * UNIT_TYPES.levy.hp + maa * UNIT_TYPES.maa.hp + elite * UNIT_TYPES.elite.hp;
  const totalATK = levy * UNIT_TYPES.levy.atk + maa * UNIT_TYPES.maa.atk + elite * UNIT_TYPES.elite.atk;

  return {
    name,
    // Current state
    levy, maa, elite,
    totalMen,
    totalHP,
    currentHP: totalHP,
    startingHP: totalHP,
    totalATK,
    avgATK: totalATK / totalMen,
    morale: 10,
    routedPool: { levy: 0, maa: 0, elite: 0 },

    // War Council (aptitude levels 1-10)
    warlord: warCouncil.command || 5,       // Command - dice pool
    champion: warCouncil.prowess || 5,      // Prowess - +2% dmg/level
    marshal: warCouncil.fortitude || 5,     // Fortitude - -2% incoming/level
    spymaster: warCouncil.cunning || 5,     // Cunning - -2% enemy effectiveness
    quartermaster: warCouncil.stewardship || 5,
    herald: warCouncil.presence || 5,       // Presence - rally + morale
    warMaester: warCouncil.lore || 5,
    warPriest: warCouncil.faith || 5,       // Faith - rout reduction
    siegeMaster: warCouncil.craftsmanship || 1,

    // Options
    advantage: options.advantage || 0,
    isNaval: options.isNaval || false,
    hasDragon: options.hasDragon || false,
    dragonTier: options.dragonTier || 0,
  };
}

// ============================================================
// DICE ROLLING
// ============================================================

function rollDice(count) {
  let successes = 0;
  for (let i = 0; i < count; i++) {
    const roll = Math.floor(Math.random() * CONFIG.DICE_SIDES) + 1;
    if (roll >= CONFIG.DICE_SUCCESS) successes++;
  }
  return successes;
}

// ============================================================
// ARMY STATS RECALCULATION
// ============================================================

function recalcArmy(army) {
  army.totalMen = army.levy + army.maa + army.elite;
  if (army.totalMen <= 0) {
    army.totalMen = 0;
    army.avgATK = 0;
    army.totalATK = 0;
    return;
  }
  army.totalATK = army.levy * UNIT_TYPES.levy.atk + army.maa * UNIT_TYPES.maa.atk + army.elite * UNIT_TYPES.elite.atk;
  army.avgATK = army.totalATK / army.totalMen;
}

// ============================================================
// CASUALTY DISTRIBUTION
// ============================================================

function applyCasualties(army, hpDamage) {
  army.currentHP = Math.max(0, army.currentHP - hpDamage);

  // Distribute casualties proportionally across unit types
  const totalUnitHP = army.levy * UNIT_TYPES.levy.hp + army.maa * UNIT_TYPES.maa.hp + army.elite * UNIT_TYPES.elite.hp;
  if (totalUnitHP <= 0) return;

  // Calculate kills per unit type based on HP damage
  const levyShare = (army.levy * UNIT_TYPES.levy.hp) / totalUnitHP;
  const maaShare = (army.maa * UNIT_TYPES.maa.hp) / totalUnitHP;
  const eliteShare = (army.elite * UNIT_TYPES.elite.hp) / totalUnitHP;

  const levyKills = Math.floor((hpDamage * levyShare) / UNIT_TYPES.levy.hp);
  const maaKills = Math.floor((hpDamage * maaShare) / UNIT_TYPES.maa.hp);
  const eliteKills = Math.floor((hpDamage * eliteShare) / UNIT_TYPES.elite.hp);

  army.levy = Math.max(0, army.levy - levyKills);
  army.maa = Math.max(0, army.maa - maaKills);
  army.elite = Math.max(0, army.elite - eliteKills);

  recalcArmy(army);
}

// ============================================================
// ROUTING
// ============================================================

function applyRouting(army) {
  if (army.morale >= 0) return;

  const routRate = Math.abs(army.morale) * CONFIG.ROUT_RATE_PER_POINT;
  // War Priest reduces rout rate
  const priestReduction = army.warPriest * 0.015;
  const effectiveRate = routRate * (1 - priestReduction);

  // Only Levy and MaA rout, Elites never rout
  const levyRout = Math.floor(army.levy * effectiveRate);
  const maaRout = Math.floor(army.maa * effectiveRate);

  army.levy = Math.max(0, army.levy - levyRout);
  army.maa = Math.max(0, army.maa - maaRout);
  army.routedPool.levy += levyRout;
  army.routedPool.maa += maaRout;

  recalcArmy(army);
}

// ============================================================
// RALLY
// ============================================================

function applyRally(army) {
  const totalRouted = army.routedPool.levy + army.routedPool.maa;
  if (totalRouted <= 0) return;

  const rallyRate = army.herald * CONFIG.RALLY_RATE_PER_PRESENCE;
  const rallyCount = Math.floor(totalRouted * rallyRate);

  if (rallyCount <= 0) return;

  // Rally proportionally
  const levyShare = army.routedPool.levy / totalRouted;
  const levyRally = Math.floor(rallyCount * levyShare);
  const maaRally = rallyCount - levyRally;

  army.routedPool.levy = Math.max(0, army.routedPool.levy - levyRally);
  army.routedPool.maa = Math.max(0, army.routedPool.maa - maaRally);
  army.levy += levyRally;
  army.maa += maaRally;

  recalcArmy(army);
}

// ============================================================
// MORALE UPDATE
// ============================================================

function updateMorale(army, damageDealt, damageTaken, enemyHasDragon, enemyDragonTier) {
  let change = 0;

  // Damage comparison (simplified — one clean check per tick)
  const evenThreshold = 0.10; // within 10% = roughly even
  if (damageTaken > 0 || damageDealt > 0) {
    const ratio = damageDealt / Math.max(1, damageTaken);
    if (ratio >= 2.0) {
      change += 2;  // Dealt significantly more (2:1+)
    } else if (damageDealt > damageTaken * (1 + evenThreshold)) {
      change += 1;  // Dealt more than taken
    } else if (damageTaken >= damageDealt * 2) {
      change -= 2;  // Took significantly more (2:1+)
    } else if (damageTaken > damageDealt * (1 + evenThreshold)) {
      change -= 1;  // Took more than dealt
    }
    // Within 10% = 0 change (roughly even)
  }

  // Situational modifiers (constant per tick while active)
  if (enemyHasDragon) change -= 2;   // Enemy dragon active
  if (army.hasDragon) change += 2;    // Friendly dragon active
  // Supply cut off: -1/tick (would need supply tracking, omitted in sim for now)

  army.morale = Math.max(CONFIG.MORALE_FLOOR, Math.min(CONFIG.MORALE_CAP, army.morale + change));
}

// ============================================================
// ENGAGEMENT RESOLUTION
// ============================================================

function resolveEngagement(attacker, defender, divisor) {
  if (attacker.totalMen <= 0 || defender.totalMen <= 0) return { atkDmg: 0, defDmg: 0 };

  const seaMultAtk = attacker.isNaval ? (1 - CONFIG.SEA_COMBAT_PENALTY) : 1;
  const seaMultDef = defender.isNaval ? (1 - CONFIG.SEA_COMBAT_PENALTY) : 1;

  // === BOTH SIDES CALCULATE SIMULTANEOUSLY (snapshot state) ===

  // Attacker's damage output (based on pre-engagement state)
  const atkSuccesses = rollDice(attacker.warlord);
  let atkBase = atkSuccesses * (attacker.avgATK * attacker.totalMen / divisor) * seaMultAtk;
  const atkChampion = 1 + attacker.champion * 0.02;
  const atkAdvantage = 1 + (attacker.advantage - defender.advantage) * CONFIG.ADVANTAGE_PER_POINT;
  let atkRaw = atkBase * atkChampion * Math.max(0.1, atkAdvantage);

  // Defender's damage output (based on pre-engagement state)
  const defSuccesses = rollDice(defender.warlord);
  let defBase = defSuccesses * (defender.avgATK * defender.totalMen / divisor) * seaMultDef;
  const defChampion = 1 + defender.champion * 0.02;
  const defAdvantage = 1 + (defender.advantage - attacker.advantage) * CONFIG.ADVANTAGE_PER_POINT;
  let defRaw = defBase * defChampion * Math.max(0.1, defAdvantage);

  // === APPLY DEFENDER'S DAMAGE REDUCTION TO ATTACKER'S OUTPUT ===
  const defMarshal = 1 - defender.marshal * 0.02;
  const defSpymaster = 1 - defender.spymaster * 0.02;
  const defMoraleDR = defender.morale > 0 ? 1 - defender.morale * CONFIG.MORALE_DR_PER_POINT : 1;
  const atkFinal = atkRaw * defMarshal * defSpymaster * defMoraleDR;

  // === APPLY ATTACKER'S DAMAGE REDUCTION TO DEFENDER'S OUTPUT ===
  const atkMarshal = 1 - attacker.marshal * 0.02;
  const atkSpymaster = 1 - attacker.spymaster * 0.02;
  const atkMoraleDR = attacker.morale > 0 ? 1 - attacker.morale * CONFIG.MORALE_DR_PER_POINT : 1;
  const defFinal = defRaw * atkMarshal * atkSpymaster * atkMoraleDR;

  // === APPLY DAMAGE SIMULTANEOUSLY (both calculated from pre-engagement state) ===
  applyCasualties(defender, Math.max(0, atkFinal));
  applyCasualties(attacker, Math.max(0, defFinal));

  return { atkDmg: Math.max(0, atkFinal), defDmg: Math.max(0, defFinal) };
}

// ============================================================
// TICK RESOLUTION
// ============================================================

function resolveTick(attacker, defender, divisor, engagements) {
  let totalAtkDmg = 0;
  let totalDefDmg = 0;

  for (let e = 0; e < engagements; e++) {
    if (attacker.totalMen <= 0 || defender.totalMen <= 0) break;

    const { atkDmg, defDmg } = resolveEngagement(attacker, defender, divisor);
    // atkDmg = damage attacker dealt to defender
    // defDmg = damage defender dealt to attacker
    totalAtkDmg += atkDmg;
    totalDefDmg += defDmg;

    // Apply routing per engagement
    applyRouting(attacker);
    applyRouting(defender);
  }

  // End of tick: update morale
  updateMorale(attacker, totalAtkDmg, totalDefDmg, defender.hasDragon, defender.dragonTier);
  updateMorale(defender, totalDefDmg, totalAtkDmg, attacker.hasDragon, attacker.dragonTier);

  // End of tick: rally
  applyRally(attacker);
  applyRally(defender);
}

// ============================================================
// BATTLE SIMULATION
// ============================================================

function simulateBattle(attackerTemplate, defenderTemplate, divisor, engagementsPerTick, maxTicks = 60) {
  const attacker = JSON.parse(JSON.stringify(attackerTemplate));
  const defender = JSON.parse(JSON.stringify(defenderTemplate));

  let tick = 0;
  while (tick < maxTicks && attacker.totalMen > 0 && defender.totalMen > 0) {
    resolveTick(attacker, defender, divisor, engagementsPerTick);
    tick++;
  }

  const attackerSurvival = attacker.totalMen / attackerTemplate.totalMen;
  const defenderSurvival = defender.totalMen / defenderTemplate.totalMen;
  const attackerRouted = attacker.routedPool.levy + attacker.routedPool.maa;
  const defenderRouted = defender.routedPool.levy + defender.routedPool.maa;

  let winner = 'draw';
  if (attacker.totalMen <= 0 && defender.totalMen > 0) winner = defender.name;
  else if (defender.totalMen <= 0 && attacker.totalMen > 0) winner = attacker.name;
  else if (attackerSurvival > defenderSurvival) winner = attacker.name;
  else winner = defender.name;

  return {
    winner,
    ticks: tick,
    attackerSurvival,
    defenderSurvival,
    attackerRemaining: attacker.totalMen,
    defenderRemaining: defender.totalMen,
    attackerRouted,
    defenderRouted,
    attackerMorale: attacker.morale,
    defenderMorale: defender.morale,
  };
}

// ============================================================
// MONTE CARLO
// ============================================================

function monteCarlo(attackerTemplate, defenderTemplate, divisor, engagements, runs = CONFIG.SIMULATIONS) {
  const results = { wins: {}, totalTicks: 0, avgSurvival: {}, avgRouted: {} };
  results.wins[attackerTemplate.name] = 0;
  results.wins[defenderTemplate.name] = 0;
  results.wins['draw'] = 0;
  results.avgSurvival[attackerTemplate.name] = 0;
  results.avgSurvival[defenderTemplate.name] = 0;
  results.avgRouted[attackerTemplate.name] = 0;
  results.avgRouted[defenderTemplate.name] = 0;

  for (let i = 0; i < runs; i++) {
    const r = simulateBattle(attackerTemplate, defenderTemplate, divisor, engagements);
    results.wins[r.winner]++;
    results.totalTicks += r.ticks;
    results.avgSurvival[attackerTemplate.name] += r.attackerSurvival;
    results.avgSurvival[defenderTemplate.name] += r.defenderSurvival;
    results.avgRouted[attackerTemplate.name] += r.attackerRouted;
    results.avgRouted[defenderTemplate.name] += r.defenderRouted;
  }

  results.avgTicks = results.totalTicks / runs;
  results.avgSurvival[attackerTemplate.name] /= runs;
  results.avgSurvival[defenderTemplate.name] /= runs;
  results.avgRouted[attackerTemplate.name] /= runs;
  results.avgRouted[defenderTemplate.name] /= runs;

  return results;
}

// ============================================================
// DISPLAY
// ============================================================

function displayResults(label, attacker, defender, results, runs) {
  console.log(`\n${'='.repeat(70)}`);
  console.log(`  ${label}`);
  console.log(`  ${attacker.name} (${attacker.totalMen} men, AvgATK ${attacker.avgATK.toFixed(1)}, Cmd ${attacker.warlord})`);
  console.log(`  vs`);
  console.log(`  ${defender.name} (${defender.totalMen} men, AvgATK ${defender.avgATK.toFixed(1)}, Cmd ${defender.warlord})`);
  console.log(`${'='.repeat(70)}`);

  const atkWinRate = ((results.wins[attacker.name] / runs) * 100).toFixed(1);
  const defWinRate = ((results.wins[defender.name] / runs) * 100).toFixed(1);
  const drawRate = ((results.wins['draw'] / runs) * 100).toFixed(1);

  console.log(`  Win Rate:     ${attacker.name}: ${atkWinRate}%  |  ${defender.name}: ${defWinRate}%  |  Draw: ${drawRate}%`);
  console.log(`  Avg Duration: ${results.avgTicks.toFixed(1)} ticks (days)`);
  console.log(`  Avg Survival: ${attacker.name}: ${(results.avgSurvival[attacker.name] * 100).toFixed(1)}%  |  ${defender.name}: ${(results.avgSurvival[defender.name] * 100).toFixed(1)}%`);
  console.log(`  Avg Routed:   ${attacker.name}: ${results.avgRouted[attacker.name].toFixed(0)} men  |  ${defender.name}: ${results.avgRouted[defender.name].toFixed(0)} men`);
}

// ============================================================
// SCENARIOS
// ============================================================

function runScenarios() {
  const DIV = CONFIG.DIVISOR;
  const ENG = CONFIG.ENGAGEMENTS_PER_TICK;

  console.log('\n' + '█'.repeat(70));
  console.log('  WARFARE FOUNDATION SIMULATION');
  console.log(`  Dice: d6, success on 4+ (50%) | Divisor: /${DIV} | Engagements/tick: ${ENG}`);
  console.log(`  Simulations per scenario: ${CONFIG.SIMULATIONS}`);
  console.log('█'.repeat(70));

  // Standard War Council templates
  const goodCouncil = { command: 7, prowess: 6, fortitude: 6, cunning: 5, stewardship: 5, presence: 6, lore: 5, faith: 5 };
  const avgCouncil = { command: 5, prowess: 5, fortitude: 5, cunning: 4, stewardship: 4, presence: 4, lore: 4, faith: 4 };

  // -----------------------------------------------------------
  // SCENARIO 1: Equal armies (baseline sanity check)
  // -----------------------------------------------------------
  console.log('\n\n' + '─'.repeat(70));
  console.log('  SCENARIO 1: BASELINE — Equal Armies');
  console.log('─'.repeat(70));

  const equalA = createArmy('Army A', { levy: 2000, maa: 2000, elite: 1000 }, goodCouncil);
  const equalB = createArmy('Army B', { levy: 2000, maa: 2000, elite: 1000 }, goodCouncil);

  const results1 = monteCarlo(equalA, equalB, DIV, ENG);
  displayResults('Equal 5,000 vs 5,000 (Size 3 Military)', equalA, equalB, results1, CONFIG.SIMULATIONS);

  // -----------------------------------------------------------
  // SCENARIO 2: Quality vs Quantity
  // -----------------------------------------------------------
  console.log('\n\n' + '─'.repeat(70));
  console.log('  SCENARIO 2: QUALITY VS QUANTITY');
  console.log('─'.repeat(70));

  const military = createArmy('Military (S3)', { levy: 2000, maa: 2000, elite: 1000 },
    { command: 8, prowess: 7, fortitude: 7, cunning: 6, presence: 6, faith: 5, lore: 5 });
  const civilian = createArmy('Civilian (S3)', { levy: 8000, maa: 1700, elite: 300 },
    { command: 5, prowess: 4, fortitude: 4, cunning: 4, presence: 4, faith: 3, lore: 3 });

  const results2 = monteCarlo(military, civilian, DIV, ENG);
  displayResults('Size 3 Military (5k) vs Size 3 Civilian (10k)', military, civilian, results2, CONFIG.SIMULATIONS);

  // -----------------------------------------------------------
  // SCENARIO 3: WAR COUNCIL QUALITY
  // -----------------------------------------------------------
  console.log('\n\n' + '─'.repeat(70));
  console.log('  SCENARIO 3: WAR COUNCIL QUALITY');
  console.log('─'.repeat(70));

  const eliteCouncil = createArmy('Elite Council', { levy: 2000, maa: 2000, elite: 1000 },
    { command: 10, prowess: 9, fortitude: 9, cunning: 8, presence: 8, faith: 7, lore: 7 });
  const poorCouncil = createArmy('Poor Council', { levy: 2000, maa: 2000, elite: 1000 },
    { command: 3, prowess: 3, fortitude: 3, cunning: 3, presence: 3, faith: 3, lore: 3 });

  const results3 = monteCarlo(eliteCouncil, poorCouncil, DIV, ENG);
  displayResults('Equal Army, Elite Council vs Poor Council', eliteCouncil, poorCouncil, results3, CONFIG.SIMULATIONS);

  // -----------------------------------------------------------
  // SCENARIO 4: DRAGON MORALE IMPACT
  // -----------------------------------------------------------
  console.log('\n\n' + '─'.repeat(70));
  console.log('  SCENARIO 4: DRAGON MORALE IMPACT');
  console.log('─'.repeat(70));

  const dragonArmy = createArmy('Dragon Army', { levy: 2000, maa: 2000, elite: 1000 }, goodCouncil,
    { hasDragon: true, dragonTier: 5 });
  const noDragonArmy = createArmy('No Dragon Army', { levy: 2000, maa: 2000, elite: 1000 }, goodCouncil);

  const results4 = monteCarlo(dragonArmy, noDragonArmy, DIV, ENG);
  displayResults('Equal Armies — One Has Dragon (Morale Only)', dragonArmy, noDragonArmy, results4, CONFIG.SIMULATIONS);

  // -----------------------------------------------------------
  // SCENARIO 5: NAVAL COMBAT
  // -----------------------------------------------------------
  console.log('\n\n' + '─'.repeat(70));
  console.log('  SCENARIO 5: NAVAL COMBAT (-25% Sea Penalty)');
  console.log('─'.repeat(70));

  const fleet1 = createArmy('Fleet Alpha', { levy: 750, maa: 500, elite: 250 }, goodCouncil, { isNaval: true });
  const fleet2 = createArmy('Fleet Beta', { levy: 750, maa: 500, elite: 250 }, goodCouncil, { isNaval: true });

  const results5 = monteCarlo(fleet1, fleet2, DIV, ENG);
  displayResults('Equal Fleets (50 ships each, 1500 crew)', fleet1, fleet2, results5, CONFIG.SIMULATIONS);

  // -----------------------------------------------------------
  // SCENARIO 6: MERCENARIES
  // -----------------------------------------------------------
  console.log('\n\n' + '─'.repeat(70));
  console.log('  SCENARIO 6: MERCENARIES (Gold Company Supplement)');
  console.log('─'.repeat(70));

  const armyWithMercs = createArmy('Army + Gold Co', { levy: 2000, maa: 3000, elite: 2000 },
    { command: 8, prowess: 8, fortitude: 7, cunning: 6, presence: 6, faith: 5, lore: 5 });
  const armyAlone = createArmy('Army Alone', { levy: 2000, maa: 2000, elite: 1000 }, goodCouncil);

  const results6 = monteCarlo(armyWithMercs, armyAlone, DIV, ENG);
  displayResults('5,000 + 2,000 Gold Company vs 5,000 Alone', armyWithMercs, armyAlone, results6, CONFIG.SIMULATIONS);

  // ═══════════════════════════════════════════════════════════
  // SCENARIO 7: SIEGE FORTIFICATION BALANCE (THE KEY TEST)
  // ═══════════════════════════════════════════════════════════
  console.log('\n\n' + '█'.repeat(70));
  console.log('  SIEGE FORTIFICATION BALANCE');
  console.log('  Goal: 3:1 ratio needed to reliably beat fortified defenders');
  console.log('  Defender: 3,500 troops (Size 2 Military), good council');
  console.log('  Fortification advantage = defender advantage points');
  console.log('█'.repeat(70));

  // Defender: Size 2 Military (3,000 manpower) holding a fortress
  // 40% levy, 40% MaA, 20% elite
  const siegeDefender = (fortAdv) => createArmy('Defender', { levy: 1200, maa: 1200, elite: 600 },
    { command: 7, prowess: 6, fortitude: 7, cunning: 5, stewardship: 5, presence: 6, lore: 5, faith: 5 },
    { advantage: fortAdv });

  // Attackers at different ratios (no advantage — they're attacking a fort)
  const siegeAttacker = (mult, name) => {
    const base = 3000;
    const total = Math.round(base * mult);
    // Hybrid composition: 60/28/12
    return createArmy(name, {
      levy: Math.round(total * 0.60),
      maa: Math.round(total * 0.28),
      elite: Math.round(total * 0.12)
    }, { command: 6, prowess: 6, fortitude: 5, cunning: 5, stewardship: 5, presence: 5, lore: 4, faith: 4 },
    { advantage: 0 });
  };

  // Test different fortification advantage values
  for (const fortAdv of [8, 10, 12, 15, 18]) {
    console.log('\n\n' + '─'.repeat(70));
    console.log(`  FORTIFICATION ADVANTAGE: +${fortAdv} (Defender Net: +${fortAdv})`);
    console.log('─'.repeat(70));

    for (const ratio of [1.5, 2, 2.5, 3, 3.5, 4]) {
      const atk = siegeAttacker(ratio, `Attacker ${ratio}:1`);
      const def = siegeDefender(fortAdv);
      const r = monteCarlo(atk, def, DIV, ENG);
      const atkWin = ((r.wins[atk.name] / CONFIG.SIMULATIONS) * 100).toFixed(1);
      const defWin = ((r.wins[def.name] / CONFIG.SIMULATIONS) * 100).toFixed(1);
      console.log(`  ${ratio}:1 (${atk.totalMen} vs ${def.totalMen}):  Attacker ${atkWin}% | Defender ${defWin}% | ${r.avgTicks.toFixed(1)} ticks`);
    }
  }

  // ═══════════════════════════════════════════════════════════
  // SCENARIO 8: SIEGE WITH DRAGONS
  // ═══════════════════════════════════════════════════════════
  console.log('\n\n' + '█'.repeat(70));
  console.log('  SIEGE WITH DRAGON (Morale Only — No Strafe Damage)');
  console.log('  Shows how dragon morale shifts siege balance');
  console.log('█'.repeat(70));

  // Use fortification value of +12 (testing)
  const siegeDefDragon = createArmy('Defender (Fort)', { levy: 1200, maa: 1200, elite: 600 },
    { command: 7, prowess: 6, fortitude: 7, cunning: 5, stewardship: 5, presence: 6, lore: 5, faith: 5 },
    { advantage: 12 });

  for (const ratio of [1.5, 2, 2.5, 3]) {
    const atkDragon = siegeAttacker(ratio, `Attacker ${ratio}:1+Dragon`);
    atkDragon.hasDragon = true;
    atkDragon.dragonTier = 5;
    const def = JSON.parse(JSON.stringify(siegeDefDragon));
    const r = monteCarlo(atkDragon, def, DIV, ENG);
    const atkWin = ((r.wins[atkDragon.name] / CONFIG.SIMULATIONS) * 100).toFixed(1);
    const defWin = ((r.wins[def.name] / CONFIG.SIMULATIONS) * 100).toFixed(1);
    console.log(`  ${ratio}:1 + Dragon:  Attacker ${atkWin}% | Defender ${defWin}% | ${r.avgTicks.toFixed(1)} ticks`);
  }

  // ═══════════════════════════════════════════════════════════
  // ENGAGEMENT COUNT COMPARISON
  // ═══════════════════════════════════════════════════════════
  console.log('\n\n' + '─'.repeat(70));
  console.log('  ENGAGEMENT COUNT COMPARISON (Equal Armies, Divisor /75)');
  console.log('─'.repeat(70));

  for (const eng of [2, 3, 4, 5, 6]) {
    const a = createArmy('Army A', { levy: 2000, maa: 2000, elite: 1000 }, goodCouncil);
    const b = createArmy('Army B', { levy: 2000, maa: 2000, elite: 1000 }, goodCouncil);
    const r = monteCarlo(a, b, DIV, eng);
    console.log(`  ${eng} engagements/tick: A wins ${((r.wins['Army A'] / CONFIG.SIMULATIONS) * 100).toFixed(1)}% | B wins ${((r.wins['Army B'] / CONFIG.SIMULATIONS) * 100).toFixed(1)}% | ${r.avgTicks.toFixed(1)} ticks`);
  }

  // ═══════════════════════════════════════════════════════════
  // SUMMARY
  // ═══════════════════════════════════════════════════════════
  console.log('\n\n' + '█'.repeat(70));
  console.log('  DIVISOR COMPARISON TABLE (4 engagements/tick)');
  console.log('█'.repeat(70));
  console.log('\n  Divisor | Avg Ticks | Avg Survivor % (winner)');
  console.log('  --------+-----------+------------------------');

  for (const divisor of [50, 60, 75, 100, 125, 150]) {
    const a = createArmy('A', { levy: 2000, maa: 2000, elite: 1000 }, goodCouncil);
    const b = createArmy('B', { levy: 2000, maa: 2000, elite: 1000 }, goodCouncil);
    const r = monteCarlo(a, b, divisor, 4);
    const avgSurv = ((r.avgSurvival['A'] + r.avgSurvival['B']) / 2 * 100).toFixed(1);
    console.log(`  /${divisor.toString().padStart(5)}  |  ${r.avgTicks.toFixed(1).padStart(6)}  |  ${avgSurv}%`);
  }
}

// ============================================================
// RUN
// ============================================================

runScenarios();
