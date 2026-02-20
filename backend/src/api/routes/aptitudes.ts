import { Router, Request, Response } from 'express';
import { db } from '../../db/connection.js';
import { logger } from '../../utils/logger.js';
import { calculateMaxHealth } from '../../utils/formulas.js';
import { getRetainerAptCap } from '../../retainers/retainer-manager.js';

export const aptitudesRouter = Router();

const VALID_APTITUDES = ['prowess', 'fortitude', 'command', 'cunning', 'stewardship', 'presence', 'lore', 'faith'] as const;
const POINT_BUY_TOTAL = 28;
const CREATION_MIN = 2;
const CREATION_MAX = 7;
const GAMEPLAY_MAX = 10;

// Get character aptitudes
aptitudesRouter.get('/character/:characterId', async (req: Request, res: Response) => {
  try {
    const aptitudes = await db.query(`
      SELECT * FROM character_aptitudes
      WHERE character_id = ?
      ORDER BY FIELD(aptitude_key, 'prowess','fortitude','command','cunning','stewardship','presence','lore','faith')
    `, [req.params.characterId]);

    res.json(aptitudes);
  } catch (error) {
    logger.error('Failed to fetch aptitudes:', error);
    res.status(500).json({ error: 'Failed to fetch aptitudes' });
  }
});

// Initialize aptitudes for a new character (point-buy)
aptitudesRouter.post('/character/:characterId/init', async (req: Request, res: Response) => {
  try {
    const { aptitudes } = req.body;

    if (!aptitudes || typeof aptitudes !== 'object') {
      return res.status(400).json({ error: 'Aptitudes object required' });
    }

    // Validate all 8 aptitudes are present
    for (const key of VALID_APTITUDES) {
      if (aptitudes[key] === undefined) {
        return res.status(400).json({ error: `Missing aptitude: ${key}` });
      }
      const val = aptitudes[key];
      if (typeof val !== 'number' || !Number.isInteger(val)) {
        return res.status(400).json({ error: `Aptitude ${key} must be an integer` });
      }
      if (val < CREATION_MIN || val > CREATION_MAX) {
        return res.status(400).json({ error: `Aptitude ${key} must be between ${CREATION_MIN} and ${CREATION_MAX}` });
      }
    }

    // Validate point-buy total
    const total = VALID_APTITUDES.reduce((sum, key) => sum + aptitudes[key], 0);
    if (total !== POINT_BUY_TOTAL) {
      return res.status(400).json({
        error: `Point total must equal ${POINT_BUY_TOTAL}, got ${total}`,
      });
    }

    // Check character exists
    const character = await db.queryOne(`SELECT id FROM characters WHERE id = ?`, [req.params.characterId]);
    if (!character) {
      return res.status(404).json({ error: 'Character not found' });
    }

    // Check aptitudes not already initialized
    const existing = await db.queryOne(`
      SELECT id FROM character_aptitudes WHERE character_id = ? LIMIT 1
    `, [req.params.characterId]);
    if (existing) {
      return res.status(409).json({ error: 'Aptitudes already initialized for this character' });
    }

    await db.transaction(async (conn) => {
      // Insert all 8 aptitudes
      for (const key of VALID_APTITUDES) {
        await conn.query(`
          INSERT INTO character_aptitudes (character_id, aptitude_key, base_value, current_value)
          VALUES (?, ?, ?, ?)
        `, [req.params.characterId, key, aptitudes[key], aptitudes[key]]);
      }

      // Derive max_health from Fortitude: 20 + (fortitude × 10)
      const maxHealth = calculateMaxHealth(aptitudes.fortitude);
      await conn.query(`
        UPDATE character_vitals SET max_health = ?, health = LEAST(health, ?)
        WHERE character_id = ?
      `, [maxHealth, maxHealth, req.params.characterId]);
    });

    const result = await db.query(`
      SELECT * FROM character_aptitudes
      WHERE character_id = ?
      ORDER BY FIELD(aptitude_key, 'prowess','fortitude','command','cunning','stewardship','presence','lore','faith')
    `, [req.params.characterId]);

    res.status(201).json(result);
  } catch (error) {
    logger.error('Failed to initialize aptitudes:', error);
    res.status(500).json({ error: 'Failed to initialize aptitudes' });
  }
});

// Update a single aptitude (gameplay progression)
aptitudesRouter.patch('/character/:characterId', async (req: Request, res: Response) => {
  try {
    const { aptitude_key, current_value } = req.body;

    if (!aptitude_key || !VALID_APTITUDES.includes(aptitude_key)) {
      return res.status(400).json({ error: `Invalid aptitude key. Must be one of: ${VALID_APTITUDES.join(', ')}` });
    }

    // Check if character is a retainer — use lower aptitude cap
    const charRow = await db.queryOne<{ retainer_tier: number | null }>(
      'SELECT retainer_tier FROM characters WHERE id = ?',
      [req.params.characterId],
    );
    const maxApt = charRow?.retainer_tier != null ? getRetainerAptCap(charRow.retainer_tier) : GAMEPLAY_MAX;

    if (typeof current_value !== 'number' || !Number.isInteger(current_value) || current_value < 1 || current_value > maxApt) {
      return res.status(400).json({ error: `Value must be an integer between 1 and ${maxApt}` });
    }

    const existing = await db.queryOne(`
      SELECT id FROM character_aptitudes WHERE character_id = ? AND aptitude_key = ?
    `, [req.params.characterId, aptitude_key]);

    if (!existing) {
      return res.status(404).json({ error: 'Aptitude not found for this character' });
    }

    await db.execute(`
      UPDATE character_aptitudes SET current_value = ? WHERE character_id = ? AND aptitude_key = ?
    `, [current_value, req.params.characterId, aptitude_key]);

    // If Fortitude changed, recalculate max_health
    if (aptitude_key === 'fortitude') {
      const maxHealth = calculateMaxHealth(current_value);
      await db.execute(`
        UPDATE character_vitals SET max_health = ?, health = LEAST(health, ?)
        WHERE character_id = ?
      `, [maxHealth, maxHealth, req.params.characterId]);
    }

    const aptitudes = await db.query(`
      SELECT * FROM character_aptitudes
      WHERE character_id = ?
      ORDER BY FIELD(aptitude_key, 'prowess','fortitude','command','cunning','stewardship','presence','lore','faith')
    `, [req.params.characterId]);

    res.json(aptitudes);
  } catch (error) {
    logger.error('Failed to update aptitude:', error);
    res.status(500).json({ error: 'Failed to update aptitude' });
  }
});
