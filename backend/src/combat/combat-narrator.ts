/**
 * Combat Narrator — generates medieval fantasy IC emotes from ActionResult data.
 *
 * Pure functions only. No DB access, no side effects.
 * Uses template pools with random selection to avoid repetitive output.
 *
 * Writing style: informational and grounded. Describe what the reader sees.
 * No metaphor, analogy, or flowery language. No em dashes.
 */

import type { ActionResult, AttackResult, StatusEffect, CombatSessionCombatant, CombatantStats, WoundAssessmentResult } from './types.js';

// ============================================
// Utility
// ============================================

function pickRandom<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

function fillTemplate(template: string, actor: string, target: string): string {
  return template.replace(/\{actor\}/g, actor).replace(/\{target\}/g, target);
}

// ============================================
// Template pools
// ============================================

const MISS_TEMPLATES = [
  '{actor} lunges at {target}, but the strike goes wide.',
  '{actor} swings at {target}, but the blow misses.',
  '{target} parries {actor}\'s strike, turning the blade aside.',
  '{actor} thrusts at {target}, who sidesteps the blow.',
  '{actor}\'s weapon swings past {target}, missing its mark.',
];

const DEFENSE_REVERSAL_SHIELD_TEMPLATES = [
  '{target}\'s shield catches {actor}\'s blow and turns it aside with force.',
  '{target} reads {actor}\'s attack perfectly, deflecting it with the shield.',
  '{actor}\'s strike is caught clean on {target}\'s shield, leaving an opening.',
];

const DODGE_TEMPLATES = [
  '{target} sidesteps {actor}\'s strike with quick footwork.',
  '{target} ducks beneath {actor}\'s swing, the blade passing overhead.',
  '{actor} lunges, but {target} twists aside at the last moment.',
  '{actor}\'s weapon cuts through empty air as {target} evades.',
  '{target} reads {actor}\'s attack and slips aside.',
];

const DODGE_RIPOSTE_TEMPLATES = [
  '{target} sidesteps and drives a quick counter-blow into {actor}.',
  '{target} evades the strike and retaliates, catching {actor} off-guard.',
  'Slipping past the blow, {target} strikes back at {actor}.',
  '{target} twists away from the attack and delivers a sharp riposte to {actor}.',
];

const HIT_TEMPLATES: Record<string, string[]> = {
  Deflected: [
    '{actor}\'s strike scrapes against {target}\'s armor, leaving no wound.',
    'The blow glances off {target}\'s plate, barely leaving a mark.',
    '{actor} connects, but {target}\'s armor absorbs the impact.',
  ],
  Glancing: [
    '{actor}\'s strike catches {target} at an angle, scratching the surface.',
    '{actor} grazes {target}, the edge skidding across armor.',
    'A glancing blow from {actor} catches {target}\'s pauldron, leaving only a scratch.',
  ],
  Partial: [
    '{actor}\'s blade slips through a gap in {target}\'s armor, drawing blood.',
    '{actor} strikes {target} through a weak point, leaving a shallow wound.',
    '{actor} finds a seam in {target}\'s armor and opens a thin cut.',
  ],
  Reduced: [
    '{actor}\'s blow dents {target}\'s armor and bruises the flesh beneath.',
    '{actor} hammers {target}\'s guard, the impact carrying through the plate.',
    '{actor} lands a solid hit that drives {target} back a step despite the armor.',
  ],
  Solid: [
    '{actor} strikes {target} cleanly, drawing blood from a deep cut.',
    '{actor} finds an opening and lands a solid hit, the wound running deep.',
    'A strong blow from {actor} staggers {target}, blood flowing from the wound.',
    '{actor} drives the weapon into {target}, cutting through armor into flesh.',
  ],
  Clean: [
    '{actor}\'s strike cuts through {target}\'s guard, opening a deep wound.',
    '{actor} lands a heavy blow across {target}, blood flowing freely.',
    '{actor}\'s weapon cuts clean through {target}\'s armor, biting deep.',
    '{actor}\'s blow splits {target}\'s armor apart and cuts into the flesh beneath.',
  ],
  Devastating: [
    '{actor} delivers a crushing blow that breaks through {target}\'s defenses.',
    '{actor}\'s weapon crashes through {target}\'s armor with full force.',
    'A massive strike from {actor} tears into {target}, shattering armor.',
    '{actor} lands a devastating hit on {target}, cutting deep through armor and flesh.',
  ],
};

