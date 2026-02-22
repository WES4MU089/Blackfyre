import { Router, Request, Response } from 'express';
import { z } from 'zod';
import { db } from '../../db/connection.js';
import { logger } from '../../utils/logger.js';
import { requireAuth, requirePermission } from '../middleware/auth.js';
import { logAuditAction } from '../../utils/audit.js';

export const staffFamilyTreeRouter = Router();

staffFamilyTreeRouter.use(requireAuth());

// List all pending family tree suggestions
staffFamilyTreeRouter.get(
  '/pending',
  requirePermission('family_tree.approve_suggestions'),
  async (_req: Request, res: Response) => {
    try {
      const edges = await db.query(
        `SELECT fte.id, fte.house_id, fte.relationship, fte.status,
                fte.from_character_id, fte.from_npc_id,
                fte.to_character_id, fte.to_npc_id,
                fte.created_at,
                h.name AS house_name,
                p.discord_username AS submitted_by,
                fc.name AS from_character_name,
                fn.name AS from_npc_name,
                tc.name AS to_character_name,
                tn.name AS to_npc_name
         FROM family_tree_edges fte
         JOIN houses h ON fte.house_id = h.id
         JOIN players p ON fte.created_by = p.id
         LEFT JOIN characters fc ON fte.from_character_id = fc.id
         LEFT JOIN family_tree_npcs fn ON fte.from_npc_id = fn.id
         LEFT JOIN characters tc ON fte.to_character_id = tc.id
         LEFT JOIN family_tree_npcs tn ON fte.to_npc_id = tn.id
         WHERE fte.status = 'pending'
         ORDER BY fte.created_at ASC`
      );
      res.json({ edges });
    } catch (err) {
      logger.error('Failed to fetch pending family tree suggestions:', err);
      res.status(500).json({ error: 'Failed to fetch pending suggestions' });
    }
  }
);

// Create NPC entry directly (staff)
const createNpcSchema = z.object({
  houseId: z.number().int().positive(),
  name: z.string().min(1).max(150),
  title: z.string().max(100).nullable().optional(),
  epithet: z.string().max(100).nullable().optional(),
  portraitUrl: z.string().max(500).nullable().optional(),
  publicBio: z.string().max(5000).nullable().optional(),
  isDeceased: z.boolean().optional().default(false),
});

