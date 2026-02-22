import { Router, Request, Response } from 'express';
import { db } from '../../db/connection.js';
import { logger } from '../../utils/logger.js';
import { logAuditAction } from '../../utils/audit.js';
import { requireAuth, requireSuperAdmin, requirePermission } from '../middleware/auth.js';

export const sysadminRouter = Router();

// All sysadmin routes require super admin
sysadminRouter.use(requireAuth());
sysadminRouter.use(requireSuperAdmin());

// ─── Roles ────────────────────────────────────────────────────────────────────

// GET /roles — list all roles with permission counts
sysadminRouter.get('/roles', async (_req: Request, res: Response) => {
  try {
    const roles = await db.query(
      `SELECT r.id, r.name, r.description, r.color, r.is_default, r.sort_order,
              COUNT(rp.permission_id) AS permission_count,
              (SELECT COUNT(*) FROM players p WHERE p.role_id = r.id) AS player_count
       FROM roles r
       LEFT JOIN role_permissions rp ON r.id = rp.role_id
       GROUP BY r.id
       ORDER BY r.sort_order ASC, r.name ASC`
    );
    res.json({ roles });
  } catch (err) {
    logger.error('Failed to fetch roles:', err);
    res.status(500).json({ error: 'Failed to fetch roles' });
  }
});

// GET /roles/:id — role detail with permissions
sysadminRouter.get('/roles/:id', async (req: Request, res: Response) => {
  try {
    const roleId = Number(req.params.id);
    const role = await db.queryOne<{
      id: number; name: string; description: string | null; color: string | null;
      is_default: boolean; sort_order: number;
    }>(
      `SELECT id, name, description, color, is_default, sort_order FROM roles WHERE id = ?`,
      [roleId]
    );

    if (!role) return res.status(404).json({ error: 'Role not found' });

    const assignedPermissions = await db.query<{ id: number; key: string; label: string; category: string }>(
      `SELECT p.id, p.\`key\`, p.label, p.category
       FROM permissions p
       JOIN role_permissions rp ON p.id = rp.permission_id
       WHERE rp.role_id = ?
       ORDER BY p.category ASC, p.\`key\` ASC`,
      [roleId]
    );

    const allPermissions = await db.query<{ id: number; key: string; label: string; category: string; description: string | null }>(
      `SELECT id, \`key\`, label, category, description FROM permissions ORDER BY category ASC, \`key\` ASC`
    );

    res.json({ role, assignedPermissions, allPermissions });
  } catch (err) {
    logger.error('Failed to fetch role:', err);
    res.status(500).json({ error: 'Failed to fetch role' });
  }
});

// POST /roles — create role
sysadminRouter.post('/roles', async (req: Request, res: Response) => {
  try {
    const { name, description, color, sort_order } = req.body;
    if (!name) return res.status(400).json({ error: 'Name is required' });

    const insertId = await db.execute(
      `INSERT INTO roles (name, description, color, sort_order) VALUES (?, ?, ?, ?)`,
      [name, description || null, color || null, sort_order || 0]
    );

    await logAuditAction({
      actorId: req.player!.id,
      actionKey: 'role.created',
      description: `Created role: ${name}`,
      targetType: 'role',
      targetId: insertId,
    }).catch(e => logger.error('Audit error:', e));

    res.status(201).json({ id: insertId });
  } catch (err: any) {
    if (err.code === 'ER_DUP_ENTRY') return res.status(409).json({ error: 'A role with that name already exists' });
    logger.error('Failed to create role:', err);
    res.status(500).json({ error: 'Failed to create role' });
  }
});

