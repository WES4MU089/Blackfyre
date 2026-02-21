import { db } from '../db/connection.js';

/**
 * Queries a player's permissions through their role assignment.
 * Returns a Set of permission key strings (e.g. "applications.review").
 */
export async function getPlayerPermissions(playerId: number): Promise<Set<string>> {
  const rows = await db.query<{ key: string }>(
    `SELECT p.\`key\`
     FROM permissions p
     JOIN role_permissions rp ON p.id = rp.permission_id
     JOIN players pl ON pl.role_id = rp.role_id
     WHERE pl.id = ?`,
    [playerId]
  );
  return new Set(rows.map(r => r.key));
}
