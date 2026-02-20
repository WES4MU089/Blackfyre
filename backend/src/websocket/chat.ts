import { Server as SocketServer, Socket } from 'socket.io';
import { z } from 'zod';
import { db } from '../db/connection.js';
import { logger } from '../utils/logger.js';
import { getConnectedPlayer } from './index.js';
import { getSocketIdBySession } from './sessionIds.js';

// Validation schemas
const sendMessageSchema = z.object({
  tab: z.enum(['ic', 'whispers', 'ooc']),
  content: z.string().min(1).max(50000),
  messageType: z.enum(['say', 'shout', 'low', 'emote', 'ooc', 'gooc', 'whisper']),
  targetSessionId: z.number().int().positive().optional(),
});

const loadHistorySchema = z.object({
  tab: z.enum(['ic', 'whispers', 'ooc', 'system']),
  before: z.string().optional(),
  limit: z.number().int().min(1).max(100).default(50),
});

// Cached channel IDs (loaded once at startup)
let channelIds: Record<string, number> = {};

async function ensureChannelIds(): Promise<void> {
  if (Object.keys(channelIds).length > 0) return;
  const rows = await db.query<{ id: number; channel_key: string }>(
    `SELECT id, channel_key FROM chat_channels WHERE channel_key IN ('ic', 'ooc', 'whispers', 'system') AND is_active = 1`
  );
  for (const row of rows) {
    channelIds[row.channel_key] = row.id;
  }
  logger.debug(`Chat channel IDs cached: ${JSON.stringify(channelIds)}`);
}

export function setupChatHandlers(io: SocketServer, socket: Socket): void {
  // Ensure channel IDs are cached
  ensureChannelIds().catch(err => logger.error('Failed to cache channel IDs:', err));

  // Send a chat message
  socket.on('chat:send', async (data: unknown) => {
    const playerInfo = getConnectedPlayer(socket.id);
    if (!playerInfo?.characterId || !playerInfo?.region) {
      return socket.emit('error', { message: 'Must have active character and region' });
    }

    try {
      const parsed = sendMessageSchema.parse(data);
      await ensureChannelIds();

      // Look up character info
      const character = await db.queryOne<{ name: string; portrait_url: string | null }>(
        'SELECT name, portrait_url FROM characters WHERE id = ?',
        [playerInfo.characterId]
      );
      if (!character) {
        return socket.emit('error', { message: 'Character not found' });
      }

      const { content, messageType, targetSessionId } = parsed;

      // Route by message type
      if (messageType === 'whisper') {
        await handleWhisper(io, socket, playerInfo, character, content, targetSessionId);
      } else if (messageType === 'gooc') {
        await handleGlobalMessage(io, playerInfo, character, content, messageType);
      } else {
        // say, shout, low, emote, ooc — all proximity-based (region)
        await handleRegionMessage(io, playerInfo, character, content, messageType, parsed.tab);
      }
    } catch (error) {
      if (error instanceof z.ZodError) {
        return socket.emit('error', { message: 'Invalid message data', details: error.errors });
      }
      logger.error('Chat send error:', error);
      socket.emit('error', { message: 'Failed to send message' });
    }
  });

  // Load message history (tab-based)
  socket.on('chat:history', async (data: unknown) => {
    const playerInfo = getConnectedPlayer(socket.id);
    if (!playerInfo?.characterId || !playerInfo?.region) {
      return socket.emit('error', { message: 'Must have active character and region' });
    }

    try {
      const parsed = loadHistorySchema.parse(data);
      await ensureChannelIds();

      // Whispers use a separate table
      if (parsed.tab === 'whispers') {
        return handleWhisperHistory(socket, playerInfo.characterId, parsed.before, parsed.limit);
      }

      const channelKey = parsed.tab === 'ic' ? 'ic' : parsed.tab === 'ooc' ? 'ooc' : 'system';
      const channelId = channelIds[channelKey];
      if (!channelId) {
        return socket.emit('error', { message: `Channel not found for tab: ${parsed.tab}` });
      }

      // System and GOOC are global; IC and OOC are proximity
      const isProximity = parsed.tab === 'ic' || parsed.tab === 'ooc';

      let sql: string;
      let params: unknown[];

      if (isProximity) {
        sql = `SELECT cm.id, cm.channel_id, cm.character_id, c.name AS character_name,
                      c.portrait_url, cm.content, cm.message_type, cm.region, cm.created_at
               FROM chat_messages cm
               JOIN characters c ON cm.character_id = c.id
               WHERE cm.channel_id = ? AND cm.region = ? AND cm.is_deleted = 0
                 ${parsed.before ? 'AND cm.created_at < ?' : ''}
               ORDER BY cm.created_at DESC
               LIMIT ?`;
        params = parsed.before
          ? [channelId, playerInfo.region, parsed.before, parsed.limit]
          : [channelId, playerInfo.region, parsed.limit];
      } else {
        sql = `SELECT cm.id, cm.channel_id, cm.character_id, c.name AS character_name,
                      c.portrait_url, cm.content, cm.message_type, cm.region, cm.created_at
               FROM chat_messages cm
               JOIN characters c ON cm.character_id = c.id
               WHERE cm.channel_id = ? AND cm.is_deleted = 0
                 ${parsed.before ? 'AND cm.created_at < ?' : ''}
               ORDER BY cm.created_at DESC
               LIMIT ?`;
        params = parsed.before
          ? [channelId, parsed.before, parsed.limit]
          : [channelId, parsed.limit];
      }

      const messages = await db.query(sql, params);

      socket.emit('chat:history', {
        tab: parsed.tab,
        messages: (messages as unknown[]).reverse(),
        hasMore: messages.length === parsed.limit,
      });
    } catch (error) {
      if (error instanceof z.ZodError) {
        return socket.emit('error', { message: 'Invalid request', details: error.errors });
      }
      logger.error('Chat history error:', error);
      socket.emit('error', { message: 'Failed to load history' });
    }
  });

  logger.debug(`Chat handlers registered for socket ${socket.id}`);
}

