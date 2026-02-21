import { Request, Response, NextFunction } from 'express';
import { verifyJWT } from '../routes/auth.js';
import { db } from '../../db/connection.js';
import { getPlayerPermissions } from '../../utils/permissions.js';

export interface AuthenticatedPlayer {
  id: number;
  discordId: string;
  discordUsername: string;
  roleId: number | null;
  roleName: string | null;
  permissions: Set<string>;
  isSuperAdmin: boolean;
}

// Extend Express Request type
declare global {
  namespace Express {
    interface Request {
      player?: AuthenticatedPlayer;
    }
  }
}

/**
 * Middleware that verifies the Bearer JWT token, loads the player from the
 * database, and populates req.player with role and permission data.
 */
export function requireAuth() {
  return async (req: Request, res: Response, next: NextFunction) => {
    const authHeader = req.headers.authorization;
    if (!authHeader?.startsWith('Bearer ')) {
      return res.status(401).json({ error: 'No token provided' });
    }

    const token = authHeader.slice(7);
    const payload = verifyJWT(token);
    if (!payload) {
      return res.status(401).json({ error: 'Invalid or expired token' });
    }

    const player = await db.queryOne<{
      id: number;
      discord_id: string;
      discord_username: string;
      role_id: number | null;
      is_super_admin: boolean;
    }>(
      `SELECT p.id, p.discord_id, p.discord_username, p.role_id, p.is_super_admin
       FROM players p
       WHERE p.id = ? AND p.is_active = 1`,
      [payload.userId]
    );

    if (!player) {
      return res.status(401).json({ error: 'Player not found or inactive' });
    }

    // Load role name if assigned
    let roleName: string | null = null;
    if (player.role_id) {
      const role = await db.queryOne<{ name: string }>(
        `SELECT name FROM roles WHERE id = ?`,
        [player.role_id]
      );
      roleName = role?.name ?? null;
    }

    // Load permissions
    const permissions = await getPlayerPermissions(player.id);

    req.player = {
      id: player.id,
      discordId: player.discord_id,
      discordUsername: player.discord_username,
      roleId: player.role_id,
      roleName,
      permissions,
      isSuperAdmin: !!player.is_super_admin,
    };

    next();
  };
}

/**
 * Middleware that checks if the authenticated player has at least one of the
 * required permissions. Super admins always pass.
 * Must be chained after requireAuth().
 */
export function requirePermission(...keys: string[]) {
  return (req: Request, res: Response, next: NextFunction) => {
    const player = req.player;
    if (!player) {
      return res.status(401).json({ error: 'Not authenticated' });
    }

    if (player.isSuperAdmin) return next();

    if (keys.some(k => player.permissions.has(k))) return next();

    return res.status(403).json({ error: 'Insufficient permissions' });
  };
}

/**
 * Middleware that requires the player to be a super admin.
 * Must be chained after requireAuth().
 */
export function requireSuperAdmin() {
  return (req: Request, res: Response, next: NextFunction) => {
    if (!req.player?.isSuperAdmin) {
      return res.status(403).json({ error: 'Super admin access required' });
    }
    next();
  };
}