// Appended after a crit hit, keyed by status effect type
const CRIT_SUFFIXES: Record<string, string[]> = {
  bleeding: [
    ' A deep wound opens, bleeding heavily.',
    ' Blood flows freely from the deep cut.',
    ' The wound bleeds steadily, dripping to the ground.',
  ],
  stunned: [
    ' The heavy impact leaves {target} reeling.',
    ' {target} staggers, dazed and unable to act.',
    ' The blow leaves {target} stunned and off-balance.',
  ],
  sundered: [
    ' Armor buckles and splinters beneath the strike.',
    ' Fragments of shattered armor scatter across the ground.',
    ' {target}\'s armor cracks apart under the heavy blow.',
  ],
  piercing: [
    ' The point drives clean through a weak joint in the armor.',
    ' The weapon punches through the armor\'s weakest point.',
  ],
};

const DEATH_SUFFIXES = [
  ' {target} crumples to the ground, slain.',
  ' {target} falls, and does not rise again.',
  ' {target} collapses, dead before hitting the ground.',
];

// Counter-attack templates (defensive crit)
const COUNTER_ATTACK_TEMPLATES = [
  '{actor} catches the failed strike and drives a counter-blow into {target}.',
  '{actor} parries the attack and retaliates, striking {target} hard.',
  '{actor} turns aside the blow and strikes back, catching {target} off-guard.',
  'Reading the attack, {actor} deflects it and delivers a sharp counter-strike to {target}.',
];

// Non-attack action templates
const PROTECT_TEMPLATES = [
  '{actor} moves to shield {target}, positioning to intercept incoming attacks.',
  '{actor} steps in front of {target}, weapon raised in defense.',
  '{actor} takes position between {target} and the enemy.',
];

const GRAPPLE_HIT_TEMPLATES = [
  '{actor} grabs {target} and pulls them into close quarters.',
  '{actor} closes the distance and locks {target} in a grapple.',
  '{actor} gets hold of {target}, tangling them up at close range.',
];

const GRAPPLE_MISS_TEMPLATES = [
  '{actor} lunges to grapple {target}, but is thrown off.',
  '{actor} reaches for {target}, but is shoved away.',
  '{actor} attempts to grab {target}, who twists free at the last moment.',
];

const DISENGAGE_HIT_TEMPLATES = [
  '{actor} breaks free from {target} with quick footwork.',
  '{actor} wrenches away from {target}, creating distance.',
  '{actor} pulls back from {target}\'s reach and resets their footing.',
];

const DISENGAGE_MISS_TEMPLATES = [
  '{actor} tries to withdraw from {target} but is caught.',
  '{actor} attempts to break away, but {target} keeps hold.',
  '{actor} stumbles while retreating, unable to escape {target}\'s grip.',
];

const BRACE_TEMPLATES = [
  '{actor} plants their feet and raises their guard, bracing for impact.',
  '{actor} digs in and tightens their stance, shield held high.',
  '{actor} adopts a defensive stance, ready to absorb the next blow.',
];

const OPPORTUNITY_PREFIX = [
  'Seizing the opening, ',
  'Punishing the misstep, ',
  'Exploiting the gap in defenses, ',
];

