import { Router, Request, Response } from 'express';
import { z } from 'zod';
import { db } from '../../db/connection.js';
import { logger } from '../../utils/logger.js';
import { requireAuth, requirePermission } from '../middleware/auth.js';
import { createNotification } from '../../utils/notifications.js';
import { logAuditAction } from '../../utils/audit.js';

export const staffApplicationsRouter = Router();

// All staff routes require auth
staffApplicationsRouter.use(requireAuth());

// List all applications with filters
staffApplicationsRouter.get(
  '/',
  requirePermission('applications.view_queue'),
  async (req: Request, res: Response) => {
    try {
      const status = req.query.status as string | undefined;
      const houseId = req.query.houseId as string | undefined;

      let sql = `
        SELECT ca.id, ca.character_id, ca.player_id, ca.house_id,
               ca.status, ca.requested_role, ca.is_featured_role,
               ca.is_bastard, ca.is_dragon_seed,
               ca.submitted_at, ca.updated_at,
               c.name AS character_name, c.template_key,
               p.discord_username AS player_name,
               h.name AS house_name, h.is_great_house, h.is_royal_house
        FROM character_applications ca
        JOIN characters c ON ca.character_id = c.id
        JOIN players p ON ca.player_id = p.id
        LEFT JOIN houses h ON ca.house_id = h.id
        WHERE 1=1
      `;
      const params: unknown[] = [];

      if (status) {
        sql += ` AND ca.status = ?`;
        params.push(status);
      }

      if (houseId) {
        sql += ` AND ca.house_id = ?`;
        params.push(houseId);
      }

      sql += ` ORDER BY ca.submitted_at DESC LIMIT 100`;

      const applications = await db.query(sql, params);
      res.json({ applications });
    } catch (err) {
      logger.error('Failed to fetch application queue:', err);
      res.status(500).json({ error: 'Failed to fetch applications' });
    }
  }
);

// Get single application detail (staff view — includes private comments)
staffApplicationsRouter.get(
  '/:id',
  requirePermission('applications.view_queue'),
  async (req: Request, res: Response) => {
    try {
      const application = await db.queryOne(
        `SELECT ca.*,
                c.name AS character_name, c.template_key,
                p.discord_username AS player_name,
                h.name AS house_name, h.is_great_house, h.is_royal_house,
                reviewer.discord_username AS reviewed_by_name
         FROM character_applications ca
         JOIN characters c ON ca.character_id = c.id
         JOIN players p ON ca.player_id = p.id
         LEFT JOIN houses h ON ca.house_id = h.id
         LEFT JOIN players reviewer ON ca.reviewed_by = reviewer.id
         WHERE ca.id = ?`,
        [req.params.id]
      );

      if (!application) {
        return res.status(404).json({ error: 'Application not found' });
      }

      // Load all non-deleted comments (public + private) for staff
      const comments = await db.query(
        `SELECT ac.id, ac.author_id, ac.body, ac.is_private, ac.is_visible,
                ac.created_at, ac.edited_at,
                p.discord_username AS author_name
         FROM application_comments ac
         JOIN players p ON ac.author_id = p.id
         WHERE ac.application_id = ? AND ac.deleted_at IS NULL
         ORDER BY ac.created_at ASC`,
        [req.params.id]
      );

      res.json({ application, comments });
    } catch (err) {
      logger.error('Failed to fetch application detail:', err);
      res.status(500).json({ error: 'Failed to fetch application' });
    }
  }
);

// Update application status (approve/deny/revision)
const updateStatusSchema = z.object({
  status: z.enum(['approved', 'denied', 'revision']),
  staffNotes: z.string().max(5000).optional(),
});

