/**
 * Combat balance simulator — runs N fights between two builds and reports stats.
 * Usage: npx tsx src/tools/combat-sim.ts
 */

// ── RNG ──
function d100(): number { return Math.floor(Math.random() * 100) + 1; }
function disadvantage(): number { return Math.min(d100(), d100()); }

// ── Wound penalty ──
function woundPenalty(hp: number, maxHp: number): number {
  const pct = (hp / maxHp) * 100;
  if (pct >= 75) return 0;
  if (pct >= 50) return -2;
  if (pct >= 25) return -5;
  return -10;
}

// ── Damage multiplier from pen vs mitigation ──
function damageMultiplier(penDiff: number): number {
  if (penDiff <= -15) return 0.40;
  if (penDiff <= -10) return 0.50;
  if (penDiff <= -5) return 0.65;
  if (penDiff <= 0) return 0.80;
  if (penDiff <= 5) return 1.00;
  if (penDiff <= 10) return 1.15;
  return 1.30;
}

function damageLabel(penDiff: number): string {
  if (penDiff <= -15) return 'Deflected';
  if (penDiff <= -10) return 'Glancing';
  if (penDiff <= -5) return 'Partial';
  if (penDiff <= 0) return 'Reduced';
  if (penDiff <= 5) return 'Solid';
  if (penDiff <= 10) return 'Clean';
  return 'Devastating';
}

function finalDamage(baseDmg: number, mult: number, isCrit: boolean): number {
  let eff = mult;
  let critMult = 1.0;
  if (isCrit) { eff = Math.max(eff, 1.0); critMult = 1.25; }
  return Math.max(1, Math.round(baseDmg * eff * critMult));
}

// ── Build definition ──
interface Build {
  name: string;
  prowess: number;
  fortitude: number;
  cunning: number;
  // Weapon
  weaponName: string;
  baseDamage: number;
  penetration: number;     // final (tier pen + penMod)
  critBonus: number;
  critEffect: string[];
  weaponEnc: number;       // 1H = 0, 2H = -5 + encMod
  isTwoHanded: boolean;
  bonusVsHeavy: number;
  isDagger: boolean;
  armorPiercing: boolean;
  slashing: boolean;
  // Armor
  armorMitigation: number; // final (tier + class mod)
  armorEnc: number;
  armorClass: string;
  isLightlyArmored: boolean;
  // Shield (only if 1H + shield)
  shieldBlock: number;     // final (tier + class mod)
  shieldEnc: number;
  hasShield: boolean;
}

function maxHp(b: Build): number { return 20 + b.fortitude * 10; }
function critThreshold(b: Build): number {
  // Dagger critBonus only applies in light armor
  const effectiveCritBonus = (b.isDagger && !b.isLightlyArmored) ? 0 : b.critBonus;
  return 100 - (b.prowess * 2) - effectiveCritBonus;
}
function attackBonus(b: Build): number { return (b.prowess * 5); }
function totalEnc(b: Build): number { return b.weaponEnc + b.armorEnc + b.shieldEnc; }
function initiative(b: Build): number { return d100() + (b.cunning * 3) + (b.prowess * 2) + totalEnc(b); }

// ── Single fight simulation ──
interface FightResult {
  winner: string;
  rounds: number;
  winnerHpPct: number;
  totalDamageByA: number;
  totalDamageByB: number;
  critsA: number;
  critsB: number;
  hitsA: number;
  hitsB: number;
  blocksA: number;
  blocksB: number;
  dodgesA: number;
  dodgesB: number;
}

function simulateFight(a: Build, b: Build): FightResult {
  let hpA = maxHp(a);
  let hpB = maxHp(b);
  const maxHpA = hpA;
  const maxHpB = hpB;

  // Determine turn order
  const initA = initiative(a);
  const initB = initiative(b);
  let first: Build, second: Build;
  let firstIsA: boolean;
  if (initA >= initB) { first = a; second = b; firstIsA = true; }
  else { first = b; second = a; firstIsA = false; }

  let round = 0;
  let dmgByA = 0, dmgByB = 0;
  let critsA = 0, critsB = 0;
  let hitsA = 0, hitsB = 0;
  let blocksA = 0, blocksB = 0; // blocks BY defender when attacked by A/B

  // Track status effects (simplified: bleeding stacks, sundered stacks, stunned)
  let bleedA = 0, bleedB = 0;
  let sunderA = 0, sunderB = 0;
  let stunnedA = false, stunnedB = false;

  function resolveAttackAction(
    atk: Build, def: Build,
    atkHp: number, atkMaxHp: number,
    defHp: number, defMaxHp: number,
    defSunder: number,
    atkSunder: number,
  ): { damage: number; isCrit: boolean; isHit: boolean; effects: string[]; counterEffects: string[] } {
    const atkRoll = d100();
    const defRoll = d100();

    const atkWound = woundPenalty(atkHp, atkMaxHp);
    const defWound = woundPenalty(defHp, defMaxHp);

    // 2H Overwhelm: +10 attack bonus vs shielded targets, halve shield block
    let overwhelm = 0;
    if (atk.isTwoHanded && def.hasShield) overwhelm = 10;
    const effectiveBlock = (atk.isTwoHanded && def.hasShield)
      ? Math.floor(def.shieldBlock / 2)
      : def.shieldBlock;
    const atkMod = attackBonus(atk) + overwhelm + atkWound;
    // Enc NOT in defense (only affects initiative)
    const defMod = attackBonus(def) + effectiveBlock + defWound;

    const atkTotal = atkRoll + atkMod;
    const defTotal = defRoll + defMod;

    if (atkTotal <= defTotal) {
      // Block — check defensive crit (counter-attack)
      const defCritRoll = d100();
      const defCritThresh = critThreshold(def);
      if (defCritRoll >= defCritThresh) {
        // Counter-attack: auto-hit, always crit — bypasses mitigation entirely
        let pen = def.penetration;
        const critEfx = def.critEffect;
        if (critEfx.includes('piercing')) pen += 10;
        if (def.slashing && atk.isLightlyArmored) { pen += 5; }
        const netPen = pen; // crit bypasses mitigation (pen vs 0)
        const mult = damageMultiplier(netPen);
        const effectiveMult = Math.max(mult, 1.0);
        const counterBaseDmg = def.baseDamage + (def.slashing && atk.isLightlyArmored ? 8 : 0);
        const counterDmg = Math.max(1, Math.round(counterBaseDmg * effectiveMult * 1.25));
        // Counter-attack crit effects on the attacker
        const counterEffects: string[] = [];
        for (const eff of critEfx) {
          if (eff !== 'piercing') {
            // Dagger counter: double bleed
            if (def.isDagger && eff === 'bleeding') {
              counterEffects.push('bleeding', 'bleeding');
            } else {
              counterEffects.push(eff);
            }
          }
        }
        return { damage: -counterDmg, isCrit: false, isHit: false, effects: [], counterEffects };
      }
      return { damage: 0, isCrit: false, isHit: false, effects: [], counterEffects: [] };
    }

    // Hit — shield crit deflection (+5 to crit threshold)
    const effectiveCritThresh = def.hasShield ? critThreshold(atk) + 5 : critThreshold(atk);
    const isCrit = atkRoll >= effectiveCritThresh;
    let pen = atk.penetration;
    let bonusDmg = 0;
    const effects: string[] = [];

    // Armor piercing (daggers): roll >= 80 → +5 pen
    if (atk.armorPiercing && atkRoll >= 80) {
      pen += 5;
    }

    // Blunt bonus scaled by armor class
    if (atk.bonusVsHeavy > 0) {
      if (def.armorClass === 'heavy') pen += atk.bonusVsHeavy;
      else if (def.armorClass === 'medium') pen += Math.floor(atk.bonusVsHeavy / 2);
    }

    // Slashing vs lightly armored
    if (atk.slashing && def.isLightlyArmored) {
      bonusDmg = 8;
      pen += 5;
    }

    // Crit effects
    if (isCrit) {
      for (const eff of atk.critEffect) {
        if (eff === 'piercing') pen += 10;
        else {
          // Dagger crit: double bleed stacks
          if (atk.isDagger && eff === 'bleeding') {
            effects.push('bleeding', 'bleeding');
          } else {
            effects.push(eff);
          }
        }
      }
    }

    // Crits bypass mitigation entirely
    const baseMitig = def.armorMitigation - (defSunder * 5);
    const effectiveMitigation = isCrit ? 0 : Math.max(0, baseMitig);
    const netPen = pen - effectiveMitigation;
    const mult = damageMultiplier(netPen);
    const dmg = finalDamage(atk.baseDamage + bonusDmg, mult, isCrit);

    return { damage: dmg, isCrit, isHit: true, effects, counterEffects: [] };
  }

  for (round = 1; round <= 50; round++) {
    // Round start: bleeding damage
    if (bleedA > 0) {
      const bleedDmg = 5 * bleedA;
      hpA -= bleedDmg;
      dmgByB += bleedDmg;
      if (hpA <= 0) break;
    }
    if (bleedB > 0) {
      const bleedDmg = 5 * bleedB;
      hpB -= bleedDmg;
      dmgByA += bleedDmg;
      if (hpB <= 0) break;
    }

    // Turn order
    const turns: Array<{ atk: 'A' | 'B' }> = firstIsA
      ? [{ atk: 'A' }, { atk: 'B' }]
      : [{ atk: 'B' }, { atk: 'A' }];

    for (const turn of turns) {
      if (hpA <= 0 || hpB <= 0) break;

      if (turn.atk === 'A') {
        if (stunnedA) { stunnedA = false; continue; }
        const res = resolveAttackAction(a, b, hpA, maxHpA, hpB, maxHpB, sunderB, sunderA);
        if (res.isHit) {
          hitsA++;
          hpB -= res.damage;
          dmgByA += res.damage;
          if (res.isCrit) critsA++;
          for (const eff of res.effects) {
            if (eff === 'bleeding') bleedB = Math.min(3, bleedB + 1);
            if (eff === 'stunned') stunnedB = true;
            if (eff === 'sundered') sunderB = Math.min(3, sunderB + 1);
          }
          // Dagger crit bonus strike (light armor only)
          if (res.isCrit && a.isDagger && a.isLightlyArmored && hpB > 0) {
            const bonus = resolveAttackAction(a, b, hpA, maxHpA, hpB, maxHpB, sunderB, sunderA);
            if (bonus.isHit) {
              hitsA++;
              hpB -= bonus.damage;
              dmgByA += bonus.damage;
              if (bonus.isCrit) critsA++;
              for (const eff of bonus.effects) {
                if (eff === 'bleeding') bleedB = Math.min(3, bleedB + 1);
                if (eff === 'stunned') stunnedB = true;
                if (eff === 'sundered') sunderB = Math.min(3, sunderB + 1);
              }
            } else {
              blocksB++;
              if (bonus.damage < 0) {
                hpA += bonus.damage;
                dmgByB += Math.abs(bonus.damage);
                for (const eff of bonus.counterEffects) {
                  if (eff === 'bleeding') bleedA = Math.min(3, bleedA + 1);
                  if (eff === 'stunned') stunnedA = true;
                  if (eff === 'sundered') sunderA = Math.min(3, sunderA + 1);
                }
              }
            }
          }
        } else {
          blocksB++;
          if (res.damage < 0) {
            hpA += res.damage;
            dmgByB += Math.abs(res.damage);
            for (const eff of res.counterEffects) {
              if (eff === 'bleeding') bleedA = Math.min(3, bleedA + 1);
              if (eff === 'stunned') stunnedA = true;
              if (eff === 'sundered') sunderA = Math.min(3, sunderA + 1);
            }
          }
        }
      } else {
        if (stunnedB) { stunnedB = false; continue; }
        const res = resolveAttackAction(b, a, hpB, maxHpB, hpA, maxHpA, sunderA, sunderB);
        if (res.isHit) {
          hitsB++;
          hpA -= res.damage;
          dmgByB += res.damage;
          if (res.isCrit) critsB++;
          for (const eff of res.effects) {
            if (eff === 'bleeding') bleedA = Math.min(3, bleedA + 1);
            if (eff === 'stunned') stunnedA = true;
            if (eff === 'sundered') sunderA = Math.min(3, sunderA + 1);
          }
          // Dagger crit bonus strike (light armor only)
          if (res.isCrit && b.isDagger && b.isLightlyArmored && hpA > 0) {
            const bonus = resolveAttackAction(b, a, hpB, maxHpB, hpA, maxHpA, sunderA, sunderB);
            if (bonus.isHit) {
              hitsB++;
              hpA -= bonus.damage;
              dmgByB += bonus.damage;
              if (bonus.isCrit) critsB++;
              for (const eff of bonus.effects) {
                if (eff === 'bleeding') bleedA = Math.min(3, bleedA + 1);
                if (eff === 'stunned') stunnedA = true;
                if (eff === 'sundered') sunderA = Math.min(3, sunderA + 1);
              }
            } else {
              blocksA++;
              if (bonus.damage < 0) {
                hpB += bonus.damage;
                dmgByA += Math.abs(bonus.damage);
                for (const eff of bonus.counterEffects) {
                  if (eff === 'bleeding') bleedB = Math.min(3, bleedB + 1);
                  if (eff === 'stunned') stunnedB = true;
                  if (eff === 'sundered') sunderB = Math.min(3, sunderB + 1);
                }
              }
            }
          }
        } else {
          blocksA++;
          if (res.damage < 0) {
            hpB += res.damage;
            dmgByA += Math.abs(res.damage);
            for (const eff of res.counterEffects) {
              if (eff === 'bleeding') bleedB = Math.min(3, bleedB + 1);
              if (eff === 'stunned') stunnedB = true;
              if (eff === 'sundered') sunderB = Math.min(3, sunderB + 1);
            }
          }
        }
      }
    }

    if (hpA <= 0 || hpB <= 0) break;
  }

  const winner = hpA > hpB ? a.name : b.name;
  const winnerHp = hpA > hpB ? hpA : hpB;
  const winnerMaxHp = hpA > hpB ? maxHpA : maxHpB;

  return {
    winner,
    rounds: round,
    winnerHpPct: Math.round((winnerHp / winnerMaxHp) * 100),
    totalDamageByA: dmgByA,
    totalDamageByB: dmgByB,
    critsA, critsB,
    hitsA, hitsB,
    blocksA, blocksB,
    dodgesA: 0, dodgesB: 0,
  };
}

