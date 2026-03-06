#!/usr/bin/env node
/**
 * WBS Siege Validation Simulation
 *
 * Sections:
 * 1. Siege engine breach pacing (with defender repair rates)
 * 2. Dragon siege strafing with scorpion battery return fire
 * 3. Combined arms siege timeline (dragon + engines + repair + batteries)
 * 4. Starvation & attrition timeline
 *
 * Usage: node scripts/siege-sim.js
 */

const SIMS = 5000;

// ═══════════════════════════════════════════════════════════════
// UTILITIES
// ═══════════════════════════════════════════════════════════════

function pad(s, n) { s = String(s); return s + ' '.repeat(Math.max(0, n - s.length)); }
function padL(s, n) { s = String(s); return ' '.repeat(Math.max(0, n - s.length)) + s; }
function pct(v, total) { return ((v / total) * 100).toFixed(1) + '%'; }
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
// CONSTANTS — SETTLEMENTS
// ═══════════════════════════════════════════════════════════════

// Settlement HP base values (siege-mechanics.md §3.1)
const SETTLEMENT_HP = {
  civilian: { 1: 2000, 2: 4000, 3: 6000 },
  hybrid:   { 1: 2500, 2: 5000, 3: 7500 },
  military: { 1: 3000, 2: 6000, 3: 9000 },
};

// Fortified Walls HP bonus per tier (holdings-system.md §5.2)
const WALL_HP_BONUS = { 0: 0, 1: 500, 2: 1000, 3: 2000, 4: 3500, 5: 5000 };

// Warehouse capacity (food) per settlement size & tier (holdings-system.md §10.1-10.2)
const WAREHOUSE_CAPACITY = {
  1: { 1: 5000, 2: 6250, 3: 7500, 4: 8750, 5: 10000 },
  2: { 1: 10000, 2: 12500, 3: 15000, 4: 17500, 5: 20000 },
  3: { 1: 20000, 2: 25000, 3: 30000, 4: 35000, 5: 40000 },
};

// Food consumption per tick: 100 per 1,000 garrison + 50 flat (siege-mechanics.md §6.1)
function foodPerTick(garrison) {
  return Math.ceil(garrison / 1000) * 100 + 50;
}

// ═══════════════════════════════════════════════════════════════
// CONSTANTS — SIEGE ENGINES
// ═══════════════════════════════════════════════════════════════

// Siege engine damage per tick by tier (siege-mechanics.md §3.3)
const ENGINE_DMG = { 1: 100, 2: 200, 3: 350, 4: 500, 5: 700 };

// Siege engine build time: ~7 ticks base, -0.5 per Craftsmanship above tier minimum
// Craftsmanship required: T1=1-2, T2=3-4, T3=5-6, T4=7-8, T5=9-10
const ENGINE_CRAFT_MIN = { 1: 1, 2: 3, 3: 5, 4: 7, 5: 9 };
function engineBuildTime(engineTier, craftsmanship) {
  const minCraft = ENGINE_CRAFT_MIN[engineTier];
  const bonus = Math.max(0, craftsmanship - minCraft);
  return Math.max(4, 7 - bonus * 0.5);
}

// ═══════════════════════════════════════════════════════════════
// CONSTANTS — DEFENDER REPAIR
// ═══════════════════════════════════════════════════════════════

// Settlement repair rate: 50 base + 15 per Craftsmanship level (siege-mechanics.md §3.6)
function repairRate(craftsmanship) {
  return 50 + craftsmanship * 15;
}

// ═══════════════════════════════════════════════════════════════
// CONSTANTS — SCORPION BATTERIES (anti-dragon only)
// ═══════════════════════════════════════════════════════════════

// Battery stats per tier (siege-mechanics.md §3.5.1)
const BATTERY = {
  1: { bolts: 2, dmgPerBolt: 15 },
  2: { bolts: 3, dmgPerBolt: 20 },
  3: { bolts: 4, dmgPerBolt: 25 },
  4: { bolts: 5, dmgPerBolt: 30 },
  5: { bolts: 6, dmgPerBolt: 40 },
};

// ═══════════════════════════════════════════════════════════════
// CONSTANTS — DRAGONS
// ═══════════════════════════════════════════════════════════════

const DRAGONS = [
  { name: 'Vhagar',       tier: 5, might: 10, agility: 3,  resilience: 10 },
  { name: 'Caraxes',      tier: 5, might: 7,  agility: 9,  resilience: 6 },
  { name: 'Vermithor',    tier: 5, might: 9,  agility: 5,  resilience: 9 },
  { name: 'Meleys',       tier: 5, might: 7,  agility: 10, resilience: 7 },
  { name: 'The Cannibal', tier: 5, might: 8,  agility: 6,  resilience: 8 },
  { name: 'Sunfyre',      tier: 4, might: 6,  agility: 6,  resilience: 6 },
  { name: 'Dreamfyre',    tier: 4, might: 7,  agility: 4,  resilience: 8 },
  { name: 'Silverwing',   tier: 4, might: 7,  agility: 5,  resilience: 8 },
  { name: 'Seasmoke',     tier: 3, might: 5,  agility: 7,  resilience: 5 },
  { name: 'Tessarion',    tier: 2, might: 4,  agility: 7,  resilience: 4 },
  { name: 'Arrax',        tier: 1, might: 2,  agility: 7,  resilience: 2 },
];

