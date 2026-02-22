import { Router, Request, Response } from 'express';
import { db } from '../../db/connection.js';
import { logger } from '../../utils/logger.js';
import { requireAuth } from '../middleware/auth.js';

export const notificationsRouter = Router();

notificationsRouter.use(requireAuth());

// List recent notifications for the authenticated player
notificationsRouter.get('/', async (req: Request, res: Response) => {
  try {
    const limit = Math.min(Number(req.query.limit) || 50, 100);
    const offset = Number(req.query.offset) || 0;
    const unreadOnly = req.query.unreadOnly === 'true';

    let sql = `
      SELECT id, player_id, character_id, notification_type, title, message,
             icon, action_url, metadata, is_read, read_at, created_at, expires_at
      FROM notifications
      WHERE player_id = ?
        AND (expires_at IS NULL OR expires_at > NOW())
    `;
    const params: unknown[] = [req.player!.id];

    if (unreadOnly) {
      sql += ` AND is_read = FALSE`;
    }

    sql += ` ORDER BY created_at DESC LIMIT ? OFFSET ?`;
    params.push(limit, offset);

    const notifications = await db.query(sql, params);
    const countRow = await db.queryOne<{ cnt: number }>(
      `SELECT COUNT(*) AS cnt FROM notifications
       WHERE player_id = ? AND is_read = FALSE
       AND (expires_at IS NULL OR expires_at > NOW())`,
      [req.player!.id],
    );

    res.json({
      notifications,
      unreadCount: Number(countRow?.cnt ?? 0),
    });
  } catch (err) {
    logger.error('Failed to fetch notifications:', err);
    res.status(500).json({ error: 'Failed to fetch notifications' });
  }
});

// Lightweight unread count for badge
notificationsRouter.get('/unread-count', async (req: Request, res: Response) => {
  try {
    const row = await db.queryOne<{ cnt: number }>(
      `SELECT COUNT(*) AS cnt FROM notifications
       WHERE player_id = ? AND is_read = FALSE
       AND (expires_at IS NULL OR expires_at > NOW())`,
      [req.player!.id],
    );
    res.json({ unreadCount: Number(row?.cnt ?? 0) });
  } catch (err) {
    logger.error('Failed to fetch unread count:', err);
    res.status(500).json({ error: 'Failed to fetch unread count' });
  }
});

// Mark single notification as read
notificationsRouter.patch('/:id/read', async (req: Request, res: Response) => {
  try {
    const affected = await db.execute(
      `UPDATE notifications SET is_read = TRUE, read_at = NOW()
       WHERE id = ? AND player_id = ?`,
      [req.params.id, req.player!.id],
    );
    if (affected === 0) {
      return res.status(404).json({ error: 'Notification not found' });
    }
    res.json({ success: true });
  } catch (err) {
    logger.error('Failed to mark notification read:', err);
    res.status(500).json({ error: 'Failed to mark notification read' });
  }
});

// Mark all as read
notificationsRouter.patch('/read-all', async (req: Request, res: Response) => {
  try {
    await db.execute(
      `UPDATE notifications SET is_read = TRUE, read_at = NOW()
       WHERE player_id = ? AND is_read = FALSE`,
      [req.player!.id],
    );
    res.json({ success: true });
  } catch (err) {
    logger.error('Failed to mark all read:', err);
    res.status(500).json({ error: 'Failed to mark all read' });
  }
});

// Delete single notification
notificationsRouter.delete('/:id', async (req: Request, res: Response) => {
  try {
    const affected = await db.execute(
      `DELETE FROM notifications WHERE id = ? AND player_id = ?`,
      [req.params.id, req.player!.id],
    );
    if (affected === 0) {
      return res.status(404).json({ error: 'Notification not found' });
    }
    res.json({ success: true });
  } catch (err) {
    logger.error('Failed to delete notification:', err);
    res.status(500).json({ error: 'Failed to delete notification' });
  }
});
