// ============================================
// Combat System Type Definitions
// ============================================

// --- Enums / Union types ---

export type YieldThreshold = 'heroic' | 'brave' | 'cautious' | 'cowardly';
export type YieldResponse = 'merciful' | 'pragmatic' | 'ruthless';
export type DuelOutcome = 'victory' | 'yield_accepted' | 'yield_rejected_slain' | 'desperate_stand_win' | 'draw';
export type Actor = 'attacker' | 'defender';

export type WeaponType =
  | 'dagger' | 'bastardSword' | 'longsword' | 'greatsword'
  | 'battleAxe1H' | 'battleAxe2H'
  | 'warhammer1H' | 'warhammer2H' | 'mace1H'
  | 'spear' | 'polearm'
  | 'bow';

export type ArmorClass = 'none' | 'light' | 'medium' | 'heavy';
export type ShieldClass = 'none' | 'light' | 'medium' | 'heavy';

export type HitQuality = 'normal' | 'strong' | 'critical';

// --- Dice pool result ---

/** Result of rolling a combat dice pool (Xd6, attack 4+ / defense 5+). */
export interface CombatPoolResult {
  poolSize: number;           // Pool size before minimum clamp
  effectivePool: number;      // Dice actually rolled (min 1)
  dice: number[];             // Every die result
  successes: number;          // Count of dice >= threshold (4 for attack, 5 for defense)
  sixes: number;              // Count of dice showing 6 (for armor piercing)
}

// --- Equipment stat interfaces (computed from tier + class constants) ---

export interface WeaponStats {
  penetration: number;
  baseDamage: number;
  encumbrance: number;
  twoHanded: boolean;
  slashing: boolean;
  armorPiercing: boolean;
  bonusVsHeavy: number;
  noBluntBonus: boolean;     // Valyrian tier blocks blunt bonus
  noEncumbrance: boolean;    // Daggers ignore encumbrance
  critEffect: string | string[];
  critBonus: number;
  durabilityLoss: number;
}

export interface ArmorStats {
  mitigation: number;
  encumbrance: number;
  isHeavy: boolean;
}

export interface ShieldStats {
  blockBonus: number;
  encumbrance: number;
}

export interface DurabilityState {
  weapon: { current: number; loss: number };
  armor: { current: number; loss: number };
  shield: { current: number; loss: number };
}

// --- Core combatant stats (loaded from DB, computed via equipment-data) ---

export interface CombatantStats {
  characterId: number;
  characterName: string;

  // Aptitudes
  prowess: number;
  fortitude: number;
  cunning: number;
  lore: number;

  // Weapon (raw DB fields + computed stats)
  weaponType: WeaponType;
  weaponTier: number;
  weaponMaterial: string;
  isTwoHanded: boolean;
  weapon: WeaponStats;

  // Armor (raw DB fields + computed stats)
  armorTier: number;
  armorClass: ArmorClass;
  armor: ArmorStats;

  // Shield (raw DB fields + computed stats)
  shieldTier: number;
  shieldClass: ShieldClass;
  shield: ShieldStats;
  hasShield: boolean;

  // Derived combat values (dice pool system)
  attackPoolBase: number;      // prowess + weaponTierBonus
  defensePoolBase: number;     // defenseAptitude + shieldDice
  defenseAptitude: number;     // resolved aptitude (Fortitude/Cunning/max)
  weaponTierBonus: number;     // T1=0, T2=1, T3=2, T4=3, T5=4
  shieldDice: number;          // computed from shield tier + class
  totalEncumbrance: number;    // weapon + armor + shield encumbrance
  isLightlyArmored: boolean;   // no armor or armorClass is none/light
  baseMitigation: number;      // armor.mitigation (immutable reference)
  totalMitigation: number;     // baseMitigation minus sundered stacks (mutable in combat)

  // Durability (mutable during combat)
  durability: DurabilityState;

  // Vitals
  currentHealth: number;
  maxHealth: number;

  // Combat personality
  yieldThreshold: YieldThreshold;
  yieldResponse: YieldResponse;
  isNoble: boolean;

  // Persistent wound status
  woundSeverity: WoundSeverity;  // wound state from prior combat
}

// --- Attack resolution results ---

export interface DurabilityChange {
  characterId: number;
  slot: 'mainHand' | 'armor' | 'offHand';
  loss: number;
  newValue: number;
}