// ── Run N simulations ──
function simulate(a: Build, b: Build, n: number = 10000) {
  let winsA = 0, winsB = 0;
  let totalRounds = 0;
  let totalWinnerHp = 0;
  let totalDmgA = 0, totalDmgB = 0;
  let totalCritsA = 0, totalCritsB = 0;
  let totalHitsA = 0, totalHitsB = 0;
  let totalBlocksA = 0, totalBlocksB = 0;

  for (let i = 0; i < n; i++) {
    const result = simulateFight(a, b);
    if (result.winner === a.name) winsA++;
    else winsB++;
    totalRounds += result.rounds;
    totalWinnerHp += result.winnerHpPct;
    totalDmgA += result.totalDamageByA;
    totalDmgB += result.totalDamageByB;
    totalCritsA += result.critsA;
    totalCritsB += result.critsB;
    totalHitsA += result.hitsA;
    totalHitsB += result.hitsB;
    totalBlocksA += result.blocksA;
    totalBlocksB += result.blocksB;
  }

  console.log(`\n${'═'.repeat(60)}`);
  console.log(`  ${a.name}  vs  ${b.name}  (${n} fights)`);
  console.log(`${'═'.repeat(60)}`);
  console.log(`  Win rate:        ${a.name} ${((winsA/n)*100).toFixed(1)}%  |  ${b.name} ${((winsB/n)*100).toFixed(1)}%`);
  console.log(`  Avg rounds:      ${(totalRounds/n).toFixed(1)}`);
  console.log(`  Avg winner HP:   ${(totalWinnerHp/n).toFixed(0)}%`);
  console.log(`  ──────────────────────────────────────`);
  console.log(`  ${a.name}:`);
  console.log(`    Attack bonus:  +${attackBonus(a)}  |  Crit threshold: ${critThreshold(a)}+`);
  console.log(`    HP: ${maxHp(a)}  |  Pen: ${a.penetration}  |  Mit: ${a.armorMitigation}  |  Shield: ${a.hasShield ? a.shieldBlock : 'none'}`);
  console.log(`    Pen-Mit diff:  ${a.penetration - b.armorMitigation} (${damageLabel(a.penetration - b.armorMitigation)}) → ${(damageMultiplier(a.penetration - b.armorMitigation)*100).toFixed(0)}% dmg`);
  console.log(`    Avg hits/fight: ${(totalHitsA/n).toFixed(1)}  |  Avg crits: ${(totalCritsA/n).toFixed(2)}  |  Avg dmg: ${(totalDmgA/n).toFixed(0)}`);
  console.log(`    Blocked by ${b.name}: ${(totalBlocksB/n).toFixed(1)}/fight`);
  console.log(`  ${b.name}:`);
  console.log(`    Attack bonus:  +${attackBonus(b)}  |  Crit threshold: ${critThreshold(b)}+`);
  console.log(`    HP: ${maxHp(b)}  |  Pen: ${b.penetration}  |  Mit: ${b.armorMitigation}  |  Shield: ${b.hasShield ? b.shieldBlock : 'none'}`);
  console.log(`    Pen-Mit diff:  ${b.penetration - a.armorMitigation} (${damageLabel(b.penetration - a.armorMitigation)}) → ${(damageMultiplier(b.penetration - a.armorMitigation)*100).toFixed(0)}% dmg`);
  console.log(`    Avg hits/fight: ${(totalHitsB/n).toFixed(1)}  |  Avg crits: ${(totalCritsB/n).toFixed(2)}  |  Avg dmg: ${(totalDmgB/n).toFixed(0)}`);
  console.log(`    Blocked by ${a.name}: ${(totalBlocksA/n).toFixed(1)}/fight`);
}

// ═══════════════════════════════════════════════
// BUILD PRESETS
// ═══════════════════════════════════════════════

// Steel longsword (Tier 3): pen = 15 + (-2) = 13, 2H
// Steel bastard sword (Tier 3): pen = 12 + (-2) = 10, 1H
// Castle-forged warhammer 1H (Tier 4): pen = 17 + 8 = 25
// Steel warhammer 1H (Tier 3): pen = 12 + 8 = 20
// Steel plate (heavy, Tier 3): mit = 12 + 5 = 17
// Steel chain (medium, Tier 3): mit = 12 + 0 = 12
// Leather (light, Tier 2): mit = 8 + (-3) = 5
// Steel heater shield (Tier 3, medium): block = 20, enc = -3
// Iron buckler (Tier 2, light): block = 16 + (-8) = 8, enc = 0

// ── 1. Fresh character (Level 1) vs Fresh character ──
// Iron (Tier 2) 1H pen: 7. Bastard sword penMod: -2. Final pen: 5
// Iron medium armor: mit 8 + 0 = 8. enc: -5 + 0 = -5
// Iron medium shield: block 16 + 0 = 16. enc: -3

const knightLv1: Build = {
  name: 'Lv1 Knight',
  prowess: 7, fortitude: 5, cunning: 3,
  weaponName: 'Iron Bastard Sword + Shield',
  baseDamage: 14, penetration: 5, critBonus: 0, critEffect: ['bleeding'],
  weaponEnc: 0, isTwoHanded: false, bonusVsHeavy: 0,
  isDagger: false, armorPiercing: false, slashing: true,
  armorMitigation: 8, armorEnc: -5, armorClass: 'medium', isLightlyArmored: false,
  shieldBlock: 16, shieldEnc: -3, hasShield: true,
};

const rogueLv1: Build = {
  name: 'Lv1 Rogue',
  prowess: 5, fortitude: 3, cunning: 7,
  weaponName: 'Iron Dagger',
  baseDamage: 10, penetration: 4, critBonus: 5, critEffect: ['bleeding'],
  weaponEnc: 0, isTwoHanded: false, bonusVsHeavy: 0,
  isDagger: true, armorPiercing: true, slashing: true,
  armorMitigation: 5, armorEnc: -2, armorClass: 'light', isLightlyArmored: true,
  shieldBlock: 0, shieldEnc: 0, hasShield: false,
};

// ── 2. Veteran characters (Level 10-ish) ──
const veteranKnight: Build = {
  name: 'Vet Knight',
  prowess: 9, fortitude: 7, cunning: 4,
  weaponName: 'Steel Bastard Sword + Steel Shield',
  baseDamage: 14, penetration: 10, critBonus: 0, critEffect: ['bleeding'],
  weaponEnc: 0, isTwoHanded: false, bonusVsHeavy: 0,
  isDagger: false, armorPiercing: false, slashing: true,
  armorMitigation: 17, armorEnc: -13, armorClass: 'heavy', isLightlyArmored: false,
  shieldBlock: 20, shieldEnc: -3, hasShield: true,
};

const veteranBerserker: Build = {
  name: 'Vet Berserker',
  prowess: 9, fortitude: 6, cunning: 5,
  weaponName: 'Steel Greatsword (2H)',
  baseDamage: 15, penetration: 12, critBonus: 0, critEffect: ['bleeding'],
  weaponEnc: -5, isTwoHanded: true, bonusVsHeavy: 0,
  isDagger: false, armorPiercing: false, slashing: true,
  armorMitigation: 12, armorEnc: -8, armorClass: 'medium', isLightlyArmored: false,
  shieldBlock: 0, shieldEnc: 0, hasShield: false,
};

const veteranRogue: Build = {
  name: 'Vet Rogue',
  prowess: 7, fortitude: 5, cunning: 8,
  weaponName: 'Steel Dagger',
  baseDamage: 10, penetration: 9, critBonus: 5, critEffect: ['bleeding'],
  weaponEnc: 0, isTwoHanded: false, bonusVsHeavy: 0,
  isDagger: true, armorPiercing: true, slashing: true,
  armorMitigation: 9, armorEnc: -2, armorClass: 'light', isLightlyArmored: true,
  shieldBlock: 0, shieldEnc: 0, hasShield: false,
};

// ── 3. Max builds (Level 20) ──
const maxKnight: Build = {
  name: 'Max Knight',
  prowess: 10, fortitude: 9, cunning: 5,
  weaponName: 'Castle-Forged Bastard Sword + CF Shield',
  baseDamage: 14, penetration: 15, critBonus: 0, critEffect: ['bleeding'],
  weaponEnc: 0, isTwoHanded: false, bonusVsHeavy: 0,
  isDagger: false, armorPiercing: false, slashing: true,
  armorMitigation: 21, armorEnc: -17, armorClass: 'heavy', isLightlyArmored: false,
  shieldBlock: 24, shieldEnc: -3, hasShield: true,
};

const maxHammer: Build = {
  name: 'Max Hammerer',
  prowess: 10, fortitude: 8, cunning: 5,
  weaponName: 'Castle-Forged Warhammer 1H + CF Shield',
  baseDamage: 14, penetration: 25, critBonus: 0, critEffect: ['stunned'],
  weaponEnc: -5, isTwoHanded: false, bonusVsHeavy: 5,
  isDagger: false, armorPiercing: false, slashing: false,
  armorMitigation: 21, armorEnc: -17, armorClass: 'heavy', isLightlyArmored: false,
  shieldBlock: 24, shieldEnc: -3, hasShield: true,
};

const maxRogue: Build = {
  name: 'Max Rogue',
  prowess: 8, fortitude: 6, cunning: 9,
  weaponName: 'CF Dagger',
  baseDamage: 10, penetration: 14, critBonus: 5, critEffect: ['bleeding'],
  weaponEnc: 0, isTwoHanded: false, bonusVsHeavy: 0,
  isDagger: true, armorPiercing: true, slashing: true,
  armorMitigation: 13, armorEnc: -2, armorClass: 'light', isLightlyArmored: true,
  shieldBlock: 0, shieldEnc: 0, hasShield: false,
};

// ── 4. Level 1 vs Level 20 (stomps?) ──

// ── 5. Weapon matchup: Sword vs Hammer vs Axe ──
const maxAxe: Build = {
  name: 'Max Axeman',
  prowess: 10, fortitude: 8, cunning: 5,
  weaponName: 'CF Battle Axe 1H + CF Shield',
  baseDamage: 16, penetration: 22, critBonus: 0, critEffect: ['sundered'],
  weaponEnc: -2, isTwoHanded: false, bonusVsHeavy: 0,
  isDagger: false, armorPiercing: false, slashing: false,
  armorMitigation: 21, armorEnc: -17, armorClass: 'heavy', isLightlyArmored: false,
  shieldBlock: 24, shieldEnc: -3, hasShield: true,
};

// ── 6. More weapon archetypes (Max level) ──

// CF Spear 1H: pen = 17 + 7 = 24, baseDmg 14, piercing crit, no extra enc
const maxSpear: Build = {
  name: 'Max Spearman',
  prowess: 10, fortitude: 8, cunning: 5,
  weaponName: 'CF Spear + CF Shield',
  baseDamage: 14, penetration: 24, critBonus: 0, critEffect: ['piercing'],
  weaponEnc: 0, isTwoHanded: false, bonusVsHeavy: 0,
  isDagger: false, armorPiercing: false, slashing: false,
  armorMitigation: 21, armorEnc: -17, armorClass: 'heavy', isLightlyArmored: false,
  shieldBlock: 24, shieldEnc: -3, hasShield: true,
};

// CF Polearm 2H: pen = 20 + 6 = 26, baseDmg 16, piercing crit
const maxPolearm: Build = {
  name: 'Max Polearm',
  prowess: 10, fortitude: 8, cunning: 5,
  weaponName: 'CF Polearm (2H)',
  baseDamage: 16, penetration: 26, critBonus: 0, critEffect: ['piercing'],
  weaponEnc: -5, isTwoHanded: true, bonusVsHeavy: 0,
  isDagger: false, armorPiercing: false, slashing: false,
  armorMitigation: 21, armorEnc: -17, armorClass: 'heavy', isLightlyArmored: false,
  shieldBlock: 0, shieldEnc: 0, hasShield: false,
};

// CF Great Warhammer 2H: pen = 20 + 10 = 30, baseDmg 14, stunned, bonusVsHeavy 8, enc -8
const maxGreathammer: Build = {
  name: 'Max GHammer',
  prowess: 10, fortitude: 8, cunning: 5,
  weaponName: 'CF Great Warhammer (2H)',
  baseDamage: 14, penetration: 30, critBonus: 0, critEffect: ['stunned'],
  weaponEnc: -13, isTwoHanded: true, bonusVsHeavy: 8,
  isDagger: false, armorPiercing: false, slashing: false,
  armorMitigation: 21, armorEnc: -17, armorClass: 'heavy', isLightlyArmored: false,
  shieldBlock: 0, shieldEnc: 0, hasShield: false,
};

// CF Greatsword 2H: pen = 20 + (-3) = 17, baseDmg 15, bleeding, slashing
const maxGreatsword: Build = {
  name: 'Max Greatsword',
  prowess: 10, fortitude: 8, cunning: 5,
  weaponName: 'CF Greatsword (2H)',
  baseDamage: 15, penetration: 17, critBonus: 0, critEffect: ['bleeding'],
  weaponEnc: -5, isTwoHanded: true, bonusVsHeavy: 0,
  isDagger: false, armorPiercing: false, slashing: true,
  armorMitigation: 21, armorEnc: -17, armorClass: 'heavy', isLightlyArmored: false,
  shieldBlock: 0, shieldEnc: 0, hasShield: false,
};

// CF Mace 1H + Shield: pen = 17 + 6 = 23, baseDmg 14, stunned, bonusVsHeavy 5, enc -3
const maxMace: Build = {
  name: 'Max Mace',
  prowess: 10, fortitude: 8, cunning: 5,
  weaponName: 'CF Mace + CF Shield',
  baseDamage: 14, penetration: 23, critBonus: 0, critEffect: ['stunned'],
  weaponEnc: -3, isTwoHanded: false, bonusVsHeavy: 5,
  isDagger: false, armorPiercing: false, slashing: false,
  armorMitigation: 21, armorEnc: -17, armorClass: 'heavy', isLightlyArmored: false,
  shieldBlock: 24, shieldEnc: -3, hasShield: true,
};

// CF Longsword 2H: pen = 20 + (-2) = 18, baseDmg 14, bleeding, slashing
const maxLongsword: Build = {
  name: 'Max Longsword',
  prowess: 10, fortitude: 8, cunning: 5,
  weaponName: 'CF Longsword (2H)',
  baseDamage: 14, penetration: 18, critBonus: 0, critEffect: ['bleeding'],
  weaponEnc: -5, isTwoHanded: true, bonusVsHeavy: 0,
  isDagger: false, armorPiercing: false, slashing: true,
  armorMitigation: 21, armorEnc: -17, armorClass: 'heavy', isLightlyArmored: false,
  shieldBlock: 0, shieldEnc: 0, hasShield: false,
};

// Valyrian Bastard Sword + Valyrian Shield: pen = 22 + (-2) = 20, 0 weapon enc
// Valyrian heavy armor: mit 14 + 5 = 19, enc = 0 + (-5) = -5
// Valyrian heavy shield: block 28, enc = -8 (tower) or 28+0=28/-3 (heater)
const valyrianKnight: Build = {
  name: 'Valyrian Knight',
  prowess: 10, fortitude: 9, cunning: 5,
  weaponName: 'Valyrian Bastard Sword + Valyrian Shield',
  baseDamage: 14, penetration: 20, critBonus: 0, critEffect: ['bleeding'],
  weaponEnc: 0, isTwoHanded: false, bonusVsHeavy: 0,
  isDagger: false, armorPiercing: false, slashing: true,
  armorMitigation: 19, armorEnc: -5, armorClass: 'heavy', isLightlyArmored: false,
  shieldBlock: 28, shieldEnc: -3, hasShield: true, // Valyrian heater
};

