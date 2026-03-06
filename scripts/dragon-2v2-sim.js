// ═══════════════════════════════════════════════════════════════════════════
//  DRAGON 2v2 COMBAT SIMULATOR
//  Vhagar + The Cannibal  vs  Caraxes + Meleys
// ═══════════════════════════════════════════════════════════════════════════

const SIMULATIONS = 1000;

// ── Dragon Definitions ───────────────────────────────────────────────────

// Equal riders: all four dragons get identical P6/Co6/Cu6/F6 riders (+3 Strike, +3 Evasion)
const EQUAL_RIDER = { prowess: 6, command: 6, cunning: 6, fortitude: 6 };

const RAW = {
  vhagar:   { name: 'Vhagar',       tier: 5, might: 10, agility: 3,  ferocity: 10, resilience: 10, rider: { name: 'Rider A', ...EQUAL_RIDER } },
  caraxes:  { name: 'Caraxes',      tier: 5, might: 7,  agility: 9,  ferocity: 10, resilience: 6,  rider: { name: 'Rider B', ...EQUAL_RIDER } },
  meleys:   { name: 'Meleys',       tier: 5, might: 7,  agility: 10, ferocity: 8,  resilience: 7,  rider: { name: 'Rider C', ...EQUAL_RIDER } },
  cannibal: { name: 'The Cannibal', tier: 5, might: 8,  agility: 6,  ferocity: 10, resilience: 8,  rider: { name: 'Rider D', ...EQUAL_RIDER } },
};

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
    riderName:    d.rider ? d.rider.name : '(wild)',
  };
}

const D = {};
for (const [k, v] of Object.entries(RAW)) D[k] = derive(v);

// ── Dice Mechanics ───────────────────────────────────────────────────────

function rollPool(n) {
  let s = 0;
  for (let i = 0; i < n; i++) {
    if (Math.floor(Math.random() * 10) + 1 >= 6) s++;
  }
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
  const f = rollPool(Math.max(0, fleeAgi - fleePen));
  const p = rollPool(Math.max(0, pursueAgi - pursuePen));
  return f > p;
}

// ── Targeting AI ─────────────────────────────────────────────────────────
// Focus fire: target enemy with lowest current HP to eliminate them fast
// and gain the numbers advantage. If HP is tied, target the one with
// higher Strike (bigger threat).

// ── Targeting Strategies ─────────────────────────────────────────────────

// Default: focus enemy with lowest HP%
function targetLowestHp(attacker, enemies) {
  return enemies.reduce((best, e) => {
    const bestPct = best.hp / best.maxHp;
    const ePct    = e.hp / e.maxHp;
    if (ePct < bestPct) return e;
    if (ePct === bestPct && e.strike > best.strike) return e;
    return best;
  });
}

// Priority target: focus a specific dragon by name, fall back to lowest HP
function targetPriority(priorityName) {
  return (attacker, enemies) => {
    const priority = enemies.find(e => e.name === priorityName);
    if (priority) return priority;
    return targetLowestHp(attacker, enemies);
  };
}

// Bleed-then-focus: spread attacks to get bleeds on all enemies first,
// then collapse onto the priority target once everyone is bleeding.
function targetBleedThenFocus(priorityName) {
  return (attacker, enemies) => {
    // Phase 1: find any enemy without bleed stacks
    const unbled = enemies.filter(e => e.bleed === 0);
    if (unbled.length > 0) {
      // Target the unbled enemy — if multiple, pick the one NOT being
      // targeted by our ally (spread). Fall back to highest Strike threat.
      return unbled.reduce((a, b) => b.strike > a.strike ? b : a);
    }
    // Phase 2: all enemies bleeding — focus priority target
    const priority = enemies.find(e => e.name === priorityName);
    if (priority) return priority;
    return targetLowestHp(attacker, enemies);
  };
}

// Per-dragon priority: each dragon on a team can have its own focus target
function targetPerDragon(assignments) {
  // assignments = { 'Caraxes': 'The Cannibal', 'Meleys': 'Vhagar' }
  return (attacker, enemies) => {
    const assigned = assignments[attacker.name];
    if (assigned) {
      const target = enemies.find(e => e.name === assigned);
      if (target) return target;
    }
    return targetLowestHp(attacker, enemies);
  };
}

// Per-team targeting config (set before running)
let teamATargeting = targetLowestHp;
let teamBTargeting = targetLowestHp;

function pickTarget(attacker, enemies) {
  const fn = attacker.team === 'A' ? teamATargeting : teamBTargeting;
  return fn(attacker, enemies);
}

