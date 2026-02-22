import { Router, Request, Response } from 'express';
import { z } from 'zod';
import { db } from '../../db/connection.js';
import { logger } from '../../utils/logger.js';
import { requireAuth } from '../middleware/auth.js';

export const applicationsRouter = Router();

// All player application routes require authentication
applicationsRouter.use(requireAuth());

// List own applications
applicationsRouter.get('/', async (req: Request, res: Response) => {
  try {
    const applications = await db.query(
      `SELECT ca.id, ca.character_id, ca.house_id, ca.status,
              ca.requested_role, ca.is_featured_role,
              ca.submitted_at, ca.updated_at,
              c.name AS character_name,
              h.name AS house_name
       FROM character_applications ca
       JOIN characters c ON ca.character_id = c.id
       LEFT JOIN houses h ON ca.house_id = h.id
       WHERE ca.player_id = ?
       ORDER BY ca.submitted_at DESC`,
      [req.player!.id]
    );
    res.json({ applications });
  } catch (err) {
    logger.error('Failed to fetch player applications:', err);
    res.status(500).json({ error: 'Failed to fetch applications' });
  }
});

// Get single application detail (own only)
applicationsRouter.get('/:id', async (req: Request, res: Response) => {
  try {
    const application = await db.queryOne(
      `SELECT ca.*, c.name AS character_name, h.name AS house_name
       FROM character_applications ca
       JOIN characters c ON ca.character_id = c.id
       LEFT JOIN houses h ON ca.house_id = h.id
       WHERE ca.id = ? AND ca.player_id = ?`,
      [req.params.id, req.player!.id]
    );

    if (!application) {
      return res.status(404).json({ error: 'Application not found' });
    }

    // Load public, visible, non-deleted comments only
    const comments = await db.query(
      `SELECT ac.id, ac.author_id, ac.body, ac.is_private, ac.created_at, ac.edited_at,
              p.discord_username AS author_name
       FROM application_comments ac
       JOIN players p ON ac.author_id = p.id
       WHERE ac.application_id = ? AND ac.is_private = FALSE
         AND ac.is_visible = TRUE AND ac.deleted_at IS NULL
       ORDER BY ac.created_at ASC`,
      [req.params.id]
    );

    res.json({ application, comments });
  } catch (err) {
    logger.error('Failed to fetch application detail:', err);
    res.status(500).json({ error: 'Failed to fetch application' });
  }
});

// Resubmit a revision
const resubmitSchema = z.object({
  applicationBio: z.string().min(1).max(10000),
  publicBio: z.string().max(5000).nullable().optional(),
  hohContact: z.string().max(2000).nullable().optional(),
  isBastard: z.boolean().optional(),
  isDragonSeed: z.boolean().optional(),
  houseId: z.number().int().positive().nullable().optional(),
  requestedRole: z.enum(['member', 'head_of_house', 'lord_paramount', 'royalty']).optional(),
  isFeaturedRole: z.boolean().optional(),
});

applicationsRouter.put('/:id', async (req: Request, res: Response) => {
  try {
    const parsed = resubmitSchema.parse(req.body);

    // Verify application belongs to player and is in 'revision' status
    const application = await db.queryOne<{ id: number; character_id: number; status: string }>(
      `SELECT id, character_id, status FROM character_applications
       WHERE id = ? AND player_id = ?`,
      [req.params.id, req.player!.id]
    );

    if (!application) {
      return res.status(404).json({ error: 'Application not found' });
    }

    if (application.status !== 'revision') {
      return res.status(400).json({ error: 'Application is not in revision status' });
    }

    // Auto-set featured role for leadership positions
    const isFeatured = parsed.isFeaturedRole ||
      ['head_of_house', 'lord_paramount', 'royalty'].includes(parsed.requestedRole ?? '');

    await db.transaction(async (conn) => {
      // Update the application
      await conn.query(
        `UPDATE character_applications SET
          application_bio = ?,
          public_bio = ?,
          hoh_contact = ?,
          is_bastard = ?,
          is_dragon_seed = ?,
          house_id = ?,
          requested_role = ?,
          is_featured_role = ?,
          status = 'pending',
          reviewed_by = NULL,
          reviewed_at = NULL
         WHERE id = ?`,
        [
          parsed.applicationBio,
          parsed.publicBio ?? null,
          parsed.hohContact ?? null,
          parsed.isBastard ?? false,
          parsed.isDragonSeed ?? false,
          parsed.houseId ?? null,
          parsed.requestedRole ?? 'member',
          isFeatured,
          application.id,
        ]
      );

      // Update character status back to pending
      await conn.query(
        `UPDATE characters SET application_status = 'pending' WHERE id = ?`,
        [application.character_id]
      );

      // Auto-post private comment noting resubmission
      await conn.query(
        `INSERT INTO application_comments (application_id, author_id, body, is_private)
         VALUES (?, ?, 'Application resubmitted by player — previous version archived.', TRUE)`,
        [application.id, req.player!.id]
      );
    });

    // Broadcast to staff
    const { getIO } = await import('../../websocket/index.js');
    const io = getIO();
    if (io) {
      io.to('staff:applications').emit('application:submitted', {
        applicationId: application.id,
        characterName: 'Resubmission',
        tier: 2,
      });
    }

    res.json({ success: true });
  } catch (err) {
    if (err instanceof z.ZodError) {
      return res.status(400).json({ error: 'Validation error', details: err.errors });
    }
    logger.error('Failed to resubmit application:', err);
    res.status(500).json({ error: 'Failed to resubmit application' });
  }
});

// Post a public comment on own application
const playerCommentSchema = z.object({
  body: z.string().min(1).max(5000),
});

applicationsRouter.post('/:id/comments', async (req: Request, res: Response) => {
  try {
    const parsed = playerCommentSchema.parse(req.body);

    // Verify application belongs to player
    const application = await db.queryOne<{ id: number; status: string }>(
      `SELECT id, status FROM character_applications
       WHERE id = ? AND player_id = ?`,
      [req.params.id, req.player!.id]
    );

    if (!application) {
      return res.status(404).json({ error: 'Application not found' });
    }

    // Only allow commenting on pending or revision applications
    if (application.status !== 'pending' && application.status !== 'revision') {
      return res.status(400).json({ error: 'Cannot comment on this application' });
    }

    const commentId = await db.insert(
      `INSERT INTO application_comments (application_id, author_id, body, is_private)
       VALUES (?, ?, ?, FALSE)`,
      [application.id, req.player!.id, parsed.body]
    );

    // Notify staff via socket
    const { getIO } = await import('../../websocket/index.js');
    const io = getIO();
    if (io) {
      io.to('staff:applications').emit('application:comment', {
        applicationId: application.id,
        commentId,
        isPrivate: false,
      });
    }

    res.json({
      success: true,
      comment: {
        id: commentId,
        author_id: req.player!.id,
        body: parsed.body,
        is_private: false,
        created_at: new Date().toISOString(),
        author_name: req.player!.discordUsername ?? 'Player',
      },
    });
  } catch (err) {
    if (err instanceof z.ZodError) {
      return res.status(400).json({ error: 'Validation error', details: err.errors });
    }
    logger.error('Failed to post player comment:', err);
    res.status(500).json({ error: 'Failed to post comment' });
  }
});
