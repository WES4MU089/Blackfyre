import { Router, Request, Response } from 'express';
import { z } from 'zod';
import { db } from '../../db/connection.js';
import { logger } from '../../utils/logger.js';
import { requireAuth, requirePermission } from '../middleware/auth.js';
import { logAuditAction } from '../../utils/audit.js';

export const staffOrganizationsRouter = Router();

staffOrganizationsRouter.use(requireAuth());

// List all organizations including inactive
staffOrganizationsRouter.get(
  '/',
  requirePermission('content.manage_organizations'),
  async (_req: Request, res: Response) => {
    try {
      const organizations = await db.query(
        `SELECT o.*, r.name AS region_name, lc.name AS leader_name,
                (SELECT COUNT(*) FROM organization_members om WHERE om.organization_id = o.id) AS member_count
         FROM organizations o
         LEFT JOIN regions r ON o.region_id = r.id
         LEFT JOIN characters lc ON o.leader_character_id = lc.id
         ORDER BY o.is_active DESC, o.org_type, o.name`
      );
      res.json({ organizations });
    } catch (err) {
      logger.error('Failed to fetch organizations (staff):', err);
      res.status(500).json({ error: 'Failed to fetch organizations' });
    }
  }
);

// Create organization
const createOrgSchema = z.object({
  name: z.string().min(1).max(100),
  orgType: z.enum(['order', 'guild', 'company']),
  description: z.string().max(5000).nullable().optional(),
  sigilUrl: z.string().max(500).nullable().optional(),
  regionId: z.number().int().positive().nullable().optional(),
  leaderCharacterId: z.number().int().positive().nullable().optional(),
  requiresApproval: z.boolean().optional().default(false),
});

staffOrganizationsRouter.post(
  '/',
  requirePermission('content.manage_organizations'),
  async (req: Request, res: Response) => {
    try {
      const parsed = createOrgSchema.parse(req.body);

      const id = await db.insert(
        `INSERT INTO organizations (name, org_type, description, sigil_url, region_id, leader_character_id, requires_approval)
         VALUES (?, ?, ?, ?, ?, ?, ?)`,
        [
          parsed.name, parsed.orgType,
          parsed.description ?? null, parsed.sigilUrl ?? null,
          parsed.regionId ?? null, parsed.leaderCharacterId ?? null,
          parsed.requiresApproval,
        ]
      );

      await logAuditAction({
        actorId: req.player!.id,
        actionKey: 'organization.created',
        description: `Created organization "${parsed.name}"`,
        targetType: 'organization',
        targetId: id,
      }).catch(err => logger.error('Audit log error:', err));

      res.status(201).json({ success: true, id });
    } catch (err) {
      if (err instanceof z.ZodError) {
        return res.status(400).json({ error: 'Validation error', details: err.errors });
      }
      logger.error('Failed to create organization:', err);
      res.status(500).json({ error: 'Failed to create organization' });
    }
  }
);

// Update organization
const updateOrgSchema = z.object({
  name: z.string().min(1).max(100).optional(),
  orgType: z.enum(['order', 'guild', 'company']).optional(),
  description: z.string().max(5000).nullable().optional(),
  sigilUrl: z.string().max(500).nullable().optional(),
  regionId: z.number().int().positive().nullable().optional(),
  leaderCharacterId: z.number().int().positive().nullable().optional(),
  requiresApproval: z.boolean().optional(),
  isActive: z.boolean().optional(),
});

staffOrganizationsRouter.patch(
  '/:id',
  requirePermission('content.manage_organizations'),
  async (req: Request, res: Response) => {
    try {
      const parsed = updateOrgSchema.parse(req.body);

      const org = await db.queryOne<{ id: number; name: string }>(
        `SELECT id, name FROM organizations WHERE id = ?`,
        [req.params.id]
      );

      if (!org) {
        return res.status(404).json({ error: 'Organization not found' });
      }

      const fields: string[] = [];
      const params: unknown[] = [];

      if (parsed.name !== undefined) { fields.push('name = ?'); params.push(parsed.name); }
      if (parsed.orgType !== undefined) { fields.push('org_type = ?'); params.push(parsed.orgType); }
      if (parsed.description !== undefined) { fields.push('description = ?'); params.push(parsed.description); }
      if (parsed.sigilUrl !== undefined) { fields.push('sigil_url = ?'); params.push(parsed.sigilUrl); }
      if (parsed.regionId !== undefined) { fields.push('region_id = ?'); params.push(parsed.regionId); }
      if (parsed.leaderCharacterId !== undefined) { fields.push('leader_character_id = ?'); params.push(parsed.leaderCharacterId); }
      if (parsed.requiresApproval !== undefined) { fields.push('requires_approval = ?'); params.push(parsed.requiresApproval); }
      if (parsed.isActive !== undefined) { fields.push('is_active = ?'); params.push(parsed.isActive); }

      if (fields.length === 0) {
        return res.status(400).json({ error: 'No fields to update' });
      }

      params.push(org.id);
      await db.execute(
        `UPDATE organizations SET ${fields.join(', ')} WHERE id = ?`,
        params
      );

      await logAuditAction({
        actorId: req.player!.id,
        actionKey: 'organization.updated',
        description: `Updated organization "${org.name}"`,
        targetType: 'organization',
        targetId: org.id,
        metadata: parsed as Record<string, unknown>,
      }).catch(err => logger.error('Audit log error:', err));

      res.json({ success: true });
    } catch (err) {
      if (err instanceof z.ZodError) {
        return res.status(400).json({ error: 'Validation error', details: err.errors });
      }
      logger.error('Failed to update organization:', err);
      res.status(500).json({ error: 'Failed to update organization' });
    }
  }
);