// PATCH /roles/:id — update role
sysadminRouter.patch('/roles/:id', async (req: Request, res: Response) => {
  try {
    const roleId = Number(req.params.id);

    // Fetch current role state for diff
    const oldRole = await db.queryOne<{ name: string; description: string | null; color: string | null; is_default: boolean; sort_order: number }>(
      `SELECT name, description, color, is_default, sort_order FROM roles WHERE id = ?`,
      [roleId]
    );
    if (!oldRole) return res.status(404).json({ error: 'Role not found' });

    const allowed = ['name', 'description', 'color', 'sort_order', 'is_default'];
    const updates: string[] = [];
    const values: unknown[] = [];
    const changes: string[] = [];

    for (const key of allowed) {
      if (req.body[key] !== undefined) {
        updates.push(`${key} = ?`);
        values.push(req.body[key]);
        const oldVal = (oldRole as Record<string, unknown>)[key];
        if (String(oldVal) !== String(req.body[key])) {
          changes.push(`${key}: ${JSON.stringify(oldVal)} → ${JSON.stringify(req.body[key])}`);
        }
      }
    }

    if (updates.length === 0) return res.status(400).json({ error: 'No fields to update' });

    values.push(roleId);
    await db.execute(`UPDATE roles SET ${updates.join(', ')} WHERE id = ?`, values);

    await logAuditAction({
      actorId: req.player!.id,
      actionKey: 'role.updated',
      description: `Updated role "${oldRole.name}" (#${roleId})${changes.length ? ': ' + changes.join(', ') : ''}`,
      targetType: 'role',
      targetId: roleId,
      metadata: changes.length ? { changes } : undefined,
    }).catch(e => logger.error('Audit error:', e));

    res.json({ success: true });
  } catch (err) {
    logger.error('Failed to update role:', err);
    res.status(500).json({ error: 'Failed to update role' });
  }
});

// PUT /roles/:id/permissions — set role permissions (replaces all)
sysadminRouter.put('/roles/:id/permissions', async (req: Request, res: Response) => {
  try {
    const roleId = Number(req.params.id);
    const { permissionIds } = req.body as { permissionIds: number[] };

    if (!Array.isArray(permissionIds)) {
      return res.status(400).json({ error: 'permissionIds must be an array' });
    }

    // Fetch role name and current permissions for the diff
    const role = await db.queryOne<{ name: string }>(`SELECT name FROM roles WHERE id = ?`, [roleId]);
    if (!role) return res.status(404).json({ error: 'Role not found' });

    const oldPerms = await db.query<{ permission_id: number; key: string }>(
      `SELECT rp.permission_id, p.\`key\`
       FROM role_permissions rp
       JOIN permissions p ON rp.permission_id = p.id
       WHERE rp.role_id = ?`,
      [roleId]
    );
    const oldPermIds = new Set(oldPerms.map(p => p.permission_id));
    const newPermIds = new Set(permissionIds);

    const added = permissionIds.filter(id => !oldPermIds.has(id));
    const removed = [...oldPermIds].filter(id => !newPermIds.has(id));

    await db.transaction(async (conn) => {
      await conn.query(`DELETE FROM role_permissions WHERE role_id = ?`, [roleId]);
      for (const pid of permissionIds) {
        await conn.query(`INSERT INTO role_permissions (role_id, permission_id) VALUES (?, ?)`, [roleId, pid]);
      }
    });

    // Resolve permission keys for added/removed for readable audit
    let addedKeys: string[] = [];
    let removedKeys: string[] = [];
    if (added.length || removed.length) {
      const allPerms = await db.query<{ id: number; key: string }>(`SELECT id, \`key\` FROM permissions`);
      const permMap = new Map(allPerms.map(p => [p.id, p.key]));
      addedKeys = added.map(id => permMap.get(id) || `#${id}`);
      removedKeys = removed.map(id => permMap.get(id) || `#${id}`);
    }

    const parts: string[] = [`Set ${permissionIds.length} permissions on role "${role.name}" (#${roleId})`];
    if (addedKeys.length) parts.push(`+${addedKeys.join(', +')}`);
    if (removedKeys.length) parts.push(`-${removedKeys.join(', -')}`);

    await logAuditAction({
      actorId: req.player!.id,
      actionKey: 'role.permissions_updated',
      description: parts.join('. '),
      targetType: 'role',
      targetId: roleId,
      metadata: { total: permissionIds.length, added: addedKeys, removed: removedKeys },
    }).catch(e => logger.error('Audit error:', e));

    res.json({ success: true });
  } catch (err) {
    logger.error('Failed to update role permissions:', err);
    res.status(500).json({ error: 'Failed to update permissions' });
  }
});

