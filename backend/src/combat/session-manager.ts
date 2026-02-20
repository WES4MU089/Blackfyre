/**
 * Session manager for multiplayer turn-based combat.
 * Manages in-memory session state, turn advancement, and persistence.
 */

import { db } from '../db/connection.js';
import { logger } from '../utils/logger.js';
import { loadCombatantStats } from './load-stats.js';
import { rollPoolInitiative } from './dice.js';
import { isNpcCharacter } from './npc-combatant.js';
import { assessWound } from './wound-assessment.js';
import {
  resolveAttack, resolveProtect, resolveGrapple, resolveDisengage,
  resolveBrace, processRoundStart, validateAction,
} from './tactical-engine.js';
import type {
  LobbyState, CombatSessionState, CombatSessionCombatant,
  ActionResult, RoundStartResult, TacticalAction, StatusEffect,
  WoundAssessmentResult,
} from './types.js';

// In-memory session store
const sessions = new Map<number, CombatSessionState>();

// Concurrency guard — prevents duplicate action processing
const processingLock = new Map<number, boolean>();

// Character → session mapping for quick lookups
const characterSession = new Map<number, number>();

// ============================================
// Session lifecycle
// ============================================

/**
 * Create a combat session from a lobby. Loads all combatant stats, rolls initiative,
 * creates turn order, persists to DB, and returns the session state.
 */
export async function createSession(lobby: LobbyState): Promise<CombatSessionState> {
  // Insert session into DB
  const sessionId = await db.insert(
    `INSERT INTO combat_sessions (lobby_id, status, current_round, combat_log)
     VALUES (?, 'active', 1, '[]')`,
    [lobby.lobbyId],
  );

  // Load stats and roll initiative for all members
  const combatants = new Map<number, CombatSessionCombatant>();
  const turnOrder: { characterId: number; initiative: number; team: number }[] = [];

  for (const member of lobby.members) {
    const stats = await loadCombatantStats(member.characterId);
    if (!stats) {
      throw new Error(`Failed to load stats for character ${member.characterId}`);
    }

    const initiative = rollPoolInitiative(stats.cunning, stats.prowess, stats.totalEncumbrance).total;

    const combatant: CombatSessionCombatant = {
      characterId: member.characterId,
      characterName: member.characterName,
      team: member.team,
      initiative,
      ownerCharacterId: member.ownerCharacterId ?? null,
      currentHealth: stats.currentHealth,
      maxHealth: stats.maxHealth,
      isAlive: true,
      isYielded: false,
      statusEffects: [],
      engagedTo: [],
      protectingId: null,
      isBracing: false,
      totalMitigation: stats.baseMitigation,
      durability: {
        weapon: { ...stats.durability.weapon },
        armor: { ...stats.durability.armor },
        shield: { ...stats.durability.shield },
      },
      statsSnapshot: stats,
    };

    combatants.set(member.characterId, combatant);
    turnOrder.push({ characterId: member.characterId, initiative, team: member.team });

    // Persist combatant to DB
    await db.insert(
      `INSERT INTO combat_session_combatants
       (session_id, character_id, team, initiative, current_health, max_health,
        is_alive, is_yielded, status_effects, engaged_to, stats_snapshot)
       VALUES (?, ?, ?, ?, ?, ?, TRUE, FALSE, '[]', '[]', ?)`,
      [
        sessionId, member.characterId, member.team, initiative,
        stats.currentHealth, stats.maxHealth, JSON.stringify(stats),
      ],
    );

    characterSession.set(member.characterId, sessionId);
  }

  // Sort turn order by initiative descending
  turnOrder.sort((a, b) => b.initiative - a.initiative);

  // Update DB with turn order and first turn
  const firstCharId = turnOrder[0].characterId;
  await db.execute(
    `UPDATE combat_sessions SET turn_order = ?, current_turn_character_id = ?
     WHERE id = ?`,
    [JSON.stringify(turnOrder), firstCharId, sessionId],
  );

  const session: CombatSessionState = {
    sessionId,
    lobbyId: lobby.lobbyId,
    region: lobby.region,
    status: 'active',
    currentRound: 1,
    currentTurnIndex: 0,
    turnOrder,
    combatants,
    winningTeam: null,
    combatLog: [],
  };

  sessions.set(sessionId, session);
  processingLock.set(sessionId, false);

  logger.info(`Combat session ${sessionId} created from lobby ${lobby.lobbyId} — ${combatants.size} combatants, first turn: ${firstCharId}`);
  return session;
}

