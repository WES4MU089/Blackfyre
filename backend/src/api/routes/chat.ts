import { Router, Request, Response } from 'express';
import { db } from '../../db/connection.js';
import { logger } from '../../utils/logger.js';

export const chatRouter = Router();

// Get all active channels
chatRouter.get('/channels', async (_req: Request, res: Response) => {
  try {
    const channels = await db.query(
      `SELECT id, channel_key, name, description, channel_type, is_proximity, created_at
       FROM chat_channels WHERE is_active = 1
       ORDER BY channel_type, name`
    );
    res.json(channels);
  } catch (error) {
    logger.error('Failed to fetch chat channels:', error);
    res.status(500).json({ error: 'Failed to fetch channels' });
  }
});

// Get message history for a channel
chatRouter.get('/channels/:channelId/messages', async (req: Request, res: Response) => {
  try {
    const { channelId } = req.params;
    const { region, before, limit: limitStr } = req.query;
    const limit = Math.min(parseInt(limitStr as string) || 50, 100);

    let sql: string;
    let params: unknown[];

    if (before) {
      sql = `SELECT cm.id, cm.channel_id, cm.character_id, c.name AS character_name,
                    c.portrait_url, cm.content, cm.message_type, cm.region, cm.created_at
             FROM chat_messages cm
             JOIN characters c ON cm.character_id = c.id
             WHERE cm.channel_id = ? AND cm.is_deleted = 0
               ${region ? 'AND cm.region = ?' : ''}
               AND cm.created_at < ?
             ORDER BY cm.created_at DESC LIMIT ?`;
      params = region ? [channelId, region, before, limit] : [channelId, before, limit];
    } else {
      sql = `SELECT cm.id, cm.channel_id, cm.character_id, c.name AS character_name,
                    c.portrait_url, cm.content, cm.message_type, cm.region, cm.created_at
             FROM chat_messages cm
             JOIN characters c ON cm.character_id = c.id
             WHERE cm.channel_id = ? AND cm.is_deleted = 0
               ${region ? 'AND cm.region = ?' : ''}
             ORDER BY cm.created_at DESC LIMIT ?`;
      params = region ? [channelId, region, limit] : [channelId, limit];
    }

    const messages = await db.query(sql, params);
    res.json({
      messages: messages.reverse(),
      hasMore: messages.length === limit,
    });
  } catch (error) {
    logger.error('Failed to fetch chat messages:', error);
    res.status(500).json({ error: 'Failed to fetch messages' });
  }
});
