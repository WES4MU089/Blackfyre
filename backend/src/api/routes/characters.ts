import { Router, Request, Response } from 'express';
import { db } from '../../db/connection.js';
import { logger } from '../../utils/logger.js';
import { z } from 'zod';

export const charactersRouter = Router();

// Validation schemas
const createCharacterSchema = z.object({
  player_id: z.number().int().positive(),
  name: z.string().min(1).max(100),
  backstory: z.string().optional(),
  portrait_url: z.string().url().optional(),
});

// Get all characters for a player
charactersRouter.get('/player/:playerId', async (req: Request, res: Response) => {
  try {
    const characters = await db.query(`
      SELECT c.*, cv.health, cv.max_health, cv.stamina, cv.hunger, cv.thirst,
             cf.cash, cf.bank
      FROM characters c
      LEFT JOIN character_vitals cv ON c.id = cv.character_id
      LEFT JOIN character_finances cf ON c.id = cf.character_id
      WHERE c.player_id = ? AND c.owner_character_id IS NULL
      ORDER BY c.created_at DESC
    `, [req.params.playerId]);
    res.json(characters);
  } catch (error) {
    logger.error('Failed to fetch characters:', error);
    res.status(500).json({ error: 'Failed to fetch characters' });
  }
});

// Get character by ID with full data
charactersRouter.get('/:id', async (req: Request, res: Response) => {
  try {
    const character = await db.queryOne(`
      SELECT c.*, cv.health, cv.max_health, cv.armor, cv.max_armor, 
             cv.stamina, cv.max_stamina, cv.hunger, cv.thirst, cv.stress, cv.oxygen,
             cf.cash, cf.bank, cf.crypto, cf.dirty_money
      FROM characters c
      LEFT JOIN character_vitals cv ON c.id = cv.character_id
      LEFT JOIN character_finances cf ON c.id = cf.character_id
      WHERE c.id = ?
    `, [req.params.id]);

    if (!character) {
      return res.status(404).json({ error: 'Character not found' });
    }

    // Get active jobs
    const jobs = await db.query(`
      SELECT cj.*, j.name as job_name, j.category as job_category,
             jg.name as grade_name, jg.salary
      FROM character_jobs cj
      JOIN jobs j ON cj.job_id = j.id
      LEFT JOIN job_grades jg ON j.id = jg.job_id AND cj.grade = jg.grade
      WHERE cj.character_id = ?
    `, [req.params.id]);

    // Get active status effects
    const effects = await db.query(`
      SELECT cse.*, se.name, se.effect_type, se.icon_url
      FROM character_status_effects cse
      JOIN status_effects se ON cse.effect_id = se.id
      WHERE cse.character_id = ? 
        AND (cse.expires_at IS NULL OR cse.expires_at > NOW())
    `, [req.params.id]);

    res.json({
      ...character,
      jobs,
      activeEffects: effects,
    });
  } catch (error) {
    logger.error('Failed to fetch character:', error);
    res.status(500).json({ error: 'Failed to fetch character' });
  }
});

// Create new character
charactersRouter.post('/', async (req: Request, res: Response) => {
  try {
    const data = createCharacterSchema.parse(req.body);

    // Check player exists
    const player = await db.queryOne(`SELECT id FROM players WHERE id = ?`, [data.player_id]);
    if (!player) {
      return res.status(404).json({ error: 'Player not found' });
    }

    // Create character with transaction
    const characterId = await db.transaction(async (conn) => {
      // Insert character
      const result = await conn.query(`
        INSERT INTO characters (player_id, name, backstory, portrait_url)
        VALUES (?, ?, ?, ?)
      `, [data.player_id, data.name, data.backstory || null, data.portrait_url || null]);

      const charId = Number(result.insertId);

      // Create default vitals
      await conn.query(`
        INSERT INTO character_vitals (character_id) VALUES (?)
      `, [charId]);

      // Create default finances
      await conn.query(`
        INSERT INTO character_finances (character_id) VALUES (?)
      `, [charId]);

      // Assign default job (smallfolk)
      const defaultJob = await conn.query(`SELECT id FROM jobs WHERE job_key = 'smallfolk'`);
      if (defaultJob.length > 0) {
        await conn.query(`
          INSERT INTO character_jobs (character_id, job_id, is_primary) VALUES (?, ?, TRUE)
        `, [charId, defaultJob[0].id]);
      }

      // Initialize default aptitudes (all at base 3)
      const defaultAptitudes = ['prowess', 'fortitude', 'command', 'cunning', 'stewardship', 'presence', 'lore', 'faith'];
      for (const key of defaultAptitudes) {
        await conn.query(`
          INSERT INTO character_aptitudes (character_id, aptitude_key, base_value, current_value)
          VALUES (?, ?, 3, 3)
        `, [charId, key]);
      }

      // Set max_health based on default Fortitude (3): 10 + (3 × 5) = 25
      await conn.query(`
        UPDATE character_vitals SET max_health = 25, health = 25 WHERE character_id = ?
      `, [charId]);

      return charId;
    });

    const character = await db.queryOne(`SELECT * FROM characters WHERE id = ?`, [characterId]);
    res.status(201).json(character);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: 'Validation error', details: error.errors });
    }
    logger.error('Failed to create character:', error);
    res.status(500).json({ error: 'Failed to create character' });
  }
});

// Update character
charactersRouter.patch('/:id', async (req: Request, res: Response) => {
  try {
    const { name, backstory, portrait_url, is_active } = req.body;
    const updates: string[] = [];
    const values: unknown[] = [];

    if (name !== undefined) { updates.push('name = ?'); values.push(name); }
    if (backstory !== undefined) { updates.push('backstory = ?'); values.push(backstory); }
    if (portrait_url !== undefined) { updates.push('portrait_url = ?'); values.push(portrait_url); }
    if (is_active !== undefined) { updates.push('is_active = ?'); values.push(is_active); }

    if (updates.length === 0) {
      return res.status(400).json({ error: 'No fields to update' });
    }

    values.push(req.params.id);
    await db.execute(`UPDATE characters SET ${updates.join(', ')} WHERE id = ?`, values);

    const character = await db.queryOne(`SELECT * FROM characters WHERE id = ?`, [req.params.id]);
    res.json(character);
  } catch (error) {
    logger.error('Failed to update character:', error);
    res.status(500).json({ error: 'Failed to update character' });
  }
});

// Delete character
charactersRouter.delete('/:id', async (req: Request, res: Response) => {
  try {
    const affected = await db.execute(`DELETE FROM characters WHERE id = ?`, [req.params.id]);
    
    if (affected === 0) {
      return res.status(404).json({ error: 'Character not found' });
    }

    res.json({ success: true, message: 'Character deleted' });
  } catch (error) {
    logger.error('Failed to delete character:', error);
    res.status(500).json({ error: 'Failed to delete character' });
  }
});

// Update play time
charactersRouter.post('/:id/playtime', async (req: Request, res: Response) => {
  try {
    const { seconds } = req.body;
    
    if (typeof seconds !== 'number' || seconds < 0) {
      return res.status(400).json({ error: 'Invalid seconds value' });
    }

    await db.execute(`
      UPDATE characters SET played_time = played_time + ? WHERE id = ?
    `, [seconds, req.params.id]);

    res.json({ success: true });
  } catch (error) {
    logger.error('Failed to update playtime:', error);
    res.status(500).json({ error: 'Failed to update playtime' });
  }
});