// ============================================
// Turn management
// ============================================

/**
 * Get the character whose turn it currently is.
 */
export function getCurrentTurnCharacterId(sessionId: number): number | null {
  const session = sessions.get(sessionId);
  if (!session || session.status !== 'active') return null;
  return session.turnOrder[session.currentTurnIndex]?.characterId ?? null;
}

/**
 * Process a player's action. Validates turn, validates action legality,
 * delegates to the tactical engine, checks combat end, advances turn.
 */
export async function processAction(
  sessionId: number,
  characterId: number,
  actionType: TacticalAction,
  targetCharacterId?: number,
): Promise<{
  result: ActionResult;
  roundStart?: RoundStartResult;
  sessionEnded: boolean;
  nextTurnCharacterId: number | null;
  stunnedSkips: { characterId: number; characterName: string }[];
}> {
  const session = sessions.get(sessionId);
  if (!session) throw new Error('SESSION_NOT_FOUND');
  if (session.status !== 'active') throw new Error('SESSION_NOT_ACTIVE');

  // Concurrency guard
  if (processingLock.get(sessionId)) throw new Error('ACTION_IN_PROGRESS');
  processingLock.set(sessionId, true);

  try {
    // Validate it's this player's turn
    const currentTurn = session.turnOrder[session.currentTurnIndex];
    if (!currentTurn || currentTurn.characterId !== characterId) {
      throw new Error('NOT_YOUR_TURN');
    }

    const actor = session.combatants.get(characterId);
    if (!actor) throw new Error('COMBATANT_NOT_FOUND');

    // Validate action legality
    const validationError = validateAction(actor, actionType, targetCharacterId, session.combatants);
    if (validationError) throw new Error(validationError);

    // Resolve the action
    const turnNumber = session.combatLog.length + 1;
    let result: ActionResult;

    switch (actionType) {
      case 'attack':
        result = resolveAttack(
          sessionId, actor, targetCharacterId!, session.combatants,
          session.currentRound, turnNumber,
        );
        break;
      case 'protect':
        result = resolveProtect(
          sessionId, actor, targetCharacterId!, session.combatants,
          session.currentRound, turnNumber,
        );
        break;
      case 'grapple':
        result = resolveGrapple(
          sessionId, actor, targetCharacterId!, session.combatants,
          session.currentRound, turnNumber,
        );
        break;
      case 'disengage': {
        // If no specific target, disengage from first engager
        const disengageTarget = targetCharacterId ?? actor.engagedTo[0];
        result = resolveDisengage(
          sessionId, actor, disengageTarget, session.combatants,
          session.currentRound, turnNumber,
        );
        break;
      }
      case 'brace':
        result = resolveBrace(sessionId, actor, session.currentRound, turnNumber);
        break;
      default:
        throw new Error(`Unknown action: ${actionType}`);
    }

    session.combatLog.push(result);

    // Log to DB
    await logAction(sessionId, result);

    // Check combat end
    const ended = checkCombatEnd(session);
    if (ended) {
      session.status = 'completed';
      session.winningTeam = ended;
      await completeSession(session);
      return { result, sessionEnded: true, nextTurnCharacterId: null, stunnedSkips: [] };
    }

    // Advance turn
    const { roundStart, nextCharacterId, stunnedSkips } = advanceTurn(session);

    // advanceTurn may detect combat end (e.g. round-start bleed kills, or all dead after skips)
    if (nextCharacterId === null) {
      const winner = checkCombatEnd(session) ?? 0;
      session.status = 'completed';
      session.winningTeam = winner;
      await completeSession(session);
      return { result, roundStart: roundStart ?? undefined, sessionEnded: true, nextTurnCharacterId: null, stunnedSkips };
    }

    return {
      result,
      roundStart: roundStart ?? undefined,
      sessionEnded: false,
      nextTurnCharacterId: nextCharacterId,
      stunnedSkips,
    };
  } finally {
    processingLock.set(sessionId, false);
  }
}