// ── 7. Stat spread experiments ──

// Glass Cannon: all prowess, min fort
const glassCannon: Build = {
  ...maxKnight,
  name: 'Glass Cannon',
  prowess: 10, fortitude: 5, cunning: 5,
};

// Fortitude Tank: high fort, lower prowess
const fortTank: Build = {
  ...maxKnight,
  name: 'Fort Tank',
  prowess: 8, fortitude: 10, cunning: 5,
};

// Prowess Rogue: invests more in prowess, less cunning
const prowRogue: Build = {
  ...maxRogue,
  name: 'Prow Rogue',
  prowess: 10, cunning: 7, fortitude: 5,
};

// CF Greataxe 2H: pen = 20 + 4 = 24, baseDmg 18, sundered, enc -3
const maxGreataxe: Build = {
  name: 'Max Greataxe',
  prowess: 10, fortitude: 8, cunning: 5,
  weaponName: 'CF Greataxe (2H)',
  baseDamage: 18, penetration: 24, critBonus: 0, critEffect: ['sundered'],
  weaponEnc: -8, isTwoHanded: true, bonusVsHeavy: 0,
  isDagger: false, armorPiercing: false, slashing: false,
  armorMitigation: 21, armorEnc: -17, armorClass: 'heavy', isLightlyArmored: false,
  shieldBlock: 0, shieldEnc: 0, hasShield: false,
};

// ═══════════════════════════════════════════════
// RPS BALANCE ANALYSIS — Normalized Stats
// ═══════════════════════════════════════════════
// All archetypes use Prowess 9, Fort 7, Cunning 5
// Only equipment differs. This isolates weapon/armor balance.

const NORM = { prowess: 9, fortitude: 7, cunning: 5 };

// --- TANK: 1H + Shield + Heavy Armor ---
const normTankSword: Build = {
  ...NORM, name: 'Tank(Sword)',
  weaponName: 'CF Bastard Sword + CF Shield',
  baseDamage: 14, penetration: 15, critBonus: 0, critEffect: ['bleeding'],
  weaponEnc: 0, isTwoHanded: false, bonusVsHeavy: 0,
  isDagger: false, armorPiercing: false, slashing: true,
  armorMitigation: 21, armorEnc: -17, armorClass: 'heavy', isLightlyArmored: false,
  shieldBlock: 24, shieldEnc: -3, hasShield: true,
};

const normTankHammer: Build = {
  ...NORM, name: 'Tank(Hammer)',
  weaponName: 'CF Warhammer 1H + CF Shield',
  baseDamage: 14, penetration: 25, critBonus: 0, critEffect: ['stunned'],
  weaponEnc: -5, isTwoHanded: false, bonusVsHeavy: 5,
  isDagger: false, armorPiercing: false, slashing: false,
  armorMitigation: 21, armorEnc: -17, armorClass: 'heavy', isLightlyArmored: false,
  shieldBlock: 24, shieldEnc: -3, hasShield: true,
};

const normTankSpear: Build = {
  ...NORM, name: 'Tank(Spear)',
  weaponName: 'CF Spear + CF Shield',
  baseDamage: 14, penetration: 24, critBonus: 0, critEffect: ['piercing'],
  weaponEnc: 0, isTwoHanded: false, bonusVsHeavy: 0,
  isDagger: false, armorPiercing: false, slashing: false,
  armorMitigation: 21, armorEnc: -17, armorClass: 'heavy', isLightlyArmored: false,
  shieldBlock: 24, shieldEnc: -3, hasShield: true,
};

// --- BRUISER: 2H + Heavy Armor ---
const normBruiserGHammer: Build = {
  ...NORM, name: 'Bruiser(GHammer)',
  weaponName: 'CF Great Warhammer (2H)',
  baseDamage: 14, penetration: 30, critBonus: 0, critEffect: ['stunned'],
  weaponEnc: -13, isTwoHanded: true, bonusVsHeavy: 8,
  isDagger: false, armorPiercing: false, slashing: false,
  armorMitigation: 21, armorEnc: -17, armorClass: 'heavy', isLightlyArmored: false,
  shieldBlock: 0, shieldEnc: 0, hasShield: false,
};

const normBruiserGreataxe: Build = {
  ...NORM, name: 'Bruiser(Greataxe)',
  weaponName: 'CF Greataxe (2H)',
  baseDamage: 18, penetration: 24, critBonus: 0, critEffect: ['sundered'],
  weaponEnc: -8, isTwoHanded: true, bonusVsHeavy: 0,
  isDagger: false, armorPiercing: false, slashing: false,
  armorMitigation: 21, armorEnc: -17, armorClass: 'heavy', isLightlyArmored: false,
  shieldBlock: 0, shieldEnc: 0, hasShield: false,
};

const normBruiserPolearm: Build = {
  ...NORM, name: 'Bruiser(Polearm)',
  weaponName: 'CF Polearm (2H)',
  baseDamage: 16, penetration: 26, critBonus: 0, critEffect: ['piercing'],
  weaponEnc: -5, isTwoHanded: true, bonusVsHeavy: 0,
  isDagger: false, armorPiercing: false, slashing: false,
  armorMitigation: 21, armorEnc: -17, armorClass: 'heavy', isLightlyArmored: false,
  shieldBlock: 0, shieldEnc: 0, hasShield: false,
};

const normBruiserGreatsword: Build = {
  ...NORM, name: 'Bruiser(GS)',
  weaponName: 'CF Greatsword (2H)',
  baseDamage: 15, penetration: 17, critBonus: 0, critEffect: ['bleeding'],
  weaponEnc: -5, isTwoHanded: true, bonusVsHeavy: 0,
  isDagger: false, armorPiercing: false, slashing: true,
  armorMitigation: 21, armorEnc: -17, armorClass: 'heavy', isLightlyArmored: false,
  shieldBlock: 0, shieldEnc: 0, hasShield: false,
};

// --- SKIRMISHER: Dagger + Light Armor ---
const normSkirmisher: Build = {
  ...NORM, name: 'Skirmisher',
  weaponName: 'CF Dagger',
  baseDamage: 10, penetration: 14, critBonus: 5, critEffect: ['bleeding'],
  weaponEnc: 0, isTwoHanded: false, bonusVsHeavy: 0,
  isDagger: true, armorPiercing: true, slashing: true,
  armorMitigation: 13, armorEnc: -2, armorClass: 'light', isLightlyArmored: true,
  shieldBlock: 0, shieldEnc: 0, hasShield: false,
};

// --- SKIRMISHER with dedicated stats (Cunning build) ---
const normSkirmCunning: Build = {
  name: 'Skirm(Cunning)',
  prowess: 7, fortitude: 6, cunning: 9,
  weaponName: 'CF Dagger',
  baseDamage: 10, penetration: 14, critBonus: 5, critEffect: ['bleeding'],
  weaponEnc: 0, isTwoHanded: false, bonusVsHeavy: 0,
  isDagger: true, armorPiercing: true, slashing: true,
  armorMitigation: 13, armorEnc: -2, armorClass: 'light', isLightlyArmored: true,
  shieldBlock: 0, shieldEnc: 0, hasShield: false,
};

// ═══════════════════════════════════════════════
// RPS VARIANT SIMULATOR — Test proposed mechanics
// ═══════════════════════════════════════════════

interface RPSConfig {
  twoHandedHalvesShield: boolean;   // 2H attacks halve shield block value
  twoHandedAttackVsShield: number;  // flat attack bonus for 2H vs shielded targets (0=off)
  cunningDodgeMult: number;         // dodge% = cunning * mult (only light/no armor, no shield). 0=off
  mediumDodgeMult: number;          // dodge% = cunning * mult for medium armor (0=off). Separate from light dodge
  heavyArmorDaggerDmgPenalty: number; // fractional reduction on dagger baseDmg vs heavy (0.25 = 25% less)
  shieldCritDeflection: number;     // shields add this to attacker's crit threshold (0=off)
  encumbranceInDefense: boolean;    // true=current (enc in defense roll), false=enc only in initiative
  slashingBonusDmg: number;         // bonus dmg for slashing vs light armor (default 8)
  slashingBonusPen: number;         // bonus pen for slashing vs light armor (default 5)
  bluntShieldPenalty: number;       // flat block reduction when attacker has bonusVsHeavy > 0 (blunt weapons)
  armorBasedDefense: boolean;       // true = defense uses Fort/Cunning based on armor, false = Prowess
  mediumDefenseMode: 'fortitude' | 'cunning' | 'max';  // which stat medium armor uses for defense
  daggerShieldBypass: number;       // fraction of shield block daggers ignore (0.5 = ignore 50%). 0=off
  daggerBypassLightOnly: boolean;   // if true, only isLightlyArmored daggers get shield bypass
  daggerBypassCunningScale: number; // if > 0, bypass% = cunning * this (e.g. 11 → C9=99%, C5=55%). Overrides daggerShieldBypass
  dodgeRiposte: boolean;            // when a build dodges, they get a free counter-attack (auto-hit, no crit)
  lightArmorCunningAttack: number;  // light armor: Cunning × this added to attack roll (0=off). Represents "reading the opponent"
  critsBypassMitigation: boolean;   // true = crits set mitigation to 0 (current). false = crits keep normal pen vs mit
}

const RPS_OFF: RPSConfig = { twoHandedHalvesShield: false, twoHandedAttackVsShield: 0, cunningDodgeMult: 0, mediumDodgeMult: 0, heavyArmorDaggerDmgPenalty: 0, shieldCritDeflection: 0, encumbranceInDefense: true, slashingBonusDmg: 8, slashingBonusPen: 5, bluntShieldPenalty: 0, armorBasedDefense: false, mediumDefenseMode: 'fortitude', daggerShieldBypass: 0, daggerBypassLightOnly: false, daggerBypassCunningScale: 0, dodgeRiposte: false, lightArmorCunningAttack: 0, critsBypassMitigation: true };

// Defense stat based on armor class (when armorBasedDefense is true)
function defenseStatBonus(b: Build, cfg: RPSConfig): number {
  if (!cfg.armorBasedDefense) return b.prowess * 5;
  // Light/None → Cunning, Heavy → Fortitude, Medium → depends on mode
  if (b.isLightlyArmored) return b.cunning * 5;
  if (b.armorClass === 'heavy') return b.fortitude * 5;
  // Medium armor
  if (cfg.mediumDefenseMode === 'max') return Math.max(b.fortitude, b.cunning) * 5;
  if (cfg.mediumDefenseMode === 'cunning') return b.cunning * 5;
  return b.fortitude * 5;
}