// ─── Players ──────────────────────────────────────────────────────────────────

// GET /players — list players with role info
sysadminRouter.get('/players', async (req: Request, res: Response) => {
  try {
    const search = req.query.search as string | undefined;
    const limit = Math.min(parseInt(req.query.limit as string) || 50, 200);
    const offset = parseInt(req.query.offset as string) || 0;

    let sql = `
      SELECT p.id, p.discord_id, p.discord_username, p.sl_name,
             p.is_active, p.is_banned, p.is_super_admin, p.role_id,
             p.created_at, p.last_seen,
             r.name AS role_name, r.color AS role_color
      FROM players p
      LEFT JOIN roles r ON p.role_id = r.id
      WHERE p.discord_id IS NOT NULL
    `;
    const params: unknown[] = [];

    if (search) {
      sql += ` AND (p.discord_username LIKE ? OR p.sl_name LIKE ? OR p.discord_id = ?)`;
      params.push(`%${search}%`, `%${search}%`, search);
    }

    sql += ` ORDER BY p.last_seen DESC LIMIT ? OFFSET ?`;
    params.push(limit, offset);

    const players = await db.query(sql, params);

    // Get total count
    let countSql = `SELECT COUNT(*) AS total FROM players p WHERE p.discord_id IS NOT NULL`;
    const countParams: unknown[] = [];
    if (search) {
      countSql += ` AND (p.discord_username LIKE ? OR p.sl_name LIKE ? OR p.discord_id = ?)`;
      countParams.push(`%${search}%`, `%${search}%`, search);
    }
    const countResult = await db.queryOne<{ total: number }>(countSql, countParams);

    res.json({ players, total: countResult?.total ?? 0, limit, offset });
  } catch (err) {
    logger.error('Failed to fetch players:', err);
    res.status(500).json({ error: 'Failed to fetch players' });
  }
});

// PATCH /players/:id — update player (role assignment, ban, etc.)
sysadminRouter.patch('/players/:id', async (req: Request, res: Response) => {
  try {
    const playerId = Number(req.params.id);

    // Fetch current player state for descriptive audit
    const oldPlayer = await db.queryOne<{
      discord_username: string; role_id: number | null; is_banned: boolean;
      is_active: boolean; is_super_admin: boolean;
    }>(
      `SELECT discord_username, role_id, is_banned, is_active, is_super_admin FROM players WHERE id = ?`,
      [playerId]
    );
    if (!oldPlayer) return res.status(404).json({ error: 'Player not found' });

    const allowed = ['role_id', 'is_active', 'is_banned', 'ban_reason', 'is_super_admin'];
    const updates: string[] = [];
    const values: unknown[] = [];
    const changes: string[] = [];

    for (const key of allowed) {
      if (req.body[key] !== undefined) {
        updates.push(`${key} = ?`);
        values.push(req.body[key]);
        const oldVal = (oldPlayer as Record<string, unknown>)[key];
        if (String(oldVal) !== String(req.body[key])) {
          changes.push(`${key}: ${JSON.stringify(oldVal)} → ${JSON.stringify(req.body[key])}`);
        }
      }
    }

    if (updates.length === 0) return res.status(400).json({ error: 'No fields to update' });

    values.push(playerId);
    await db.execute(`UPDATE players SET ${updates.join(', ')} WHERE id = ?`, values);

    // Determine action key based on what changed
    let actionKey = 'player.updated';
    if (req.body.is_banned !== undefined) actionKey = req.body.is_banned ? 'player.banned' : 'player.unbanned';
    else if (req.body.role_id !== undefined) actionKey = 'player.role_assigned';
    else if (req.body.is_super_admin !== undefined) actionKey = 'player.super_admin_toggled';

    // Resolve role names for readable audit
    let roleDesc = '';
    if (req.body.role_id !== undefined) {
      const newRole = req.body.role_id ? await db.queryOne<{ name: string }>(`SELECT name FROM roles WHERE id = ?`, [req.body.role_id]) : null;
      const oldRole = oldPlayer.role_id ? await db.queryOne<{ name: string }>(`SELECT name FROM roles WHERE id = ?`, [oldPlayer.role_id]) : null;
      roleDesc = ` role: ${oldRole?.name || 'none'} → ${newRole?.name || 'none'}`;
    }

    await logAuditAction({
      actorId: req.player!.id,
      actionKey,
      description: `Updated player "${oldPlayer.discord_username}" (#${playerId})${roleDesc || (changes.length ? ': ' + changes.join(', ') : '')}`,
      targetType: 'player',
      targetId: playerId,
      metadata: changes.length ? { changes } : undefined,
    }).catch(e => logger.error('Audit error:', e));

    res.json({ success: true });
  } catch (err) {
    logger.error('Failed to update player:', err);
    res.status(500).json({ error: 'Failed to update player' });
  }
});

