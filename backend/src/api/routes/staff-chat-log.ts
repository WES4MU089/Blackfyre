import { Router, Request, Response } from 'express';
import { db } from '../../db/connection.js';
import { logger } from '../../utils/logger.js';
import { requireAuth, requirePermission } from '../middleware/auth.js';

export const staffChatLogRouter = Router();

staffChatLogRouter.use(requireAuth());

// Helper: format date as CHAT_MON_DAY_YEAR label
function formatDayLabel(dateStr: string): string {
  const d = new Date(dateStr + 'T00:00:00Z');
  const months = ['JAN', 'FEB', 'MAR', 'APR', 'MAY', 'JUN', 'JUL', 'AUG', 'SEP', 'OCT', 'NOV', 'DEC'];
  const mon = months[d.getUTCMonth()];
  const day = d.getUTCDate();
  const year = d.getUTCFullYear();
  return `CHAT_${mon}_${day}_${year}`;
}

// GET /days — list daily log "files"
staffChatLogRouter.get(
  '/days',
  requirePermission('system.view_chat_log'),
  async (req: Request, res: Response) => {
    try {
      const channelKey = req.query.channelKey as string | undefined;
      const region = req.query.region as string | undefined;
      const startDate = req.query.startDate as string | undefined;
      const endDate = req.query.endDate as string | undefined;
      const limit = Math.min(parseInt(req.query.limit as string) || 30, 100);
      const offset = parseInt(req.query.offset as string) || 0;

      let sql = `
        SELECT DATE(cm.created_at) AS date, COUNT(*) AS message_count
        FROM chat_messages cm
      `;
      const params: unknown[] = [];
      const joins: string[] = [];

      if (channelKey) {
        joins.push(`JOIN chat_channels cc ON cm.channel_id = cc.id`);
      }

      sql = sql + joins.join(' ') + ` WHERE cm.is_deleted = 0`;

      if (channelKey) {
        sql += ` AND cc.channel_key = ?`;
        params.push(channelKey);
      }
      if (region) {
        sql += ` AND cm.region LIKE ?`;
        params.push(`%${region}%`);
      }
      if (startDate) {
        sql += ` AND cm.created_at >= ?`;
        params.push(startDate);
      }
      if (endDate) {
        sql += ` AND cm.created_at <= ?`;
        params.push(endDate + ' 23:59:59');
      }

      sql += ` GROUP BY DATE(cm.created_at) ORDER BY date DESC LIMIT ? OFFSET ?`;
      params.push(limit, offset);

      const rows = await db.query<{ date: string; message_count: number }>(sql, params);

      const days = rows.map(r => ({
        date: typeof r.date === 'string' ? r.date : new Date(r.date).toISOString().slice(0, 10),
        label: formatDayLabel(typeof r.date === 'string' ? r.date : new Date(r.date).toISOString().slice(0, 10)),
        message_count: Number(r.message_count),
      }));

      // Count total distinct days
      let countSql = `
        SELECT COUNT(DISTINCT DATE(cm.created_at)) AS total
        FROM chat_messages cm
      `;
      const countParams: unknown[] = [];
      const countJoins: string[] = [];

      if (channelKey) {
        countJoins.push(`JOIN chat_channels cc ON cm.channel_id = cc.id`);
      }

      countSql = countSql + countJoins.join(' ') + ` WHERE cm.is_deleted = 0`;

      if (channelKey) { countSql += ` AND cc.channel_key = ?`; countParams.push(channelKey); }
      if (region) { countSql += ` AND cm.region LIKE ?`; countParams.push(`%${region}%`); }
      if (startDate) { countSql += ` AND cm.created_at >= ?`; countParams.push(startDate); }
      if (endDate) { countSql += ` AND cm.created_at <= ?`; countParams.push(endDate + ' 23:59:59'); }

      const countResult = await db.queryOne<{ total: number }>(countSql, countParams);

      res.json({ days, total: countResult?.total ?? 0, limit, offset });
    } catch (err) {
      logger.error('Failed to fetch chat log days:', err);
      res.status(500).json({ error: 'Failed to fetch chat log days' });
    }
  }
);

