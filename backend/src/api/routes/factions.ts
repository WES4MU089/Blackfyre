import { Router, Request, Response } from 'express';
import { db } from '../../db/connection.js';
import { logger } from '../../utils/logger.js';
import { requireAuth } from '../middleware/auth.js';

export const factionsRouter = Router();

factionsRouter.use(requireAuth());

// List active factions with public member counts
factionsRouter.get('/', async (_req: Request, res: Response) => {
  try {
    const factions = await db.query(
      `SELECT f.id, f.name, f.description, f.banner_url,
              f.leader_character_id,
              lc.name AS leader_name,
              (SELECT COUNT(*) FROM faction_members fm WHERE fm.faction_id = f.id AND fm.declared_publicly = TRUE) AS public_member_count
       FROM factions f
       LEFT JOIN characters lc ON f.leader_character_id = lc.id
       WHERE f.is_active = TRUE
       ORDER BY f.name`
    );
    res.json({ factions });
  } catch (err) {
    logger.error('Failed to fetch factions:', err);
    res.status(500).json({ error: 'Failed to fetch factions' });
  }
});

// Get faction detail with publicly-declared members only
factionsRouter.get('/:id', async (req: Request, res: Response) => {
  try {
    const faction = await db.queryOne(
      `SELECT f.*, lc.name AS leader_name
       FROM factions f
       LEFT JOIN characters lc ON f.leader_character_id = lc.id
       WHERE f.id = ? AND f.is_active = TRUE`,
      [req.params.id]
    );

    if (!faction) {
      return res.status(404).json({ error: 'Faction not found' });
    }

    const members = await db.query(
      `SELECT fm.character_id, fm.joined_at,
              c.name AS character_name, c.portrait_url, c.title,
              h.name AS house_name
       FROM faction_members fm
       JOIN characters c ON fm.character_id = c.id
       LEFT JOIN houses h ON c.house_id = h.id
       WHERE fm.faction_id = ? AND fm.declared_publicly = TRUE
       ORDER BY fm.joined_at ASC`,
      [req.params.id]
    );

    res.json({ faction, members });
  } catch (err) {
    logger.error('Failed to fetch faction:', err);
    res.status(500).json({ error: 'Failed to fetch faction' });
  }
});