function simulateFightRPS(a: Build, b: Build, cfg: RPSConfig): FightResult {
  let hpA = maxHp(a);
  let hpB = maxHp(b);
  const maxHpA = hpA;
  const maxHpB = hpB;

  const initA = initiative(a);
  const initB = initiative(b);
  let first: Build, second: Build;
  let firstIsA: boolean;
  if (initA >= initB) { first = a; second = b; firstIsA = true; }
  else { first = b; second = a; firstIsA = false; }

  let round = 0;
  let dmgByA = 0, dmgByB = 0;
  let critsA = 0, critsB = 0;
  let hitsA = 0, hitsB = 0;
  let blocksA = 0, blocksB = 0;
  let bleedA = 0, bleedB = 0;
  let sunderA = 0, sunderB = 0;
  let stunnedA = false, stunnedB = false;
  let dodgesA = 0, dodgesB = 0; // track dodges for stats

  function canDodge(b: Build): boolean {
    if (b.hasShield) return false;
    if (b.isLightlyArmored && cfg.cunningDodgeMult > 0) return true;
    if (b.armorClass === 'medium' && cfg.mediumDodgeMult > 0) return true;
    return false;
  }
  function dodgeChance(b: Build): number {
    if (b.isLightlyArmored) return b.cunning * cfg.cunningDodgeMult;
    if (b.armorClass === 'medium') return b.cunning * cfg.mediumDodgeMult;
    return 0;
  }

  function resolveAttackRPS(
    atk: Build, def: Build,
    atkHp: number, atkMaxHp: number,
    defHp: number, defMaxHp: number,
    defSunder: number, atkSunder: number,
  ): { damage: number; isCrit: boolean; isHit: boolean; isDodge: boolean; effects: string[]; counterEffects: string[] } {
    const atkRoll = d100();
    const defRoll = d100();

    const atkWound = woundPenalty(atkHp, atkMaxHp);
    const defWound = woundPenalty(defHp, defMaxHp);

    // 2H overwhelm: flat attack bonus vs shielded targets, or halve shield block
    let overwhelmBonus = 0;
    if (atk.isTwoHanded && def.hasShield) {
      overwhelmBonus = cfg.twoHandedAttackVsShield;
    }
    // Light armor cunning attack: read opponent's moves, find openings
    const cunningAtkBonus = (cfg.lightArmorCunningAttack > 0 && atk.isLightlyArmored)
      ? atk.cunning * cfg.lightArmorCunningAttack : 0;
    const atkMod = attackBonus(atk) + overwhelmBonus + cunningAtkBonus + atkWound;
    let effectiveShieldBlock = (cfg.twoHandedHalvesShield && atk.isTwoHanded)
      ? Math.floor(def.shieldBlock / 2)
      : def.shieldBlock;
    // Blunt shield-breaker: blunt weapons (bonusVsHeavy > 0) reduce shield block
    if (cfg.bluntShieldPenalty > 0 && atk.bonusVsHeavy > 0 && def.hasShield) {
      effectiveShieldBlock = Math.max(0, effectiveShieldBlock - cfg.bluntShieldPenalty);
    }
    // Dagger shield bypass: daggers slip past shields
    if (atk.isDagger && def.hasShield) {
      let bypassFraction = 0;
      if (cfg.daggerBypassCunningScale > 0) {
        // Cunning-scaled: bypass% = cunning * scale (e.g. 11 → C9=99%, C5=55%)
        bypassFraction = Math.min(1.0, (atk.cunning * cfg.daggerBypassCunningScale) / 100);
      } else if (cfg.daggerShieldBypass > 0) {
        // Fixed bypass, optionally restricted to light armor
        if (!cfg.daggerBypassLightOnly || atk.isLightlyArmored) {
          bypassFraction = cfg.daggerShieldBypass;
        }
      }
      if (bypassFraction > 0) {
        effectiveShieldBlock = Math.floor(effectiveShieldBlock * (1 - bypassFraction));
      }
    }
    const defEnc = cfg.encumbranceInDefense ? totalEnc(def) : 0;
    const defStatBonus = defenseStatBonus(def, cfg);
    const defMod = defStatBonus + effectiveShieldBlock + defEnc + defWound;

    const atkTotal = atkRoll + atkMod;
    const defTotal = defRoll + defMod;

    if (atkTotal <= defTotal) {
      // Block — check defensive crit counter
      const defCritRoll = d100();
      const defCritThresh = critThreshold(def);
      if (defCritRoll >= defCritThresh) {
        let pen = def.penetration;
        const critEfx = def.critEffect;
        if (critEfx.includes('piercing')) pen += 10;
        if (def.slashing && atk.isLightlyArmored) pen += cfg.slashingBonusPen;
        // Counter-attacks are always crits — bypass mitigation entirely
        const netPen = pen; // pen vs 0
        const mult = damageMultiplier(netPen);
        const effectiveMult = Math.max(mult, 1.0);
        let counterBaseDmg = def.baseDamage + (def.slashing && atk.isLightlyArmored ? cfg.slashingBonusDmg : 0);
        // Heavy armor dagger penalty on counter too
        if (cfg.heavyArmorDaggerDmgPenalty > 0 && def.isDagger && atk.armorClass === 'heavy') {
          counterBaseDmg = Math.round(counterBaseDmg * (1 - cfg.heavyArmorDaggerDmgPenalty));
        }
        const counterDmg = Math.max(1, Math.round(counterBaseDmg * effectiveMult * 1.25));
        const counterEffects: string[] = [];
        for (const eff of critEfx) {
          if (eff !== 'piercing') {
            if (def.isDagger && eff === 'bleeding') {
              counterEffects.push('bleeding', 'bleeding');
            } else {
              counterEffects.push(eff);
            }
          }
        }
        return { damage: -counterDmg, isCrit: false, isHit: false, isDodge: false, effects: [], counterEffects };
      }
      return { damage: 0, isCrit: false, isHit: false, isDodge: false, effects: [], counterEffects: [] };
    }

    // Hit — check dodge
    if (canDodge(def) && d100() <= dodgeChance(def)) {
      return { damage: 0, isCrit: false, isHit: false, isDodge: true, effects: [], counterEffects: [] };
    }

    // Resolve hit — shield crit deflection raises attacker's crit threshold
    const effectiveCritThresh = (cfg.shieldCritDeflection > 0 && def.hasShield)
      ? critThreshold(atk) + cfg.shieldCritDeflection
      : critThreshold(atk);
    const isCrit = atkRoll >= effectiveCritThresh;
    let pen = atk.penetration;
    let bonusDmg = 0;
    const effects: string[] = [];

    if (atk.armorPiercing && atkRoll >= 80) pen += 5;
    if (atk.bonusVsHeavy > 0) {
      if (def.armorClass === 'heavy') pen += atk.bonusVsHeavy;
      else if (def.armorClass === 'medium') pen += Math.floor(atk.bonusVsHeavy / 2);
    }
    if (atk.slashing && def.isLightlyArmored) { bonusDmg = cfg.slashingBonusDmg; pen += cfg.slashingBonusPen; }

    if (isCrit) {
      for (const eff of atk.critEffect) {
        if (eff === 'piercing') pen += 10;
        else {
          if (atk.isDagger && eff === 'bleeding') {
            effects.push('bleeding', 'bleeding');
          } else {
            effects.push(eff);
          }
        }
      }
    }

    // Crit mitigation: bypass or keep?
    const baseMitig = def.armorMitigation - (defSunder * 5);
    const effMitig = (isCrit && cfg.critsBypassMitigation) ? 0 : Math.max(0, baseMitig);
    const netPen = pen - effMitig;
    const mult = damageMultiplier(netPen);

    let baseDmg = atk.baseDamage + bonusDmg;
    // Heavy armor dagger penalty
    if (cfg.heavyArmorDaggerDmgPenalty > 0 && atk.isDagger && def.armorClass === 'heavy') {
      baseDmg = Math.round(baseDmg * (1 - cfg.heavyArmorDaggerDmgPenalty));
    }
    const dmg = finalDamage(baseDmg, mult, isCrit);

    return { damage: dmg, isCrit, isHit: true, isDodge: false, effects, counterEffects: [] };
  }

  for (round = 1; round <= 50; round++) {
    if (bleedA > 0) { const d = 5 * bleedA; hpA -= d; dmgByB += d; if (hpA <= 0) break; }
    if (bleedB > 0) { const d = 5 * bleedB; hpB -= d; dmgByA += d; if (hpB <= 0) break; }

    const turns: Array<{ atk: 'A' | 'B' }> = firstIsA
      ? [{ atk: 'A' }, { atk: 'B' }]
      : [{ atk: 'B' }, { atk: 'A' }];

    for (const turn of turns) {
      if (hpA <= 0 || hpB <= 0) break;

      if (turn.atk === 'A') {
        if (stunnedA) { stunnedA = false; continue; }
        const res = resolveAttackRPS(a, b, hpA, maxHpA, hpB, maxHpB, sunderB, sunderA);
        if (res.isDodge) {
          dodgesB++;
          // Dodge riposte: dodger gets a free counter-strike (auto-hit, base damage, no crit)
          if (cfg.dodgeRiposte && hpA > 0 && hpB > 0) {
            const ripostePen = b.penetration;
            const riposteMitig = a.armorMitigation - (sunderA * 5);
            const riposteMult = damageMultiplier(ripostePen - Math.max(0, riposteMitig));
            const riposteDmg = Math.max(1, Math.round(b.baseDamage * riposteMult));
            hpA -= riposteDmg; dmgByB += riposteDmg; hitsB++;
          }
          continue;
        }
        if (res.isHit) {
          hitsA++; hpB -= res.damage; dmgByA += res.damage;
          if (res.isCrit) critsA++;
          for (const eff of res.effects) {
            if (eff === 'bleeding') bleedB = Math.min(3, bleedB + 1);
            if (eff === 'stunned') stunnedB = true;
            if (eff === 'sundered') sunderB = Math.min(3, sunderB + 1);
          }
          // Dagger crit bonus strike (light armor only)
          if (res.isCrit && a.isDagger && a.isLightlyArmored && hpB > 0) {
            const bonus = resolveAttackRPS(a, b, hpA, maxHpA, hpB, maxHpB, sunderB, sunderA);
            if (bonus.isDodge) { dodgesB++; }
            else if (bonus.isHit) {
              hitsA++; hpB -= bonus.damage; dmgByA += bonus.damage;
              if (bonus.isCrit) critsA++;
              for (const eff of bonus.effects) {
                if (eff === 'bleeding') bleedB = Math.min(3, bleedB + 1);
                if (eff === 'stunned') stunnedB = true;
                if (eff === 'sundered') sunderB = Math.min(3, sunderB + 1);
              }
            } else {
              blocksB++;
              if (bonus.damage < 0) {
                hpA += bonus.damage; dmgByB += Math.abs(bonus.damage);
                for (const eff of bonus.counterEffects) {
                  if (eff === 'bleeding') bleedA = Math.min(3, bleedA + 1);
                  if (eff === 'stunned') stunnedA = true;
                  if (eff === 'sundered') sunderA = Math.min(3, sunderA + 1);
                }
              }
            }
          }
        } else {
          blocksB++;
          if (res.damage < 0) {
            hpA += res.damage; dmgByB += Math.abs(res.damage);
            for (const eff of res.counterEffects) {
              if (eff === 'bleeding') bleedA = Math.min(3, bleedA + 1);
              if (eff === 'stunned') stunnedA = true;
              if (eff === 'sundered') sunderA = Math.min(3, sunderA + 1);
            }
          }
        }
      } else {
        if (stunnedB) { stunnedB = false; continue; }
        const res = resolveAttackRPS(b, a, hpB, maxHpB, hpA, maxHpA, sunderA, sunderB);
        if (res.isDodge) {
          dodgesA++;
          // Dodge riposte: dodger gets a free counter-strike
          if (cfg.dodgeRiposte && hpA > 0 && hpB > 0) {
            const ripostePen = a.penetration;
            const riposteMitig = b.armorMitigation - (sunderB * 5);
            const riposteMult = damageMultiplier(ripostePen - Math.max(0, riposteMitig));
            const riposteDmg = Math.max(1, Math.round(a.baseDamage * riposteMult));
            hpB -= riposteDmg; dmgByA += riposteDmg; hitsA++;
          }
          continue;
        }
        if (res.isHit) {
          hitsB++; hpA -= res.damage; dmgByB += res.damage;
          if (res.isCrit) critsB++;
          for (const eff of res.effects) {
            if (eff === 'bleeding') bleedA = Math.min(3, bleedA + 1);
            if (eff === 'stunned') stunnedA = true;
            if (eff === 'sundered') sunderA = Math.min(3, sunderA + 1);
          }
          // Dagger crit bonus strike (light armor only)
          if (res.isCrit && b.isDagger && b.isLightlyArmored && hpA > 0) {
            const bonus = resolveAttackRPS(b, a, hpB, maxHpB, hpA, maxHpA, sunderA, sunderB);
            if (bonus.isDodge) { dodgesA++; }
            else if (bonus.isHit) {
              hitsB++; hpA -= bonus.damage; dmgByB += bonus.damage;
              if (bonus.isCrit) critsB++;
              for (const eff of bonus.effects) {
                if (eff === 'bleeding') bleedA = Math.min(3, bleedA + 1);
                if (eff === 'stunned') stunnedA = true;
                if (eff === 'sundered') sunderA = Math.min(3, sunderA + 1);
              }
            } else {
              blocksA++;
              if (bonus.damage < 0) {
                hpB += bonus.damage; dmgByA += Math.abs(bonus.damage);
                for (const eff of bonus.counterEffects) {
                  if (eff === 'bleeding') bleedB = Math.min(3, bleedB + 1);
                  if (eff === 'stunned') stunnedB = true;
                  if (eff === 'sundered') sunderB = Math.min(3, sunderB + 1);
                }
              }
            }
          }
        } else {
          blocksA++;
          if (res.damage < 0) {
            hpB += res.damage; dmgByA += Math.abs(res.damage);
            for (const eff of res.counterEffects) {
              if (eff === 'bleeding') bleedB = Math.min(3, bleedB + 1);
              if (eff === 'stunned') stunnedB = true;
              if (eff === 'sundered') sunderB = Math.min(3, sunderB + 1);
            }
          }
        }
      }
    }
    if (hpA <= 0 || hpB <= 0) break;
  }

  const winner = hpA > hpB ? a.name : b.name;
  const winnerHp = hpA > hpB ? hpA : hpB;
  const winnerMaxHp = hpA > hpB ? maxHpA : maxHpB;

  return {
    winner, rounds: round,
    winnerHpPct: Math.round((winnerHp / winnerMaxHp) * 100),
    totalDamageByA: dmgByA, totalDamageByB: dmgByB,
    critsA, critsB, hitsA, hitsB, blocksA, blocksB,
    dodgesA, dodgesB,
  };
}

function simulateRPS(a: Build, b: Build, cfg: RPSConfig, n: number = 10000) {
  let winsA = 0, winsB = 0;
  let totalRounds = 0, totalWinnerHp = 0;
  let totalDodgesA = 0, totalDodgesB = 0;

  for (let i = 0; i < n; i++) {
    const r = simulateFightRPS(a, b, cfg);
    if (r.winner === a.name) winsA++; else winsB++;
    totalRounds += r.rounds;
    totalWinnerHp += r.winnerHpPct;
    totalDodgesA += r.dodgesA;
    totalDodgesB += r.dodgesB;
  }

  const pctA = ((winsA/n)*100).toFixed(1);
  const pctB = ((winsB/n)*100).toFixed(1);
  const winnerName = winsA >= winsB ? a.name : b.name;
  const winnerPct = winsA >= winsB ? pctA : pctB;
  let line = `  ${a.name.padEnd(20)} ${pctA.padStart(5)}%  vs  ${pctB.padStart(5)}%  ${b.name.padEnd(20)}  → ${winnerName} wins (${winnerPct}%, ${(totalRounds/n).toFixed(1)} rds, ${(totalWinnerHp/n).toFixed(0)}% HP left)`;
  if (totalDodgesA > 0 || totalDodgesB > 0) {
    line += `  [dodges: ${(totalDodgesA/n).toFixed(1)}/${(totalDodgesB/n).toFixed(1)}]`;
  }
  console.log(line);
}

// ═══════════════════════════════════════════════
// DODGE MECHANIC TEST — Cunning × 2% Dodge
// ═══════════════════════════════════════════════
// Dodge: only light armor + no shield (Skirmishers).
// Tank (heavy + shield) and Bruiser (heavy) CANNOT dodge.
//
// Test plan:
//   A) Baseline — no dodge, Cunning-invested skirmishers
//   B) Dodge ON — same builds, Cunning × 2% dodge
//   C) Dodge ON — normalized C5 skirmishers (10% dodge) for comparison

// --- RPS Configs ---
const BASELINE_CFG: RPSConfig = {
  twoHandedHalvesShield: true,
  twoHandedAttackVsShield: 10,
  cunningDodgeMult: 0,
  mediumDodgeMult: 0,
  heavyArmorDaggerDmgPenalty: 0,
  shieldCritDeflection: 5,
  encumbranceInDefense: false,
  slashingBonusDmg: 8,
  slashingBonusPen: 5,
  bluntShieldPenalty: 0,
  armorBasedDefense: false,
  mediumDefenseMode: 'fortitude',
  daggerShieldBypass: 0,
  daggerBypassLightOnly: false,
  daggerBypassCunningScale: 0,
  dodgeRiposte: false,
  lightArmorCunningAttack: 0,
  critsBypassMitigation: true,
};

// ═══════════════════════════════════════════════
// DEFENSE TRACK TEST — Prowess out of defense
// ═══════════════════════════════════════════════
// Attack: d100 + (Prowess × 5) + overwhelm
// Defense: d100 + (DefenseStat × 5) + shieldBlock
//   Heavy → Fortitude    (stand firm, absorb hits)
//   Light/None → Cunning (evade, read opponent)
//   Medium → test three options: Fortitude, Cunning, or max(Fort,Cunning)

// --- Configs ---
const DEFENSE_FORT: RPSConfig = {
  ...BASELINE_CFG,
  armorBasedDefense: true,
  mediumDefenseMode: 'fortitude',
};

const DEFENSE_MAX: RPSConfig = {
  ...BASELINE_CFG,
  armorBasedDefense: true,
  mediumDefenseMode: 'max',
};

// --- Builds ---