// ── 2v2 Combat Simulation ────────────────────────────────────────────────

const BLEED_DMG  = 3;
const BLEED_MAX  = 3;
const MAX_TICKS  = 200;

function makeCombatant(dragon, team) {
  return { ...dragon, hp: dragon.maxHp, bleed: 0, team, alive: true, fled: false, engagedBy: null };
}

// Resolve a single attack: attacker rolls vs target, applies damage + crits.
// Returns { unblocked, dmg, critCount } for logging purposes.
function resolveAttack(attacker, target) {
  const aPen = getWoundPenalty(attacker.hp, attacker.maxHp);
  const tPen = getWoundPenalty(target.hp, target.maxHp);

  const strikePool  = Math.max(0, attacker.strike  - aPen);
  const evasionPool = Math.max(0, target.evasion - tPen);

  const hits     = rollPool(strikePool);
  const blocks   = rollPool(evasionPool);
  const unblocked = Math.max(0, hits - blocks);
  const dmg      = unblocked * attacker.damagePerHit;

  target.hp = Math.max(0, target.hp - dmg);

  let critCount = 0;
  for (let i = 0; i < unblocked; i++) {
    if (Math.random() < attacker.critChance) {
      target.bleed = Math.min(BLEED_MAX, target.bleed + 1);
      critCount++;
    }
  }

  if (target.hp <= 0) target.alive = false;

  return { hits, blocks, unblocked, dmg, critCount };
}

function simulate2v2(teamADragons, teamBDragons) {
  const combatants = [
    ...teamADragons.map(d => makeCombatant(d, 'A')),
    ...teamBDragons.map(d => makeCombatant(d, 'B')),
  ];

  let ticks = 0;
  const log = [];  // optional narrative log

  const alive = (team) => combatants.filter(c => c.team === team && c.alive && !c.fled);

  while (ticks < MAX_TICKS) {
    ticks++;

    // ── Bleed damage (start of tick) ──
    for (const c of combatants) {
      if (!c.alive || c.fled || c.bleed <= 0) continue;
      c.hp = Math.max(0, c.hp - c.bleed * BLEED_DMG);
      if (c.hp <= 0) c.alive = false;
    }

    const aAlive = alive('A');
    const bAlive = alive('B');
    if (aAlive.length === 0 || bAlive.length === 0) break;

    // ── Flee phase ──
    for (const c of combatants) {
      if (!c.alive || c.fled) continue;
      if (!wantsToFlee(c.hp, c.maxHp, c.ferocity)) continue;

      const enemies = alive(c.team === 'A' ? 'B' : 'A');
      if (enemies.length === 0) continue;

      // Fastest enemy pursues
      const pursuer = enemies.reduce((a, b) => b.agility > a.agility ? b : a);
      const pen  = getWoundPenalty(c.hp, c.maxHp);
      const pPen = getWoundPenalty(pursuer.hp, pursuer.maxHp);

      if (attemptDisengage(c.agility, pursuer.agility, pen, pPen)) {
        c.fled = true;
      }
    }

    // Re-check after flee
    const aLeft = alive('A');
    const bLeft = alive('B');
    if (aLeft.length === 0 || bLeft.length === 0) break;

    // ── Initiative ordering ──
    const active = combatants
      .filter(c => c.alive && !c.fled)
      .sort((a, b) => b.agility - a.agility || b.ferocity - a.ferocity);

    // ── Each dragon attacks in initiative order ──
    for (const attacker of active) {
      if (!attacker.alive || attacker.fled) continue;

      const enemies = alive(attacker.team === 'A' ? 'B' : 'A');
      if (enemies.length === 0) break;

      const target = pickTarget(attacker, enemies);

      // ── Attack of Opportunity ──
      // If attacker switches away from the dragon engaged with them,
      // that dragon gets a free attack before the attacker acts.
      const engaged = attacker.engagedBy;
      if (engaged && engaged.alive && !engaged.fled && engaged !== target) {
        resolveAttack(engaged, attacker);
        if (!attacker.alive) continue; // killed by AoO
      }

      // ── Normal attack ──
      resolveAttack(attacker, target);

      // Update engagement: target is now engaged by attacker
      target.engagedBy = attacker;
    }
  }

  // ── Determine result ──
  const aFinal = combatants.filter(c => c.team === 'A');
  const bFinal = combatants.filter(c => c.team === 'B');
  const aUp = aFinal.filter(c => c.alive && !c.fled);
  const bUp = bFinal.filter(c => c.alive && !c.fled);

  let winner = null;
  if (aUp.length > 0 && bUp.length === 0) winner = 'A';
  else if (bUp.length > 0 && aUp.length === 0) winner = 'B';

  return {
    winner,
    ticks,
    dragons: combatants.map(c => ({
      name: c.name, team: c.team, alive: c.alive, fled: c.fled,
      hp: c.hp, maxHp: c.maxHp, bleed: c.bleed,
    })),
  };
}

