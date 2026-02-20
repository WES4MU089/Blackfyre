import { Server as SocketServer, Socket } from 'socket.io';
import { logger } from '../utils/logger.js';
import { db } from '../db/connection.js';
import { getConnectedPlayer } from './index.js';
import { calculateMaxHealth } from '../utils/formulas.js';

const VALID_APTITUDES = [
  'prowess', 'fortitude', 'command', 'cunning',
  'stewardship', 'presence', 'lore', 'faith',
];

/** Hard caps per aptitude tier: 1 slot at 10, 2 slots at 9, 5 slots at 8 */
const APTITUDE_HARD_CAP = 10;

export function setupAllocationHandlers(io: SocketServer, socket: Socket): void {

  // --- Allocate an aptitude point ---
  socket.on('aptitude:allocate', async (data: { aptitudeKey: string }) => {
    try {
      const player = getConnectedPlayer(socket.id);
      if (!player?.characterId) {
        return socket.emit('error', { message: 'No active character' });
      }
      const characterId = player.characterId;
      const { aptitudeKey } = data;

      if (!VALID_APTITUDES.includes(aptitudeKey)) {
        return socket.emit('error', { message: 'Invalid aptitude' });
      }

      // Load character's unspent points and current aptitude value
      const char = await db.queryOne<{ unspent_aptitude_points: number }>(
        'SELECT unspent_aptitude_points FROM characters WHERE id = ?',
        [characterId],
      );
      if (!char || char.unspent_aptitude_points <= 0) {
        return socket.emit('error', { message: 'No aptitude points available' });
      }

      const apt = await db.queryOne<{ current_value: number }>(
        'SELECT current_value FROM character_aptitudes WHERE character_id = ? AND aptitude_key = ?',
        [characterId, aptitudeKey],
      );
      if (!apt) {
        return socket.emit('error', { message: 'Aptitude not found' });
      }
      if (apt.current_value >= APTITUDE_HARD_CAP) {
        return socket.emit('error', { message: 'Aptitude already at maximum' });
      }

      const newValue = apt.current_value + 1;
      const newUnspent = char.unspent_aptitude_points - 1;

      // Apply the allocation
      await db.transaction(async (conn) => {
        await conn.query(
          'UPDATE character_aptitudes SET current_value = current_value + 1 WHERE character_id = ? AND aptitude_key = ?',
          [characterId, aptitudeKey],
        );
        await conn.query(
          'UPDATE characters SET unspent_aptitude_points = unspent_aptitude_points - 1 WHERE id = ?',
          [characterId],
        );

        // Fortitude changes max health — recalculate and update vitals
        if (aptitudeKey === 'fortitude') {
          const newMaxHealth = calculateMaxHealth(newValue);
          await conn.query(
            `UPDATE character_vitals
             SET max_health = ?,
                 health = LEAST(health + 10, ?)
             WHERE character_id = ?`,
            [newMaxHealth, newMaxHealth, characterId],
          );
        }
      });

      // Notify the client
      socket.emit('aptitude:updated', {
        aptitudeKey,
        newValue,
        unspentAptitudePoints: newUnspent,
      });

      // If fortitude changed, also send updated vitals
      if (aptitudeKey === 'fortitude') {
        const vitals = await db.queryOne<{ health: number; max_health: number }>(
          'SELECT health, max_health FROM character_vitals WHERE character_id = ?',
          [characterId],
        );
        if (vitals) {
          io.to(`character:${characterId}`).emit('vitals:changed', {
            health: Number(vitals.health),
            maxHealth: Number(vitals.max_health),
          });
        }
      }

      logger.info(`Character ${characterId}: allocated aptitude point to ${aptitudeKey} (${apt.current_value} → ${newValue})`);
    } catch (error) {
      logger.error('aptitude:allocate error:', error);
      socket.emit('error', { message: 'Failed to allocate aptitude point' });
    }
  });

}
