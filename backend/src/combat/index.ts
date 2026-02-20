// Combat system barrel exports

// Main entry point
export { resolveDuel } from './duel-engine.js';

// Shared stats loader
export { loadCombatantStats } from './load-stats.js';

// Attack resolver (shared contested dice pool resolution)
export { resolveAttack as resolveContested } from './attack-resolver.js';

// Equipment data (bible constants + compute functions)
export {
  calculateWeaponStats, calculateArmorStats, calculateShieldStats,
  getWeaponTierDice, getShieldDice,
  WEAPON_TIERS, WEAPON_TYPES, ARMOR_TIERS, ARMOR_CLASSES,
  SHIELD_TIERS, SHIELD_CLASSES, DURABILITY_LOSS,
  STATUS_EFFECT_CONFIG,
} from './equipment-data.js';

// Types
export type {
  CombatantStats,
  CombatPoolResult,
  DiceRollResult,
  HitQuality,
  Exchange,
  RoundResult,
  DuelResult,
  ReputationDelta,
  DesperateStandBonus,
  YieldThreshold,
  YieldResponse,
  WeaponType,
  ArmorClass,
  ShieldClass,
  DuelOutcome,
  Actor,
  // Equipment stat types
  WeaponStats,
  ArmorStats,
  ShieldStats,
  DurabilityState,
  DurabilityChange,
  // Attack resolution types
  AttackResult,
  CounterAttackResult,
  DodgeRiposteResult,
  // Multiplayer combat types
  TacticalAction,
  StatusEffectType,
  StatusEffect,
  CombatSessionCombatant,
  TurnAction,
  ActionResult,
  RoundStartResult,
  CombatSessionState,
  LobbyMember,
  LobbyState,
} from './types.js';

// Dice (combat pools + non-combat skill checks)
export { rollAptitudeExperience, rollD6, rollD10, rollCombatPool, rollPoolInitiative } from './dice.js';

// Damage utilities (useful for StatsPanel previews via API)
export { getWoundDice, getHitQuality, getHitQualityMultiplier, rawPenetrationDifference, getDamageLabel, calculateDamageMultiplier, calculateFinalDamage } from './damage.js';

// Yield utilities
export { shouldAttemptYield, resolveYieldResponse, calculateDesperateStandBonus } from './yield.js';

// Reputation
export { calculateDuelReputationChanges } from './reputation.js';

// Tactical engine (multiplayer per-action resolver)
export {
  resolveAttack as resolveTacticalAttack,
  resolveProtect as resolveTacticalProtect,
  resolveGrapple as resolveTacticalGrapple,
  resolveDisengage as resolveTacticalDisengage,
  resolveBrace as resolveTacticalBrace,
  resolveOpportunityAttack,
  processRoundStart,
  validateAction,
} from './tactical-engine.js';

// Session manager (multiplayer session lifecycle)
export {
  createSession,
  processAction,
  skipTurn,
  handleYield,
  getSession,
  findSessionByCharacter,
  handleCombatDisconnect,
  getCurrentTurnCharacterId,
} from './session-manager.js';

// Combat narrator (IC emote generation)
export { generateCombatEmote, generateCombatEmotes, generateBleedingEmote } from './combat-narrator.js';

// Lobby manager
export {
  createLobby,
  joinLobby,
  leaveLobby,
  switchTeam,
  setReady,
  startCombat as startLobby,
  cancelLobby,
  getLobbiesInRegion,
  findLobbyByCharacter,
  findLobbyByHost,
  getLobby,
  handleDisconnect as handleLobbyDisconnect,
  markStarted,
  canStart,
  npcJoinLobby,
} from './lobby-manager.js';

// NPC combatant AI
export {
  isNpcCharacter,
  scheduleNpcTurn,
  cancelNpcTimers,
  handleNpcPostCombat,
  resetNpcVitals,
} from './npc-combatant.js';