// GET /messages — messages for a specific date
staffChatLogRouter.get(
  '/messages',
  requirePermission('system.view_chat_log'),
  async (req: Request, res: Response) => {
    try {
      const date = req.query.date as string;
      if (!date || !/^\d{4}-\d{2}-\d{2}$/.test(date)) {
        return res.status(400).json({ error: 'date parameter required (YYYY-MM-DD)' });
      }

      const channelKey = req.query.channelKey as string | undefined;
      const region = req.query.region as string | undefined;
      const messageType = req.query.messageType as string | undefined;
      const search = req.query.search as string | undefined;
      const limit = Math.min(parseInt(req.query.limit as string) || 200, 1000);
      const offset = parseInt(req.query.offset as string) || 0;

      let sql = `
        SELECT cm.id, cc.channel_key, ch.name AS character_name, ch.portrait_url,
               cm.content, cm.message_type, cm.region, cm.created_at
        FROM chat_messages cm
        JOIN chat_channels cc ON cm.channel_id = cc.id
        LEFT JOIN characters ch ON cm.character_id = ch.id
        WHERE cm.is_deleted = 0
          AND DATE(cm.created_at) = ?
      `;
      const params: unknown[] = [date];

      if (channelKey) {
        sql += ` AND cc.channel_key = ?`;
        params.push(channelKey);
      }
      if (region) {
        sql += ` AND cm.region LIKE ?`;
        params.push(`%${region}%`);
      }
      if (messageType) {
        sql += ` AND cm.message_type = ?`;
        params.push(messageType);
      }
      if (search) {
        sql += ` AND cm.content LIKE ?`;
        params.push(`%${search}%`);
      }

      sql += ` ORDER BY cm.created_at ASC LIMIT ? OFFSET ?`;
      params.push(limit, offset);

      const entries = await db.query(sql, params);

      // Count
      let countSql = `
        SELECT COUNT(*) AS total FROM chat_messages cm
        JOIN chat_channels cc ON cm.channel_id = cc.id
        WHERE cm.is_deleted = 0 AND DATE(cm.created_at) = ?
      `;
      const countParams: unknown[] = [date];
      if (channelKey) { countSql += ` AND cc.channel_key = ?`; countParams.push(channelKey); }
      if (region) { countSql += ` AND cm.region LIKE ?`; countParams.push(`%${region}%`); }
      if (messageType) { countSql += ` AND cm.message_type = ?`; countParams.push(messageType); }
      if (search) { countSql += ` AND cm.content LIKE ?`; countParams.push(`%${search}%`); }

      const countResult = await db.queryOne<{ total: number }>(countSql, countParams);

      res.json({ entries, total: countResult?.total ?? 0, limit, offset });
    } catch (err) {
      logger.error('Failed to fetch chat messages:', err);
      res.status(500).json({ error: 'Failed to fetch chat messages' });
    }
  }
);

// GET /whispers — whisper messages for a specific date
staffChatLogRouter.get(
  '/whispers',
  requirePermission('system.view_chat_log'),
  async (req: Request, res: Response) => {
    try {
      const date = req.query.date as string;
      if (!date || !/^\d{4}-\d{2}-\d{2}$/.test(date)) {
        return res.status(400).json({ error: 'date parameter required (YYYY-MM-DD)' });
      }

      const characterName = req.query.characterName as string | undefined;
      const limit = Math.min(parseInt(req.query.limit as string) || 200, 1000);
      const offset = parseInt(req.query.offset as string) || 0;

      let sql = `
        SELECT cw.id, cw.sender_name, cw.sender_portrait_url,
               cw.target_name, cw.target_portrait_url,
               cw.content, cw.region, cw.created_at
        FROM chat_whispers cw
        WHERE cw.is_deleted = 0
          AND DATE(cw.created_at) = ?
      `;
      const params: unknown[] = [date];

      if (characterName) {
        sql += ` AND (cw.sender_name LIKE ? OR cw.target_name LIKE ?)`;
        params.push(`%${characterName}%`, `%${characterName}%`);
      }

      sql += ` ORDER BY cw.created_at ASC LIMIT ? OFFSET ?`;
      params.push(limit, offset);

      const entries = await db.query(sql, params);

      let countSql = `
        SELECT COUNT(*) AS total FROM chat_whispers cw
        WHERE cw.is_deleted = 0 AND DATE(cw.created_at) = ?
      `;
      const countParams: unknown[] = [date];
      if (characterName) {
        countSql += ` AND (cw.sender_name LIKE ? OR cw.target_name LIKE ?)`;
        countParams.push(`%${characterName}%`, `%${characterName}%`);
      }

      const countResult = await db.queryOne<{ total: number }>(countSql, countParams);

      res.json({ entries, total: countResult?.total ?? 0, limit, offset });
    } catch (err) {
      logger.error('Failed to fetch whisper messages:', err);
      res.status(500).json({ error: 'Failed to fetch whisper messages' });
    }
  }
);