// Dragon siege damage: (Tier² × 25) + (Might × 10)
function dragonSiegeDmg(d) {
  return d.tier * d.tier * 25 + d.might * 10;
}

// Dragon HP: (Might + Resilience) × Tier × 5
function dragonHP(d) {
  return (d.might + d.resilience) * d.tier * 5;
}

// Scorpion evasion: max(agility, resilience) — validated in naval sim
function getHitRate(evasionStat) {
  if (evasionStat <= 2) return 0.55;
  if (evasionStat <= 4) return 0.45;
  if (evasionStat <= 6) return 0.35;
  if (evasionStat <= 8) return 0.25;
  return 0.15;
}

function dragonEvasionStat(d) {
  return Math.max(d.agility, d.resilience);
}

// ═══════════════════════════════════════════════════════════════
// 1. SIEGE ENGINE BREACH PACING (with repair)
// ═══════════════════════════════════════════════════════════════

function runSiegeEnginePacing() {
  banner('1. SIEGE ENGINE BREACH PACING (with Defender Repair)');
  console.log('  Engine damage per tick: T1=100, T2=200, T3=350, T4=500, T5=700');
  console.log('  Repair rate: 50 base + 15 per Craftsmanship level (max 200 at Craft 10)');
  console.log('  Build time: 7 ticks base, -0.5 per Craft above tier minimum (min 4)');

  // ── Net damage per tick (engine minus repair) ──
  section('Net Damage/Tick (Engine Damage − Repair Rate)');
  console.log('  Positive = siege progressing | Negative = defenders out-repairing');
  console.log('');
  console.log('  ' + pad('', 18) + padL('Craft 0', 10) + padL('Craft 3', 10) +
    padL('Craft 5', 10) + padL('Craft 7', 10) + padL('Craft 10', 10));
  console.log('  ' + pad('', 18) + padL('(50/t)', 10) + padL('(95/t)', 10) +
    padL('(125/t)', 10) + padL('(155/t)', 10) + padL('(200/t)', 10));
  console.log('  ' + '─'.repeat(68));

  for (const [tier, dmg] of Object.entries(ENGINE_DMG)) {
    let row = '  ' + pad('T' + tier + ' Engine (' + dmg + '/t)', 18);
    for (const craft of [0, 3, 5, 7, 10]) {
      const repair = repairRate(craft);
      const net = dmg - repair;
      const label = net > 0 ? '+' + net : String(net);
      row += padL(label, 10);
    }
    console.log(row);
  }

  // ── Breach timelines (including build time + bombardment) ──
  section('Total Siege Duration: Build Time + Bombardment (ticks to breach)');
  console.log('  Includes 7-tick build delay. "never" = repair outpaces engine damage.');
  console.log('');

  const targets = [
    { label: 'Civilian S1, no walls',   hp: 2000 },
    { label: 'Military S1, T1 walls',   hp: 3000 + 500 },
    { label: 'Military S2, T3 walls',   hp: 6000 + 2000 },
    { label: 'Military S3, T3 walls',   hp: 9000 + 2000 },
    { label: 'Military S3, T5 walls',   hp: 9000 + 5000 },
    { label: 'Storm\'s End (16k)',       hp: 16000 },
  ];

  console.log('  ' + pad('Target', 28) + padL('HP', 7) +
    padL('T1 eng', 10) + padL('T2 eng', 10) + padL('T3 eng', 10) +
    padL('T5 eng', 10));

  // Test with defender Craftsmanship 5 (typical)
  console.log('  ' + pad('', 28) + padL('', 7) +
    padL('Craft 5 defender (125/t repair)', 40));
  console.log('  ' + '─'.repeat(75));

  const defCraft = 5;
  const defRepair = repairRate(defCraft);

  for (const t of targets) {
    let row = '  ' + pad(t.label, 28) + padL(t.hp, 7);
    for (const eTier of [1, 2, 3, 5]) {
      const eDmg = ENGINE_DMG[eTier];
      const net = eDmg - defRepair;
      if (net <= 0) {
        row += padL('never', 10);
      } else {
        const bombardTicks = Math.ceil(t.hp / net);
        const buildTime = Math.ceil(engineBuildTime(eTier, defCraft));
        const total = buildTime + bombardTicks;
        row += padL(total + 't', 10);
      }
    }
    console.log(row);
  }

  // Also show with no Siege Master (Craft 0)
  console.log('');
  console.log('  ' + pad('', 28) + padL('', 7) +
    padL('No Siege Master (50/t repair)', 40));
  console.log('  ' + '─'.repeat(75));

  const noRepair = repairRate(0);

  for (const t of targets) {
    let row = '  ' + pad(t.label, 28) + padL(t.hp, 7);
    for (const eTier of [1, 2, 3, 5]) {
      const eDmg = ENGINE_DMG[eTier];
      const net = eDmg - noRepair;
      if (net <= 0) {
        row += padL('never', 10);
      } else {
        const bombardTicks = Math.ceil(t.hp / net);
        // Attacker Craftsmanship = tier minimum (worst case build time)
        const buildTime = 7;
        const total = buildTime + bombardTicks;
        row += padL(total + 't', 10);
      }
    }
    console.log(row);
  }

  // Also show with max Siege Master (Craft 10)
  console.log('');
  console.log('  ' + pad('', 28) + padL('', 7) +
    padL('Max Siege Master (200/t repair)', 40));
  console.log('  ' + '─'.repeat(75));

  const maxRepair = repairRate(10);

  for (const t of targets) {
    let row = '  ' + pad(t.label, 28) + padL(t.hp, 7);
    for (const eTier of [1, 2, 3, 5]) {
      const eDmg = ENGINE_DMG[eTier];
      const net = eDmg - maxRepair;
      if (net <= 0) {
        row += padL('never', 10);
      } else {
        const bombardTicks = Math.ceil(t.hp / net);
        const buildTime = 7;
        const total = buildTime + bombardTicks;
        row += padL(total + 't', 10);
      }
    }
    console.log(row);
  }
}

