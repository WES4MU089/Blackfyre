import { db } from '../db/connection.js';
import { logger } from '../utils/logger.js';
import { getXpConfig } from './xp-config.js';
import { getIO } from '../websocket/index.js';
import { RETAINER_LEVEL_CAP } from '../retainers/retainer-manager.js';

// ---- Types ----

export type CharacterXpSource = 'combat' | 'dm_award' | 'playtime';

export interface GrantCharacterXpResult {
  granted: boolean;
  reason?: 'daily_cap_reached' | 'level_cap_reached';
  newSegments: number;
  newLevel: number;
  leveledUp: boolean;
  aptitudePointsGained: number;
}

// ---- Character XP ----

/**
 * Grant character XP segments. Handles daily cap checking, level-up, and point awards.
 * Emits WebSocket events to the character.
 */
export async function grantCharacterXp(
  characterId: number,
  source: CharacterXpSource,
  segments: number = 1,
  metadata?: Record<string, unknown>,
): Promise<GrantCharacterXpResult> {
  const segmentsPerLevel = getXpConfig('char_segments_per_level', 10);

  // Load current state (include retainer_tier to determine caps)
  const char = await db.queryOne<{ level: number; xp_segments: number; retainer_tier: number | null }>(
    'SELECT level, xp_segments, retainer_tier FROM characters WHERE id = ?',
    [characterId],
  );
  if (!char) {
    logger.warn(`grantCharacterXp: character ${characterId} not found`);
    return { granted: false, newSegments: 0, newLevel: 0, leveledUp: false, aptitudePointsGained: 0 };
  }

  const isRetainer = char.retainer_tier !== null;
  const levelCap = isRetainer ? RETAINER_LEVEL_CAP : getXpConfig('char_level_cap', 20);

  // Hard global daily cap (dm_award bypasses all caps)
  if (source !== 'dm_award') {
    const globalCap = isRetainer ? 1 : getXpConfig('char_daily_cap', 3);
    const totalToday = await getCharacterDailyTotal(characterId);
    if (totalToday >= globalCap) {
      logger.debug(`Character ${characterId} hit daily cap (${totalToday}/${globalCap})${isRetainer ? ' [retainer]' : ''}`);
      return {
        granted: false,
        reason: 'daily_cap_reached',
        newSegments: 0,
        newLevel: 0,
        leveledUp: false,
        aptitudePointsGained: 0,
      };
    }
  }

  if (char.level >= levelCap) {
    return {
      granted: false,
      reason: 'level_cap_reached',
      newSegments: Number(char.xp_segments),
      newLevel: char.level,
      leveledUp: false,
      aptitudePointsGained: 0,
    };
  }

  // Calculate new state
  let newSegments = Number(char.xp_segments) + segments;
  let newLevel = char.level;
  let leveledUp = false;
  let aptitudePointsGained = 0;

  if (newSegments >= segmentsPerLevel) {
    newLevel = Math.min(char.level + 1, levelCap);
    newSegments = newSegments - segmentsPerLevel;
    leveledUp = true;
    aptitudePointsGained = getXpConfig('levelup_aptitude_points', 1);
  }

  // Transaction: log + update
  await db.transaction(async (conn) => {
    await conn.query(
      `INSERT INTO character_xp_log (character_id, source, segments_granted, earned_date, metadata)
       VALUES (?, ?, ?, CURDATE(), ?)`,
      [characterId, source, segments, metadata ? JSON.stringify(metadata) : null],
    );

    if (leveledUp) {
      await conn.query(
        `UPDATE characters SET level = ?, xp_segments = ?,
         unspent_aptitude_points = unspent_aptitude_points + ?
         WHERE id = ?`,
        [newLevel, newSegments, aptitudePointsGained, characterId],
      );
    } else {
      await conn.query(
        'UPDATE characters SET xp_segments = ? WHERE id = ?',
        [newSegments, characterId],
      );
    }
  });

  // Emit WebSocket events
  const io = getIO();
  if (io) {
    io.to(`character:${characterId}`).emit('xp:character-gain', {
      segments,
      totalSegments: newSegments,
      source,
    });

    if (leveledUp) {
      io.to(`character:${characterId}`).emit('xp:character-levelup', {
        newLevel,
        segments: newSegments,
        aptitudePoints: aptitudePointsGained,
      });
    }
  }

  logger.info(
    `Character ${characterId} gained ${segments} XP segment(s) from ${source}` +
    (leveledUp ? ` → leveled up to ${newLevel}` : ` (${newSegments}/${segmentsPerLevel})`),
  );

  return { granted: true, newSegments, newLevel, leveledUp, aptitudePointsGained };
}

// ---- Internal helpers ----

async function getCharacterDailyTotal(characterId: number): Promise<number> {
  const row = await db.queryOne<{ cnt: number }>(
    `SELECT COUNT(*) AS cnt FROM character_xp_log WHERE character_id = ? AND source != 'dm_award' AND earned_date = CURDATE()`,
    [characterId],
  );
  return Number(row?.cnt ?? 0);
}