staffFamilyTreeRouter.post(
  '/npcs',
  requirePermission('family_tree.manage'),
  async (req: Request, res: Response) => {
    try {
      const parsed = createNpcSchema.parse(req.body);

      const house = await db.queryOne<{ id: number; name: string }>(
        `SELECT id, name FROM houses WHERE id = ?`,
        [parsed.houseId]
      );

      if (!house) {
        return res.status(404).json({ error: 'House not found' });
      }

      const id = await db.insert(
        `INSERT INTO family_tree_npcs (house_id, name, title, epithet, portrait_url, public_bio, is_deceased, created_by)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          parsed.houseId, parsed.name,
          parsed.title ?? null, parsed.epithet ?? null,
          parsed.portraitUrl ?? null, parsed.publicBio ?? null,
          parsed.isDeceased, req.player!.id,
        ]
      );

      await logAuditAction({
        actorId: req.player!.id,
        actionKey: 'family_tree.npc_created',
        description: `Created NPC "${parsed.name}" in House ${house.name}`,
        targetType: 'family_tree_npc',
        targetId: id,
      }).catch(err => logger.error('Audit log error:', err));

      res.status(201).json({ success: true, id });
    } catch (err) {
      if (err instanceof z.ZodError) {
        return res.status(400).json({ error: 'Validation error', details: err.errors });
      }
      logger.error('Failed to create family tree NPC:', err);
      res.status(500).json({ error: 'Failed to create NPC' });
    }
  }
);

// Edit NPC
const updateNpcSchema = z.object({
  name: z.string().min(1).max(150).optional(),
  title: z.string().max(100).nullable().optional(),
  epithet: z.string().max(100).nullable().optional(),
  portraitUrl: z.string().max(500).nullable().optional(),
  publicBio: z.string().max(5000).nullable().optional(),
  isDeceased: z.boolean().optional(),
});

staffFamilyTreeRouter.patch(
  '/npcs/:id',
  requirePermission('family_tree.manage'),
  async (req: Request, res: Response) => {
    try {
      const parsed = updateNpcSchema.parse(req.body);

      const npc = await db.queryOne<{ id: number; name: string }>(
        `SELECT id, name FROM family_tree_npcs WHERE id = ?`,
        [req.params.id]
      );

      if (!npc) {
        return res.status(404).json({ error: 'NPC not found' });
      }

      const fields: string[] = [];
      const params: unknown[] = [];

      if (parsed.name !== undefined) { fields.push('name = ?'); params.push(parsed.name); }
      if (parsed.title !== undefined) { fields.push('title = ?'); params.push(parsed.title); }
      if (parsed.epithet !== undefined) { fields.push('epithet = ?'); params.push(parsed.epithet); }
      if (parsed.portraitUrl !== undefined) { fields.push('portrait_url = ?'); params.push(parsed.portraitUrl); }
      if (parsed.publicBio !== undefined) { fields.push('public_bio = ?'); params.push(parsed.publicBio); }
      if (parsed.isDeceased !== undefined) { fields.push('is_deceased = ?'); params.push(parsed.isDeceased); }

      if (fields.length === 0) {
        return res.status(400).json({ error: 'No fields to update' });
      }

      params.push(npc.id);
      await db.execute(
        `UPDATE family_tree_npcs SET ${fields.join(', ')} WHERE id = ?`,
        params
      );

      await logAuditAction({
        actorId: req.player!.id,
        actionKey: 'family_tree.npc_updated',
        description: `Updated NPC "${npc.name}"`,
        targetType: 'family_tree_npc',
        targetId: npc.id,
      }).catch(err => logger.error('Audit log error:', err));

      res.json({ success: true });
    } catch (err) {
      if (err instanceof z.ZodError) {
        return res.status(400).json({ error: 'Validation error', details: err.errors });
      }
      logger.error('Failed to update family tree NPC:', err);
      res.status(500).json({ error: 'Failed to update NPC' });
    }
  }
);

// Delete NPC
staffFamilyTreeRouter.delete(
  '/npcs/:id',
  requirePermission('family_tree.manage'),
  async (req: Request, res: Response) => {
    try {
      const npc = await db.queryOne<{ id: number; name: string; house_id: number }>(
        `SELECT id, name, house_id FROM family_tree_npcs WHERE id = ?`,
        [req.params.id]
      );

      if (!npc) {
        return res.status(404).json({ error: 'NPC not found' });
      }

      // Cascade will delete associated edges
      await db.execute(
        `DELETE FROM family_tree_npcs WHERE id = ?`,
        [npc.id]
      );

      await logAuditAction({
        actorId: req.player!.id,
        actionKey: 'family_tree.npc_deleted',
        description: `Deleted NPC "${npc.name}"`,
        targetType: 'family_tree_npc',
        targetId: npc.id,
      }).catch(err => logger.error('Audit log error:', err));

      res.json({ success: true });
    } catch (err) {
      logger.error('Failed to delete family tree NPC:', err);
      res.status(500).json({ error: 'Failed to delete NPC' });
    }
  }
);

// Create edge directly (pre-approved, staff)
const createEdgeSchema = z.object({
  houseId: z.number().int().positive(),
  relationship: z.enum(['parent', 'spouse', 'sibling']),
  fromCharacterId: z.number().int().positive().nullable().optional(),
  fromNpcId: z.number().int().positive().nullable().optional(),
  toCharacterId: z.number().int().positive().nullable().optional(),
  toNpcId: z.number().int().positive().nullable().optional(),
});

staffFamilyTreeRouter.post(
  '/edges',
  requirePermission('family_tree.manage'),
  async (req: Request, res: Response) => {
    try {
      const parsed = createEdgeSchema.parse(req.body);

      if (!parsed.fromCharacterId && !parsed.fromNpcId) {
        return res.status(400).json({ error: 'Must specify a from node (character or NPC)' });
      }
      if (!parsed.toCharacterId && !parsed.toNpcId) {
        return res.status(400).json({ error: 'Must specify a to node (character or NPC)' });
      }

      const id = await db.insert(
        `INSERT INTO family_tree_edges (house_id, relationship, from_character_id, from_npc_id, to_character_id, to_npc_id, created_by, approved_by, approved_at, status)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, NOW(), 'approved')`,
        [
          parsed.houseId, parsed.relationship,
          parsed.fromCharacterId ?? null, parsed.fromNpcId ?? null,
          parsed.toCharacterId ?? null, parsed.toNpcId ?? null,
          req.player!.id, req.player!.id,
        ]
      );

      await logAuditAction({
        actorId: req.player!.id,
        actionKey: 'family_tree.edge_created',
        description: `Created ${parsed.relationship} edge in house ${parsed.houseId}`,
        targetType: 'family_tree_edge',
        targetId: id,
      }).catch(err => logger.error('Audit log error:', err));

      res.status(201).json({ success: true, id });
    } catch (err) {
      if (err instanceof z.ZodError) {
        return res.status(400).json({ error: 'Validation error', details: err.errors });
      }
      logger.error('Failed to create family tree edge:', err);
      res.status(500).json({ error: 'Failed to create edge' });
    }
  }
);

// Delete edge
staffFamilyTreeRouter.delete(
  '/edges/:id',
  requirePermission('family_tree.manage'),
  async (req: Request, res: Response) => {
    try {
      const edge = await db.queryOne<{ id: number }>(
        `SELECT id FROM family_tree_edges WHERE id = ?`,
        [req.params.id]
      );

      if (!edge) {
        return res.status(404).json({ error: 'Edge not found' });
      }

      await db.execute(
        `DELETE FROM family_tree_edges WHERE id = ?`,
        [edge.id]
      );

      await logAuditAction({
        actorId: req.player!.id,
        actionKey: 'family_tree.edge_deleted',
        description: `Deleted family tree edge ${edge.id}`,
        targetType: 'family_tree_edge',
        targetId: edge.id,
      }).catch(err => logger.error('Audit log error:', err));

      res.json({ success: true });
    } catch (err) {
      logger.error('Failed to delete family tree edge:', err);
      res.status(500).json({ error: 'Failed to delete edge' });
    }
  }
);

// Approve or deny a pending suggestion
const reviewEdgeSchema = z.object({
  status: z.enum(['approved', 'denied']),
});

staffFamilyTreeRouter.patch(
  '/edges/:id',
  requirePermission('family_tree.approve_suggestions'),
  async (req: Request, res: Response) => {
    try {
      const parsed = reviewEdgeSchema.parse(req.body);

      const edge = await db.queryOne<{ id: number; status: string; house_id: number; created_by: number }>(
        `SELECT id, status, house_id, created_by FROM family_tree_edges WHERE id = ?`,
        [req.params.id]
      );

      if (!edge) {
        return res.status(404).json({ error: 'Edge not found' });
      }

      if (edge.status !== 'pending') {
        return res.status(400).json({ error: `Edge is already ${edge.status}` });
      }

      await db.execute(
        `UPDATE family_tree_edges SET status = ?, approved_by = ?, approved_at = NOW() WHERE id = ?`,
        [parsed.status, req.player!.id, edge.id]
      );

      await logAuditAction({
        actorId: req.player!.id,
        actionKey: `family_tree.suggestion_${parsed.status}`,
        description: `${parsed.status} family tree suggestion (edge ${edge.id}) for house ${edge.house_id}`,
        targetType: 'family_tree_edge',
        targetId: edge.id,
      }).catch(err => logger.error('Audit log error:', err));

      res.json({ success: true, status: parsed.status });
    } catch (err) {
      if (err instanceof z.ZodError) {
        return res.status(400).json({ error: 'Validation error', details: err.errors });
      }
      logger.error('Failed to review family tree suggestion:', err);
      res.status(500).json({ error: 'Failed to review suggestion' });
    }
  }
);