// ═══════════════════════════════════════════════════════════════
// 2. DRAGON SIEGE STRAFING (with battery return fire)
// ═══════════════════════════════════════════════════════════════

function simDragonSiege(dragon, batteries, settlementHP, defCraft) {
  // Dragon strafes walls each tick. Batteries fire back at dragon.
  // Dragon withdraws at 30% HP. Repair applies each tick.
  const hp = dragonHP(dragon);
  const siegeDmg = dragonSiegeDmg(dragon);
  const withdrawHP = hp * 0.30;
  const evasion = dragonEvasionStat(dragon);
  const hitRate = getHitRate(evasion);
  const repair = repairRate(defCraft);

  let dragonHp = hp;
  let wallHP = settlementHP;
  let tick = 0;
  let dragonDied = false;
  let dragonWithdrew = false;

  while (tick < 200 && dragonHp > 0 && wallHP > 0) {
    tick++;

    // Dragon withdrawal check
    if (dragonHp <= withdrawHP) {
      dragonWithdrew = true;
      break;
    }

    // Dragon strafes walls
    wallHP = Math.max(0, wallHP - siegeDmg);
    if (wallHP <= 0) break;

    // Defender repairs
    wallHP = Math.min(settlementHP, wallHP + repair);

    // Batteries fire at dragon
    for (const bat of batteries) {
      const b = BATTERY[bat];
      for (let i = 0; i < b.bolts; i++) {
        if (Math.random() < hitRate) {
          dragonHp -= b.dmgPerBolt;
        }
      }
    }

    if (dragonHp <= 0) {
      dragonDied = true;
      break;
    }
  }

  return {
    tick, dragonDied, dragonWithdrew,
    dragonHpPct: Math.max(0, dragonHp) / hp * 100,
    wallHPRemaining: Math.max(0, wallHP),
    wallDmgDealt: settlementHP - Math.max(0, wallHP),
    breached: wallHP <= 0,
  };
}

