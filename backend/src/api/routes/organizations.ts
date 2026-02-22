import { Router, Request, Response } from 'express';
import { db } from '../../db/connection.js';
import { logger } from '../../utils/logger.js';
import { requireAuth } from '../middleware/auth.js';

export const organizationsRouter = Router();

organizationsRouter.use(requireAuth());

// List all active organizations (for character creation dropdown + social viewer)
organizationsRouter.get('/', async (_req: Request, res: Response) => {
  try {
    const organizations = await db.query(
      `SELECT o.id, o.name, o.org_type, o.description, o.sigil_url,
              o.region_id, o.leader_character_id, o.requires_approval,
              r.name AS region_name,
              lc.name AS leader_name,
              (SELECT COUNT(*) FROM organization_members om WHERE om.organization_id = o.id) AS member_count
       FROM organizations o
       LEFT JOIN regions r ON o.region_id = r.id
       LEFT JOIN characters lc ON o.leader_character_id = lc.id
       WHERE o.is_active = TRUE
       ORDER BY o.org_type, o.name`
    );
    res.json({ organizations });
  } catch (err) {
    logger.error('Failed to fetch organizations:', err);
    res.status(500).json({ error: 'Failed to fetch organizations' });
  }
});

// Get single organization detail with member list
organizationsRouter.get('/:id', async (req: Request, res: Response) => {
  try {
    const organization = await db.queryOne(
      `SELECT o.*, r.name AS region_name, lc.name AS leader_name
       FROM organizations o
       LEFT JOIN regions r ON o.region_id = r.id
       LEFT JOIN characters lc ON o.leader_character_id = lc.id
       WHERE o.id = ? AND o.is_active = TRUE`,
      [req.params.id]
    );

    if (!organization) {
      return res.status(404).json({ error: 'Organization not found' });
    }

    const members = await db.query(
      `SELECT om.id, om.character_id, om.rank, om.joined_at,
              c.name AS character_name, c.portrait_url, c.title, c.level
       FROM organization_members om
       JOIN characters c ON om.character_id = c.id
       WHERE om.organization_id = ?
       ORDER BY om.joined_at ASC`,
      [req.params.id]
    );

    res.json({ organization, members });
  } catch (err) {
    logger.error('Failed to fetch organization:', err);
    res.status(500).json({ error: 'Failed to fetch organization' });
  }
});