staffApplicationsRouter.patch(
  '/:id',
  requirePermission('applications.review'),
  async (req: Request, res: Response) => {
    try {
      const parsed = updateStatusSchema.parse(req.body);

      const application = await db.queryOne<{
        id: number;
        character_id: number;
        player_id: number;
        house_id: number | null;
        organization_id: number | null;
        is_bastard: boolean;
        is_dragon_seed: boolean;
        father_name: string;
        mother_name: string;
        public_bio: string | null;
        status: string;
        character_name: string;
      }>(
        `SELECT ca.id, ca.character_id, ca.player_id, ca.house_id, ca.organization_id,
                ca.is_bastard, ca.is_dragon_seed,
                ca.father_name, ca.mother_name, ca.public_bio, ca.status,
                c.name AS character_name
         FROM character_applications ca
         JOIN characters c ON ca.character_id = c.id
         WHERE ca.id = ?`,
        [req.params.id]
      );

      if (!application) {
        return res.status(404).json({ error: 'Application not found' });
      }

      if (application.status !== 'pending' && application.status !== 'revision') {
        return res.status(400).json({ error: `Cannot change status from '${application.status}'` });
      }

      await db.transaction(async (conn) => {
        // Update the application record
        await conn.query(
          `UPDATE character_applications SET
            status = ?,
            staff_notes = ?,
            reviewed_by = ?,
            reviewed_at = NOW()
           WHERE id = ?`,
          [parsed.status, parsed.staffNotes ?? null, req.player!.id, application.id]
        );

        // Update the character record
        await conn.query(
          `UPDATE characters SET application_status = ? WHERE id = ?`,
          [parsed.status, application.character_id]
        );

        // On approval: copy lineage fields to character
        if (parsed.status === 'approved') {
          // Resolve region_id from house if applicable
          let regionId: number | null = null;
          if (application.house_id) {
            const house = await conn.query(
              `SELECT region_id FROM houses WHERE id = ?`,
              [application.house_id]
            ) as Array<{ region_id: number | null }>;
            regionId = house[0]?.region_id ?? null;
          }

          await conn.query(
            `UPDATE characters SET
              house_id = ?,
              region_id = ?,
              is_bastard = ?,
              is_dragon_seed = ?,
              father_name = ?,
              mother_name = ?,
              public_bio = ?,
              application_reviewed_by = ?,
              application_reviewed_at = NOW(),
              application_notes = ?
             WHERE id = ?`,
            [
              application.house_id,
              regionId,
              application.is_bastard,
              application.is_dragon_seed,
              application.father_name,
              application.mother_name,
              application.public_bio,
              req.player!.id,
              parsed.staffNotes ?? null,
              application.character_id,
            ]
          );

          // Auto-seed family tree from parent names (Section 6.6.4)
          if (application.house_id) {
            for (const parentName of [application.father_name, application.mother_name]) {
              if (!parentName || parentName.trim().length === 0) continue;
              const trimmed = parentName.trim();

              // Check if a character with that name exists in the house
              const existingChar = (await conn.query(
                `SELECT id FROM characters WHERE LOWER(name) = LOWER(?) AND house_id = ? LIMIT 1`,
                [trimmed, application.house_id]
              ) as Array<{ id: number }>)[0];

              let fromCharId: number | null = null;
              let fromNpcId: number | null = null;

              if (existingChar) {
                fromCharId = existingChar.id;
              } else {
                // Check if an NPC with that name exists in the house
                const existingNpc = (await conn.query(
                  `SELECT id FROM family_tree_npcs WHERE LOWER(name) = LOWER(?) AND house_id = ? LIMIT 1`,
                  [trimmed, application.house_id]
                ) as Array<{ id: number }>)[0];

                if (existingNpc) {
                  fromNpcId = existingNpc.id;
                } else {
                  // Create a new NPC entry
                  const npcResult = await conn.query(
                    `INSERT INTO family_tree_npcs (house_id, name, created_by) VALUES (?, ?, ?)`,
                    [application.house_id, trimmed, req.player!.id]
                  );
                  fromNpcId = Number((npcResult as { insertId: number }).insertId);
                }
              }

              // Create a parent edge (pre-approved since the application was reviewed)
              await conn.query(
                `INSERT INTO family_tree_edges (house_id, relationship, from_character_id, from_npc_id, to_character_id, to_npc_id, created_by, approved_by, approved_at, status)
                 VALUES (?, 'parent', ?, ?, ?, NULL, ?, ?, NOW(), 'approved')`,
                [
                  application.house_id,
                  fromCharId, fromNpcId,
                  application.character_id,
                  req.player!.id, req.player!.id,
                ]
              );
            }
          }

          // Add to organization if specified in the application
          if (application.organization_id) {
            await conn.query(
              `INSERT IGNORE INTO organization_members (organization_id, character_id) VALUES (?, ?)`,
              [application.organization_id, application.character_id]
            );
          }
        }
      });

      // Broadcast status change
      const { getIO } = await import('../../websocket/index.js');
      const io = getIO();
      if (io) {
        // Notify the applicant via socket
        io.to(`player:${application.player_id}`).emit('application:updated', {
          applicationId: application.id,
          status: parsed.status,
          characterId: application.character_id,
          characterName: application.character_name,
        });

        // Notify staff
        io.to('staff:applications').emit('application:updated', {
          applicationId: application.id,
          status: parsed.status,
          characterId: application.character_id,
        });

        // If approved, refresh the player's character list
        if (parsed.status === 'approved') {
          const characters = await db.query(
            `SELECT c.id, c.name, c.level, c.is_active, c.portrait_url,
                    c.application_status,
                    cv.health, cv.max_health
             FROM characters c
             LEFT JOIN character_vitals cv ON c.id = cv.character_id
             WHERE c.player_id = ? AND c.owner_character_id IS NULL
             ORDER BY c.created_at DESC`,
            [application.player_id]
          );
          io.to(`player:${application.player_id}`).emit('characters:list', characters);
        }
      }

      // Create persistent notification for applicant
      const statusMessages: Record<string, string> = {
        approved: 'Your application has been approved!',
        denied: 'Your application has been denied.',
        revision: 'Your application requires revision.',
      };
      const statusTypes: Record<string, 'success' | 'warning' | 'error'> = {
        approved: 'success',
        denied: 'error',
        revision: 'warning',
      };
      await createNotification({
        playerId: application.player_id,
        characterId: application.character_id,
        type: 'application',
        title: application.character_name,
        message: statusMessages[parsed.status] ?? `Application status: ${parsed.status}`,
        metadata: { applicationId: application.id, status: parsed.status },
      }).catch(err => logger.error('Failed to create application notification:', err));

      await logAuditAction({
        actorId: req.player!.id,
        actionKey: `application.${parsed.status}`,
        description: `${parsed.status} application for ${application.character_name}`,
        targetType: 'application',
        targetId: application.id,
      }).catch(err => logger.error('Audit log error:', err));

      res.json({ success: true, status: parsed.status });
    } catch (err) {
      if (err instanceof z.ZodError) {
        return res.status(400).json({ error: 'Validation error', details: err.errors });
      }
      logger.error('Failed to update application status:', err);
      res.status(500).json({ error: 'Failed to update application' });
    }
  }
);