export interface CounterAttackResult {
  attackerCharacterId: number;
  attackerName: string;
  targetCharacterId: number;
  targetName: string;
  damage: number;
  weaponPenetration: number;
  targetMitigation: number;
  netPenetration: number;
  damageLabel: string;
  statusEffectsApplied: StatusEffect[];
  bonuses: string[];
  durabilityChanges: DurabilityChange[];
}

export interface DodgeRiposteResult {
  attackerCharacterId: number;
  attackerName: string;
  targetCharacterId: number;
  targetName: string;
  damage: number;
  weaponPenetration: number;
  targetMitigation: number;
  netPenetration: number;
  damageLabel: string;
  bonuses: string[];
  durabilityChanges: DurabilityChange[];
}

export interface AttackResult {
  attackerCharacterId: number;
  attackerName: string;
  defenderCharacterId: number;
  defenderName: string;

  // Pool rolls
  attackPool: CombatPoolResult;
  defensePool: CombatPoolResult | null;  // null for alwaysHit (opportunity attacks)
  attackPoolSize: number;                // pre-roll pool size (for logging)
  defensePoolSize: number;               // pre-roll pool size
  netSuccesses: number;                  // attack successes - defense successes (can be negative)

  // Outcome
  hit: boolean;
  defenseReversal: boolean;  // defense successes exceed attack by 3+ (4+ for medium)
  dodged: boolean;           // defense reversal for light/no armor
  hitQuality: HitQuality | null;  // null on miss
  damage: number;
  damageLabel: string;
  isCrit: boolean;           // true when hitQuality === 'critical'

  // Penetration details (populated on hit)
  weaponPenetration: number;
  targetMitigation: number;
  netPenetration: number;
  baseDamage: number;
  bonusDamage: number;
  damageMultiplier: number;
  hitQualityMultiplier: number;  // 1.0 / 1.15 / 1.35

  // Effects
  critEffectsApplied: string[];
  statusEffectsApplied: StatusEffect[];
  bonuses: string[];

  // Counter-attack (on defense reversal with shield)
  counterAttack: CounterAttackResult | null;

  // Dodge riposte (on defense reversal for light/no armor)
  dodgeRiposte: DodgeRiposteResult | null;

  // Dagger crit bonus strike (second attack, no recursion)
  bonusStrike: AttackResult | null;

  // Durability
  durabilityChanges: DurabilityChange[];
}

// --- Dice result types ---

/** Result of rolling an Aptitude+Experience dice pool (non-combat skill checks). */
export interface DiceRollResult {
  total: number;
  keptDice: number[];
  discardedDice: number[];
  aptitudeDiceCount: number;
  experienceDiceCount: number;
  modifier: number;
}

// --- Duel types ---

export interface Exchange {
  actor: Actor;
  result: AttackResult;
}

export interface RoundResult {
  roundNumber: number;
  firstActorInitiative: number;
  secondActorInitiative: number;
  firstActor: Actor;
  exchanges: Exchange[];
  attackerHpAfter: number;
  defenderHpAfter: number;
  yieldAttemptedBy: Actor | null;
  yieldAccepted: boolean | null;
  desperateStand: boolean;
  narrative: string;
}

export interface ReputationDelta {
  characterId: number;
  honor: number;
  chivalry: number;
  dread: number;
  renown: number;
  reason: string;
}

export interface DuelResult {
  winnerId: number | null;
  loserId: number | null;
  outcome: DuelOutcome;
  rounds: RoundResult[];
  totalRounds: number;
  attackerHpStart: number;
  attackerHpEnd: number;
  defenderHpStart: number;
  defenderHpEnd: number;
  reputationChanges: ReputationDelta[];
}

/** Desperate stand attack/initiative bonus for rejected yielders (duel only). */
export interface DesperateStandBonus {
  attackBonus: number;
  initiativeBonus: number;
}

// ============================================
// Multiplayer Combat Types
// ============================================

export type TacticalAction = 'attack' | 'protect' | 'grapple' | 'disengage' | 'brace' | 'mend';

