import { db } from '../db/connection.js';
import { logger } from './logger.js';
import { getIO } from '../websocket/index.js';

export type NotificationType =
  | 'info' | 'success' | 'warning' | 'error'
  | 'achievement' | 'quest' | 'money' | 'social'
  | 'application' | 'combat' | 'levelup' | 'ailment'
  | 'raven' | 'war' | 'trade' | 'staff';

export interface CreateNotificationOptions {
  playerId: number;
  characterId?: number | null;
  type: NotificationType;
  title: string;
  message: string;
  icon?: string | null;
  actionUrl?: string | null;
  metadata?: Record<string, unknown> | null;
  expiresAt?: Date | null;
  /** If true, also show an ephemeral toast on the client. Defaults to true. */
  showToast?: boolean;
}

/**
 * Create a persistent notification. Inserts into DB and broadcasts
 * via Socket.IO to the player's room.
 */
export async function createNotification(opts: CreateNotificationOptions): Promise<number> {
  const {
    playerId,
    characterId = null,
    type,
    title,
    message,
    icon = null,
    actionUrl = null,
    metadata = null,
    expiresAt = null,
    showToast = true,
  } = opts;

  const id = await db.insert(
    `INSERT INTO notifications
     (player_id, character_id, notification_type, title, message,
      icon, action_url, metadata, expires_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      playerId,
      characterId,
      type,
      title,
      message,
      icon,
      actionUrl,
      metadata ? JSON.stringify(metadata) : null,
      expiresAt,
    ],
  );

  const notification = {
    id,
    playerId,
    characterId,
    type,
    title,
    message,
    icon,
    actionUrl,
    metadata,
    isRead: false,
    createdAt: new Date().toISOString(),
    expiresAt: expiresAt?.toISOString() ?? null,
  };

  const io = getIO();
  if (io) {
    io.to(`player:${playerId}`).emit('notification:new', {
      notification,
      showToast,
    });
  }

  logger.debug(`Notification created: [${type}] "${title}" for player ${playerId}`);
  return id;
}

/**
 * Batch-create notifications for multiple players (e.g., staff alerts).
 */
export async function createNotificationForMany(
  playerIds: number[],
  opts: Omit<CreateNotificationOptions, 'playerId'>,
): Promise<void> {
  for (const playerId of playerIds) {
    await createNotification({ ...opts, playerId });
  }
}