/**
 * Skip a turn (voluntary or stunned).
 */
export async function skipTurn(
  sessionId: number,
  characterId: number,
): Promise<{
  result: ActionResult;
  roundStart?: RoundStartResult;
  sessionEnded: boolean;
  nextTurnCharacterId: number | null;
  stunnedSkips: { characterId: number; characterName: string }[];
}> {
  const session = sessions.get(sessionId);
  if (!session) throw new Error('SESSION_NOT_FOUND');
  if (session.status !== 'active') throw new Error('SESSION_NOT_ACTIVE');

  if (processingLock.get(sessionId)) throw new Error('ACTION_IN_PROGRESS');
  processingLock.set(sessionId, true);

  try {
    const currentTurn = session.turnOrder[session.currentTurnIndex];
    if (!currentTurn || currentTurn.characterId !== characterId) {
      throw new Error('NOT_YOUR_TURN');
    }

    const actor = session.combatants.get(characterId);
    if (!actor) throw new Error('COMBATANT_NOT_FOUND');

    const turnNumber = session.combatLog.length + 1;
    const result = {
      ...emptySkipResult(sessionId, session.currentRound, turnNumber, actor),
    };

    session.combatLog.push(result);
    await logAction(sessionId, result);

    const ended = checkCombatEnd(session);
    if (ended) {
      session.status = 'completed';
      session.winningTeam = ended;
      await completeSession(session);
      return { result, sessionEnded: true, nextTurnCharacterId: null, stunnedSkips: [] };
    }

    const { roundStart, nextCharacterId, stunnedSkips } = advanceTurn(session);

    if (nextCharacterId === null) {
      const winner = checkCombatEnd(session) ?? 0;
      session.status = 'completed';
      session.winningTeam = winner;
      await completeSession(session);
      return { result, roundStart: roundStart ?? undefined, sessionEnded: true, nextTurnCharacterId: null, stunnedSkips };
    }

    return {
      result,
      roundStart: roundStart ?? undefined,
      sessionEnded: false,
      nextTurnCharacterId: nextCharacterId,
      stunnedSkips,
    };
  } finally {
    processingLock.set(sessionId, false);
  }
}

/**
 * Advance to the next alive, non-stunned combatant.
 * If wrapping to index 0, process round start.
 * Stunned combatants are auto-skipped and their stun is consumed.
 */