// Tank: CF Bastard Sword + CF Tower Shield + CF Heavy Armor
// P9/F7/C5/S9 — Defense(Fort): F7×5 = 35 + S9×3 + 32 shield = 94
const focusTank: Build = {
  ...NORM, name: 'Tank(Sword+Tower)',
  weaponName: 'CF Bastard Sword + CF Tower Shield',
  baseDamage: 14, penetration: 15, critBonus: 0, critEffect: ['bleeding'],
  weaponEnc: 0, isTwoHanded: false, bonusVsHeavy: 0,
  isDagger: false, armorPiercing: false, slashing: true,
  armorMitigation: 21, armorEnc: -17, armorClass: 'heavy', isLightlyArmored: false,
  shieldBlock: 32, shieldEnc: -8, hasShield: true,
};

// Bruiser: CF Great Warhammer 2H + CF Heavy Armor
// P9/F7/C5/S9 — Defense(Fort): F7×5 = 35 + S9×3 = 62
const focusBruiser: Build = {
  ...NORM, name: 'Bruiser(GHammer)',
  weaponName: 'CF Great Warhammer (2H)',
  baseDamage: 18, penetration: 30, critBonus: 0, critEffect: ['stunned'],
  weaponEnc: -13, isTwoHanded: true, bonusVsHeavy: 8,
  isDagger: false, armorPiercing: false, slashing: false,
  armorMitigation: 21, armorEnc: -17, armorClass: 'heavy', isLightlyArmored: false,
  shieldBlock: 0, shieldEnc: 0, hasShield: false,
};

// Tank(VS Greatsword) — P9/F7/C5/S9
// Valyrian Greatsword 2H: pen 23, baseDmg 15, slashing, bleed, 0 weapon enc
// CF Heavy Armor: mit 21, enc -17. No shield. 2H overwhelm.
// Defense(Fort): F7×5 = 35 + S9×3 = 62. Total enc: -17 (vs Bruiser's -30!)
const tankGreatsword: Build = {
  ...NORM, name: 'Tank(VSGreat)',
  weaponName: 'Valyrian Greatsword (2H)',
  baseDamage: 15, penetration: 23, critBonus: 0, critEffect: ['bleeding'],
  weaponEnc: 0, isTwoHanded: true, bonusVsHeavy: 0,
  isDagger: false, armorPiercing: false, slashing: true,
  armorMitigation: 21, armorEnc: -17, armorClass: 'heavy', isLightlyArmored: false,
  shieldBlock: 0, shieldEnc: 0, hasShield: false,
};

// Tank(CF Great Warhammer) — same as focusBruiser, aliased for clarity
// CF Great Warhammer 2H: pen = 20 + 10 = 30, baseDmg 18, stun crit, bonusVsHeavy 8
// CF 2H enc = -5, encMod -8 → weapon enc = -13
// CF Heavy Armor: mit 21, enc -17. Total enc: -30.
// NOTE: This is the same build as focusBruiser / Bruiser(GHammer).
const tankCFHammer = focusBruiser;

// Skirmisher(Dagger) — P7/F6/C9/S9
// Defense(Cunning): C9×5 = 45 + S9×3 = 72
const skirmDaggerC9: Build = {
  name: 'Skirm(Dag,C9)',
  prowess: 7, fortitude: 6, cunning: 9,
  weaponName: 'CF Dagger',
  baseDamage: 10, penetration: 14, critBonus: 5, critEffect: ['bleeding'],
  weaponEnc: 0, isTwoHanded: false, bonusVsHeavy: 0,
  isDagger: true, armorPiercing: true, slashing: true,
  armorMitigation: 13, armorEnc: -9, armorClass: 'light', isLightlyArmored: true,
  shieldBlock: 0, shieldEnc: 0, hasShield: false,
};

// Skirmisher(VS Greatsword) — P7/F6/C9/S9
// Valyrian Greatsword 2H: pen = 26 + (-3) = 23, baseDmg 15, slashing, bleed crit
// Valyrian 2H enc = 0 (!) + no greatsword encMod = 0 total weapon enc
// CF Light Armor: mit 13, enc -9
// Defense(Cunning): C9×5 = 45 + S9×3 = 72. 2H overwhelm vs shields.
const skirmGreatsword: Build = {
  name: 'Skirm(VSGreat)',
  prowess: 7, fortitude: 6, cunning: 9,
  weaponName: 'Valyrian Greatsword (2H)',
  baseDamage: 15, penetration: 23, critBonus: 0, critEffect: ['bleeding'],
  weaponEnc: 0, isTwoHanded: true, bonusVsHeavy: 0,
  isDagger: false, armorPiercing: false, slashing: true,
  armorMitigation: 13, armorEnc: -9, armorClass: 'light', isLightlyArmored: true,
  shieldBlock: 0, shieldEnc: 0, hasShield: false,
};

// Skirmisher(Mace) — P7/F6/C9/S9
// Defense(Cunning): C9×5 = 45 + S9×3 = 72
const skirmMaceC9: Build = {
  name: 'Skirm(Mace,C9)',
  prowess: 7, fortitude: 6, cunning: 9,
  weaponName: 'CF Mace 1H',
  baseDamage: 16, penetration: 23, critBonus: 0, critEffect: ['stunned'],
  weaponEnc: -3, isTwoHanded: false, bonusVsHeavy: 5,
  isDagger: false, armorPiercing: false, slashing: false,
  armorMitigation: 13, armorEnc: -9, armorClass: 'light', isLightlyArmored: true,
  shieldBlock: 0, shieldEnc: 0, hasShield: false,
};

// --- Medium Armor Builds (Sellsword archetype) ---

// Sellsword A: P8/F6/C8/S9 — CF Bastard Sword, CF Medium Armor (mit 16, enc -12)
// Defense(Fort): F6×5=30+27=57 | Defense(Cunning): C8×5=40+27=67 | Defense(max): max(6,8)×5=40+27=67
const sellswordA: Build = {
  name: 'Sellsword(P8C8)',
  prowess: 8, fortitude: 6, cunning: 8,
  weaponName: 'CF Bastard Sword + Medium Armor',
  baseDamage: 14, penetration: 15, critBonus: 0, critEffect: ['bleeding'],
  weaponEnc: 0, isTwoHanded: false, bonusVsHeavy: 0,
  isDagger: false, armorPiercing: false, slashing: true,
  armorMitigation: 16, armorEnc: -12, armorClass: 'medium', isLightlyArmored: false,
  shieldBlock: 0, shieldEnc: 0, hasShield: false,
};

// Man-at-Arms: P9/F7/C5/S9 — CF Spear, CF Medium Armor, CF Heater Shield (block 24, enc -3)
// Defense(Fort): F7×5=35+27+24=86 | Defense(max): max(7,5)=35+27+24=86
const manAtArms: Build = {
  ...NORM, name: 'Man-at-Arms(Med)',
  weaponName: 'CF Spear + CF Heater + Medium Armor',
  baseDamage: 14, penetration: 24, critBonus: 0, critEffect: ['piercing'],
  weaponEnc: 0, isTwoHanded: false, bonusVsHeavy: 0,
  isDagger: false, armorPiercing: false, slashing: false,
  armorMitigation: 16, armorEnc: -12, armorClass: 'medium', isLightlyArmored: false,
  shieldBlock: 24, shieldEnc: -3, hasShield: true,
};

// ── Helper to show defense stat for a build under a config ──
function defLabel(b: Build, cfg: RPSConfig): string {
  const stat = defenseStatBonus(b, cfg);
  const src = !cfg.armorBasedDefense ? 'Prow' :
    b.isLightlyArmored ? 'Cun' :
    b.armorClass === 'heavy' ? 'Fort' :
    cfg.mediumDefenseMode === 'max' ? 'max(F,C)' :
    cfg.mediumDefenseMode === 'cunning' ? 'Cun' : 'Fort';
  return `Def(${src}): ${stat}`;
}

// ── Output ──

console.log('\n🗡️  DEFENSE TRACK TEST — Prowess removed from defense  🗡️');
console.log('Attack: d100 + (Prowess×5)');
console.log('Defense: d100 + (DefenseStat×5) + shieldBlock');
console.log('  Heavy → Fortitude | Light → Cunning | Medium → varies');
console.log('All simulations: 10,000 fights each\n');

console.log('Build Summary (under armor-based defense, medium=Fort):');
console.log(`  Tank(Sword+Tower):  P${focusTank.prowess}/F${focusTank.fortitude}/C${focusTank.cunning} | HP ${maxHp(focusTank)} | Atk +${attackBonus(focusTank)} | ${defLabel(focusTank, DEFENSE_FORT)} +shield ${focusTank.shieldBlock} | Pen ${focusTank.penetration} | Mit ${focusTank.armorMitigation}`);
console.log(`  Bruiser(GHammer):   P${focusBruiser.prowess}/F${focusBruiser.fortitude}/C${focusBruiser.cunning} | HP ${maxHp(focusBruiser)} | Atk +${attackBonus(focusBruiser)} | ${defLabel(focusBruiser, DEFENSE_FORT)} | Pen ${focusBruiser.penetration} | Mit ${focusBruiser.armorMitigation}`);
console.log(`  Skirm(Dag,C9):      P${skirmDaggerC9.prowess}/F${skirmDaggerC9.fortitude}/C${skirmDaggerC9.cunning} | HP ${maxHp(skirmDaggerC9)} | Atk +${attackBonus(skirmDaggerC9)} | ${defLabel(skirmDaggerC9, DEFENSE_FORT)} | Pen ${skirmDaggerC9.penetration} | Mit ${skirmDaggerC9.armorMitigation}`);
console.log(`  Skirm(Mace,C9):     P${skirmMaceC9.prowess}/F${skirmMaceC9.fortitude}/C${skirmMaceC9.cunning} | HP ${maxHp(skirmMaceC9)} | Atk +${attackBonus(skirmMaceC9)} | ${defLabel(skirmMaceC9, DEFENSE_FORT)} | Pen ${skirmMaceC9.penetration} | Mit ${skirmMaceC9.armorMitigation}`);
console.log(`  Sellsword(P8C8):    P${sellswordA.prowess}/F${sellswordA.fortitude}/C${sellswordA.cunning} | HP ${maxHp(sellswordA)} | Atk +${attackBonus(sellswordA)} | ${defLabel(sellswordA, DEFENSE_FORT)} (Fort) / ${defLabel(sellswordA, DEFENSE_MAX)} (max) | Pen ${sellswordA.penetration} | Mit ${sellswordA.armorMitigation}`);
console.log(`  Man-at-Arms(Med):   P${manAtArms.prowess}/F${manAtArms.fortitude}/C${manAtArms.cunning} | HP ${maxHp(manAtArms)} | Atk +${attackBonus(manAtArms)} | ${defLabel(manAtArms, DEFENSE_FORT)} +shield ${manAtArms.shieldBlock} | Pen ${manAtArms.penetration} | Mit ${manAtArms.armorMitigation}`);

// ── A) Baseline (Prowess defense) for reference ──
console.log('\n═══════════════════════════════════════════════');
console.log('  A) BASELINE — Prowess defense (current system)');
console.log('═══════════════════════════════════════════════');
console.log('  Defense = d100 + (Prowess×5) + shieldBlock\n');
simulateRPS(focusTank, focusBruiser, BASELINE_CFG);
simulateRPS(focusTank, skirmDaggerC9, BASELINE_CFG);
simulateRPS(focusTank, skirmMaceC9, BASELINE_CFG);
simulateRPS(focusBruiser, skirmDaggerC9, BASELINE_CFG);
simulateRPS(focusBruiser, skirmMaceC9, BASELINE_CFG);

// ── B) Armor-based defense (medium = Fortitude) ──
console.log('\n═══════════════════════════════════════════════');
console.log('  B) ARMOR-BASED — Heavy/Medium→Fort, Light→Cunning');
console.log('═══════════════════════════════════════════════\n');
simulateRPS(focusTank, focusBruiser, DEFENSE_FORT);
simulateRPS(focusTank, skirmDaggerC9, DEFENSE_FORT);
simulateRPS(focusTank, skirmMaceC9, DEFENSE_FORT);
simulateRPS(focusBruiser, skirmDaggerC9, DEFENSE_FORT);
simulateRPS(focusBruiser, skirmMaceC9, DEFENSE_FORT);

// ── C) Armor-based defense (medium = max(Fort,Cunning)) ──
console.log('\n═══════════════════════════════════════════════');
console.log('  C) ARMOR-BASED — Heavy→Fort, Light→Cun, Medium→max(F,C)');
console.log('═══════════════════════════════════════════════\n');
simulateRPS(focusTank, focusBruiser, DEFENSE_MAX);
simulateRPS(focusTank, skirmDaggerC9, DEFENSE_MAX);
simulateRPS(focusTank, skirmMaceC9, DEFENSE_MAX);
simulateRPS(focusBruiser, skirmDaggerC9, DEFENSE_MAX);
simulateRPS(focusBruiser, skirmMaceC9, DEFENSE_MAX);

// ── D) Medium armor matchups ──
console.log('\n═══════════════════════════════════════════════');
console.log('  D) MEDIUM ARMOR — Sellsword & Man-at-Arms vs all');
console.log('═══════════════════════════════════════════════');
console.log('  Medium = Fortitude:\n');
simulateRPS(focusTank, sellswordA, DEFENSE_FORT);
simulateRPS(focusTank, manAtArms, DEFENSE_FORT);
simulateRPS(focusBruiser, sellswordA, DEFENSE_FORT);
simulateRPS(focusBruiser, manAtArms, DEFENSE_FORT);
simulateRPS(sellswordA, skirmDaggerC9, DEFENSE_FORT);
simulateRPS(manAtArms, skirmDaggerC9, DEFENSE_FORT);
console.log('\n  Medium = max(Fort,Cunning):\n');
simulateRPS(focusTank, sellswordA, DEFENSE_MAX);
simulateRPS(focusTank, manAtArms, DEFENSE_MAX);
simulateRPS(focusBruiser, sellswordA, DEFENSE_MAX);
simulateRPS(focusBruiser, manAtArms, DEFENSE_MAX);
simulateRPS(sellswordA, skirmDaggerC9, DEFENSE_MAX);
simulateRPS(manAtArms, skirmDaggerC9, DEFENSE_MAX);

// ── E) Armor-based + dodge (does dodge stack too much?) ──
console.log('\n═══════════════════════════════════════════════');
console.log('  E) ARMOR-BASED + DODGE (2% per Cunning)');
console.log('═══════════════════════════════════════════════');
console.log('  Cunning in defense + dodge on top — too much?\n');
const DEFENSE_DODGE: RPSConfig = { ...DEFENSE_FORT, cunningDodgeMult: 2 };
simulateRPS(focusTank, skirmDaggerC9, DEFENSE_DODGE);
simulateRPS(focusTank, skirmMaceC9, DEFENSE_DODGE);
simulateRPS(focusBruiser, skirmDaggerC9, DEFENSE_DODGE);
simulateRPS(focusBruiser, skirmMaceC9, DEFENSE_DODGE);