// Post a comment on an application
const commentSchema = z.object({
  body: z.string().min(1).max(5000),
  isPrivate: z.boolean().default(false),
});

staffApplicationsRouter.post(
  '/:id/comments',
  requirePermission('applications.comment_public', 'applications.comment_private'),
  async (req: Request, res: Response) => {
    try {
      const parsed = commentSchema.parse(req.body);

      // If posting private comment, must have private permission
      if (parsed.isPrivate && !req.player!.isSuperAdmin && !req.player!.permissions.has('applications.comment_private')) {
        return res.status(403).json({ error: 'No permission to post private comments' });
      }

      // Verify application exists
      const application = await db.queryOne<{ id: number; player_id: number; character_name: string }>(
        `SELECT ca.id, ca.player_id, c.name AS character_name
         FROM character_applications ca
         JOIN characters c ON ca.character_id = c.id
         WHERE ca.id = ?`,
        [req.params.id]
      );

      if (!application) {
        return res.status(404).json({ error: 'Application not found' });
      }

      const commentId = await db.insert(
        `INSERT INTO application_comments (application_id, author_id, body, is_private)
         VALUES (?, ?, ?, ?)`,
        [application.id, req.player!.id, parsed.body, parsed.isPrivate]
      );

      // Broadcast comment notification
      const { getIO } = await import('../../websocket/index.js');
      const io = getIO();
      if (io) {
        // Public comments notify the applicant
        if (!parsed.isPrivate) {
          io.to(`player:${application.player_id}`).emit('application:comment', {
            applicationId: application.id,
            commentId,
          });
        }
        // All comments notify staff
        io.to('staff:applications').emit('application:comment', {
          applicationId: application.id,
          commentId,
          isPrivate: parsed.isPrivate,
        });
      }

      // Create persistent notification for applicant (public comments only)
      if (!parsed.isPrivate) {
        await createNotification({
          playerId: application.player_id,
          type: 'application',
          title: application.character_name,
          message: 'New comment on your application',
          metadata: { applicationId: application.id, commentId },
        }).catch(err => logger.error('Failed to create comment notification:', err));
      }

      res.json({ success: true, commentId });
    } catch (err) {
      if (err instanceof z.ZodError) {
        return res.status(400).json({ error: 'Validation error', details: err.errors });
      }
      logger.error('Failed to post comment:', err);
      res.status(500).json({ error: 'Failed to post comment' });
    }
  }
);