// ── Helpers ──────────────────────────────────────────────────────────────

function pad(s, n)  { s = String(s); return s + ' '.repeat(Math.max(0, n - s.length)); }
function padL(s, n) { s = String(s); return ' '.repeat(Math.max(0, n - s.length)) + s; }
function pct(n, total) { return (n / total * 100).toFixed(1) + '%'; }

// ── Run Simulations ─────────────────────────────────────────────────────

const teamALabel = 'Vhagar + The Cannibal';
const teamBLabel = 'Caraxes + Meleys';
const teamA = [D.vhagar, D.cannibal];
const teamB = [D.caraxes, D.meleys];

// ── Targeting Strategy ──
// Team A: Vhagar focuses Meleys, Cannibal focuses Caraxes
// Team B: Meleys focuses Vhagar, Caraxes focuses Cannibal
teamATargeting = targetPerDragon({ 'Vhagar': 'Meleys', 'The Cannibal': 'Caraxes' });
teamBTargeting = targetPerDragon({ 'Meleys': 'Vhagar', 'Caraxes': 'The Cannibal' });

let aWins = 0, bWins = 0, draws = 0;
let totalTicks = 0;

// Per-dragon stats
const dragonStats = {};
for (const d of [...teamA, ...teamB]) {
  dragonStats[d.name] = { deaths: 0, flees: 0, survived: 0, totalHpLeft: 0, firstDeath: 0 };
}

// Track who dies first
let firstDeathCounts = {};

// Track survivors composition
const survivorComps = {};

for (let i = 0; i < SIMULATIONS; i++) {
  const r = simulate2v2(teamA, teamB);
  totalTicks += r.ticks;

  if (r.winner === 'A') aWins++;
  else if (r.winner === 'B') bWins++;
  else draws++;

  // Per-dragon tracking
  let firstDeath = null;
  let firstDeathTick = Infinity;

  for (const d of r.dragons) {
    const s = dragonStats[d.name];
    if (!d.alive) {
      s.deaths++;
    } else if (d.fled) {
      s.flees++;
    } else {
      s.survived++;
      s.totalHpLeft += d.hp;
    }
  }

  // Track surviving team composition
  const survivors = r.dragons.filter(d => d.alive && !d.fled).map(d => d.name).sort().join(' + ');
  survivorComps[survivors] = (survivorComps[survivors] || 0) + 1;
}

// ── Output ──────────────────────────────────────────────────────────────

console.log('');
console.log('='.repeat(100));
console.log('  2v2 DRAGON COMBAT SIMULATOR');
console.log('  ' + teamALabel + '  vs  ' + teamBLabel);
console.log('  ' + SIMULATIONS + ' simulations | d10 pools, 6+ hit | Tier+3 dmg | bleed 3/stack/tick (max 3)');
console.log('  STRATEGY — Team A: Vhagar→Meleys, Cannibal→Caraxes | Team B: Meleys→Vhagar, Caraxes→Cannibal');
console.log('='.repeat(100));

// ── Stat Cards ──

console.log('');
console.log('COMBATANT STAT CARDS (with rider bonuses)');
console.log('-'.repeat(110));
console.log(
  pad('Dragon', 18) + pad('Rider', 10) + pad('Team', 8) +
  padL('HP', 5) + padL('Str', 7) + padL('Eva', 7) + padL('Ter', 5) +
  padL('Dmg', 5) + padL('Crit', 6) + padL('Agi', 5)
);
console.log('-'.repeat(110));

for (const d of [...teamA, ...teamB]) {
  const teamLabel = teamA.includes(d) ? 'A' : 'B';
  const strLabel = d.riderOff > 0 ? (d.strike - d.riderOff) + '+' + d.riderOff : String(d.strike);
  const evaLabel = d.riderDef > 0 ? (d.evasion - d.riderDef) + '+' + d.riderDef : String(d.evasion);
  console.log(
    pad(d.name, 18) + pad(d.riderName, 10) + pad('Team ' + teamLabel, 8) +
    padL(d.maxHp, 5) + padL(strLabel, 7) + padL(evaLabel, 7) + padL(d.terror, 5) +
    padL(d.damagePerHit, 5) + padL(Math.round(d.critChance * 100) + '%', 6) + padL(d.agility, 5)
  );
}

