import { Router, Request, Response } from 'express';
import { db } from '../../db/connection.js';

export const housesRouter = Router();

// List all non-extinct houses (for creation form dropdown)
housesRouter.get('/', async (_req: Request, res: Response) => {
  try {
    const houses = await db.query(
      `SELECT h.id, h.name, h.motto, h.sigil_url, h.seat, h.region_id,
              h.is_great_house, h.is_royal_house, h.head_character_id,
              r.name AS region_name
       FROM houses h
       LEFT JOIN regions r ON h.region_id = r.id
       WHERE h.is_extinct = FALSE
       ORDER BY h.is_royal_house DESC, h.is_great_house DESC, h.name`
    );
    res.json({ houses });
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch houses' });
  }
});

// Get single house detail
housesRouter.get('/:id', async (req: Request, res: Response) => {
  try {
    const house = await db.queryOne(
      `SELECT h.*, r.name AS region_name
       FROM houses h
       LEFT JOIN regions r ON h.region_id = r.id
       WHERE h.id = ?`,
      [req.params.id]
    );
    if (!house) {
      return res.status(404).json({ error: 'House not found' });
    }
    res.json({ house });
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch house' });
  }
});

// List all regions
housesRouter.get('/regions/list', async (_req: Request, res: Response) => {
  try {
    const regions = await db.query(
      `SELECT r.id, r.name, r.description, r.banner_url,
              r.ruling_house_id, h.name AS ruling_house_name
       FROM regions r
       LEFT JOIN houses h ON r.ruling_house_id = h.id
       ORDER BY r.name`
    );
    res.json({ regions });
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch regions' });
  }
});
