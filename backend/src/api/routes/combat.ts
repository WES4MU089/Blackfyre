import { Router, Request, Response } from 'express';
import { z } from 'zod';
import { db } from '../../db/connection.js';
import { logger } from '../../utils/logger.js';
import { getIO } from '../../websocket/index.js';
import { resolveDuel } from '../../combat/index.js';
import { loadCombatantStats } from '../../combat/load-stats.js';

export const combatRouter = Router();

// ============================================
// Validation schemas
// ============================================

const initiateSchema = z.object({
  attackerCharacterId: z.number().int().positive(),
  defenderCharacterId: z.number().int().positive(),
});

const acceptSchema = z.object({
  characterId: z.number().int().positive(),
});

const declineSchema = z.object({
  characterId: z.number().int().positive(),
});

const yieldSettingsSchema = z.object({
  yieldThreshold: z.enum(['heroic', 'brave', 'cautious', 'cowardly']).optional(),
  yieldResponse: z.enum(['merciful', 'pragmatic', 'ruthless']).optional(),
});

// ============================================
// Routes
// ============================================

/** POST /duel/initiate — Challenge another character to a duel. */
combatRouter.post('/duel/initiate', async (req: Request, res: Response) => {
  try {
    const parsed = initiateSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: 'Invalid request', details: parsed.error.issues });
    }

    const { attackerCharacterId, defenderCharacterId } = parsed.data;

    if (attackerCharacterId === defenderCharacterId) {
      return res.status(400).json({ error: 'Cannot challenge yourself' });
    }

    // Verify both characters exist and are active
    const attacker = await db.queryOne<{ id: number; name: string }>(
      `SELECT id, name FROM characters WHERE id = ? AND is_active = TRUE`,
      [attackerCharacterId],
    );
    const defender = await db.queryOne<{ id: number; name: string }>(
      `SELECT id, name FROM characters WHERE id = ? AND is_active = TRUE`,
      [defenderCharacterId],
    );

    if (!attacker) return res.status(404).json({ error: 'Attacker character not found' });
    if (!defender) return res.status(404).json({ error: 'Defender character not found' });

    // Check neither is in an active duel (use transaction with FOR UPDATE to prevent race)
    const duelId = await db.transaction(async (conn) => {
      const activeDuels = await conn.query(
        `SELECT id FROM duels
         WHERE status IN ('pending', 'active')
           AND (attacker_character_id IN (?, ?) OR defender_character_id IN (?, ?))
         FOR UPDATE`,
        [attackerCharacterId, defenderCharacterId, attackerCharacterId, defenderCharacterId],
      );

      if (activeDuels.length > 0) {
        throw new Error('ALREADY_IN_DUEL');
      }

      const result = await conn.query(
        `INSERT INTO duels (attacker_character_id, defender_character_id, status)
         VALUES (?, ?, 'pending')`,
        [attackerCharacterId, defenderCharacterId],
      );
      return Number(result.insertId);
    });

    // Emit challenge event to defender
    const io = getIO();
    if (io) {
      io.to(`character:${defenderCharacterId}`).emit('combat:duel-challenge', {
        duelId,
        attackerCharacterId,
        attackerCharacterName: attacker.name,
      });
    }

    res.status(201).json({ duelId, status: 'pending' });
  } catch (error: unknown) {
    if (error instanceof Error && error.message === 'ALREADY_IN_DUEL') {
      return res.status(409).json({ error: 'One or both characters are already in a duel' });
    }
    logger.error('Failed to initiate duel:', error);
    res.status(500).json({ error: 'Failed to initiate duel' });
  }
});