// Edit own comment body
const editCommentSchema = z.object({
  body: z.string().min(1).max(5000),
});

staffApplicationsRouter.patch(
  '/:id/comments/:commentId',
  requirePermission('applications.comment_public', 'applications.comment_private'),
  async (req: Request, res: Response) => {
    try {
      const parsed = editCommentSchema.parse(req.body);

      // Verify comment exists and belongs to current user (super admins can edit any)
      const comment = await db.queryOne<{ id: number; author_id: number }>(
        `SELECT id, author_id FROM application_comments
         WHERE id = ? AND application_id = ? AND deleted_at IS NULL`,
        [req.params.commentId, req.params.id]
      );

      if (!comment) {
        return res.status(404).json({ error: 'Comment not found' });
      }

      if (comment.author_id !== req.player!.id && !req.player!.isSuperAdmin) {
        return res.status(403).json({ error: 'Can only edit your own comments' });
      }

      await db.execute(
        `UPDATE application_comments SET body = ?, edited_at = NOW() WHERE id = ?`,
        [parsed.body, comment.id]
      );

      logger.info(`Staff comment edited: commentId=${comment.id} by playerId=${req.player!.id}`);
      res.json({ success: true });
    } catch (err) {
      if (err instanceof z.ZodError) {
        return res.status(400).json({ error: 'Validation error', details: err.errors });
      }
      logger.error('Failed to edit comment:', err);
      res.status(500).json({ error: 'Failed to edit comment' });
    }
  }
);

// Toggle comment visibility (hide/show from player)
const visibilitySchema = z.object({
  isVisible: z.boolean(),
});

staffApplicationsRouter.patch(
  '/:id/comments/:commentId/visibility',
  requirePermission('applications.comment_public', 'applications.comment_private'),
  async (req: Request, res: Response) => {
    try {
      const parsed = visibilitySchema.parse(req.body);

      const comment = await db.queryOne<{ id: number; author_id: number }>(
        `SELECT id, author_id FROM application_comments
         WHERE id = ? AND application_id = ? AND deleted_at IS NULL`,
        [req.params.commentId, req.params.id]
      );

      if (!comment) {
        return res.status(404).json({ error: 'Comment not found' });
      }

      if (comment.author_id !== req.player!.id && !req.player!.isSuperAdmin) {
        return res.status(403).json({ error: 'Can only toggle visibility of your own comments' });
      }

      await db.execute(
        `UPDATE application_comments SET is_visible = ? WHERE id = ?`,
        [parsed.isVisible, comment.id]
      );

      logger.info(`Staff comment visibility toggled: commentId=${comment.id} visible=${parsed.isVisible} by playerId=${req.player!.id}`);
      res.json({ success: true, isVisible: parsed.isVisible });
    } catch (err) {
      if (err instanceof z.ZodError) {
        return res.status(400).json({ error: 'Validation error', details: err.errors });
      }
      logger.error('Failed to toggle comment visibility:', err);
      res.status(500).json({ error: 'Failed to toggle comment visibility' });
    }
  }
);

// Soft-delete own comment
staffApplicationsRouter.delete(
  '/:id/comments/:commentId',
  requirePermission('applications.comment_public', 'applications.comment_private'),
  async (req: Request, res: Response) => {
    try {
      const comment = await db.queryOne<{ id: number; author_id: number }>(
        `SELECT id, author_id FROM application_comments
         WHERE id = ? AND application_id = ? AND deleted_at IS NULL`,
        [req.params.commentId, req.params.id]
      );

      if (!comment) {
        return res.status(404).json({ error: 'Comment not found' });
      }

      if (comment.author_id !== req.player!.id && !req.player!.isSuperAdmin) {
        return res.status(403).json({ error: 'Can only delete your own comments' });
      }

      await db.execute(
        `UPDATE application_comments SET deleted_at = NOW() WHERE id = ?`,
        [comment.id]
      );

      logger.info(`Staff comment soft-deleted: commentId=${comment.id} by playerId=${req.player!.id}`);
      res.json({ success: true });
    } catch (err) {
      logger.error('Failed to delete comment:', err);
      res.status(500).json({ error: 'Failed to delete comment' });
    }
  }
);