// Health threshold flavor — celebrates the target's valor as they take punishment
const HEALTH_THRESHOLD_TEMPLATES: Record<number, string[]> = {
  4: [ // Crossed below 80%
    ' {target} sets their jaw and shrugs off the wound.',
    ' {target} barely flinches, pressing forward despite the hit.',
    ' {target} steadies and stands firm against the pain.',
  ],
  3: [ // Crossed below 60%
    ' {target} grits their teeth and fights on, blood staining their armor.',
    ' {target} spits blood and raises their guard, refusing to falter.',
    ' {target} absorbs the punishment and presses on through the pain.',
  ],
  2: [ // Crossed below 40%
    ' {target} staggers but stays on their feet through sheer force of will.',
    ' {target} is bloodied and battered, yet the fire in their eyes does not dim.',
    ' {target} forces themselves upright, every breath a battle, but still standing.',
  ],
  1: [ // Crossed below 20%
    ' {target} sways on their feet, torn and bleeding, but refuses to fall.',
    ' {target} is broken and bloodied, yet stands defiant against all odds.',
    ' {target} clings to consciousness through iron will alone, still raising their weapon.',
  ],
};

// Bleeding tick templates
const BLEED_ALIVE_TEMPLATES = [
  '{name} grimaces as blood seeps from their wounds.',
  '{name} pales, the wounds still bleeding freely.',
  'Blood continues to flow from {name}\'s injuries.',
];

const BLEED_DEATH_TEMPLATES = [
  '{name} collapses, overcome by their wounds.',
  '{name}\'s strength gives out as blood pools beneath them.',
  '{name} succumbs to the bleeding and falls.',
];

// ============================================
// Public API
// ============================================

export interface NarratorContext {
  targetFallen: boolean;
  actorFallen?: boolean;
  /** Health threshold band the target crossed into (4=80%, 3=60%, 2=40%, 1=20%), or null. */
  targetThresholdCrossed?: number | null;
}

/**
 * Generate a single IC emote string from an ActionResult.
 * Returns null for action types that should not produce emotes (e.g., skip).
 */
export function generateCombatEmote(
  result: ActionResult,
  context: NarratorContext,
): string | null {
  const actor = result.actorName;
  const target = result.targetName ?? 'an unknown foe';

  switch (result.actionType) {
    case 'skip':
      return null;

    case 'protect':
      return fillTemplate(pickRandom(PROTECT_TEMPLATES), actor, target);

    case 'brace':
      return fillTemplate(pickRandom(BRACE_TEMPLATES), actor, target);

    case 'grapple': {
      // Grapple success is indicated by grappled effect being applied
      const success = result.statusEffectsApplied.some(e => e.type === 'grappled');
      return success
        ? fillTemplate(pickRandom(GRAPPLE_HIT_TEMPLATES), actor, target)
        : fillTemplate(pickRandom(GRAPPLE_MISS_TEMPLATES), actor, target);
    }

    case 'disengage': {
      // Disengage success is indicated by having removed effects (grappled/engaged)
      const success = result.statusEffectsRemoved.length > 0
        || result.opportunityAttacks.length === 0;
      return success
        ? fillTemplate(pickRandom(DISENGAGE_HIT_TEMPLATES), actor, target)
        : fillTemplate(pickRandom(DISENGAGE_MISS_TEMPLATES), actor, target);
    }

    case 'attack':
    case 'opportunity_attack':
      return buildAttackEmote(result, context);

    default:
      return null;
  }
}

/**
 * Generate emotes for a complete action including its opportunity attacks.
 * Returns an ordered array of emote strings.
 */
export function generateCombatEmotes(
  result: ActionResult,
  context: NarratorContext,
): string[] {
  const emotes: string[] = [];

  // Main action emote first (the turn holder's action)
  const mainEmote = generateCombatEmote(result, context);
  if (mainEmote) emotes.push(mainEmote);

  // Opportunity attacks triggered by this action come after
  if (result.opportunityAttacks && result.opportunityAttacks.length > 0) {
    for (const opp of result.opportunityAttacks) {
      const oppEmote = generateCombatEmote(opp, {
        targetFallen: false,
        targetThresholdCrossed: opp.targetThresholdCrossed ?? null,
      });
      if (oppEmote) emotes.push(oppEmote);
    }
  }

  return emotes;
}