export type StatusEffectType =
  | 'bleeding'     // 5 dmg/round per stack, stacks to 3
  | 'stunned'      // Skip next turn, 1 round
  | 'sundered'     // -5 mitigation/stack, stacks to 3
  | 'piercing'     // +10 pen instant on this attack
  | 'engaged'      // In melee with another combatant
  | 'protecting'   // Guarding an ally, +1 defense die
  | 'pressured'    // 2+ enemies engaging, -2 dice from pool
  | 'grappled'     // -3 defense dice
  | 'grappling'    // Holding an opponent
  | 'bracing';     // +1 defense die per incoming attacker

/** Effects that can be removed by the Mend action. */
export const MENDABLE_EFFECTS: StatusEffectType[] = ['bleeding', 'stunned', 'sundered'];

export interface StatusEffect {
  type: StatusEffectType;
  stacks: number;
  roundsRemaining: number;   // -1 = indefinite (until explicitly removed)
  sourceCharacterId: number;
}

/** Per-combatant state during an active combat session. */
export interface CombatSessionCombatant {
  characterId: number;
  characterName: string;
  team: number;
  initiative: number;
  ownerCharacterId: number | null;  // null for players/NPCs, set for retainers
  currentHealth: number;
  maxHealth: number;
  isAlive: boolean;
  isYielded: boolean;
  statusEffects: StatusEffect[];
  engagedTo: number[];          // Character IDs currently engaged with
  protectingId: number | null;  // Character being guarded
  isBracing: boolean;
  totalMitigation: number;      // Starts at baseMitigation, reduced by sundered
  durability: DurabilityState;  // Tracked per-session
  statsSnapshot: CombatantStats;
}

/** A player's chosen action for their turn. */
export interface TurnAction {
  actionType: TacticalAction;
  targetCharacterId?: number;
}

/** Full result of resolving one action — broadcast to all combatants. */
export interface ActionResult {
  sessionId: number;
  roundNumber: number;
  turnNumber: number;
  actorCharacterId: number;
  actorName: string;
  actionType: TacticalAction | 'opportunity_attack' | 'skip';
  targetCharacterId: number | null;
  targetName: string | null;

  // Attack resolution (null for non-attack actions like protect/brace)
  attackResult: AttackResult | null;

  // Status effect changes
  statusEffectsApplied: StatusEffect[];
  statusEffectsRemoved: { characterId: number; type: StatusEffectType }[];

  // Triggered opportunity attacks
  opportunityAttacks: ActionResult[];

  // Health threshold band the target crossed into (4=80%, 3=60%, 2=40%, 1=20%), or null
  targetThresholdCrossed?: number | null;

  // Narrative text
  narrative: string;
}

/** Round-start processing results (bleeding, effect expiry, etc.). */
export interface RoundStartResult {
  roundNumber: number;
  bleedingDamage: { characterId: number; damage: number; stacks: number }[];
  expiredEffects: { characterId: number; type: StatusEffectType }[];
  deaths: { characterId: number; cause: string }[];
}

/** Full state of an active combat session. */
export interface CombatSessionState {
  sessionId: number;
  lobbyId: number | null;
  region: string;
  status: 'active' | 'completed' | 'abandoned';
  currentRound: number;
  currentTurnIndex: number;
  turnOrder: { characterId: number; initiative: number; team: number }[];
  combatants: Map<number, CombatSessionCombatant>;
  winningTeam: number | null;
  combatLog: ActionResult[];
  woundAssessments?: WoundAssessmentResult[];
}

// --- Wound assessment types ---

export type WoundSeverity = 'healthy' | 'light' | 'serious' | 'severe' | 'grave';

export interface WoundAssessmentResult {
  characterId: number;
  characterName: string;
  currentHealth: number;
  maxHealth: number;
  healthPercent: number;
  severity: WoundSeverity;
  dicePenalty: number;        // 0, 1, 2, 3, or -1 for blocked
  requiresTending: boolean;   // false for healthy/light
  infectionRisk: boolean;     // true for serious/severe/grave
}

/** Lobby member state. */
export interface LobbyMember {
  characterId: number;
  characterName: string;
  team: number;
  isReady: boolean;
  socketId: string;
  ownerCharacterId: number | null;  // null for players, set for retainers
  isRetainer: boolean;
}

/** In-memory lobby state. */
export interface LobbyState {
  lobbyId: number;
  hostCharacterId: number;
  hostName: string;
  region: string;
  status: 'open' | 'starting' | 'started' | 'cancelled';
  maxPlayers: number;
  members: LobbyMember[];
}