// ─── Database Tools ───────────────────────────────────────────────────────────

// Database routes require system.database_access permission
sysadminRouter.use('/database', requirePermission('system.database_access'));

// GET /database/schema — list all tables with column info
sysadminRouter.get('/database/schema', async (_req: Request, res: Response) => {
  try {
    const tables = await db.query<{ TABLE_NAME: string; TABLE_ROWS: number }>(
      `SELECT TABLE_NAME, TABLE_ROWS
       FROM INFORMATION_SCHEMA.TABLES
       WHERE TABLE_SCHEMA = DATABASE()
       ORDER BY TABLE_NAME ASC`
    );

    const schema: Record<string, unknown[]> = {};
    for (const t of tables) {
      const columns = await db.query(
        `SELECT COLUMN_NAME, COLUMN_TYPE, IS_NULLABLE, COLUMN_KEY, COLUMN_DEFAULT, EXTRA
         FROM INFORMATION_SCHEMA.COLUMNS
         WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ?
         ORDER BY ORDINAL_POSITION ASC`,
        [t.TABLE_NAME]
      );
      schema[t.TABLE_NAME] = columns;
    }

    res.json({ tables: tables.map(t => ({ name: t.TABLE_NAME, rows: t.TABLE_ROWS })), schema });
  } catch (err) {
    logger.error('Failed to fetch schema:', err);
    res.status(500).json({ error: 'Failed to fetch schema' });
  }
});

// POST /database/query — execute read-only SQL query
sysadminRouter.post('/database/query', async (req: Request, res: Response) => {
  try {
    const { sql } = req.body as { sql: string };
    if (!sql || typeof sql !== 'string') {
      return res.status(400).json({ error: 'SQL query is required' });
    }

    // Only allow SELECT statements for safety
    const trimmed = sql.trim().toUpperCase();
    if (!trimmed.startsWith('SELECT') && !trimmed.startsWith('SHOW') && !trimmed.startsWith('DESCRIBE') && !trimmed.startsWith('EXPLAIN')) {
      return res.status(400).json({ error: 'Only SELECT, SHOW, DESCRIBE, and EXPLAIN queries are allowed' });
    }

    const rows = await db.query(sql);

    await logAuditAction({
      actorId: req.player!.id,
      actionKey: 'database.query',
      description: `Executed query: ${sql.substring(0, 200)}`,
    }).catch(e => logger.error('Audit error:', e));

    res.json({ rows, rowCount: rows.length });
  } catch (err: any) {
    res.status(400).json({ error: err.message || 'Query failed' });
  }
});