function runDragonSiege() {
  banner('2. DRAGON SIEGE STRAFING (with Battery Return Fire)');
  console.log('  Dragon siege dmg: (Tier² × 25) + (Might × 10)');
  console.log('  Scorpion evasion: max(agility, resilience) — same as naval');
  console.log('  Batteries are ANTI-DRAGON ONLY (do not target siege engines)');
  console.log('  Dragon withdraws at 30% HP. Defender repairs each tick.');
  console.log('  ' + SIMS + ' sims per matchup\n');

  // Show dragon siege stats
  console.log('  Dragon Siege Stats:');
  console.log('  ' + pad('Dragon', 16) + padL('Tier', 5) + padL('HP', 5) +
    padL('Siege Dmg', 10) + padL('Evasion', 8) + padL('Hit Rate', 9));
  for (const d of DRAGONS) {
    console.log('  ' + pad(d.name, 16) + padL('T' + d.tier, 5) + padL(dragonHP(d), 5) +
      padL(dragonSiegeDmg(d), 10) + padL(dragonEvasionStat(d), 8) +
      padL((getHitRate(dragonEvasionStat(d)) * 100).toFixed(0) + '%', 9));
  }

  // ── Dragon vs settlement with various battery configs ──
  section('Dragon Siege Survivability (' + SIMS + ' sims each)');
  console.log('  Target: Military S2 + T3 walls (8,000 HP), Craftsmanship 5 defender (125/t repair)');
  console.log('  Net dragon siege damage = siege dmg - 125 repair');
  console.log('');

  const targetHP = 6000 + 2000; // Military S2 + T3 walls
  const defCraft = 5;

  const batteryConfigs = [
    { label: 'No batteries', batteries: [] },
    { label: '1× T3 battery', batteries: [3] },
    { label: '1× T5 battery', batteries: [5] },
    { label: '2× T3 battery', batteries: [3, 3] },
    { label: '2× T5 battery', batteries: [5, 5] },
    { label: '3× T5 battery', batteries: [5, 5, 5] },
  ];

  for (const config of batteryConfigs) {
    console.log('\n  ┌─ Battery Config: ' + config.label);

    // Calculate expected battery damage per tick
    let totalBolts = 0, totalBatDmg = 0;
    for (const bt of config.batteries) {
      totalBolts += BATTERY[bt].bolts;
      totalBatDmg += BATTERY[bt].bolts * BATTERY[bt].dmgPerBolt;
    }
    if (totalBolts > 0) {
      console.log('  │  Bolts/tick: ' + totalBolts + ' | Max damage/tick: ' + totalBatDmg);
    }

    console.log('  │');
    console.log('  │  ' + pad('Dragon', 16) +
      padL('Breaches?', 10) + padL('Survives', 10) + padL('Killed', 8) +
      padL('Withdrew', 10) + padL('Avg Ticks', 10) +
      padL('Wall Dmg', 10) + padL('Net Dmg/t', 10));

    const testDragons = ['Vhagar', 'Caraxes', 'Vermithor', 'Sunfyre', 'Seasmoke', 'Arrax'];
    for (const dname of testDragons) {
      const d = DRAGONS.find(x => x.name === dname);
      let breaches = 0, kills = 0, withdraws = 0, survives = 0;
      let totalTicks = 0, totalWallDmg = 0;

      for (let i = 0; i < SIMS; i++) {
        const r = simDragonSiege(d, config.batteries, targetHP, defCraft);
        if (r.breached) breaches++;
        if (r.dragonDied) kills++;
        else if (r.dragonWithdrew) withdraws++;
        else survives++;
        totalTicks += r.tick;
        totalWallDmg += r.wallDmgDealt;
      }

      // "Survives" = breached walls AND dragon still alive
      const avgTicks = (totalTicks / SIMS).toFixed(1);
      const avgWallDmg = Math.round(totalWallDmg / SIMS);
      const netPerTick = (totalWallDmg / totalTicks).toFixed(0);

      console.log('  │  ' + pad(d.name, 16) +
        padL(pct(breaches, SIMS), 10) + padL(pct(SIMS - kills - withdraws, SIMS), 10) +
        padL(pct(kills, SIMS), 8) + padL(pct(withdraws, SIMS), 10) +
        padL(avgTicks, 10) + padL(avgWallDmg + '/' + targetHP, 10) +
        padL(netPerTick, 10));
    }
    console.log('  └─');
  }

  // ── Verbose trace: Vhagar vs Military S2 + T3 walls, 1× T5 battery ──
  section('Verbose: Vhagar vs Military S2/T3 walls (8,000 HP), 1× T5 battery, Craft 5 repair');

  const vhagar = DRAGONS.find(d => d.name === 'Vhagar');
  const hp = dragonHP(vhagar);
  const siegeDmg = dragonSiegeDmg(vhagar);
  const withdrawHP = hp * 0.30;
  const evasion = dragonEvasionStat(vhagar);
  const hitRate = getHitRate(evasion);
  const repair = repairRate(defCraft);
  const bat = BATTERY[5];

  let dHp = hp;
  let wHP = targetHP;

  console.log('  Vhagar: ' + hp + ' HP, ' + siegeDmg + ' siege dmg/tick, withdraws at ≤' + Math.floor(withdrawHP) + ' HP');
  console.log('  Battery: T5 (' + bat.bolts + ' bolts × ' + bat.dmgPerBolt + ' dmg, ' + (hitRate * 100).toFixed(0) + '% hit rate)');
  console.log('  Repair: ' + repair + '/tick');
  console.log('');
  console.log('  ' + pad('Tick', 6) + pad('Action', 55) + padL('Dragon HP', 12) + padL('Wall HP', 10));
  console.log('  ' + '─'.repeat(83));

  for (let tick = 1; tick <= 50 && dHp > 0 && wHP > 0; tick++) {
    if (dHp <= withdrawHP) {
      console.log('  ' + pad(tick, 6) + pad('>>> Dragon withdraws — HP too low', 55) +
        padL(Math.floor(dHp) + '/' + hp, 12) + padL(Math.floor(wHP) + '/' + targetHP, 10));
      break;
    }

    // Dragon strafes
    wHP = Math.max(0, wHP - siegeDmg);
    let action = 'Vhagar strafes walls → -' + siegeDmg + ' HP';

    if (wHP <= 0) {
      console.log('  ' + pad(tick, 6) + pad(action + ' → WALLS BREACHED', 55) +
        padL(Math.floor(dHp) + '/' + hp, 12) + padL('0/' + targetHP, 10));
      break;
    }

    // Repair
    const preRepair = wHP;
    wHP = Math.min(targetHP, wHP + repair);
    action += ', repair +' + Math.round(wHP - preRepair);

    // Battery fires
    let hits = 0, batDmg = 0;
    for (let b = 0; b < bat.bolts; b++) {
      if (Math.random() < hitRate) {
        hits++;
        batDmg += bat.dmgPerBolt;
        dHp -= bat.dmgPerBolt;
      }
    }

    console.log('  ' + pad(tick, 6) + pad(action, 55) +
      padL(Math.floor(dHp) + '/' + hp, 12) + padL(Math.floor(wHP) + '/' + targetHP, 10));

    if (hits > 0) {
      console.log('  ' + pad('', 6) + pad('  Battery: ' + bat.bolts + ' bolts, ' + hits + ' hit → ' + batDmg + ' dmg to dragon', 55) +
        padL('', 12) + padL('', 10));
    }

    if (dHp <= 0) {
      console.log('  ' + pad('', 6) + pad('  >>> DRAGON KILLED', 55));
      break;
    }
  }
}