/**
 * Generate a bleeding tick emote for round-start processing.
 */
export function generateBleedingEmote(
  characterName: string,
  _stacks: number,
  died: boolean,
): string {
  const templates = died ? BLEED_DEATH_TEMPLATES : BLEED_ALIVE_TEMPLATES;
  return pickRandom(templates).replace(/\{name\}/g, characterName);
}

// ============================================
// Entrance emotes (session start)
// ============================================

const WEAPON_NAMES: Record<string, string> = {
  dagger: 'dagger',
  bastardSword: 'bastard sword',
  greatsword: 'greatsword',
  battleAxe1H: 'battle axe',
  battleAxe2H: 'battle axe',
  warhammer1H: 'warhammer',
  warhammer2H: 'warhammer',
  mace1H: 'mace',
  spear: 'spear',
  polearm: 'polearm',
  bow: 'bow',
};

const ARMOR_DESCRIPTORS: Record<string, string[]> = {
  heavy: ['clad in heavy plate', 'in full plate armor'],
  medium: ['wearing chainmail', 'in chain and leather'],
  light: ['in leather armor', 'lightly armored'],
  none: ['unarmored', 'wearing no armor'],
};

const TEAM1_INTRO = [
  'Standing on one side',
  'Taking position',
];

const TEAM2_INTRO = [
  'Across from them',
  'On the opposing side',
  'Facing them',
];

const WEAPON_PHRASES = [
  '{weapon} in hand',
  '{weapon} drawn',
  'armed with a {weapon}',
];

const RETAINER_INTRO = [
  'Accompanying',
  'At their side',
  'Standing with',
];

const RETAINER_NOUN = [
  'loyal oathsworn',
  'sworn retainers',
];

const JOIN_PHRASES = [
  'Joining them in battle',
  'Standing alongside them',
  'Fighting beside them',
];

function weaponDisplayName(stats: CombatantStats): string {
  const baseName = WEAPON_NAMES[stats.weaponType] ?? stats.weaponType;
  if (stats.weaponMaterial && stats.weaponMaterial !== 'iron') {
    return `${stats.weaponMaterial} ${baseName}`;
  }
  return baseName;
}

function armorDescriptor(stats: CombatantStats): string {
  const pool = ARMOR_DESCRIPTORS[stats.armorClass] ?? ARMOR_DESCRIPTORS['none'];
  return pickRandom(pool);
}

function shieldSuffix(stats: CombatantStats): string {
  if (!stats.hasShield) return '';
  return pickRandom([' and shield at the ready', ' with shield in hand']);
}

function buildCombatantPhrase(name: string, stats: CombatantStats): string {
  const weapon = weaponDisplayName(stats);
  const weaponPhrase = pickRandom(WEAPON_PHRASES).replace('{weapon}', weapon);
  const armor = armorDescriptor(stats);
  const shield = shieldSuffix(stats);
  return `${name}, ${weaponPhrase}, ${armor}${shield}`;
}

function formatNameList(names: string[]): string {
  if (names.length === 0) return '';
  if (names.length === 1) return names[0];
  if (names.length === 2) return `${names[0]} and ${names[1]}`;
  return names.slice(0, -1).join(', ') + ', and ' + names[names.length - 1];
}

/**
 * Generate entrance emotes for the start of a combat session.
 * Returns one emote per team (team 1 first, then team 2).
 */
