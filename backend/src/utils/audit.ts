import { db } from '../db/connection.js';
import { logger } from './logger.js';

export interface AuditLogOptions {
  actorId: number;
  actionKey: string;
  description: string;
  targetType?: string | null;
  targetId?: number | null;
  metadata?: Record<string, unknown> | null;
}

/**
 * Log a staff action to the audit_log table.
 * Fire-and-forget — callers should use .catch() to avoid unhandled rejections.
 */
export async function logAuditAction(opts: AuditLogOptions): Promise<number> {
  const {
    actorId,
    actionKey,
    description,
    targetType = null,
    targetId = null,
    metadata = null,
  } = opts;

  const id = await db.insert(
    `INSERT INTO audit_log (actor_id, action_key, description, target_type, target_id, metadata)
     VALUES (?, ?, ?, ?, ?, ?)`,
    [
      actorId,
      actionKey,
      description,
      targetType,
      targetId,
      metadata ? JSON.stringify(metadata) : null,
    ],
  );

  logger.debug(`Audit: [${actionKey}] "${description}" by actor ${actorId}`);
  return id;
}
