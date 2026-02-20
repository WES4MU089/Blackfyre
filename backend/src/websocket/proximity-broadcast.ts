/**
 * Proximity-based emote broadcasting.
 *
 * Queries character_positions for all characters within a given radius
 * in the same region, persists the emote to chat_messages, and emits
 * chat:message to each qualifying socket individually.
 */

import { Server as SocketServer } from 'socket.io';
import { db } from '../db/connection.js';
import { logger } from '../utils/logger.js';
import { connectedPlayers } from './index.js';
import { getChannelId } from './chat.js';

/**
 * Broadcast an IC emote to all players within `radius` meters of an anchor
 * character, and persist it to chat_messages.
 */
export async function broadcastProximityEmote(
  io: SocketServer,
  anchorCharacterId: number,
  emoteText: string,
  characterName: string,
  portraitUrl: string | null,
  region: string,
  radius = 50,
  senderCharacterId?: number,
  metadata?: Record<string, unknown>,
): Promise<void> {
  const icChannelId = await getChannelId('ic');
  if (!icChannelId) {
    logger.warn('IC channel not found — skipping combat emote broadcast');
    return;
  }

  // Persist to chat_messages
  const messageId = await db.insert(
    `INSERT INTO chat_messages (channel_id, character_id, content, message_type, region)
     VALUES (?, ?, ?, 'emote', ?)`,
    [icChannelId, anchorCharacterId, emoteText, region],
  );

  const message = {
    id: messageId,
    tab: 'ic',
    character_id: senderCharacterId ?? anchorCharacterId,
    character_name: characterName,
    portrait_url: portraitUrl,
    content: emoteText,
    message_type: 'emote',
    region,
    created_at: new Date().toISOString(),
    ...(metadata ? { metadata } : {}),
  };

  // Query all character positions in the same region
  const positions = await db.query<{
    character_id: number; pos_x: number; pos_y: number; pos_z: number;
  }>(
    `SELECT character_id, pos_x, pos_y, pos_z FROM character_positions WHERE region = ?`,
    [region],
  );

  // Find the anchor position
  const anchor = positions.find(p => p.character_id === anchorCharacterId);
  if (!anchor) {
    // Anchor has no position — fall back to emitting to all in region
    io.to(`region:${region}`).emit('chat:message', message);
    return;
  }

  // Filter to characters within radius
  const nearbyCharacterIds = new Set<number>();
  for (const pos of positions) {
    const dx = anchor.pos_x - pos.pos_x;
    const dy = anchor.pos_y - pos.pos_y;
    const dz = anchor.pos_z - pos.pos_z;
    const distance = Math.sqrt(dx * dx + dy * dy + dz * dz);
    if (distance <= radius) {
      nearbyCharacterIds.add(pos.character_id);
    }
  }

  // Emit to each nearby player's socket
  let emitCount = 0;
  for (const [socketId, player] of connectedPlayers) {
    if (player.characterId && nearbyCharacterIds.has(player.characterId)) {
      const sock = io.sockets.sockets.get(socketId);
      if (sock) {
        sock.emit('chat:message', message);
        emitCount++;
      }
    }
  }

  logger.debug(`Combat emote broadcast: ${emitCount} recipients within ${radius}m in ${region}`);
}