// ── Overall Results ──

console.log('');
console.log('='.repeat(100));
console.log('  RESULTS — ' + SIMULATIONS + ' SIMULATIONS');
console.log('='.repeat(100));
console.log('');
console.log('  Team A (' + teamALabel + '):  ' + padL(aWins, 5) + ' wins  (' + pct(aWins, SIMULATIONS) + ')');
console.log('  Team B (' + teamBLabel + '):       ' + padL(bWins, 5) + ' wins  (' + pct(bWins, SIMULATIONS) + ')');
console.log('  Draws / Stalemates:           ' + padL(draws, 5) + '        (' + pct(draws, SIMULATIONS) + ')');
console.log('');
console.log('  Average fight duration: ' + (totalTicks / SIMULATIONS).toFixed(1) + ' ticks');

// ── Per-Dragon Breakdown ──

console.log('');
console.log('='.repeat(100));
console.log('  PER-DRAGON OUTCOMES');
console.log('='.repeat(100));
console.log('');
console.log(
  pad('Dragon', 18) + padL('Deaths', 8) + padL('Fled', 8) + padL('Survived', 10) +
  padL('Death%', 8) + padL('Flee%', 8) + padL('Surv%', 8) + padL('Avg HP left', 13)
);
console.log('-'.repeat(100));

for (const d of [...teamA, ...teamB]) {
  const s = dragonStats[d.name];
  const avgHp = s.survived > 0 ? (s.totalHpLeft / s.survived).toFixed(0) : '-';
  const avgHpPct = s.survived > 0 ? '(' + (s.totalHpLeft / s.survived / d.maxHp * 100).toFixed(0) + '%)' : '';
  console.log(
    pad(d.name, 18) +
    padL(s.deaths, 8) + padL(s.flees, 8) + padL(s.survived, 10) +
    padL(pct(s.deaths, SIMULATIONS), 8) + padL(pct(s.flees, SIMULATIONS), 8) +
    padL(pct(s.survived, SIMULATIONS), 8) + padL(avgHp + ' ' + avgHpPct, 13)
  );
}

// ── Survivor Compositions ──

console.log('');
console.log('='.repeat(100));
console.log('  SURVIVOR COMPOSITIONS — Who is left standing?');
console.log('='.repeat(100));
console.log('');

const sortedComps = Object.entries(survivorComps).sort((a, b) => b[1] - a[1]);
for (const [comp, count] of sortedComps) {
  const label = comp || '(No survivors)';
  console.log('  ' + pad(label, 50) + padL(count, 5) + '  (' + pct(count, SIMULATIONS) + ')');
}

// ── Battle Narrative (single sample fight) ──

console.log('');
console.log('='.repeat(100));
console.log('  SAMPLE BATTLE NARRATIVE');
console.log('='.repeat(100));
console.log('');

