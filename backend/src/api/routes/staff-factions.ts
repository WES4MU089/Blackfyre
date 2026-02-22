import { Router, Request, Response } from 'express';
import { z } from 'zod';
import { db } from '../../db/connection.js';
import { logger } from '../../utils/logger.js';
import { requireAuth, requirePermission } from '../middleware/auth.js';
import { logAuditAction } from '../../utils/audit.js';

export const staffFactionsRouter = Router();

staffFactionsRouter.use(requireAuth());

// List all factions including inactive (staff view — shows secret members)
staffFactionsRouter.get(
  '/',
  requirePermission('content.manage_factions'),
  async (_req: Request, res: Response) => {
    try {
      const factions = await db.query(
        `SELECT f.*, lc.name AS leader_name,
                (SELECT COUNT(*) FROM faction_members fm WHERE fm.faction_id = f.id) AS total_member_count,
                (SELECT COUNT(*) FROM faction_members fm WHERE fm.faction_id = f.id AND fm.declared_publicly = FALSE) AS secret_member_count
         FROM factions f
         LEFT JOIN characters lc ON f.leader_character_id = lc.id
         ORDER BY f.is_active DESC, f.name`
      );
      res.json({ factions });
    } catch (err) {
      logger.error('Failed to fetch factions (staff):', err);
      res.status(500).json({ error: 'Failed to fetch factions' });
    }
  }
);

// Create faction
const createFactionSchema = z.object({
  name: z.string().min(1).max(100),
  description: z.string().max(5000).nullable().optional(),
  bannerUrl: z.string().max(500).nullable().optional(),
  leaderCharacterId: z.number().int().positive().nullable().optional(),
});

staffFactionsRouter.post(
  '/',
  requirePermission('content.manage_factions'),
  async (req: Request, res: Response) => {
    try {
      const parsed = createFactionSchema.parse(req.body);

      const id = await db.insert(
        `INSERT INTO factions (name, description, banner_url, leader_character_id)
         VALUES (?, ?, ?, ?)`,
        [parsed.name, parsed.description ?? null, parsed.bannerUrl ?? null, parsed.leaderCharacterId ?? null]
      );

      await logAuditAction({
        actorId: req.player!.id,
        actionKey: 'faction.created',
        description: `Created faction "${parsed.name}"`,
        targetType: 'faction',
        targetId: id,
      }).catch(err => logger.error('Audit log error:', err));

      res.status(201).json({ success: true, id });
    } catch (err) {
      if (err instanceof z.ZodError) {
        return res.status(400).json({ error: 'Validation error', details: err.errors });
      }
      logger.error('Failed to create faction:', err);
      res.status(500).json({ error: 'Failed to create faction' });
    }
  }
);

// Update faction
const updateFactionSchema = z.object({
  name: z.string().min(1).max(100).optional(),
  description: z.string().max(5000).nullable().optional(),
  bannerUrl: z.string().max(500).nullable().optional(),
  leaderCharacterId: z.number().int().positive().nullable().optional(),
  isActive: z.boolean().optional(),
});

staffFactionsRouter.patch(
  '/:id',
  requirePermission('content.manage_factions'),
  async (req: Request, res: Response) => {
    try {
      const parsed = updateFactionSchema.parse(req.body);

      const faction = await db.queryOne<{ id: number; name: string }>(
        `SELECT id, name FROM factions WHERE id = ?`,
        [req.params.id]
      );

      if (!faction) {
        return res.status(404).json({ error: 'Faction not found' });
      }

      const fields: string[] = [];
      const params: unknown[] = [];

      if (parsed.name !== undefined) { fields.push('name = ?'); params.push(parsed.name); }
      if (parsed.description !== undefined) { fields.push('description = ?'); params.push(parsed.description); }
      if (parsed.bannerUrl !== undefined) { fields.push('banner_url = ?'); params.push(parsed.bannerUrl); }
      if (parsed.leaderCharacterId !== undefined) { fields.push('leader_character_id = ?'); params.push(parsed.leaderCharacterId); }
      if (parsed.isActive !== undefined) { fields.push('is_active = ?'); params.push(parsed.isActive); }

      if (fields.length === 0) {
        return res.status(400).json({ error: 'No fields to update' });
      }

      params.push(faction.id);
      await db.execute(
        `UPDATE factions SET ${fields.join(', ')} WHERE id = ?`,
        params
      );

      await logAuditAction({
        actorId: req.player!.id,
        actionKey: 'faction.updated',
        description: `Updated faction "${faction.name}"`,
        targetType: 'faction',
        targetId: faction.id,
        metadata: parsed as Record<string, unknown>,
      }).catch(err => logger.error('Audit log error:', err));

      res.json({ success: true });
    } catch (err) {
      if (err instanceof z.ZodError) {
        return res.status(400).json({ error: 'Validation error', details: err.errors });
      }
      logger.error('Failed to update faction:', err);
      res.status(500).json({ error: 'Failed to update faction' });
    }
  }
);

