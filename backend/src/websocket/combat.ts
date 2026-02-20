import { Server as SocketServer, Socket } from 'socket.io';
import { logger } from '../utils/logger.js';
import { db } from '../db/connection.js';
import { getConnectedPlayer } from './index.js';
import { resolveDuel } from '../combat/index.js';
import { loadCombatantStats } from '../combat/load-stats.js';
import { grantPostCombatXp } from '../xp/combat-xp.js';

export function setupCombatHandlers(io: SocketServer, socket: Socket): void {

  // --- Challenge another character ---
  socket.on('combat:challenge', async (data: { targetCharacterId: number }) => {
    try {
      const player = getConnectedPlayer(socket.id);
      if (!player?.characterId) {
        return socket.emit('combat:error', { message: 'No active character' });
      }

      const attackerCharacterId = player.characterId;
      const defenderCharacterId = data.targetCharacterId;

      if (attackerCharacterId === defenderCharacterId) {
        return socket.emit('combat:error', { message: 'Cannot challenge yourself' });
      }

      // Verify defender exists
      const defender = await db.queryOne<{ id: number; name: string }>(
        `SELECT id, name FROM characters WHERE id = ? AND is_active = TRUE`,
        [defenderCharacterId],
      );
      if (!defender) {
        return socket.emit('combat:error', { message: 'Target character not found' });
      }

      // Check no active duels
      const active = await db.query(
        `SELECT id FROM duels WHERE status IN ('pending', 'active')
         AND (attacker_character_id IN (?, ?) OR defender_character_id IN (?, ?))`,
        [attackerCharacterId, defenderCharacterId, attackerCharacterId, defenderCharacterId],
      );
      if (active.length > 0) {
        return socket.emit('combat:error', { message: 'One or both characters are already in a duel' });
      }

      const result = await db.insert(
        `INSERT INTO duels (attacker_character_id, defender_character_id, status) VALUES (?, ?, 'pending')`,
        [attackerCharacterId, defenderCharacterId],
      );

      io.to(`character:${defenderCharacterId}`).emit('combat:duel-challenge', {
        duelId: result,
        attackerCharacterId,
        attackerCharacterName: player.characterName ?? 'Unknown',
      });

      socket.emit('combat:challenge-sent', { duelId: result });
      logger.info(`Duel challenged: ${attackerCharacterId} vs ${defenderCharacterId} (duel ${result})`);
    } catch (error) {
      logger.error('combat:challenge error:', error);
      socket.emit('combat:error', { message: 'Failed to issue challenge' });
    }
  });

  // --- Accept a duel challenge ---
  socket.on('combat:accept', async (data: { duelId: number }) => {
    try {
      const player = getConnectedPlayer(socket.id);
      if (!player?.characterId) {
        return socket.emit('combat:error', { message: 'No active character' });
      }

      const duel = await db.queryOne<{
        id: number; attacker_character_id: number;
        defender_character_id: number; status: string;
      }>(
        `SELECT id, attacker_character_id, defender_character_id, status FROM duels WHERE id = ?`,
        [data.duelId],
      );

      if (!duel || duel.status !== 'pending') {
        return socket.emit('combat:error', { message: 'Duel not found or not pending' });
      }
      if (player.characterId !== duel.defender_character_id) {
        return socket.emit('combat:error', { message: 'Only the defender can accept' });
      }

      // Load combatants and resolve
      const attackerStats = await loadCombatantStats(duel.attacker_character_id);
      const defenderStats = await loadCombatantStats(duel.defender_character_id);

      if (!attackerStats || !defenderStats) {
        return socket.emit('combat:error', { message: 'Failed to load combatant stats' });
      }

      const result = resolveDuel(attackerStats, defenderStats);

      // Persist
      await db.transaction(async (conn) => {
        await conn.query(
          `UPDATE duels SET status = 'completed', winner_character_id = ?, outcome = ?,
           total_rounds = ?, combat_log = ?, attacker_hp_start = ?, attacker_hp_end = ?,
           defender_hp_start = ?, defender_hp_end = ?, reputation_changes = ?, completed_at = NOW()
           WHERE id = ?`,
          [
            result.winnerId, result.outcome, result.totalRounds,
            JSON.stringify(result.rounds),
            result.attackerHpStart, result.attackerHpEnd,
            result.defenderHpStart, result.defenderHpEnd,
            JSON.stringify(result.reputationChanges),
            duel.id,
          ],
        );

        for (const round of result.rounds) {
          const ex1 = round.exchanges[0];
          const ex2 = round.exchanges[1];
          await conn.query(
            `INSERT INTO duel_rounds (
               duel_id, round_number, attacker_initiative, defender_initiative, first_actor,
               first_attack_roll, first_defense_roll, first_hit, first_margin, first_damage, first_damage_label,
               second_attack_roll, second_defense_roll, second_hit, second_margin, second_damage, second_damage_label,
               attacker_hp_after, defender_hp_after,
               yield_attempted_by, yield_accepted, desperate_stand, round_narrative
             ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            [
              duel.id, round.roundNumber,
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

        await conn.query(
          `UPDATE character_vitals SET health = ? WHERE character_id = ?`,
          [Math.max(0, result.attackerHpEnd), duel.attacker_character_id],
        );
        await conn.query(
          `UPDATE character_vitals SET health = ? WHERE character_id = ?`,
          [Math.max(0, result.defenderHpEnd), duel.defender_character_id],
        );

        for (const delta of result.reputationChanges) {
          await conn.query(
            `INSERT INTO character_reputation (character_id, honor, chivalry, dread, renown)
             VALUES (?, ?, ?, ?, ?)
             ON DUPLICATE KEY UPDATE
               honor = honor + VALUES(honor), chivalry = chivalry + VALUES(chivalry),
               dread = dread + VALUES(dread), renown = renown + VALUES(renown)`,
            [delta.characterId, delta.honor, delta.chivalry, delta.dread, delta.renown],
          );
        }
      });

      // Broadcast result
      io.to(`character:${duel.attacker_character_id}`).emit('combat:duel-result', { duelId: duel.id, result });
      io.to(`character:${duel.defender_character_id}`).emit('combat:duel-result', { duelId: duel.id, result });

      logger.info(`Duel resolved: ${duel.id} — ${result.outcome}, winner: ${result.winnerId}, ${result.totalRounds} rounds`);

      // Grant post-duel XP to both combatants
      for (const charId of [duel.attacker_character_id, duel.defender_character_id]) {
        grantPostCombatXp(charId, duel.id, 'duel').catch(err =>
          logger.error(`Post-duel XP grant failed for character ${charId}:`, err),
        );
      }
    } catch (error) {
      logger.error('combat:accept error:', error);
      socket.emit('combat:error', { message: 'Failed to resolve duel' });
    }
  });

  // --- Decline a duel challenge ---
  socket.on('combat:decline', async (data: { duelId: number }) => {
    try {
      const player = getConnectedPlayer(socket.id);
      if (!player?.characterId) {
        return socket.emit('combat:error', { message: 'No active character' });
      }

      const duel = await db.queryOne<{
        id: number; attacker_character_id: number;
        defender_character_id: number; status: string;
      }>(
        `SELECT id, attacker_character_id, defender_character_id, status FROM duels WHERE id = ?`,
        [data.duelId],
      );

      if (!duel || duel.status !== 'pending') {
        return socket.emit('combat:error', { message: 'Duel not found or not pending' });
      }
      if (player.characterId !== duel.defender_character_id) {
        return socket.emit('combat:error', { message: 'Only the defender can decline' });
      }

      await db.execute(
        `UPDATE duels SET status = 'cancelled', outcome = 'cancelled', completed_at = NOW() WHERE id = ?`,
        [duel.id],
      );

      io.to(`character:${duel.attacker_character_id}`).emit('combat:duel-declined', {
        duelId: duel.id,
        defenderCharacterName: player.characterName ?? 'Unknown',
      });

      socket.emit('combat:decline-confirmed', { duelId: duel.id });
      logger.info(`Duel declined: ${duel.id}`);
    } catch (error) {
      logger.error('combat:decline error:', error);
      socket.emit('combat:error', { message: 'Failed to decline duel' });
    }
  });
}