// ═══════════════════════════════════════════════════════════════
// F) DAGGER SHIELD BYPASS — daggers slip past shields
// ═══════════════════════════════════════════════════════════════
// Problem: Tower Shield +32 block creates a 32-point gap daggers can't overcome.
// Proposal: daggers ignore a fraction of shield block (small, quick weapons).
// Test: 50% bypass (tower shield 32 → effective 16 vs dagger)

console.log('\n═══════════════════════════════════════════════');
console.log('  F) DAGGER SHIELD BYPASS — daggers ignore 50% of shield block');
console.log('═══════════════════════════════════════════════');
console.log('  Armor-based defense + 2% dodge + 50% dagger shield bypass\n');
const DAGGER_BYPASS_50: RPSConfig = { ...DEFENSE_FORT, cunningDodgeMult: 2, daggerShieldBypass: 0.50 };
simulateRPS(focusTank, skirmDaggerC9, DAGGER_BYPASS_50);
simulateRPS(focusTank, skirmMaceC9, DAGGER_BYPASS_50);   // mace unaffected (not dagger)
simulateRPS(focusBruiser, skirmDaggerC9, DAGGER_BYPASS_50);
simulateRPS(focusBruiser, skirmMaceC9, DAGGER_BYPASS_50);
// Also check Tank mirrors aren't broken
simulateRPS(focusTank, focusBruiser, DAGGER_BYPASS_50);

console.log('\n  75% dagger shield bypass:\n');
const DAGGER_BYPASS_75: RPSConfig = { ...DEFENSE_FORT, cunningDodgeMult: 2, daggerShieldBypass: 0.75 };
simulateRPS(focusTank, skirmDaggerC9, DAGGER_BYPASS_75);
simulateRPS(focusBruiser, skirmDaggerC9, DAGGER_BYPASS_75);
simulateRPS(focusTank, focusBruiser, DAGGER_BYPASS_75);

console.log('\n  100% dagger shield bypass (full ignore):\n');
const DAGGER_BYPASS_100: RPSConfig = { ...DEFENSE_FORT, cunningDodgeMult: 2, daggerShieldBypass: 1.0 };
simulateRPS(focusTank, skirmDaggerC9, DAGGER_BYPASS_100);
simulateRPS(focusBruiser, skirmDaggerC9, DAGGER_BYPASS_100);
simulateRPS(focusTank, focusBruiser, DAGGER_BYPASS_100);

// ═══════════════════════════════════════════════════════════════
// G) DODGE RIPOSTE — dodging grants a free counter-strike
// ═══════════════════════════════════════════════════════════════
// Makes dodge both defensive AND offensive. Thematic: nimble fighter
// sidesteps and punishes the overcommitted swing.

console.log('\n═══════════════════════════════════════════════');
console.log('  G) DODGE RIPOSTE — dodge triggers free counter-strike');
console.log('═══════════════════════════════════════════════');
console.log('  Armor-based + 2% dodge + riposte (auto-hit, base dmg, no crit)\n');
const DODGE_RIPOSTE: RPSConfig = { ...DEFENSE_FORT, cunningDodgeMult: 2, dodgeRiposte: true };
simulateRPS(focusTank, skirmDaggerC9, DODGE_RIPOSTE);
simulateRPS(focusTank, skirmMaceC9, DODGE_RIPOSTE);
simulateRPS(focusBruiser, skirmDaggerC9, DODGE_RIPOSTE);
simulateRPS(focusBruiser, skirmMaceC9, DODGE_RIPOSTE);
simulateRPS(focusTank, focusBruiser, DODGE_RIPOSTE);

// ═══════════════════════════════════════════════════════════════
// H) FULL PACKAGE — all skirmisher buffs combined
// ═══════════════════════════════════════════════════════════════
// Defense tracks + dodge + shield bypass + riposte

console.log('\n═══════════════════════════════════════════════');
console.log('  H) FULL PACKAGE — defense tracks + dodge + bypass + riposte');
console.log('═══════════════════════════════════════════════');
console.log('  50% dagger shield bypass + 2% dodge + riposte\n');
const FULL_50: RPSConfig = { ...DEFENSE_FORT, cunningDodgeMult: 2, daggerShieldBypass: 0.50, dodgeRiposte: true };
simulateRPS(focusTank, skirmDaggerC9, FULL_50);
simulateRPS(focusTank, skirmMaceC9, FULL_50);
simulateRPS(focusBruiser, skirmDaggerC9, FULL_50);
simulateRPS(focusBruiser, skirmMaceC9, FULL_50);
simulateRPS(focusTank, focusBruiser, FULL_50);

console.log('\n  75% dagger shield bypass + 2% dodge + riposte:\n');
const FULL_75: RPSConfig = { ...DEFENSE_FORT, cunningDodgeMult: 2, daggerShieldBypass: 0.75, dodgeRiposte: true };
simulateRPS(focusTank, skirmDaggerC9, FULL_75);
simulateRPS(focusBruiser, skirmDaggerC9, FULL_75);
simulateRPS(focusTank, focusBruiser, FULL_75);

// ═══════════════════════════════════════════════════════════════
// I) HIGHER DODGE RATES — 3% and 4% per Cunning
// ═══════════════════════════════════════════════════════════════

console.log('\n═══════════════════════════════════════════════');
console.log('  I) HIGHER DODGE — 3% and 4% per Cunning');
console.log('═══════════════════════════════════════════════');
console.log('  Armor-based defense, NO shield bypass, NO riposte\n');
console.log('  3% per Cunning (C9 = 27% dodge):\n');
const DODGE_3PCT: RPSConfig = { ...DEFENSE_FORT, cunningDodgeMult: 3 };
simulateRPS(focusTank, skirmDaggerC9, DODGE_3PCT);
simulateRPS(focusBruiser, skirmDaggerC9, DODGE_3PCT);
simulateRPS(focusTank, focusBruiser, DODGE_3PCT);

console.log('\n  4% per Cunning (C9 = 36% dodge):\n');
const DODGE_4PCT: RPSConfig = { ...DEFENSE_FORT, cunningDodgeMult: 4 };
simulateRPS(focusTank, skirmDaggerC9, DODGE_4PCT);
simulateRPS(focusBruiser, skirmDaggerC9, DODGE_4PCT);
simulateRPS(focusTank, focusBruiser, DODGE_4PCT);

// ═══════════════════════════════════════════════════════════════
// J) AGGRESSIVE COMBOS — find what it takes to hit 55-65%
// ═══════════════════════════════════════════════════════════════

console.log('\n═══════════════════════════════════════════════');
console.log('  J) AGGRESSIVE COMBOS — dialing in Tank vs Skirmisher');
console.log('═══════════════════════════════════════════════');

// J1: 100% shield bypass + 3% dodge + riposte
console.log('\n  J1) 100% bypass + 3% dodge + riposte:\n');
const J1: RPSConfig = { ...DEFENSE_FORT, cunningDodgeMult: 3, daggerShieldBypass: 1.0, dodgeRiposte: true };
simulateRPS(focusTank, skirmDaggerC9, J1);
simulateRPS(focusBruiser, skirmDaggerC9, J1);
simulateRPS(focusTank, focusBruiser, J1);

// J2: 100% bypass + 4% dodge + riposte
console.log('\n  J2) 100% bypass + 4% dodge + riposte:\n');
const J2: RPSConfig = { ...DEFENSE_FORT, cunningDodgeMult: 4, daggerShieldBypass: 1.0, dodgeRiposte: true };
simulateRPS(focusTank, skirmDaggerC9, J2);
simulateRPS(focusBruiser, skirmDaggerC9, J2);
simulateRPS(focusTank, focusBruiser, J2);

// J3: 75% bypass + 3% dodge + riposte
console.log('\n  J3) 75% bypass + 3% dodge + riposte:\n');
const J3: RPSConfig = { ...DEFENSE_FORT, cunningDodgeMult: 3, daggerShieldBypass: 0.75, dodgeRiposte: true };
simulateRPS(focusTank, skirmDaggerC9, J3);
simulateRPS(focusBruiser, skirmDaggerC9, J3);
simulateRPS(focusTank, focusBruiser, J3);

// J4: 50% bypass + 3% dodge + riposte
console.log('\n  J4) 50% bypass + 3% dodge + riposte:\n');
const J4: RPSConfig = { ...DEFENSE_FORT, cunningDodgeMult: 3, daggerShieldBypass: 0.50, dodgeRiposte: true };
simulateRPS(focusTank, skirmDaggerC9, J4);
simulateRPS(focusBruiser, skirmDaggerC9, J4);
simulateRPS(focusTank, focusBruiser, J4);

// J5: Now check Skirm(Mace) in best configs too
console.log('\n  J5) Mace skirmisher in J3 config (75% bypass + 3% dodge + riposte):\n');
simulateRPS(focusTank, skirmMaceC9, J3);
simulateRPS(focusBruiser, skirmMaceC9, J3);

// ═══════════════════════════════════════════════════════════════
// K) CUNNING ATTACK BONUS — light armor reads the opponent
// ═══════════════════════════════════════════════════════════════
// Light armor builds get Cunning × N added to attack roll.
// C9 skirm: +18 (at ×2) or +27 (at ×3). Closes the Prowess gap.
// Tank (heavy) and Bruiser (heavy) are NOT affected.

console.log('\n═══════════════════════════════════════════════');
console.log('  K) CUNNING ATTACK BONUS — light armor reads opponent');
console.log('═══════════════════════════════════════════════');

// K1: Defense tracks + 2% dodge + 100% bypass + Cunning×2 attack
console.log('\n  K1) 100% bypass + 2% dodge + Cunning×2 attack (no riposte):\n');
const K1: RPSConfig = { ...DEFENSE_FORT, cunningDodgeMult: 2, daggerShieldBypass: 1.0, lightArmorCunningAttack: 2 };
simulateRPS(focusTank, skirmDaggerC9, K1);
simulateRPS(focusTank, skirmMaceC9, K1);
simulateRPS(focusBruiser, skirmDaggerC9, K1);
simulateRPS(focusBruiser, skirmMaceC9, K1);
simulateRPS(focusTank, focusBruiser, K1);

// K2: Defense tracks + 2% dodge + 75% bypass + Cunning×2 attack
console.log('\n  K2) 75% bypass + 2% dodge + Cunning×2 attack (no riposte):\n');
const K2: RPSConfig = { ...DEFENSE_FORT, cunningDodgeMult: 2, daggerShieldBypass: 0.75, lightArmorCunningAttack: 2 };
simulateRPS(focusTank, skirmDaggerC9, K2);
simulateRPS(focusTank, skirmMaceC9, K2);
simulateRPS(focusBruiser, skirmDaggerC9, K2);
simulateRPS(focusBruiser, skirmMaceC9, K2);
simulateRPS(focusTank, focusBruiser, K2);

// K3: Defense tracks + 2% dodge + 50% bypass + Cunning×2 attack
console.log('\n  K3) 50% bypass + 2% dodge + Cunning×2 attack (no riposte):\n');
const K3: RPSConfig = { ...DEFENSE_FORT, cunningDodgeMult: 2, daggerShieldBypass: 0.50, lightArmorCunningAttack: 2 };
simulateRPS(focusTank, skirmDaggerC9, K3);
simulateRPS(focusTank, skirmMaceC9, K3);
simulateRPS(focusBruiser, skirmDaggerC9, K3);
simulateRPS(focusBruiser, skirmMaceC9, K3);
simulateRPS(focusTank, focusBruiser, K3);

// K4: Defense tracks + 2% dodge + NO bypass + Cunning×2 attack
console.log('\n  K4) NO bypass + 2% dodge + Cunning×2 attack (no riposte):\n');
const K4: RPSConfig = { ...DEFENSE_FORT, cunningDodgeMult: 2, lightArmorCunningAttack: 2 };
simulateRPS(focusTank, skirmDaggerC9, K4);
simulateRPS(focusTank, skirmMaceC9, K4);
simulateRPS(focusBruiser, skirmDaggerC9, K4);
simulateRPS(focusBruiser, skirmMaceC9, K4);
simulateRPS(focusTank, focusBruiser, K4);

// K5: Cunning×3 attack (more aggressive) — no bypass, 2% dodge
console.log('\n  K5) NO bypass + 2% dodge + Cunning×3 attack (no riposte):\n');
const K5: RPSConfig = { ...DEFENSE_FORT, cunningDodgeMult: 2, lightArmorCunningAttack: 3 };
simulateRPS(focusTank, skirmDaggerC9, K5);
simulateRPS(focusTank, skirmMaceC9, K5);
simulateRPS(focusBruiser, skirmDaggerC9, K5);
simulateRPS(focusBruiser, skirmMaceC9, K5);
simulateRPS(focusTank, focusBruiser, K5);

// ═══════════════════════════════════════════════════════════════
// L) FINE-TUNING — modest Cunning attack + bypass combinations
// ═══════════════════════════════════════════════════════════════

console.log('\n═══════════════════════════════════════════════');
console.log('  L) FINE-TUNING — Cunning×1 attack + bypass');
console.log('═══════════════════════════════════════════════');

// L1: 100% bypass + 2% dodge + Cunning×1 attack
console.log('\n  L1) 100% bypass + 2% dodge + Cunning×1 attack:\n');
const L1: RPSConfig = { ...DEFENSE_FORT, cunningDodgeMult: 2, daggerShieldBypass: 1.0, lightArmorCunningAttack: 1 };
simulateRPS(focusTank, skirmDaggerC9, L1);
simulateRPS(focusTank, skirmMaceC9, L1);
simulateRPS(focusBruiser, skirmDaggerC9, L1);
simulateRPS(focusBruiser, skirmMaceC9, L1);
simulateRPS(focusTank, focusBruiser, L1);

// L2: 75% bypass + 2% dodge + Cunning×1 attack
console.log('\n  L2) 75% bypass + 2% dodge + Cunning×1 attack:\n');
const L2: RPSConfig = { ...DEFENSE_FORT, cunningDodgeMult: 2, daggerShieldBypass: 0.75, lightArmorCunningAttack: 1 };
simulateRPS(focusTank, skirmDaggerC9, L2);
simulateRPS(focusTank, skirmMaceC9, L2);
simulateRPS(focusBruiser, skirmDaggerC9, L2);
simulateRPS(focusBruiser, skirmMaceC9, L2);
simulateRPS(focusTank, focusBruiser, L2);

// L3: NO bypass + 2% dodge + Cunning×1 attack (just the attack buff)
console.log('\n  L3) NO bypass + 2% dodge + Cunning×1 attack:\n');
const L3: RPSConfig = { ...DEFENSE_FORT, cunningDodgeMult: 2, lightArmorCunningAttack: 1 };
simulateRPS(focusTank, skirmDaggerC9, L3);
simulateRPS(focusTank, skirmMaceC9, L3);
simulateRPS(focusBruiser, skirmDaggerC9, L3);
simulateRPS(focusBruiser, skirmMaceC9, L3);
simulateRPS(focusTank, focusBruiser, L3);