/** POST /duel/:duelId/accept — Accept and resolve a duel challenge. */
combatRouter.post('/duel/:duelId/accept', async (req: Request, res: Response) => {
  try {
    const duelId = Number(req.params.duelId);
    const parsed = acceptSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: 'Invalid request' });
    }

    // Fetch and validate the duel
    const duel = await db.queryOne<{
      id: number;
      attacker_character_id: number;
      defender_character_id: number;
      status: string;
    }>(
      `SELECT id, attacker_character_id, defender_character_id, status FROM duels WHERE id = ?`,
      [duelId],
    );

    if (!duel) return res.status(404).json({ error: 'Duel not found' });
    if (duel.status !== 'pending') return res.status(400).json({ error: 'Duel is not pending' });
    if (parsed.data.characterId !== duel.defender_character_id) {
      return res.status(403).json({ error: 'Only the defender can accept' });
    }

    // Load both combatants
    const attackerStats = await loadCombatantStats(duel.attacker_character_id);
    const defenderStats = await loadCombatantStats(duel.defender_character_id);

    if (!attackerStats || !defenderStats) {
      return res.status(400).json({ error: 'Failed to load combatant stats' });
    }

    // Resolve the duel
    const result = resolveDuel(attackerStats, defenderStats);

    // Persist everything in a transaction
    await db.transaction(async (conn) => {
      // Update duel record
      await conn.query(
        `UPDATE duels SET
           status = 'completed',
           winner_character_id = ?,
           outcome = ?,
           total_rounds = ?,
           combat_log = ?,
           attacker_hp_start = ?,
           attacker_hp_end = ?,
           defender_hp_start = ?,
           defender_hp_end = ?,
           reputation_changes = ?,
           completed_at = NOW()
         WHERE id = ?`,
        [
          result.winnerId,
          result.outcome,
          result.totalRounds,
          JSON.stringify(result.rounds),
          result.attackerHpStart,
          result.attackerHpEnd,
          result.defenderHpStart,
          result.defenderHpEnd,
          JSON.stringify(result.reputationChanges),
          duelId,
        ],
      );

      // Insert round records
      for (const round of result.rounds) {
        const ex1 = round.exchanges[0];
        const ex2 = round.exchanges[1];

        await conn.query(
          `INSERT INTO duel_rounds (
             duel_id, round_number,
             attacker_initiative, defender_initiative, first_actor,
             first_attack_roll, first_defense_roll, first_hit, first_margin, first_damage, first_damage_label,
             second_attack_roll, second_defense_roll, second_hit, second_margin, second_damage, second_damage_label,
             attacker_hp_after, defender_hp_after,
             yield_attempted_by, yield_accepted, desperate_stand, round_narrative
           ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          [
            duelId, round.roundNumber,
            round.firstActorInitiative, round.secondActorInitiative, round.firstActor,
            ex1?.result.attackPool?.successes ?? null, ex1?.result.defensePool?.successes ?? null,
            ex1?.result.hit ?? null, ex1?.result.netSuccesses ?? 0, ex1?.result.damage ?? null, ex1?.result.damageLabel ?? null,
            ex2?.result.attackPool?.successes ?? null, ex2?.result.defensePool?.successes ?? null,
            ex2?.result.hit ?? null, ex2?.result.netSuccesses ?? 0, ex2?.result.damage ?? null, ex2?.result.damageLabel ?? null,
            round.attackerHpAfter, round.defenderHpAfter,
            round.yieldAttemptedBy, round.yieldAccepted, round.desperateStand, round.narrative,
          ],
        );
      }

      // Apply HP changes to character_vitals
      await conn.query(
        `UPDATE character_vitals SET health = ? WHERE character_id = ?`,
        [Math.max(0, result.attackerHpEnd), duel.attacker_character_id],
      );
      await conn.query(
        `UPDATE character_vitals SET health = ? WHERE character_id = ?`,
        [Math.max(0, result.defenderHpEnd), duel.defender_character_id],
      );

      // Apply reputation changes
      for (const delta of result.reputationChanges) {
        await conn.query(
          `INSERT INTO character_reputation (character_id, honor, chivalry, dread, renown)
           VALUES (?, ?, ?, ?, ?)
           ON DUPLICATE KEY UPDATE
             honor = honor + VALUES(honor),
             chivalry = chivalry + VALUES(chivalry),
             dread = dread + VALUES(dread),
             renown = renown + VALUES(renown)`,
          [delta.characterId, delta.honor, delta.chivalry, delta.dread, delta.renown],
        );
      }
    });

    // Emit result to both characters via Socket.IO
    const io = getIO();
    if (io) {
      io.to(`character:${duel.attacker_character_id}`).emit('combat:duel-result', { duelId, result });
      io.to(`character:${duel.defender_character_id}`).emit('combat:duel-result', { duelId, result });

      // Emit reputation updates
      for (const delta of result.reputationChanges) {
        const rep = await db.queryOne<{ honor: number; chivalry: number; dread: number; renown: number }>(
          `SELECT honor, chivalry, dread, renown FROM character_reputation WHERE character_id = ?`,
          [delta.characterId],
        );
        if (rep) {
          io.to(`character:${delta.characterId}`).emit('combat:reputation-update', rep);
        }
      }
    }

    res.json({ success: true, duelId, result });
  } catch (error) {
    logger.error('Failed to accept/resolve duel:', error);
    res.status(500).json({ error: 'Failed to resolve duel' });
  }
});

/** POST /duel/:duelId/decline — Decline a duel challenge. */
combatRouter.post('/duel/:duelId/decline', async (req: Request, res: Response) => {
  try {
    const duelId = Number(req.params.duelId);
    const parsed = declineSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: 'Invalid request' });
    }

    const duel = await db.queryOne<{
      id: number;
      attacker_character_id: number;
      defender_character_id: number;
      status: string;
    }>(
      `SELECT id, attacker_character_id, defender_character_id, status FROM duels WHERE id = ?`,
      [duelId],
    );

    if (!duel) return res.status(404).json({ error: 'Duel not found' });
    if (duel.status !== 'pending') return res.status(400).json({ error: 'Duel is not pending' });
    if (parsed.data.characterId !== duel.defender_character_id) {
      return res.status(403).json({ error: 'Only the defender can decline' });
    }

    await db.execute(
      `UPDATE duels SET status = 'cancelled', outcome = 'cancelled', completed_at = NOW() WHERE id = ?`,
      [duelId],
    );

    // Notify attacker
    const io = getIO();
    if (io) {
      const defender = await db.queryOne<{ name: string }>(
        `SELECT name FROM characters WHERE id = ?`,
        [duel.defender_character_id],
      );
      io.to(`character:${duel.attacker_character_id}`).emit('combat:duel-declined', {
        duelId,
        defenderCharacterName: defender?.name ?? 'Unknown',
      });
    }

    res.json({ success: true, duelId, status: 'cancelled' });
  } catch (error) {
    logger.error('Failed to decline duel:', error);
    res.status(500).json({ error: 'Failed to decline duel' });
  }
});

/** GET /duel/:duelId — Get duel details for replay. */
combatRouter.get('/duel/:duelId', async (req: Request, res: Response) => {
  try {
    const duel = await db.queryOne(
      `SELECT d.*,
              a.name AS attacker_name,
              def.name AS defender_name,
              w.name AS winner_name
       FROM duels d
       JOIN characters a ON d.attacker_character_id = a.id
       JOIN characters def ON d.defender_character_id = def.id
       LEFT JOIN characters w ON d.winner_character_id = w.id
       WHERE d.id = ?`,
      [req.params.duelId],
    );

    if (!duel) return res.status(404).json({ error: 'Duel not found' });

    // Parse JSON fields
    const result = duel as Record<string, unknown>;
    if (typeof result.combat_log === 'string') {
      result.combat_log = JSON.parse(result.combat_log);
    }
    if (typeof result.reputation_changes === 'string') {
      result.reputation_changes = JSON.parse(result.reputation_changes);
    }

    res.json(result);
  } catch (error) {
    logger.error('Failed to fetch duel:', error);
    res.status(500).json({ error: 'Failed to fetch duel' });
  }
});

/** GET /duel/history/:characterId — Paginated duel history. */
combatRouter.get('/duel/history/:characterId', async (req: Request, res: Response) => {
  try {
    const characterId = Number(req.params.characterId);
    const limit = Math.min(50, Math.max(1, Number(req.query.limit) || 20));
    const offset = Math.max(0, Number(req.query.offset) || 0);

    const duels = await db.query(
      `SELECT d.id, d.status, d.outcome, d.total_rounds, d.created_at, d.completed_at,
              d.attacker_character_id, d.defender_character_id, d.winner_character_id,
              a.name AS attacker_name,
              def.name AS defender_name
       FROM duels d
       JOIN characters a ON d.attacker_character_id = a.id
       JOIN characters def ON d.defender_character_id = def.id
       WHERE d.attacker_character_id = ? OR d.defender_character_id = ?
       ORDER BY d.created_at DESC
       LIMIT ? OFFSET ?`,
      [characterId, characterId, limit, offset],
    );

    res.json(duels);
  } catch (error) {
    logger.error('Failed to fetch duel history:', error);
    res.status(500).json({ error: 'Failed to fetch duel history' });
  }
});

/** GET /reputation/:characterId — Get character reputation values. */
combatRouter.get('/reputation/:characterId', async (req: Request, res: Response) => {
  try {
    const rep = await db.queryOne(
      `SELECT honor, chivalry, dread, renown FROM character_reputation WHERE character_id = ?`,
      [req.params.characterId],
    );

    if (!rep) {
      return res.json({ honor: 0, chivalry: 0, dread: 0, renown: 0 });
    }

    res.json(rep);
  } catch (error) {
    logger.error('Failed to fetch reputation:', error);
    res.status(500).json({ error: 'Failed to fetch reputation' });
  }
});

/** PATCH /character/:characterId/yield-settings — Update yield behavior. */
combatRouter.patch('/character/:characterId/yield-settings', async (req: Request, res: Response) => {
  try {
    const parsed = yieldSettingsSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: 'Invalid request', details: parsed.error.issues });
    }

    const updates: string[] = [];
    const values: unknown[] = [];

    if (parsed.data.yieldThreshold !== undefined) {
      updates.push('yield_threshold = ?');
      values.push(parsed.data.yieldThreshold);
    }
    if (parsed.data.yieldResponse !== undefined) {
      updates.push('yield_response = ?');
      values.push(parsed.data.yieldResponse);
    }

    if (updates.length === 0) {
      return res.status(400).json({ error: 'No fields to update' });
    }

    values.push(req.params.characterId);
    await db.execute(
      `UPDATE characters SET ${updates.join(', ')} WHERE id = ?`,
      values,
    );

    const char = await db.queryOne<{ yield_threshold: string; yield_response: string }>(
      `SELECT yield_threshold, yield_response FROM characters WHERE id = ?`,
      [req.params.characterId],
    );

    res.json({ success: true, ...char });
  } catch (error) {
    logger.error('Failed to update yield settings:', error);
    res.status(500).json({ error: 'Failed to update yield settings' });
  }
});