// Run one detailed fight
function simulate2v2Verbose(teamADragons, teamBDragons) {
  const combatants = [
    ...teamADragons.map(d => makeCombatant(d, 'A')),
    ...teamBDragons.map(d => makeCombatant(d, 'B')),
  ];

  let ticks = 0;
  const alive = (team) => combatants.filter(c => c.team === team && c.alive && !c.fled);
  const hpStr = (c) => c.hp + '/' + c.maxHp + ' (' + Math.round(c.hp / c.maxHp * 100) + '%)';
  const bleedStr = (c) => c.bleed > 0 ? ' [BLEED x' + c.bleed + ']' : '';

  while (ticks < MAX_TICKS) {
    ticks++;

    // Bleed
    for (const c of combatants) {
      if (!c.alive || c.fled || c.bleed <= 0) continue;
      const bleedDmg = c.bleed * BLEED_DMG;
      c.hp = Math.max(0, c.hp - bleedDmg);
      if (bleedDmg > 0) console.log('  [Bleed] ' + c.name + ' takes ' + bleedDmg + ' bleed damage → ' + hpStr(c));
      if (c.hp <= 0) {
        c.alive = false;
        console.log('  *** ' + c.name + ' BLEEDS OUT AND DIES ***');
      }
    }

    const aAlive = alive('A');
    const bAlive = alive('B');
    if (aAlive.length === 0 || bAlive.length === 0) break;

    console.log('');
    console.log('  ─── Tick ' + ticks + ' ───');

    // Status line
    const statusA = aAlive.map(c => c.name + ' ' + hpStr(c) + bleedStr(c)).join('  |  ');
    const statusB = bAlive.map(c => c.name + ' ' + hpStr(c) + bleedStr(c)).join('  |  ');
    console.log('  Team A: ' + statusA);
    console.log('  Team B: ' + statusB);

    // Flee
    for (const c of combatants) {
      if (!c.alive || c.fled) continue;
      if (!wantsToFlee(c.hp, c.maxHp, c.ferocity)) continue;
      const enemies = alive(c.team === 'A' ? 'B' : 'A');
      if (enemies.length === 0) continue;
      const pursuer = enemies.reduce((a, b) => b.agility > a.agility ? b : a);
      const pen  = getWoundPenalty(c.hp, c.maxHp);
      const pPen = getWoundPenalty(pursuer.hp, pursuer.maxHp);
      if (attemptDisengage(c.agility, pursuer.agility, pen, pPen)) {
        c.fled = true;
        console.log('  ** ' + c.name + ' FLEES! (pursued by ' + pursuer.name + ') **');
      } else {
        console.log('  ' + c.name + ' tries to flee but ' + pursuer.name + ' cuts them off!');
      }
    }

    const aLeft = alive('A');
    const bLeft = alive('B');
    if (aLeft.length === 0 || bLeft.length === 0) break;

    // Initiative
    const active = combatants
      .filter(c => c.alive && !c.fled)
      .sort((a, b) => b.agility - a.agility || b.ferocity - a.ferocity);

    for (const attacker of active) {
      if (!attacker.alive || attacker.fled) continue;
      const enemies = alive(attacker.team === 'A' ? 'B' : 'A');
      if (enemies.length === 0) break;

      const target = pickTarget(attacker, enemies);

      // ── Attack of Opportunity ──
      const engaged = attacker.engagedBy;
      if (engaged && engaged.alive && !engaged.fled && engaged !== target) {
        const aoo = resolveAttack(engaged, attacker);
        const aooCrit = aoo.critCount > 0 ? ' ★ CRIT x' + aoo.critCount + '! Bleed → ' + attacker.bleed + ' stacks' : '';
        console.log('  ⚔ AoO! ' + engaged.name + ' strikes ' + attacker.name + ' (disengaging)' +
          ': ' + aoo.hits + ' hits, ' + aoo.blocks + ' blocked, ' + aoo.unblocked + ' through → ' +
          aoo.dmg + ' dmg → ' + hpStr(attacker) + aooCrit);
        if (!attacker.alive) {
          console.log('  *** ' + attacker.name + ' IS SLAIN BY ' + engaged.name + ' (Attack of Opportunity)! ***');
          continue;
        }
      }

      // ── Normal attack ──
      const r = resolveAttack(attacker, target);
      const critNote = r.critCount > 0 ? ' ★ CRIT x' + r.critCount + '! Bleed → ' + target.bleed + ' stacks' : '';
      console.log('  ' + attacker.name + ' → ' + target.name +
        ': ' + r.hits + ' hits, ' + r.blocks + ' blocked, ' + r.unblocked + ' through → ' +
        r.dmg + ' dmg → ' + hpStr(target) + critNote);

      // Update engagement
      target.engagedBy = attacker;

      if (target.hp <= 0) {
        console.log('  *** ' + target.name + ' IS SLAIN BY ' + attacker.name + '! ***');
      }
    }
  }

  const aFinal = alive('A');
  const bFinal = alive('B');

  console.log('');
  console.log('  ═══ BATTLE ENDS — Tick ' + ticks + ' ═══');
  if (aFinal.length > 0 && bFinal.length === 0) {
    console.log('  WINNER: Team A (' + teamALabel + ')');
    for (const c of aFinal) console.log('    ' + c.name + ': ' + hpStr(c) + bleedStr(c));
  } else if (bFinal.length > 0 && aFinal.length === 0) {
    console.log('  WINNER: Team B (' + teamBLabel + ')');
    for (const c of bFinal) console.log('    ' + c.name + ': ' + hpStr(c) + bleedStr(c));
  } else {
    console.log('  DRAW / STALEMATE');
  }
}

simulate2v2Verbose(teamA, teamB);

console.log('');
console.log('Simulation complete. ' + SIMULATIONS + ' battles simulated.');