// L4: 100% bypass + 2% dodge + Cunning×1 attack + riposte
console.log('\n  L4) 100% bypass + 2% dodge + Cunning×1 attack + riposte:\n');
const L4: RPSConfig = { ...DEFENSE_FORT, cunningDodgeMult: 2, daggerShieldBypass: 1.0, lightArmorCunningAttack: 1, dodgeRiposte: true };
simulateRPS(focusTank, skirmDaggerC9, L4);
simulateRPS(focusTank, skirmMaceC9, L4);
simulateRPS(focusBruiser, skirmDaggerC9, L4);
simulateRPS(focusBruiser, skirmMaceC9, L4);
simulateRPS(focusTank, focusBruiser, L4);

// ═══════════════════════════════════════════════════════════════
// M) TANK 2H HAMMER vs TANK DAGGER — both heavy armor
// ═══════════════════════════════════════════════════════════════
// 2H Hammer: P9/F7/C5/S9 — CF Great Warhammer + CF Heavy Armor
// Tank Dagger: P9/F7/C5/S9 — CF Dagger + CF Heavy Armor (no shield)
// Note: dagger in heavy armor gets NO dodge (heavy = not lightly armored)
//       dagger shield bypass irrelevant (2H hammer has no shield)

const tankDagger: Build = {
  ...NORM, name: 'Tank(Dagger)',
  weaponName: 'CF Dagger + CF Heavy Armor',
  baseDamage: 10, penetration: 14, critBonus: 5, critEffect: ['bleeding'],
  weaponEnc: 0, isTwoHanded: false, bonusVsHeavy: 0,
  isDagger: true, armorPiercing: true, slashing: true,
  armorMitigation: 21, armorEnc: -17, armorClass: 'heavy', isLightlyArmored: false,
  shieldBlock: 0, shieldEnc: 0, hasShield: false,
};

// Also: Tank Dagger + Shield variant (CF Dagger + CF Heater Shield + CF Heavy Armor)
const tankDaggerShield: Build = {
  ...NORM, name: 'Tank(Dag+Shield)',
  weaponName: 'CF Dagger + CF Heater Shield + CF Heavy Armor',
  baseDamage: 10, penetration: 14, critBonus: 5, critEffect: ['bleeding'],
  weaponEnc: 0, isTwoHanded: false, bonusVsHeavy: 0,
  isDagger: true, armorPiercing: true, slashing: true,
  armorMitigation: 21, armorEnc: -17, armorClass: 'heavy', isLightlyArmored: false,
  shieldBlock: 24, shieldEnc: -3, hasShield: true,
};

console.log('\n═══════════════════════════════════════════════');
console.log('  M) TANK 2H HAMMER vs TANK DAGGER');
console.log('═══════════════════════════════════════════════');
console.log('  Both P9/F7/C5/S9, CF Heavy Armor');
console.log('  J1 config: armor-based defense + 3% dodge + 100% bypass + riposte\n');

console.log('  Dagger (no shield) vs 2H Great Warhammer:\n');
simulateRPS(focusBruiser, tankDagger, J1);

console.log('\n  Dagger + Heater Shield vs 2H Great Warhammer:\n');
simulateRPS(focusBruiser, tankDaggerShield, J1);

console.log('\n  Dagger (no shield) vs Tank (Sword+Tower Shield):\n');
simulateRPS(focusTank, tankDagger, J1);

console.log('\n  Dagger + Shield vs Tank (Sword+Tower Shield):\n');
simulateRPS(focusTank, tankDaggerShield, J1);

console.log('\n  Dagger (no shield) vs Skirm(Dag,C9) light armor:\n');
simulateRPS(tankDagger, skirmDaggerC9, J1);

console.log('\n  Baseline (no J1 mechanics) for comparison:\n');
simulateRPS(focusBruiser, tankDagger, BASELINE_CFG);
simulateRPS(focusTank, tankDagger, BASELINE_CFG);

// ═══════════════════════════════════════════════════════════════
// N) DAGGER BYPASS FIX — prevent heavy-armored dagger exploit
// ═══════════════════════════════════════════════════════════════
// Problem: 100% dagger shield bypass lets Tank(Dagger+Shield) beat
// Tank(Sword+Tower) 77%. Heavy armor dagger should NOT get full bypass.
//
// Fix 1: Restrict bypass to light armor only (daggerBypassLightOnly)
//   → Heavy-armored dagger gets 0% bypass, Skirm(C9) still gets 100%
//
// Fix 2: Scale bypass with Cunning (daggerBypassCunningScale: 11)
//   → C9 = 99% bypass, C5 = 55% bypass. Rewards Cunning investment.

console.log('\n═══════════════════════════════════════════════');
console.log('  N) DAGGER BYPASS FIX — prevent heavy-armor dagger exploit');
console.log('═══════════════════════════════════════════════');
console.log('  Current J1 problem: Tank(Dag+Shield) 77% vs Tank(Sword+Tower)');
console.log('  Fix 1: bypass only for light armor');
console.log('  Fix 2: bypass = Cunning × 11% (C9=99%, C5=55%)\n');

// Fix 1: Light armor only
const N1_LIGHT_ONLY: RPSConfig = { ...DEFENSE_FORT, cunningDodgeMult: 3, daggerShieldBypass: 1.0, daggerBypassLightOnly: true, dodgeRiposte: true };

console.log('  N1) FIX 1: Bypass restricted to light armor only');
console.log('  (Same as J1 but heavy-armored daggers get NO bypass)\n');
console.log('  --- Tank Dagger exploit matchups ---\n');
simulateRPS(focusBruiser, tankDagger, N1_LIGHT_ONLY);          // Tank(Dag) vs Bruiser(GHammer)
simulateRPS(focusTank, tankDagger, N1_LIGHT_ONLY);              // Tank(Dag) vs Tank(Sword+Tower)
simulateRPS(focusTank, tankDaggerShield, N1_LIGHT_ONLY);        // Tank(Dag+Shield) vs Tank(Sword+Tower)
simulateRPS(focusBruiser, tankDaggerShield, N1_LIGHT_ONLY);     // Tank(Dag+Shield) vs Bruiser(GHammer)
console.log('\n  --- RPS triangle check (should still match J1) ---\n');
simulateRPS(focusTank, skirmDaggerC9, N1_LIGHT_ONLY);           // Tank vs Skirm (target: Tank 55-65%)
simulateRPS(focusBruiser, skirmDaggerC9, N1_LIGHT_ONLY);        // Bruiser vs Skirm (target: Skirm 55-60%)
simulateRPS(focusTank, focusBruiser, N1_LIGHT_ONLY);            // Tank vs Bruiser (target: ~even)

// Fix 2: Cunning-scaled bypass (C×11%)
const N2_CUNNING_SCALE: RPSConfig = { ...DEFENSE_FORT, cunningDodgeMult: 3, daggerBypassCunningScale: 11, dodgeRiposte: true };

console.log('\n  N2) FIX 2: Bypass = Cunning × 11% (C9=99%, C5=55%)');
console.log('  (Scales with Cunning investment — tanks get partial bypass)\n');
console.log('  --- Tank Dagger exploit matchups ---\n');
simulateRPS(focusBruiser, tankDagger, N2_CUNNING_SCALE);
simulateRPS(focusTank, tankDagger, N2_CUNNING_SCALE);
simulateRPS(focusTank, tankDaggerShield, N2_CUNNING_SCALE);
simulateRPS(focusBruiser, tankDaggerShield, N2_CUNNING_SCALE);
console.log('\n  --- RPS triangle check ---\n');
simulateRPS(focusTank, skirmDaggerC9, N2_CUNNING_SCALE);
simulateRPS(focusBruiser, skirmDaggerC9, N2_CUNNING_SCALE);
simulateRPS(focusTank, focusBruiser, N2_CUNNING_SCALE);

// Tank(1H Hammer+Shield) — the actual tank-with-hammer build
const tankHammerShield: Build = {
  ...NORM, name: 'Tank(Hammer+S)',
  weaponName: 'CF Warhammer 1H + CF Heater Shield + CF Heavy Armor',
  baseDamage: 17, penetration: 25, critBonus: 0, critEffect: ['stunned'],
  weaponEnc: -5, isTwoHanded: false, bonusVsHeavy: 5,
  isDagger: false, armorPiercing: false, slashing: false,
  armorMitigation: 21, armorEnc: -17, armorClass: 'heavy', isLightlyArmored: false,
  shieldBlock: 24, shieldEnc: -3, hasShield: true,
};

console.log('\n  --- Tank(Dagger) vs Tank(Hammer+Shield) ---');
console.log('  J1 (unrestricted):');
simulateRPS(tankDagger, tankHammerShield, J1);
console.log('  N1 (light only):');
simulateRPS(tankDagger, tankHammerShield, N1_LIGHT_ONLY);
console.log('  N2 (C×11%):');
simulateRPS(tankDagger, tankHammerShield, N2_CUNNING_SCALE);

console.log('\n  --- Tank(Dag+Shield) vs Tank(Hammer+Shield) ---');
console.log('  J1 (unrestricted):');
simulateRPS(tankDaggerShield, tankHammerShield, J1);
console.log('  N1 (light only):');
simulateRPS(tankDaggerShield, tankHammerShield, N1_LIGHT_ONLY);
console.log('  N2 (C×11%):');
simulateRPS(tankDaggerShield, tankHammerShield, N2_CUNNING_SCALE);

console.log('\n  --- Tank(Dagger) vs Tank(Sword+Tower) ---');
console.log('  J1 (unrestricted):');
simulateRPS(tankDagger, focusTank, J1);
console.log('  N1 (light only):');
simulateRPS(tankDagger, focusTank, N1_LIGHT_ONLY);
console.log('  N2 (C×11%):');
simulateRPS(tankDagger, focusTank, N2_CUNNING_SCALE);

console.log('\n  --- Tank(Dag+Shield) vs Tank(Sword+Tower) ---');
console.log('  J1 (unrestricted):');
simulateRPS(tankDaggerShield, focusTank, J1);
console.log('  N1 (light only):');
simulateRPS(tankDaggerShield, focusTank, N1_LIGHT_ONLY);
console.log('  N2 (C×11%):');
simulateRPS(tankDaggerShield, focusTank, N2_CUNNING_SCALE);

console.log('\n  --- Tank(Dagger) vs Tank(2H GHammer) ---');
console.log('  J1 (unrestricted):');
simulateRPS(tankDagger, focusBruiser, J1);
console.log('  N1 (light only):');
simulateRPS(tankDagger, focusBruiser, N1_LIGHT_ONLY);
console.log('  N2 (C×11%):');
simulateRPS(tankDagger, focusBruiser, N2_CUNNING_SCALE);

console.log('\n  --- Tank(Dag+Shield) vs Tank(2H GHammer) ---');
console.log('  J1 (unrestricted):');
simulateRPS(tankDaggerShield, focusBruiser, J1);
console.log('  N1 (light only):');
simulateRPS(tankDaggerShield, focusBruiser, N1_LIGHT_ONLY);
console.log('  N2 (C×11%):');
simulateRPS(tankDaggerShield, focusBruiser, N2_CUNNING_SCALE);

// ═══════════════════════════════════════════════════════════════
// O) CRITS DON'T BYPASS MITIGATION — pen vs mit always applies
// ═══════════════════════════════════════════════════════════════
// Crits still get: 1.25x multiplier, status effects, min 100% damage mult floor.
// But pen vs mit is calculated normally instead of setting mit to 0.
// This makes high-pen weapons (hammers) valuable on crits too,
// and low-pen weapons (daggers) pay the armor tax even on crits.
//
// Counter-attacks still bypass mitigation (separate mechanic).

// J1 + no crit bypass + light-only dagger bypass (the full proposed package)
const O1: RPSConfig = { ...DEFENSE_FORT, cunningDodgeMult: 3, daggerShieldBypass: 1.0, daggerBypassLightOnly: true, dodgeRiposte: true, critsBypassMitigation: false };

console.log('\n═══════════════════════════════════════════════');
console.log('  O) CRITS DON\'T BYPASS MITIGATION');
console.log('═══════════════════════════════════════════════');
console.log('  Crits keep 1.25x mult + effects, but pen vs mit still applies.');
console.log('  Crit damage floor: mult clamped to min 1.0 (always at least base×1.25).');
console.log('  Config: J1 + N1 (light-only bypass) + no crit mitigation bypass.\n');

console.log('  --- RPS Triangle ---\n');
simulateRPS(focusTank, skirmDaggerC9, O1);
simulateRPS(focusBruiser, skirmDaggerC9, O1);
simulateRPS(focusTank, focusBruiser, O1);

console.log('\n  --- Tank Dagger exploit check ---\n');
simulateRPS(tankDagger, tankHammerShield, O1);
simulateRPS(tankDaggerShield, tankHammerShield, O1);
simulateRPS(tankDagger, focusTank, O1);
simulateRPS(tankDaggerShield, focusTank, O1);

console.log('\n  --- Blunt weapon matchups ---\n');
simulateRPS(tankHammerShield, focusTank, O1);          // Hammer tank vs Sword tank
simulateRPS(focusBruiser, focusTank, O1);               // 2H Hammer vs Sword tank
simulateRPS(focusBruiser, tankHammerShield, O1);         // 2H Hammer vs 1H Hammer tank
simulateRPS(tankHammerShield, skirmDaggerC9, O1);        // Hammer tank vs Skirmisher

// Compare WITH vs WITHOUT crit bypass to see the impact
const O1_WITH_BYPASS: RPSConfig = { ...O1, critsBypassMitigation: true };
console.log('\n  --- Side-by-side: crit bypass ON vs OFF ---');
console.log('  (same config otherwise: J1 + N1 light-only bypass)\n');
console.log('  Tank vs Skirm:');
console.log('    Bypass ON: ');
simulateRPS(focusTank, skirmDaggerC9, O1_WITH_BYPASS);
console.log('    Bypass OFF:');
simulateRPS(focusTank, skirmDaggerC9, O1);
console.log('  Skirm vs Bruiser:');
console.log('    Bypass ON: ');
simulateRPS(focusBruiser, skirmDaggerC9, O1_WITH_BYPASS);
console.log('    Bypass OFF:');
simulateRPS(focusBruiser, skirmDaggerC9, O1);
console.log('  Tank vs Bruiser:');
console.log('    Bypass ON: ');
simulateRPS(focusTank, focusBruiser, O1_WITH_BYPASS);
console.log('    Bypass OFF:');
simulateRPS(focusTank, focusBruiser, O1);
console.log('  Tank(Dag+Shield) vs Tank(Hammer+S):');
console.log('    Bypass ON: ');
simulateRPS(tankDaggerShield, tankHammerShield, O1_WITH_BYPASS);
console.log('    Bypass OFF:');
simulateRPS(tankDaggerShield, tankHammerShield, O1);
console.log('  Tank(Dag+Shield) vs Tank(Sword+Tower):');
console.log('    Bypass ON: ');
simulateRPS(tankDaggerShield, focusTank, O1_WITH_BYPASS);
console.log('    Bypass OFF:');
simulateRPS(tankDaggerShield, focusTank, O1);