export function generateEntranceEmotes(
  combatants: Map<number, CombatSessionCombatant>,
): string[] {
  // Group combatants by team
  const teams = new Map<number, CombatSessionCombatant[]>();
  for (const [, c] of combatants) {
    const list = teams.get(c.team) ?? [];
    list.push(c);
    teams.set(c.team, list);
  }

  // Sort teams: 1 first, then 2, then any others
  const teamNumbers = Array.from(teams.keys()).sort((a, b) => a - b);

  const emotes: string[] = [];

  for (let i = 0; i < teamNumbers.length; i++) {
    const teamNum = teamNumbers[i];
    const members = teams.get(teamNum)!;

    // Separate leaders (no owner) and retainers (have owner)
    const leaders = members.filter(c => c.ownerCharacterId === null);
    const retainers = members.filter(c => c.ownerCharacterId !== null);

    // Group retainers by owner
    const retainersByOwner = new Map<number, CombatSessionCombatant[]>();
    for (const r of retainers) {
      const list = retainersByOwner.get(r.ownerCharacterId!) ?? [];
      list.push(r);
      retainersByOwner.set(r.ownerCharacterId!, list);
    }

    // Pick intro phrase based on team position
    const introPool = i === 0 ? TEAM1_INTRO : TEAM2_INTRO;

    const parts: string[] = [];

    for (let j = 0; j < leaders.length; j++) {
      const leader = leaders[j];
      const leaderPhrase = buildCombatantPhrase(leader.characterName, leader.statsSnapshot);
      const ownedRetainers = retainersByOwner.get(leader.characterId) ?? [];

      let sentence: string;
      if (j === 0) {
        // First leader uses the team intro
        sentence = `${pickRandom(introPool)} is ${leaderPhrase}.`;
      } else {
        // Subsequent leaders on the same team
        sentence = `${pickRandom(JOIN_PHRASES)} is ${leaderPhrase}.`;
      }

      if (ownedRetainers.length > 0) {
        const retainerNames = ownedRetainers.map(r => r.characterName);
        const intro = pickRandom(RETAINER_INTRO);
        const noun = pickRandom(RETAINER_NOUN);
        const verb = ownedRetainers.length === 1 ? 'is' : 'are';
        const pronoun = ownedRetainers.length === 1 ? 'their' : 'their';
        sentence += ` ${intro} them ${verb} ${pronoun} ${noun}, ${formatNameList(retainerNames)}.`;
      }

      parts.push(sentence);
    }

    // Handle "orphan" retainers whose owner isn't on this team (edge case)
    const accountedOwners = new Set(leaders.map(l => l.characterId));
    for (const [ownerId, rets] of retainersByOwner) {
      if (!accountedOwners.has(ownerId)) {
        for (const r of rets) {
          const phrase = buildCombatantPhrase(r.characterName, r.statsSnapshot);
          if (parts.length === 0) {
            parts.push(`${pickRandom(introPool)} is ${phrase}.`);
          } else {
            parts.push(`${pickRandom(JOIN_PHRASES)} is ${phrase}.`);
          }
        }
      }
    }

    if (parts.length > 0) {
      emotes.push(parts.join(' '));
    }
  }

  return emotes;
}

// ============================================
// Retainer attribution
// ============================================

/**
 * Post-process an emote to decorate the actor's name with retainer attribution.
 * Only decorates the first non-possessive occurrence of the actor name.
 *
 * Example: "Jareth lunges at Ser Rodrik" → "Jareth, loyal sword of Benjen Reed, lunges at Ser Rodrik"
 */
export function decorateRetainerInEmote(
  emoteText: string,
  actorName: string,
  retainerOwners: Record<string, string>,
): string {
  const ownerName = retainerOwners[actorName];
  if (!ownerName) return emoteText;

  // Find the first occurrence followed by a space (skip possessive forms like "Jareth's")
  const searchStr = actorName + ' ';
  const idx = emoteText.indexOf(searchStr);
  if (idx === -1) return emoteText;

  const attribution = `${actorName}, loyal sword of ${ownerName}, `;
  return emoteText.substring(0, idx) + attribution + emoteText.substring(idx + searchStr.length);
}

// ============================================
// Internal builders
// ============================================