// ═══════════════════════════════════════════════════════════════
// 3. COMBINED ARMS SIEGE TIMELINE
// ═══════════════════════════════════════════════════════════════

function simCombinedSiege(dragon, batteries, engineTier, atkCraft, defCraft, settlementHP) {
  // Phase 1: Dragon strafes alone while engines build (ticks 1-N)
  // Phase 2: Dragon + engines combined (tick N+1 onward)
  // Batteries fire at dragon each tick. Repair each tick.

  const hp = dragonHP(dragon);
  const siegeDmg = dragonSiegeDmg(dragon);
  const withdrawHP = hp * 0.30;
  const evasion = dragonEvasionStat(dragon);
  const hitRate = getHitRate(evasion);
  const repair = repairRate(defCraft);
  const eDmg = ENGINE_DMG[engineTier];
  const buildTime = Math.ceil(engineBuildTime(engineTier, atkCraft));

  let dragonHp = hp;
  let wallHP = settlementHP;
  let dragonActive = true;
  let tick = 0;

  while (tick < 200 && wallHP > 0) {
    tick++;

    // Dragon strafe (if active)
    if (dragonActive) {
      if (dragonHp <= withdrawHP) {
        dragonActive = false;
      } else {
        wallHP = Math.max(0, wallHP - siegeDmg);
        if (wallHP <= 0) break;
      }
    }

    // Engine damage (after build time)
    if (tick > buildTime) {
      wallHP = Math.max(0, wallHP - eDmg);
      if (wallHP <= 0) break;
    }

    // Repair
    wallHP = Math.min(settlementHP, wallHP + repair);

    // Batteries fire at dragon (if active)
    if (dragonActive) {
      for (const bt of batteries) {
        const b = BATTERY[bt];
        for (let i = 0; i < b.bolts; i++) {
          if (Math.random() < hitRate) {
            dragonHp -= b.dmgPerBolt;
          }
        }
      }
      if (dragonHp <= 0) dragonActive = false;
    }

    // If no dragon and no engines yet, skip forward
    if (!dragonActive && tick <= buildTime) {
      // Jump to engine build completion
      wallHP = Math.min(settlementHP, wallHP); // already repaired above
      // Actually let repair accumulate, but wall can't exceed max
      // Just let the loop continue — it's fast enough
    }
  }

  return { tick, breached: wallHP <= 0, dragonActive, dragonHp: Math.max(0, dragonHp) };
}