function advanceTurn(session: CombatSessionState): {
  roundStart: RoundStartResult | null;
  nextCharacterId: number | null;
  stunnedSkips: { characterId: number; characterName: string }[];
} {
  let roundStart: RoundStartResult | null = null;
  const stunnedSkips: { characterId: number; characterName: string }[] = [];
  const maxAttempts = session.turnOrder.length * 2; // Safety to prevent infinite loop

  for (let i = 0; i < maxAttempts; i++) {
    session.currentTurnIndex++;

    // Round wrap
    if (session.currentTurnIndex >= session.turnOrder.length) {
      session.currentTurnIndex = 0;
      session.currentRound++;
      roundStart = processRoundStart(session.combatants, session.currentRound);

      // Check if round start caused deaths that end combat
      if (checkCombatEnd(session)) return { roundStart, nextCharacterId: null, stunnedSkips };
    }

    const next = session.turnOrder[session.currentTurnIndex];
    const combatant = session.combatants.get(next.characterId);

    if (!combatant || !combatant.isAlive || combatant.isYielded) continue;

    // Auto-skip stunned combatants: consume the stun and skip their turn
    const stunIndex = combatant.statusEffects.findIndex(e => e.type === 'stunned');
    if (stunIndex !== -1) {
      combatant.statusEffects.splice(stunIndex, 1);
      stunnedSkips.push({ characterId: combatant.characterId, characterName: combatant.characterName });
      logger.info(`Combat ${session.sessionId}: ${combatant.characterName} is stunned — turn skipped`);
      continue;
    }

    // Update DB
    db.execute(
      `UPDATE combat_sessions SET current_round = ?, current_turn_character_id = ? WHERE id = ?`,
      [session.currentRound, next.characterId, session.sessionId],
    ).catch(err => logger.error('Failed to update session turn:', err));

    return { roundStart, nextCharacterId: next.characterId, stunnedSkips };
  }

  // All combatants dead/yielded — combat should end
  return { roundStart, nextCharacterId: null, stunnedSkips };
}

// ============================================
// Combat end detection
// ============================================

/**
 * Check if combat has ended. Returns winning team number, or null if ongoing.
 */
function checkCombatEnd(session: CombatSessionState): number | null {
  const team1Alive = Array.from(session.combatants.values()).some(
    c => c.team === 1 && c.isAlive && !c.isYielded,
  );
  const team2Alive = Array.from(session.combatants.values()).some(
    c => c.team === 2 && c.isAlive && !c.isYielded,
  );

  if (!team1Alive && !team2Alive) return 0; // Draw
  if (!team1Alive) return 2;
  if (!team2Alive) return 1;
  return null;
}

// ============================================
// Yield handling
// ============================================

/**
 * Handle a combatant yielding. Marks them as yielded and checks combat end.
 */
export async function handleYield(
  sessionId: number,
  characterId: number,
): Promise<{
  sessionEnded: boolean;
  winningTeam: number | null;
  nextTurnCharacterId: number | null;
  roundStart?: RoundStartResult;
  stunnedSkips: { characterId: number; characterName: string }[];
  woundAssessments?: WoundAssessmentResult[];
}> {
  const session = sessions.get(sessionId);
  if (!session) throw new Error('SESSION_NOT_FOUND');

  const combatant = session.combatants.get(characterId);
  if (!combatant) throw new Error('COMBATANT_NOT_FOUND');
  if (!combatant.isAlive) throw new Error('ALREADY_DEAD');
  if (combatant.isYielded) throw new Error('ALREADY_YIELDED');

  combatant.isYielded = true;

  // Clean up engagements
  for (const engagedId of combatant.engagedTo) {
    const other = session.combatants.get(engagedId);
    if (other) {
      other.engagedTo = other.engagedTo.filter(id => id !== characterId);
    }
  }
  combatant.engagedTo = [];

  await db.execute(
    `UPDATE combat_session_combatants SET is_yielded = TRUE WHERE session_id = ? AND character_id = ?`,
    [sessionId, characterId],
  );

  const winningTeam = checkCombatEnd(session);
  if (winningTeam !== null) {
    session.status = 'completed';
    session.winningTeam = winningTeam;
    await completeSession(session);
    return { sessionEnded: true, winningTeam, nextTurnCharacterId: null, stunnedSkips: [], woundAssessments: session.woundAssessments };
  }

  // If the yielder is the current turn holder, advance the turn
  const currentTurn = session.turnOrder[session.currentTurnIndex];
  if (currentTurn && currentTurn.characterId === characterId) {
    const { roundStart, nextCharacterId, stunnedSkips } = advanceTurn(session);

    if (nextCharacterId === null) {
      const winner = checkCombatEnd(session) ?? 0;
      session.status = 'completed';
      session.winningTeam = winner;
      await completeSession(session);
      return { sessionEnded: true, winningTeam: winner, nextTurnCharacterId: null, roundStart: roundStart ?? undefined, stunnedSkips, woundAssessments: session.woundAssessments };
    }

    return { sessionEnded: false, winningTeam: null, nextTurnCharacterId: nextCharacterId, roundStart: roundStart ?? undefined, stunnedSkips };
  }

  return { sessionEnded: false, winningTeam: null, nextTurnCharacterId: null, stunnedSkips: [] };
}