// --- Message Routing Handlers ---

async function handleRegionMessage(
  io: SocketServer,
  playerInfo: { characterId: number; region: string; sessionId?: number },
  character: { name: string; portrait_url: string | null },
  content: string,
  messageType: string,
  tab: string
): Promise<void> {
  const channelKey = tab === 'ooc' ? 'ooc' : 'ic';
  const channelId = channelIds[channelKey];
  if (!channelId) return;

  const messageId = await db.insert(
    `INSERT INTO chat_messages (channel_id, character_id, content, message_type, region)
     VALUES (?, ?, ?, ?, ?)`,
    [channelId, playerInfo.characterId, content, messageType, playerInfo.region]
  );

  const message = {
    id: messageId,
    tab: messageType === 'ooc' ? 'ooc' : 'ic',
    character_id: playerInfo.characterId,
    character_name: character.name,
    portrait_url: character.portrait_url,
    content,
    message_type: messageType,
    region: playerInfo.region,
    created_at: new Date().toISOString(),
  };

  io.to(`region:${playerInfo.region}`).emit('chat:message', message);
  logger.debug(`[${messageType.toUpperCase()}] ${character.name}: ${content.substring(0, 50)}`);
}

async function handleGlobalMessage(
  io: SocketServer,
  playerInfo: { characterId: number; region: string },
  character: { name: string; portrait_url: string | null },
  content: string,
  messageType: string
): Promise<void> {
  const channelId = channelIds['ooc'];
  if (!channelId) return;

  const messageId = await db.insert(
    `INSERT INTO chat_messages (channel_id, character_id, content, message_type, region)
     VALUES (?, ?, ?, ?, ?)`,
    [channelId, playerInfo.characterId, content, messageType, playerInfo.region]
  );

  const message = {
    id: messageId,
    tab: 'ooc',
    character_id: playerInfo.characterId,
    character_name: character.name,
    portrait_url: character.portrait_url,
    content,
    message_type: messageType,
    region: playerInfo.region,
    created_at: new Date().toISOString(),
  };

  // GOOC goes to ALL connected clients
  io.emit('chat:message', message);
  logger.debug(`[GOOC] ${character.name}: ${content.substring(0, 50)}`);
}

