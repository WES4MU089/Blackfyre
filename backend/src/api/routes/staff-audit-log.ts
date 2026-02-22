import { Router, Request, Response } from 'express';
import { db } from '../../db/connection.js';
import { logger } from '../../utils/logger.js';
import { requireAuth, requirePermission } from '../middleware/auth.js';

export const staffAuditLogRouter = Router();

staffAuditLogRouter.use(requireAuth());

// Query audit log with filters
staffAuditLogRouter.get(
  '/',
  requirePermission('system.view_audit_log'),
  async (req: Request, res: Response) => {
    try {
      const actionKey = req.query.actionKey as string | undefined;
      const actorId = req.query.actorId as string | undefined;
      const targetType = req.query.targetType as string | undefined;
      const startDate = req.query.startDate as string | undefined;
      const endDate = req.query.endDate as string | undefined;
      const limit = Math.min(parseInt(req.query.limit as string) || 100, 500);
      const offset = parseInt(req.query.offset as string) || 0;

      let sql = `
        SELECT al.id, al.actor_id, al.action_key, al.description,
               al.target_type, al.target_id, al.metadata, al.created_at,
               p.discord_username AS actor_name,
               r.name AS actor_role
        FROM audit_log al
        JOIN players p ON al.actor_id = p.id
        LEFT JOIN roles r ON p.role_id = r.id
        WHERE 1=1
      `;
      const params: unknown[] = [];

      // Non-super-admins cannot see role/permission changes
      if (!req.player!.isSuperAdmin) {
        sql += ` AND al.action_key NOT LIKE 'role.%' AND al.action_key NOT LIKE 'permission.%'`;
      }

      if (actionKey) {
        sql += ` AND al.action_key = ?`;
        params.push(actionKey);
      }

      if (actorId) {
        sql += ` AND al.actor_id = ?`;
        params.push(actorId);
      }

      if (targetType) {
        sql += ` AND al.target_type = ?`;
        params.push(targetType);
      }

      if (startDate) {
        sql += ` AND al.created_at >= ?`;
        params.push(startDate);
      }

      if (endDate) {
        sql += ` AND al.created_at <= ?`;
        params.push(endDate);
      }

      sql += ` ORDER BY al.created_at DESC LIMIT ? OFFSET ?`;
      params.push(limit, offset);

      const entries = await db.query(sql, params);

      // Get total count for pagination
      let countSql = `SELECT COUNT(*) AS total FROM audit_log al WHERE 1=1`;
      const countParams: unknown[] = [];

      if (!req.player!.isSuperAdmin) {
        countSql += ` AND al.action_key NOT LIKE 'role.%' AND al.action_key NOT LIKE 'permission.%'`;
      }
      if (actionKey) { countSql += ` AND al.action_key = ?`; countParams.push(actionKey); }
      if (actorId) { countSql += ` AND al.actor_id = ?`; countParams.push(actorId); }
      if (targetType) { countSql += ` AND al.target_type = ?`; countParams.push(targetType); }
      if (startDate) { countSql += ` AND al.created_at >= ?`; countParams.push(startDate); }
      if (endDate) { countSql += ` AND al.created_at <= ?`; countParams.push(endDate); }

      const countResult = await db.queryOne<{ total: number }>(countSql, countParams);

      res.json({
        entries,
        total: countResult?.total ?? 0,
        limit,
        offset,
      });
    } catch (err) {
      logger.error('Failed to fetch audit log:', err);
      res.status(500).json({ error: 'Failed to fetch audit log' });
    }
  }
);