// ============================================
// Session persistence
// ============================================

/**
 * Complete a session — persist final state to DB, update character vitals.
 */
async function completeSession(session: CombatSessionState): Promise<void> {
  const woundAssessments: WoundAssessmentResult[] = [];
  try {
    // Load light wound self-heal duration from config
    const healConfig = await db.queryOne<{ self_heal_seconds: number }>(
      `SELECT self_heal_seconds FROM wound_heal_config WHERE wound_severity = 'light'`,
    );
    const lightHealSeconds = healConfig?.self_heal_seconds ?? 86400;

    await db.transaction(async (conn) => {
      // Update session record
      await conn.query(
        `UPDATE combat_sessions SET status = 'completed', winning_team = ?,
         combat_log = ?, completed_at = NOW() WHERE id = ?`,
        [session.winningTeam, JSON.stringify(session.combatLog), session.sessionId],
      );

      // Update each combatant's final state
      for (const [, combatant] of session.combatants) {
        await conn.query(
          `UPDATE combat_session_combatants SET
           current_health = ?, is_alive = ?, is_yielded = ?,
           status_effects = ?, engaged_to = ?
           WHERE session_id = ? AND character_id = ?`,
          [
            combatant.currentHealth, combatant.isAlive, combatant.isYielded,
            JSON.stringify(combatant.statusEffects),
            JSON.stringify(combatant.engagedTo),
            session.sessionId, combatant.characterId,
          ],
        );

        // Skip vitals/durability persistence for NPC characters (they reset independently)
        const isNpc = await isNpcCharacter(combatant.characterId);
        if (!isNpc) {
          // Update character_vitals with combat-ending HP
          await conn.query(
            `UPDATE character_vitals SET health = ? WHERE character_id = ?`,
            [Math.max(0, combatant.currentHealth), combatant.characterId],
          );

          // Persist durability to character_equipment
          const durSlots = [
            { slot: 'mainHand', dur: combatant.durability.weapon },
            { slot: 'armor', dur: combatant.durability.armor },
            { slot: 'offHand', dur: combatant.durability.shield },
          ];
          for (const { slot, dur } of durSlots) {
            if (dur.current < 100) {
              await conn.query(
                `UPDATE character_equipment SET durability = ?
                 WHERE character_id = ? AND slot_id = ?`,
                [Math.max(0, dur.current), combatant.characterId, slot],
              );
            }
          }

          // Wound assessment for defeated player characters (retainers die outright)
          if (!combatant.isAlive) {
            const isRetainer = combatant.ownerCharacterId !== null;

            if (isRetainer) {
              await conn.query(
                `UPDATE characters SET death_state = 'dead' WHERE id = ?`,
                [combatant.characterId],
              );
            } else {
              // PC at 0 HP → grave wounds
              const result = assessWound(
                combatant.characterId,
                combatant.characterName,
                0,
                combatant.maxHealth,
              );
              woundAssessments.push(result);
              await conn.query(
                `UPDATE characters SET wound_severity = 'grave', wound_received_at = NOW(), wound_heals_at = NULL
                 WHERE id = ?`,
                [combatant.characterId],
              );
            }
          } else if (combatant.currentHealth < combatant.maxHealth) {
            // PC took damage but survived — assess wound severity from HP%
            const result = assessWound(
              combatant.characterId,
              combatant.characterName,
              combatant.currentHealth,
              combatant.maxHealth,
            );
            if (result.severity !== 'healthy') {
              woundAssessments.push(result);
              await conn.query(
                `UPDATE characters SET wound_severity = ?, wound_received_at = NOW(),
                 wound_heals_at = ${result.severity === 'light' ? `DATE_ADD(NOW(), INTERVAL ${lightHealSeconds} SECOND)` : 'NULL'}
                 WHERE id = ?`,
                [result.severity, combatant.characterId],
              );
            }
          }
        }
      }
    });

    // Store wound assessments on session for socket broadcast
    session.woundAssessments = woundAssessments;

    // Clean up in-memory state
    for (const [, combatant] of session.combatants) {
      characterSession.delete(combatant.characterId);
    }
    sessions.delete(session.sessionId);
    processingLock.delete(session.sessionId);

    logger.info(`Combat session ${session.sessionId} completed — winning team: ${session.winningTeam}`);
  } catch (error) {
    logger.error(`Failed to complete session ${session.sessionId}:`, error);
  }
}