function runCombinedSiege() {
  banner('3. COMBINED ARMS SIEGE TIMELINE');
  console.log('  Dragon strafes from tick 1. Engines fire after build time.');
  console.log('  Batteries fire at dragon (anti-dragon only). Defender repairs each tick.');
  console.log('  ' + SIMS + ' sims per scenario\n');

  const scenarios = [
    // [dragon, engineTier, atkCraft, defCraft, batteries, settlementHP, label]
    { dragon: 'Vhagar', engine: 3, atkCraft: 6, defCraft: 5, batteries: [5], hp: 8000,  label: 'Vhagar + T3 eng vs Mil S2/T3 walls (8k), 1×T5 bat' },
    { dragon: 'Vhagar', engine: 5, atkCraft: 10, defCraft: 5, batteries: [5], hp: 8000, label: 'Vhagar + T5 eng vs Mil S2/T3 walls (8k), 1×T5 bat' },
    { dragon: 'Vhagar', engine: 5, atkCraft: 10, defCraft: 10, batteries: [5, 5], hp: 14000, label: 'Vhagar + T5 eng vs Mil S3/T5 walls (14k), 2×T5 bat' },
    { dragon: 'Vhagar', engine: 5, atkCraft: 10, defCraft: 10, batteries: [5, 5, 5], hp: 16000, label: 'Vhagar + T5 eng vs Storm\'s End (16k), 3×T5 bat' },
    { dragon: 'Caraxes', engine: 3, atkCraft: 6, defCraft: 5, batteries: [5], hp: 8000, label: 'Caraxes + T3 eng vs Mil S2/T3 walls (8k), 1×T5 bat' },
    { dragon: 'Caraxes', engine: 5, atkCraft: 10, defCraft: 10, batteries: [5, 5], hp: 14000, label: 'Caraxes + T5 eng vs Mil S3/T5 walls (14k), 2×T5 bat' },
    { dragon: 'Sunfyre', engine: 3, atkCraft: 6, defCraft: 5, batteries: [3], hp: 8000, label: 'Sunfyre + T3 eng vs Mil S2/T3 walls (8k), 1×T3 bat' },
    { dragon: 'Seasmoke', engine: 3, atkCraft: 6, defCraft: 5, batteries: [3], hp: 8000, label: 'Seasmoke + T3 eng vs Mil S2/T3 walls (8k), 1×T3 bat' },
  ];

  // Also test engines-only (no dragon) for comparison
  const engineOnlyScenarios = [
    { engine: 3, atkCraft: 6, defCraft: 5, hp: 8000, label: 'T3 engine only vs Mil S2/T3 walls (8k), Craft 5 def' },
    { engine: 5, atkCraft: 10, defCraft: 5, hp: 8000, label: 'T5 engine only vs Mil S2/T3 walls (8k), Craft 5 def' },
    { engine: 5, atkCraft: 10, defCraft: 10, hp: 14000, label: 'T5 engine only vs Mil S3/T5 walls (14k), Craft 10 def' },
    { engine: 5, atkCraft: 10, defCraft: 10, hp: 16000, label: 'T5 engine only vs Storm\'s End (16k), Craft 10 def' },
  ];

  // Engine-only baselines
  section('Engine-Only Baselines (no dragon)');
  console.log('  ' + pad('Scenario', 62) + padL('Breach?', 10) + padL('Total Ticks', 12));

  for (const s of engineOnlyScenarios) {
    const eDmg = ENGINE_DMG[s.engine];
    const repair = repairRate(s.defCraft);
    const net = eDmg - repair;
    const buildTime = Math.ceil(engineBuildTime(s.engine, s.atkCraft));
    if (net <= 0) {
      console.log('  ' + pad(s.label, 62) + padL('never', 10) + padL('—', 12));
    } else {
      const bombardTicks = Math.ceil(s.hp / net);
      const total = buildTime + bombardTicks;
      console.log('  ' + pad(s.label, 62) + padL('yes', 10) + padL(total + 't', 12));
    }
  }

  // Dragon + engine combined
  section('Dragon + Engine Combined (' + SIMS + ' sims each)');
  console.log('  ' + pad('Scenario', 62) +
    padL('Avg Ticks', 10) + padL('Breach%', 10) + padL('Dragon OK', 10));

  for (const s of scenarios) {
    const d = DRAGONS.find(x => x.name === s.dragon);
    let totalTicks = 0, breaches = 0, dragonOK = 0;

    for (let i = 0; i < SIMS; i++) {
      const r = simCombinedSiege(d, s.batteries, s.engine, s.atkCraft, s.defCraft, s.hp);
      totalTicks += r.tick;
      if (r.breached) breaches++;
      if (r.dragonActive) dragonOK++;
    }

    console.log('  ' + pad(s.label, 62) +
      padL((totalTicks / SIMS).toFixed(1), 10) + padL(pct(breaches, SIMS), 10) +
      padL(pct(dragonOK, SIMS), 10));
  }

  // ── Verbose combined timeline: Vhagar + T3 engine vs 8k HP, 1×T5 battery ──
  section('Verbose: Vhagar + T3 Engine vs Mil S2/T3 walls (8k HP), 1×T5 battery');

  const vhagar = DRAGONS.find(d => d.name === 'Vhagar');
  const vHP = dragonHP(vhagar);
  const vSiege = dragonSiegeDmg(vhagar);
  const vWithdraw = vHP * 0.30;
  const vEvasion = dragonEvasionStat(vhagar);
  const vHitRate = getHitRate(vEvasion);
  const engineDmg = ENGINE_DMG[3];
  const buildTime = Math.ceil(engineBuildTime(3, 6));
  const repair = repairRate(5);
  const bat = BATTERY[5];
  const wallMax = 8000;

  let dHp = vHP;
  let wHP = wallMax;
  let dActive = true;

  console.log('  Vhagar: ' + vHP + ' HP, ' + vSiege + ' siege/tick | T3 Engine: ' + engineDmg + '/tick (builds in ' + buildTime + ' ticks)');
  console.log('  Battery: T5 (' + bat.bolts + '×' + bat.dmgPerBolt + ', ' + (vHitRate * 100).toFixed(0) + '% hit) | Repair: ' + repair + '/tick');
  console.log('');
  console.log('  ' + pad('Tick', 6) + padL('Phase', 8) + padL('Dragon HP', 12) + padL('Wall HP', 12) + pad('  Events', 50));
  console.log('  ' + '─'.repeat(88));

  for (let tick = 1; tick <= 50 && wHP > 0; tick++) {
    let events = [];

    // Dragon strafe
    if (dActive) {
      if (dHp <= vWithdraw) {
        dActive = false;
        events.push('Dragon withdraws');
      } else {
        wHP = Math.max(0, wHP - vSiege);
        events.push('Strafe -' + vSiege);
        if (wHP <= 0) {
          console.log('  ' + pad(tick, 6) + padL(tick <= buildTime ? 'Dragon' : 'Combined', 8) +
            padL(dActive ? Math.floor(dHp) : 'OUT', 12) + padL(0, 12) +
            '  ' + events.join('; ') + '; WALLS BREACHED');
          break;
        }
      }
    }

    // Engine damage
    if (tick > buildTime) {
      wHP = Math.max(0, wHP - engineDmg);
      events.push('Engine -' + engineDmg);
      if (tick === buildTime + 1) events[events.length - 1] += ' (BUILT)';
      if (wHP <= 0) {
        console.log('  ' + pad(tick, 6) + padL('Combined', 8) +
          padL(dActive ? Math.floor(dHp) : 'OUT', 12) + padL(0, 12) +
          '  ' + events.join('; ') + '; WALLS BREACHED');
        break;
      }
    }

    // Repair
    const preRepair = wHP;
    wHP = Math.min(wallMax, wHP + repair);
    if (wHP > preRepair) events.push('Repair +' + Math.round(wHP - preRepair));

    // Battery fires
    if (dActive) {
      let hits = 0, dmg = 0;
      for (let b = 0; b < bat.bolts; b++) {
        if (Math.random() < vHitRate) { hits++; dmg += bat.dmgPerBolt; dHp -= bat.dmgPerBolt; }
      }
      if (hits > 0) events.push('Battery ' + hits + '/' + bat.bolts + ' hit → -' + dmg);
      if (dHp <= 0) { dActive = false; events.push('DRAGON KILLED'); }
    }

    const phase = tick <= buildTime ? (dActive ? 'Dragon' : 'Wait') : 'Combined';
    console.log('  ' + pad(tick, 6) + padL(phase, 8) +
      padL(dActive ? Math.floor(dHp) : 'OUT', 12) + padL(Math.floor(wHP), 12) +
      '  ' + events.join('; '));
  }
}