// Soft-deactivate organization
staffOrganizationsRouter.delete(
  '/:id',
  requirePermission('content.manage_organizations'),
  async (req: Request, res: Response) => {
    try {
      const org = await db.queryOne<{ id: number; name: string }>(
        `SELECT id, name FROM organizations WHERE id = ?`,
        [req.params.id]
      );

      if (!org) {
        return res.status(404).json({ error: 'Organization not found' });
      }

      await db.execute(
        `UPDATE organizations SET is_active = FALSE WHERE id = ?`,
        [org.id]
      );

      await logAuditAction({
        actorId: req.player!.id,
        actionKey: 'organization.deactivated',
        description: `Deactivated organization "${org.name}"`,
        targetType: 'organization',
        targetId: org.id,
      }).catch(err => logger.error('Audit log error:', err));

      res.json({ success: true });
    } catch (err) {
      logger.error('Failed to deactivate organization:', err);
      res.status(500).json({ error: 'Failed to deactivate organization' });
    }
  }
);

// Add member to organization
const addMemberSchema = z.object({
  characterId: z.number().int().positive(),
  rank: z.string().max(50).nullable().optional(),
});

staffOrganizationsRouter.post(
  '/:id/members',
  requirePermission('content.manage_organizations'),
  async (req: Request, res: Response) => {
    try {
      const parsed = addMemberSchema.parse(req.body);

      const org = await db.queryOne<{ id: number; name: string }>(
        `SELECT id, name FROM organizations WHERE id = ?`,
        [req.params.id]
      );

      if (!org) {
        return res.status(404).json({ error: 'Organization not found' });
      }

      const character = await db.queryOne<{ id: number; name: string }>(
        `SELECT id, name FROM characters WHERE id = ?`,
        [parsed.characterId]
      );

      if (!character) {
        return res.status(404).json({ error: 'Character not found' });
      }

      const id = await db.insert(
        `INSERT INTO organization_members (organization_id, character_id, rank)
         VALUES (?, ?, ?)`,
        [org.id, parsed.characterId, parsed.rank ?? null]
      );

      await logAuditAction({
        actorId: req.player!.id,
        actionKey: 'organization.member_added',
        description: `Added ${character.name} to "${org.name}"`,
        targetType: 'organization',
        targetId: org.id,
        metadata: { characterId: parsed.characterId, rank: parsed.rank ?? null },
      }).catch(err => logger.error('Audit log error:', err));

      res.status(201).json({ success: true, id });
    } catch (err) {
      if (err instanceof z.ZodError) {
        return res.status(400).json({ error: 'Validation error', details: err.errors });
      }
      logger.error('Failed to add organization member:', err);
      res.status(500).json({ error: 'Failed to add member' });
    }
  }
);

// Remove member from organization
staffOrganizationsRouter.delete(
  '/:id/members/:characterId',
  requirePermission('content.manage_organizations'),
  async (req: Request, res: Response) => {
    try {
      const org = await db.queryOne<{ id: number; name: string }>(
        `SELECT id, name FROM organizations WHERE id = ?`,
        [req.params.id]
      );

      if (!org) {
        return res.status(404).json({ error: 'Organization not found' });
      }

      const member = await db.queryOne<{ id: number; character_id: number }>(
        `SELECT om.id, om.character_id FROM organization_members om
         WHERE om.organization_id = ? AND om.character_id = ?`,
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
        `DELETE FROM organization_members WHERE id = ?`,
        [member.id]
      );

      await logAuditAction({
        actorId: req.player!.id,
        actionKey: 'organization.member_removed',
        description: `Removed ${character?.name ?? 'unknown'} from "${org.name}"`,
        targetType: 'organization',
        targetId: org.id,
        metadata: { characterId: member.character_id },
      }).catch(err => logger.error('Audit log error:', err));

      res.json({ success: true });
    } catch (err) {
      logger.error('Failed to remove organization member:', err);
      res.status(500).json({ error: 'Failed to remove member' });
    }
  }
);