/**
 * Log a single action to the combat_action_log table.
 */
async function logAction(sessionId: number, result: ActionResult): Promise<void> {
  try {
    const atk = result.attackResult;
    await db.insert(
      `INSERT INTO combat_action_log
       (session_id, round_number, turn_number, actor_character_id, action_type,
        target_character_id, roll_data, damage_dealt, damage_label, crit, crit_effect,
        status_effects_applied, narrative)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        sessionId, result.roundNumber, result.turnNumber, result.actorCharacterId,
        result.actionType, result.targetCharacterId,
        atk ? JSON.stringify({
          attackPoolSize: atk.attackPoolSize,
          defensePoolSize: atk.defensePoolSize,
          attackSuccesses: atk.attackPool.successes,
          defenseSuccesses: atk.defensePool?.successes ?? 0,
          netSuccesses: atk.netSuccesses,
          hit: atk.hit,
          defenseReversal: atk.defenseReversal,
          hitQuality: atk.hitQuality,
        }) : null,
        atk?.damage ?? 0,
        atk?.damageLabel ?? '',
        atk?.isCrit ?? false,
        atk?.critEffectsApplied?.join(',') ?? null,
        JSON.stringify(result.statusEffectsApplied),
        result.narrative,
      ],
    );
  } catch (error) {
    logger.error('Failed to log combat action:', error);
  }
}

// ============================================
// Lookup helpers
// ============================================

/** Get a session by ID. */
export function getSession(sessionId: number): CombatSessionState | null {
  return sessions.get(sessionId) ?? null;
}

/** Find which session a character is in. */
export function findSessionByCharacter(characterId: number): CombatSessionState | null {
  const sessionId = characterSession.get(characterId);
  if (!sessionId) return null;
  return sessions.get(sessionId) ?? null;
}

/** Handle a player disconnecting mid-combat. Mark them as yielded. */
export async function handleCombatDisconnect(characterId: number): Promise<{
  sessionId: number;
  sessionEnded: boolean;
  winningTeam: number | null;
  nextTurnCharacterId: number | null;
  roundStart?: RoundStartResult;
  stunnedSkips: { characterId: number; characterName: string }[];
  woundAssessments?: WoundAssessmentResult[];
} | null> {
  const sessionId = characterSession.get(characterId);
  if (!sessionId) return null;

  try {
    const result = await handleYield(sessionId, characterId);
    return { sessionId, ...result };
  } catch {
    return null;
  }
}

// ============================================
// Helpers
// ============================================

function emptySkipResult(
  sessionId: number, roundNumber: number, turnNumber: number,
  actor: CombatSessionCombatant,
): ActionResult {
  return {
    sessionId, roundNumber, turnNumber,
    actorCharacterId: actor.characterId,
    actorName: actor.characterName,
    actionType: 'skip',
    targetCharacterId: null,
    targetName: null,
    attackResult: null,
    statusEffectsApplied: [],
    statusEffectsRemoved: [],
    opportunityAttacks: [],
    narrative: `${actor.characterName} skips their turn.`,
  };
}