// ═══════════════════════════════════════════════════════════════
// 4. STARVATION & ATTRITION TIMELINE
// ═══════════════════════════════════════════════════════════════

function runStarvation() {
  banner('4. STARVATION & ATTRITION TIMELINE');
  console.log('  Food consumption: 100 per 1,000 garrison + 50 flat per tick');
  console.log('  Manpower bleed: 2%/tick (ticks 1-4), 3%/tick (5-9), 5%/tick (10+)');
  console.log('  No sortie, no assault — pure attrition siege\n');

  const siegeTargets = [
    { label: 'Military S1, 1.5k garrison, T1 warehouse',  garrison: 1500, food: 5000 },
    { label: 'Military S1, 1.5k garrison, T5 warehouse',  garrison: 1500, food: 10000 },
    { label: 'Military S3, 5k garrison, T1 warehouse',    garrison: 5000, food: 20000 },
    { label: 'Military S3, 5k garrison, T5 warehouse',    garrison: 5000, food: 40000 },
    { label: 'Civilian S3, 10k garrison, T1 warehouse',   garrison: 10000, food: 20000 },
    { label: 'Civilian S3, 10k garrison, T5 warehouse',   garrison: 10000, food: 40000 },
    { label: 'Mil S3 + extra garrison (10k), T5 warehouse', garrison: 10000, food: 40000 },
  ];

  console.log('  ' + pad('Scenario', 52) + padL('Food/Tick', 10) + padL('Starve @', 10) +
    padL('Surrender @', 12) + padL('Total', 8));
  console.log('  ' + '─'.repeat(92));

  for (const t of siegeTargets) {
    const consumption = foodPerTick(t.garrison);
    const starveTick = Math.ceil(t.food / consumption);

    // Simulate manpower bleed after food = 0
    let garrison = t.garrison;
    let bleedTick = 0;
    while (garrison > 0) {
      bleedTick++;
      let bleedRate;
      if (bleedTick <= 4) bleedRate = 0.02;
      else if (bleedTick <= 9) bleedRate = 0.03;
      else bleedRate = 0.05;
      garrison = Math.max(0, garrison - Math.ceil(t.garrison * bleedRate));
    }

    const totalTicks = starveTick + bleedTick;

    console.log('  ' + pad(t.label, 52) +
      padL(consumption + '/t', 10) + padL('tick ' + starveTick, 10) +
      padL('tick +' + bleedTick, 12) + padL(totalTicks + 't', 8));
  }

  // Verbose: Military S3, 5k garrison, T3 warehouse (30k food)
  section('Verbose: Military S3, 5,000 garrison, T3 warehouse (30,000 food)');

  const garrison = 5000;
  const food = 30000;
  const consumption = foodPerTick(garrison);

  console.log('  Food consumption: ' + consumption + '/tick');
  console.log('  Starvation begins at tick ' + Math.ceil(food / consumption));
  console.log('');

  let currentFood = food;
  let currentGarrison = garrison;
  let starveTicks = 0;
  let tick = 0;

  console.log('  ' + pad('Tick', 6) + padL('Food', 8) + padL('Garrison', 10) + padL('Morale Pen', 11) + padL('ATK/HP Pen', 11) + pad('  Phase', 30));
  console.log('  ' + '─'.repeat(76));

  // Print every 5 ticks during food phase, then every tick during bleed
  while (currentGarrison > 0 && tick < 200) {
    tick++;

    let phase = '';
    let moralePen = 0;
    let combatPen = '';

    if (currentFood > 0) {
      currentFood = Math.max(0, currentFood - consumption);
      if (currentFood <= food * 0.50 && currentFood > 0) {
        moralePen = -2;
        phase = 'Hungry (food <50%)';
      } else if (currentFood <= 0) {
        moralePen = -5;
        combatPen = '-10%';
        phase = 'FOOD DEPLETED';
      } else {
        phase = 'Siege continues';
      }
    } else {
      starveTicks++;
      let bleedRate;
      if (starveTicks <= 4) { bleedRate = 0.02; moralePen = -7; combatPen = '-15%'; phase = 'Starvation (early)'; }
      else if (starveTicks <= 9) { bleedRate = 0.03; moralePen = -10; combatPen = '-25%'; phase = 'Starvation (severe)'; }
      else { bleedRate = 0.05; moralePen = -10; combatPen = '-25%'; phase = 'Starvation (critical)'; }
      const lost = Math.ceil(garrison * bleedRate);
      currentGarrison = Math.max(0, currentGarrison - lost);
      if (currentGarrison <= 0) phase = 'AUTO-SURRENDER';
    }

    // Print at milestones or every 5 ticks during food, every 2 ticks during bleed
    const isMilestone = (currentFood > 0 && (tick % 5 === 0 || tick === 1 || currentFood <= 0)) ||
                        (currentFood <= 0 && (starveTicks <= 1 || starveTicks % 2 === 0 || currentGarrison <= 0));
    if (isMilestone) {
      console.log('  ' + pad(tick, 6) +
        padL(currentFood, 8) + padL(currentGarrison, 10) +
        padL(moralePen ? String(moralePen) : '—', 11) +
        padL(combatPen || '—', 11) +
        '  ' + phase);
    }
  }

  // Port siege comparison
  section('Port Settlement Under Partial Siege (land only, no blockade)');
  console.log('  Port settlements with land siege only: production -50%, food does NOT deplete');
  console.log('  Full siege requires naval blockade — without it, the siege grinds indefinitely');
  console.log('  This means attackers MUST bring a fleet to siege coastal settlements effectively');
  console.log('');
  console.log('  Without blockade: Attacker must rely on siege engines to breach walls');
  console.log('  With blockade:    Normal starvation timeline applies');
}

// ═══════════════════════════════════════════════════════════════
// RUN ALL
// ═══════════════════════════════════════════════════════════════

console.log('\n' + '█'.repeat(80));
console.log('  WBS SIEGE VALIDATION SIMULATION');
console.log('  ' + SIMS + ' simulations per data point');
console.log('█'.repeat(80));

runSiegeEnginePacing();
runDragonSiege();
runCombinedSiege();
runStarvation();

console.log('\n\n' + '█'.repeat(80));
console.log('  SIEGE SIMULATION COMPLETE');
console.log('█'.repeat(80) + '\n');
