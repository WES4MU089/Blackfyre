import { logger } from '../utils/logger.js';
import { db } from '../db/connection.js';
import { grantCharacterXp } from './xp-service.js';

/**
 * Grant post-combat character XP (1 segment) to a character.
 */
export async function grantPostCombatXp(
  characterId: number,
  combatId: number,
  combatType: 'duel' | 'session',
): Promise<void> {
  try {
    await grantCharacterXp(characterId, 'combat', 1, { [`${combatType}_id`]: combatId });
  } catch (error) {
    logger.error(`Failed to grant combat XP to character ${characterId}:`, error);
  }
}

/**
 * Grant post-combat XP to all player characters in a multiplayer session.
 * Skips NPC characters.
 */
export async function grantPostSessionXpToAll(
  sessionId: number,
): Promise<void> {
  try {
    // Get all non-NPC combatants
    const combatants = await db.query<{ character_id: number }>(
      `SELECT csc.character_id
       FROM combat_session_combatants csc
       JOIN characters c ON csc.character_id = c.id
       WHERE csc.session_id = ?
         AND c.player_id IS NOT NULL`,
      [sessionId],
    );

    for (const combatant of combatants) {
      await grantPostCombatXp(combatant.character_id, sessionId, 'session');
    }
  } catch (error) {
    logger.error(`Failed to grant session XP for session ${sessionId}:`, error);
  }
}