// Deactivate faction
staffFactionsRouter.delete(
  '/:id',
  requirePermission('content.manage_factions'),
  async (req: Request, res: Response) => {
    try {
      const faction = await db.queryOne<{ id: number; name: string }>(
        `SELECT id, name FROM factions WHERE id = ?`,
        [req.params.id]
      );

      if (!faction) {
        return res.status(404).json({ error: 'Faction not found' });
      }

      await db.execute(
        `UPDATE factions SET is_active = FALSE WHERE id = ?`,
        [faction.id]
      );

      await logAuditAction({
        actorId: req.player!.id,
        actionKey: 'faction.deactivated',
        description: `Deactivated faction "${faction.name}"`,
        targetType: 'faction',
        targetId: faction.id,
      }).catch(err => logger.error('Audit log error:', err));

      res.json({ success: true });
    } catch (err) {
      logger.error('Failed to deactivate faction:', err);
      res.status(500).json({ error: 'Failed to deactivate faction' });
    }
  }
);

// Add member to faction
const addMemberSchema = z.object({
  characterId: z.number().int().positive(),
  declaredPublicly: z.boolean().optional().default(true),
});

staffFactionsRouter.post(
  '/:id/members',
  requirePermission('content.manage_factions'),
  async (req: Request, res: Response) => {
    try {
      const parsed = addMemberSchema.parse(req.body);

      const faction = await db.queryOne<{ id: number; name: string }>(
        `SELECT id, name FROM factions WHERE id = ?`,
        [req.params.id]
      );

      if (!faction) {
        return res.status(404).json({ error: 'Faction not found' });
      }

      const character = await db.queryOne<{ id: number; name: string }>(
        `SELECT id, name FROM characters WHERE id = ?`,
        [parsed.characterId]
      );

      if (!character) {
        return res.status(404).json({ error: 'Character not found' });
      }

      const id = await db.insert(
        `INSERT INTO faction_members (faction_id, character_id, declared_publicly)
         VALUES (?, ?, ?)`,
        [faction.id, parsed.characterId, parsed.declaredPublicly]
      );

      await logAuditAction({
        actorId: req.player!.id,
        actionKey: 'faction.member_added',
        description: `Added ${character.name} to faction "${faction.name}"${parsed.declaredPublicly ? '' : ' (secret)'}`,
        targetType: 'faction',
        targetId: faction.id,
        metadata: { characterId: parsed.characterId, declaredPublicly: parsed.declaredPublicly },
      }).catch(err => logger.error('Audit log error:', err));

      res.status(201).json({ success: true, id });
    } catch (err) {
      if (err instanceof z.ZodError) {
        return res.status(400).json({ error: 'Validation error', details: err.errors });
      }
      logger.error('Failed to add faction member:', err);
      res.status(500).json({ error: 'Failed to add member' });
    }
  }
);

// Update member (toggle public/secret)
const updateMemberSchema = z.object({
  declaredPublicly: z.boolean(),
});

staffFactionsRouter.patch(
  '/:id/members/:characterId',
  requirePermission('content.manage_factions'),
  async (req: Request, res: Response) => {
    try {
      const parsed = updateMemberSchema.parse(req.body);

      const member = await db.queryOne<{ id: number }>(
        `SELECT id FROM faction_members WHERE faction_id = ? AND character_id = ?`,
        [req.params.id, req.params.characterId]
      );

      if (!member) {
        return res.status(404).json({ error: 'Member not found' });
      }

      await db.execute(
        `UPDATE faction_members SET declared_publicly = ? WHERE id = ?`,
        [parsed.declaredPublicly, member.id]
      );

      res.json({ success: true });
    } catch (err) {
      if (err instanceof z.ZodError) {
        return res.status(400).json({ error: 'Validation error', details: err.errors });
      }
      logger.error('Failed to update faction member:', err);
      res.status(500).json({ error: 'Failed to update member' });
    }
  }
);

// Remove member from faction
staffFactionsRouter.delete(
  '/:id/members/:characterId',
  requirePermission('content.manage_factions'),
  async (req: Request, res: Response) => {
    try {
      const faction = await db.queryOne<{ id: number; name: string }>(
        `SELECT id, name FROM factions WHERE id = ?`,
        [req.params.id]
      );

      if (!faction) {
        return res.status(404).json({ error: 'Faction not found' });
      }

      const member = await db.queryOne<{ id: number; character_id: number }>(
        `SELECT fm.id, fm.character_id FROM faction_members fm
         WHERE fm.faction_id = ? AND fm.character_id = ?`,
        [req.params.id, req.params.characterId]
      );

      if (!member) {
        return res.status(404).json({ error: 'Member not found' });
      }

      const character = await db.queryOne<{ name: string }>(
        `SELECT name FROM characters WHERE id = ?`,
        [member.character_id]
      );

      await db.execute(
        `DELETE FROM faction_members WHERE id = ?`,
        [member.id]
      );

      await logAuditAction({
        actorId: req.player!.id,
        actionKey: 'faction.member_removed',
        description: `Removed ${character?.name ?? 'unknown'} from faction "${faction.name}"`,
        targetType: 'faction',
        targetId: faction.id,
        metadata: { characterId: member.character_id },
      }).catch(err => logger.error('Audit log error:', err));

      res.json({ success: true });
    } catch (err) {
      logger.error('Failed to remove faction member:', err);
      res.status(500).json({ error: 'Failed to remove member' });
    }
  }
);