function buildAttackEmote(result: ActionResult, context: NarratorContext): string {
  const actor = result.actorName;
  const target = result.targetName ?? 'an unknown foe';
  const isOpportunity = result.actionType === 'opportunity_attack';
  const atk = result.attackResult;

  // If no attack result data, return a fallback
  if (!atk) {
    return `${actor} attacks ${target}.`;
  }

  let emote = '';

  // Opportunity attack prefix
  if (isOpportunity) {
    emote += pickRandom(OPPORTUNITY_PREFIX).replace(/\{actor\}/g, actor);
  }

  // Base layer: dodge / defense reversal / miss / hit
  if (atk.dodged) {
    // Dodge (defense reversal, light/medium armor, no shield)
    if (atk.dodgeRiposte) {
      emote += fillTemplate(pickRandom(DODGE_RIPOSTE_TEMPLATES), actor, target);
      if (atk.dodgeRiposte.damage > 0) {
        emote += ` (${atk.dodgeRiposte.damage} damage)`;
      }
    } else {
      emote += fillTemplate(pickRandom(DODGE_TEMPLATES), actor, target);
    }
  } else if (atk.defenseReversal && atk.counterAttack) {
    // Shield defense reversal — counter-attack
    emote += fillTemplate(pickRandom(DEFENSE_REVERSAL_SHIELD_TEMPLATES), actor, target);

    emote += ' ' + fillTemplate(pickRandom(COUNTER_ATTACK_TEMPLATES), target, actor);
    if (atk.counterAttack.damage > 0) {
      emote += ` (${atk.counterAttack.damage} damage)`;
    }
    // Counter-attack crit effects
    if (atk.counterAttack.statusEffectsApplied.length > 0) {
      const critEffect = findCritEffect(atk.counterAttack.statusEffectsApplied);
      if (critEffect) {
        emote += fillTemplate(pickRandom(critEffect), target, actor);
      }
    }
  } else if (!atk.hit) {
    // Miss (no reversal)
    emote += fillTemplate(pickRandom(MISS_TEMPLATES), actor, target);
  } else {
    // Hit — select template by damageLabel
    const label = atk.damageLabel || 'Solid';
    const templates = HIT_TEMPLATES[label] || HIT_TEMPLATES['Solid'];
    emote += fillTemplate(pickRandom(templates), actor, target);

    // Crit suffix (critical hits, 5+ net successes)
    if (atk.isCrit && atk.statusEffectsApplied.length > 0) {
      const critEffect = findCritEffect(atk.statusEffectsApplied);
      if (critEffect) {
        emote += fillTemplate(pickRandom(critEffect), actor, target);
      }
    }
  }

  // Health threshold flavor — only on hits, only if target survived
  if (atk.hit && !context.targetFallen && context.targetThresholdCrossed) {
    const thresholdTemplates = HEALTH_THRESHOLD_TEMPLATES[context.targetThresholdCrossed];
    if (thresholdTemplates) {
      emote += fillTemplate(pickRandom(thresholdTemplates), actor, target);
    }
  }

  // Death suffix for target
  if (context.targetFallen) {
    emote += fillTemplate(pickRandom(DEATH_SUFFIXES), actor, target);
  }

  // Death suffix for actor (from counter-attack or dodge riposte)
  if (context.actorFallen && (atk.counterAttack || atk.dodgeRiposte)) {
    emote += fillTemplate(pickRandom(DEATH_SUFFIXES), target, actor);
  }

  // For opportunity attacks that started with a lowercase prefix, ensure proper casing
  if (isOpportunity && emote.length > 0) {
    emote = emote[0].toUpperCase() + emote.slice(1);
  }

  return emote;
}

/**
 * Determine the lowest health threshold band crossed by damage.
 * Returns the band number (4=80%, 3=60%, 2=40%, 1=20%) or null if none crossed.
 * Only triggers on downward transitions. Death (0%) handled separately.
 */
export function detectThresholdCrossed(
  healthBefore: number,
  healthAfter: number,
  maxHealth: number,
): number | null {
  if (maxHealth <= 0 || healthAfter <= 0) return null;

  const pctBefore = healthBefore / maxHealth;
  const pctAfter = healthAfter / maxHealth;

  // Check from lowest to highest — return the lowest band crossed
  const thresholds = [
    { band: 1, pct: 0.20 },
    { band: 2, pct: 0.40 },
    { band: 3, pct: 0.60 },
    { band: 4, pct: 0.80 },
  ];

  for (const { band, pct } of thresholds) {
    if (pctBefore > pct && pctAfter <= pct) {
      return band;
    }
  }
  return null;
}