async function handleWhisper(
  io: SocketServer,
  socket: Socket,
  playerInfo: { characterId: number; region: string; sessionId?: number },
  character: { name: string; portrait_url: string | null },
  content: string,
  targetSessionId?: number
): Promise<void> {
  if (!targetSessionId) {
    socket.emit('error', { message: 'Whisper requires a target session ID' });
    return;
  }

  // Find target socket by session ID
  const targetSocketId = getSocketIdBySession(targetSessionId);
  if (!targetSocketId) {
    socket.emit('error', { message: `Player with session ID ${targetSessionId} not found` });
    return;
  }

  const targetPlayerInfo = getConnectedPlayer(targetSocketId);
  if (!targetPlayerInfo?.characterId) {
    socket.emit('error', { message: 'Target player has no active character' });
    return;
  }

  // Look up target character info
  const targetCharacter = await db.queryOne<{ name: string; portrait_url: string | null }>(
    'SELECT name, portrait_url FROM characters WHERE id = ?',
    [targetPlayerInfo.characterId]
  );
  if (!targetCharacter) {
    socket.emit('error', { message: 'Target character not found' });
    return;
  }

  // Store whisper in dedicated table
  const whisperId = await db.insert(
    `INSERT INTO chat_whispers (sender_character_id, sender_name, sender_portrait_url, target_character_id, target_name, target_portrait_url, content, region)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      playerInfo.characterId, character.name, character.portrait_url,
      targetPlayerInfo.characterId, targetCharacter.name, targetCharacter.portrait_url,
      content, playerInfo.region,
    ]
  );

  const whisperPayload = {
    id: whisperId,
    tab: 'whispers',
    sender_character_id: playerInfo.characterId,
    sender_name: character.name,
    sender_portrait_url: character.portrait_url,
    target_character_id: targetPlayerInfo.characterId,
    target_name: targetCharacter.name,
    target_portrait_url: targetCharacter.portrait_url,
    content,
    region: playerInfo.region,
    created_at: new Date().toISOString(),
  };

  // Emit to sender and target only
  socket.emit('chat:whisper', whisperPayload);
  const targetSocket = io.sockets.sockets.get(targetSocketId);
  if (targetSocket) {
    targetSocket.emit('chat:whisper', whisperPayload);
  }

  logger.debug(`[WHISPER] ${character.name} -> ${targetCharacter.name}: ${content.substring(0, 50)}`);
}

async function handleWhisperHistory(
  socket: Socket,
  characterId: number,
  before?: string,
  limit = 50
): Promise<void> {
  const sql = `SELECT id, sender_character_id, sender_name, sender_portrait_url,
                      target_character_id, target_name, target_portrait_url,
                      content, region, created_at
               FROM chat_whispers
               WHERE (sender_character_id = ? OR target_character_id = ?) AND is_deleted = 0
                 ${before ? 'AND created_at < ?' : ''}
               ORDER BY created_at DESC
               LIMIT ?`;

  const params = before
    ? [characterId, characterId, before, limit]
    : [characterId, characterId, limit];

  const messages = await db.query(sql, params);

  socket.emit('chat:history', {
    tab: 'whispers',
    messages: (messages as unknown[]).reverse(),
    hasMore: messages.length === limit,
  });
}

// Utility: get a cached channel ID by key (ic, ooc, system, etc.)
export async function getChannelId(key: string): Promise<number | null> {
  await ensureChannelIds();
  return channelIds[key] ?? null;
}

// Utility: send a system message (called from backend code, not from client)
export async function sendSystemMessage(
  io: SocketServer,
  content: string,
  region?: string
): Promise<void> {
  await ensureChannelIds();
  const channelId = channelIds['system'];
  if (!channelId) return;

  await db.insert(
    `INSERT INTO chat_messages (channel_id, character_id, content, message_type, region)
     VALUES (?, 0, ?, 'system', ?)`,
    [channelId, content, region || 'global']
  );

  const message = {
    id: 0,
    tab: 'system',
    character_id: 0,
    character_name: 'System',
    portrait_url: null,
    content,
    message_type: 'system',
    region: region || 'global',
    created_at: new Date().toISOString(),
  };

  if (region) {
    io.to(`region:${region}`).emit('chat:message', message);
  } else {
    io.emit('chat:message', message);
  }
}