// ═══════════════════════════════════════════════════════════════
// P) BLUNT WEAPON REBALANCE — crits don't bypass + blunt scales with armor class
// ═══════════════════════════════════════════════════════════════
// Two changes:
// 1. Crits no longer bypass mitigation (pen vs mit always applies)
// 2. bonusVsHeavy now scales: heavy=full, medium=half, light/none=0
//
// Note: The blunt scaling is now baked into the resolveAttackRPS function
// (not a config option), so all configs above with blunt weapons are affected.
// The critsBypassMitigation config flag controls crit behavior.

const P1: RPSConfig = {
  ...DEFENSE_FORT,
  cunningDodgeMult: 3,
  daggerShieldBypass: 1.0,
  daggerBypassLightOnly: true,
  dodgeRiposte: true,
  critsBypassMitigation: false,
};

console.log('\n═══════════════════════════════════════════════');
console.log('  P) BLUNT WEAPON REBALANCE');
console.log('═══════════════════════════════════════════════');
console.log('  Crits: 1.25x mult + effects, but pen vs mit applies (no bypass).');
console.log('  Blunt bonus: heavy=full, medium=half, light/none=0.');
console.log('  Config: armor defense + 3% dodge + light-only bypass + riposte.\n');

console.log('  --- RPS Triangle ---\n');
simulateRPS(focusTank, skirmDaggerC9, P1);
simulateRPS(focusBruiser, skirmDaggerC9, P1);
simulateRPS(focusTank, focusBruiser, P1);

console.log('\n  --- Hammer vs Heavy Armor (primary advantage) ---\n');
simulateRPS(focusBruiser, focusTank, P1);                    // 2H Hammer vs Sword+Tower
simulateRPS(tankHammerShield, focusTank, P1);                 // Hammer+Shield vs Sword+Tower
simulateRPS(focusBruiser, tankHammerShield, P1);              // 2H Hammer vs Hammer+Shield

console.log('\n  --- Hammer vs Medium Armor (partial bonus) ---\n');
simulateRPS(focusBruiser, sellswordA, P1);                    // 2H Hammer vs Sellsword(medium)
simulateRPS(tankHammerShield, sellswordA, P1);                // Hammer+Shield vs Sellsword
simulateRPS(tankHammerShield, manAtArms, P1);                 // Hammer+Shield vs Man-at-Arms(medium)

console.log('\n  --- Hammer vs Light Armor (no blunt bonus) ---\n');
simulateRPS(tankHammerShield, skirmDaggerC9, P1);             // Hammer+Shield vs Skirm
simulateRPS(focusBruiser, skirmDaggerC9, P1);                 // 2H Hammer vs Skirm

console.log('\n  --- Tank Dagger exploit check ---\n');
simulateRPS(tankDagger, tankHammerShield, P1);
simulateRPS(tankDaggerShield, tankHammerShield, P1);
simulateRPS(tankDagger, focusTank, P1);
simulateRPS(tankDaggerShield, focusTank, P1);

console.log('\n  --- Tank(Dagger) vs Tank(2H GHammer) ---\n');
simulateRPS(tankDagger, focusBruiser, P1);
simulateRPS(tankDaggerShield, focusBruiser, P1);

// ═══════════════════════════════════════════════════════════════
// Q) BLUNT DAMAGE BUFF — baseDamage increase for blunt weapons
// ═══════════════════════════════════════════════════════════════
// warhammer1H: 14→17, warhammer2H: 14→18, mace1H: 14→16
// NOTE: Builds already updated above with new baseDamage values.
// Q1 = P1 config (same rules, just higher blunt weapon damage).

const Q1 = P1; // Same config — the buff is in the build stats, not the config

console.log('\n═══════════════════════════════════════════════');
console.log('  Q) BLUNT DAMAGE BUFF');
console.log('═══════════════════════════════════════════════');
console.log('  warhammer1H: 14→17 (+3), warhammer2H: 14→18 (+4), mace1H: 14→16 (+2)');
console.log('  Config: P1 (armor defense + 3% dodge + light-only bypass + riposte).\n');

console.log('  --- RPS Triangle ---\n');
simulateRPS(focusTank, skirmDaggerC9, Q1);
simulateRPS(focusBruiser, skirmDaggerC9, Q1);
simulateRPS(focusTank, focusBruiser, Q1);

console.log('\n  --- Hammer vs Heavy Armor (key matchup) ---\n');
simulateRPS(focusBruiser, focusTank, Q1);                    // 2H Hammer vs Sword+Tower
simulateRPS(tankHammerShield, focusTank, Q1);                 // Hammer+Shield vs Sword+Tower  ← THE ONE TO WATCH
simulateRPS(focusBruiser, tankHammerShield, Q1);              // 2H Hammer vs Hammer+Shield

console.log('\n  --- Hammer vs Medium Armor ---\n');
simulateRPS(focusBruiser, sellswordA, Q1);                    // 2H Hammer vs Sellsword
simulateRPS(tankHammerShield, sellswordA, Q1);                // Hammer+Shield vs Sellsword
simulateRPS(tankHammerShield, manAtArms, Q1);                 // Hammer+Shield vs Man-at-Arms

console.log('\n  --- Hammer vs Light Armor ---\n');
simulateRPS(tankHammerShield, skirmDaggerC9, Q1);             // Hammer+Shield vs Skirm
simulateRPS(focusBruiser, skirmDaggerC9, Q1);                 // 2H Hammer vs Skirm

console.log('\n  --- Mace Skirmisher matchups ---\n');
simulateRPS(focusTank, skirmMaceC9, Q1);                      // Tank vs Skirm(Mace)
simulateRPS(focusBruiser, skirmMaceC9, Q1);                   // Bruiser vs Skirm(Mace)
simulateRPS(skirmMaceC9, skirmDaggerC9, Q1);                  // Mace Skirm vs Dagger Skirm

console.log('\n  --- Tank Dagger exploit check ---\n');
simulateRPS(tankDagger, tankHammerShield, Q1);
simulateRPS(tankDaggerShield, tankHammerShield, Q1);
simulateRPS(tankDagger, focusTank, Q1);
simulateRPS(tankDaggerShield, focusTank, Q1);

console.log('\n  --- Tank(Dagger) vs Bruiser(GHammer) ---\n');
simulateRPS(tankDagger, focusBruiser, Q1);
simulateRPS(tankDaggerShield, focusBruiser, Q1);

// ═══════════════════════════════════════════════════════════════
// Section R) MEDIUM ARMOR BUFF — max(Fort,Cunning) defense + partial dodge
// ═══════════════════════════════════════════════════════════════
// Medium armor currently sits in no-man's-land:
//   - Worse mitigation than heavy (16 vs 21)
//   - No dodge (that's light armor only)
//   - Half blunt bonus still hits them
//   - Defense uses Fortitude (medium wearers usually don't invest heavily in Fort)
//
// Buff: Two changes tested together:
//   Option 1: mediumDefenseMode = 'max' → defense uses max(Fortitude, Cunning) × 5
//   Option 2: mediumDodgeMult = 1 → Cunning × 1% dodge (only without shield)
//
// Key builds affected:
//   Sellsword(P8C8): Defense jumps from F6×5=30 to max(6,8)×5=40 (+10).
//                     Gains 8% dodge (C8 × 1). No shield so dodge applies.
//   Man-at-Arms(Med): Defense stays at F7×5=35 (F7 > C5, max doesn't help).
//                      Has shield → no dodge. Barely affected.

const R1: RPSConfig = {
  ...P1,
  mediumDefenseMode: 'max',
  mediumDodgeMult: 1,
};

console.log('\n═══════════════════════════════════════════════');
console.log('  R) MEDIUM ARMOR BUFF — max(Fort,Cun) defense + Cun×1% dodge');
console.log('═══════════════════════════════════════════════');
console.log('  mediumDefenseMode: max → defense = max(Fort,Cunning) × 5');
console.log('  mediumDodgeMult: 1 → dodge% = Cunning × 1 (no shield only)');
console.log(`  Sellsword(P8C8): Def ${defenseStatBonus(sellswordA, P1)} → ${defenseStatBonus(sellswordA, R1)} (+${defenseStatBonus(sellswordA, R1)-defenseStatBonus(sellswordA, P1)}), dodge ${sellswordA.cunning}%`);
console.log(`  Man-at-Arms(Med): Def ${defenseStatBonus(manAtArms, P1)} → ${defenseStatBonus(manAtArms, R1)} (+${defenseStatBonus(manAtArms, R1)-defenseStatBonus(manAtArms, P1)}), no dodge (shield)`);
console.log('  Comparing P1 (old) → R1 (new) for medium armor matchups.\n');

console.log('  --- Sellsword vs Major Archetypes (P1 → R1) ---\n');
console.log('  P1 (Fortitude defense, no dodge):');
simulateRPS(focusTank, sellswordA, P1);
simulateRPS(focusBruiser, sellswordA, P1);
simulateRPS(sellswordA, skirmDaggerC9, P1);
simulateRPS(sellswordA, skirmMaceC9, P1);
simulateRPS(tankHammerShield, sellswordA, P1);

console.log('\n  R1 (max defense + 1% dodge):');
simulateRPS(focusTank, sellswordA, R1);
simulateRPS(focusBruiser, sellswordA, R1);
simulateRPS(sellswordA, skirmDaggerC9, R1);
simulateRPS(sellswordA, skirmMaceC9, R1);
simulateRPS(tankHammerShield, sellswordA, R1);

console.log('\n  --- Man-at-Arms vs Major Archetypes (P1 → R1) ---\n');
console.log('  P1 (Fortitude defense):');
simulateRPS(focusTank, manAtArms, P1);
simulateRPS(focusBruiser, manAtArms, P1);
simulateRPS(manAtArms, skirmDaggerC9, P1);
simulateRPS(manAtArms, skirmMaceC9, P1);
simulateRPS(tankHammerShield, manAtArms, P1);

console.log('\n  R1 (max defense, no dodge — shield):');
simulateRPS(focusTank, manAtArms, R1);
simulateRPS(focusBruiser, manAtArms, R1);
simulateRPS(manAtArms, skirmDaggerC9, R1);
simulateRPS(manAtArms, skirmMaceC9, R1);
simulateRPS(tankHammerShield, manAtArms, R1);

console.log('\n  --- Medium vs Medium (mirror / cross) ---\n');
console.log('  P1:');
simulateRPS(sellswordA, manAtArms, P1);
console.log('  R1:');
simulateRPS(sellswordA, manAtArms, R1);

console.log('\n  --- Skirm(VS Greatsword) vs All (R1) ---\n');
console.log(`  Skirm(VSGreat): P${skirmGreatsword.prowess}/F${skirmGreatsword.fortitude}/C${skirmGreatsword.cunning} | HP ${maxHp(skirmGreatsword)} | Pen ${skirmGreatsword.penetration} | Mit ${skirmGreatsword.armorMitigation} | 2H overwhelm | slashing | Enc ${totalEnc(skirmGreatsword)}`);
console.log('  Valyrian 2H = 0 encumbrance. Pen 23 = near-hammer territory. Slashing vs light.\n');
simulateRPS(skirmGreatsword, focusTank, R1);
simulateRPS(skirmGreatsword, tankHammerShield, R1);
simulateRPS(skirmGreatsword, focusBruiser, R1);
simulateRPS(skirmGreatsword, sellswordA, R1);
simulateRPS(skirmGreatsword, manAtArms, R1);
simulateRPS(skirmGreatsword, skirmDaggerC9, R1);
simulateRPS(skirmGreatsword, skirmMaceC9, R1);

console.log('\n  --- Tank(VS Greatsword) vs All (R1) ---\n');
console.log(`  Tank(VSGreat): P${tankGreatsword.prowess}/F${tankGreatsword.fortitude}/C${tankGreatsword.cunning} | HP ${maxHp(tankGreatsword)} | Pen ${tankGreatsword.penetration} | Mit ${tankGreatsword.armorMitigation} | 2H overwhelm | slashing | Enc ${totalEnc(tankGreatsword)}`);
console.log(`  vs Bruiser(GHammer): Pen 23 vs 30, baseDmg 15 vs 18, but enc -17 vs -30 and bleed vs stun\n`);
simulateRPS(tankGreatsword, focusTank, R1);
simulateRPS(tankGreatsword, tankHammerShield, R1);
simulateRPS(tankGreatsword, focusBruiser, R1);
simulateRPS(tankGreatsword, sellswordA, R1);
simulateRPS(tankGreatsword, manAtArms, R1);
simulateRPS(tankGreatsword, skirmDaggerC9, R1);
simulateRPS(tankGreatsword, skirmMaceC9, R1);
simulateRPS(tankGreatsword, skirmGreatsword, R1);

console.log('\n  --- Tank(CF Great Hammer) vs All (R1) ---\n');
console.log(`  Bruiser(GHammer): P${focusBruiser.prowess}/F${focusBruiser.fortitude}/C${focusBruiser.cunning} | HP ${maxHp(focusBruiser)} | Pen ${focusBruiser.penetration} | Mit ${focusBruiser.armorMitigation} | 2H overwhelm | bonusVsHeavy ${focusBruiser.bonusVsHeavy} | Enc ${totalEnc(focusBruiser)}`);
console.log('  (Same build as Bruiser(GHammer) — CF Great Warhammer + CF Heavy)\n');
simulateRPS(focusBruiser, focusTank, R1);
simulateRPS(focusBruiser, tankHammerShield, R1);
simulateRPS(focusBruiser, tankGreatsword, R1);
simulateRPS(focusBruiser, sellswordA, R1);
simulateRPS(focusBruiser, manAtArms, R1);
simulateRPS(focusBruiser, skirmDaggerC9, R1);
simulateRPS(focusBruiser, skirmMaceC9, R1);
simulateRPS(focusBruiser, skirmGreatsword, R1);

// ═══════════════════════════════════════════════════════════════
// SUMMARY TABLE — Key matchups across all configs
// ═══════════════════════════════════════════════════════════════
console.log('\n═══════════════════════════════════════════════');
console.log('  TARGET WIN RATES (RPS Triangle)');
console.log('═══════════════════════════════════════════════');
console.log('  Tank > Skirmisher: Tank 55-65%');
console.log('  Skirmisher > Bruiser: Skirm 55-60%');
console.log('  Bruiser > Tank: Bruiser 55-60%');
console.log('═══════════════════════════════════════════════\n');