function findCritEffect(effects: StatusEffect[]): string[] | null {
  for (const effect of effects) {
    const templates = CRIT_SUFFIXES[effect.type];
    if (templates) return templates;
  }
  return null;
}

// --- Wound assessment narratives ---

const WOUND_LIGHT_TEMPLATES = [
  '{name} bears scratches and bruises but walks from the field under their own power.',
  '{name} winces at a shallow cut, but the wound is little more than a nuisance.',
  '{name} limps away, bloodied but largely whole. Time will mend what steel has marred.',
];

const WOUND_SERIOUS_TEMPLATES = [
  '{name} clutches a deep wound, blood seeping through fingers. This will need tending.',
  '{name} staggers from the field, leaving a trail of crimson. Without care, this could fester.',
  '{name} presses cloth against a ragged gash. The bleeding slows, but the wound runs deep.',
];

const WOUND_SEVERE_TEMPLATES = [
  '{name} collapses, barely conscious. Without treatment, infection is certain.',
  '{name} crumples to the ground, breath coming in short, desperate gasps. The wounds are dire.',
  '{name} lies in a spreading pool of blood, too weak to rise. Urgent care is needed.',
];

const WOUND_GRAVE_TEMPLATES = [
  '{name} lies broken and still. Only swift intervention can prevent the end.',
  '{name} is found among the fallen, barely clinging to life. Every moment without aid is borrowed time.',
  '{name} does not rise when the dust settles. The wounds are grievous beyond measure.',
];

/** Generate a narrative string for a post-combat wound assessment. */
export function generateWoundNarrative(result: WoundAssessmentResult): string {
  const name = result.characterName;
  const hpStr = `${result.healthPercent}% HP`;

  switch (result.severity) {
    case 'light':
      return pickRandom(WOUND_LIGHT_TEMPLATES).replace(/\{name\}/g, name) + ` (${hpStr})`;
    case 'serious':
      return pickRandom(WOUND_SERIOUS_TEMPLATES).replace(/\{name\}/g, name) + ` (${hpStr})`;
    case 'severe':
      return pickRandom(WOUND_SEVERE_TEMPLATES).replace(/\{name\}/g, name) + ` (${hpStr})`;
    case 'grave':
      return pickRandom(WOUND_GRAVE_TEMPLATES).replace(/\{name\}/g, name) + ` (${hpStr})`;
    default:
      return '';
  }
}

/** Generate tending narratives for the ailment system. */
export function generateTendingNarrative(
  tenderName: string,
  patientName: string,
  succeeded: boolean,
  causedHarm: boolean,
): string {
  if (succeeded) {
    return pickRandom([
      `${tenderName} cleans ${patientName}'s wounds with practiced hands. The treatment takes hold.`,
      `${tenderName} applies a careful poultice to ${patientName}'s injuries. The bleeding eases.`,
      `${tenderName} works steadily, binding ${patientName}'s wounds. There is hope yet.`,
    ]);
  }
  if (causedHarm) {
    return pickRandom([
      `${tenderName}'s clumsy hands disturb the wound. ${patientName} worsens visibly.`,
      `${tenderName} fumbles the treatment, pressing too hard. ${patientName} cries out in pain as the wound inflames.`,
      `The supplies are wasted and ${patientName}'s condition deteriorates under ${tenderName}'s uncertain touch.`,
    ]);
  }
  return pickRandom([
    `${tenderName} fumbles with the poultice, wasting the supplies to no effect.`,
    `${tenderName} tries their best, but the treatment fails to take hold. The ingredients are spent.`,
    `Despite ${tenderName}'s efforts, the wound resists treatment. The supplies are lost.`,
  ]);
}
