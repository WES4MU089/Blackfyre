import { Router, Request, Response } from 'express';
import { db } from '../../db/connection.js';
import { logger } from '../../utils/logger.js';

export const vitalsRouter = Router();

// Get character vitals
vitalsRouter.get('/:characterId', async (req: Request, res: Response) => {
  try {
    const vitals = await db.queryOne(`
      SELECT * FROM character_vitals WHERE character_id = ?
    `, [req.params.characterId]);

    if (!vitals) {
      return res.status(404).json({ error: 'Vitals not found' });
    }

    res.json(vitals);
  } catch (error) {
    logger.error('Failed to fetch vitals:', error);
    res.status(500).json({ error: 'Failed to fetch vitals' });
  }
});

// Update character vitals
vitalsRouter.patch('/:characterId', async (req: Request, res: Response) => {
  try {
    const { health, max_health, armor, max_armor, stamina, max_stamina,
            hunger, thirst, stress, oxygen } = req.body;

    const updates: string[] = [];
    const values: unknown[] = [];

    if (health !== undefined) { updates.push('health = ?'); values.push(Math.max(0, Math.min(health, req.body.max_health || 100))); }
    if (max_health !== undefined) { updates.push('max_health = ?'); values.push(max_health); }
    if (armor !== undefined) { updates.push('armor = ?'); values.push(Math.max(0, Math.min(armor, req.body.max_armor || 100))); }
    if (max_armor !== undefined) { updates.push('max_armor = ?'); values.push(max_armor); }
    if (stamina !== undefined) { updates.push('stamina = ?'); values.push(Math.max(0, Math.min(stamina, req.body.max_stamina || 100))); }
    if (max_stamina !== undefined) { updates.push('max_stamina = ?'); values.push(max_stamina); }
    if (hunger !== undefined) { updates.push('hunger = ?'); values.push(Math.max(0, Math.min(hunger, 100))); }
    if (thirst !== undefined) { updates.push('thirst = ?'); values.push(Math.max(0, Math.min(thirst, 100))); }
    if (stress !== undefined) { updates.push('stress = ?'); values.push(Math.max(0, Math.min(stress, 100))); }
    if (oxygen !== undefined) { updates.push('oxygen = ?'); values.push(Math.max(0, Math.min(oxygen, 100))); }

    if (updates.length === 0) {
      return res.status(400).json({ error: 'No fields to update' });
    }

    values.push(req.params.characterId);
    await db.execute(`
      UPDATE character_vitals SET ${updates.join(', ')} WHERE character_id = ?
    `, values);

    const vitals = await db.queryOne(`SELECT * FROM character_vitals WHERE character_id = ?`, [req.params.characterId]);
    res.json(vitals);
  } catch (error) {
    logger.error('Failed to update vitals:', error);
    res.status(500).json({ error: 'Failed to update vitals' });
  }
});

// Apply damage to character
vitalsRouter.post('/:characterId/damage', async (req: Request, res: Response) => {
  try {
    const { amount, damageType = 'physical', bypassArmor = false } = req.body;

    if (typeof amount !== 'number' || amount < 0) {
      return res.status(400).json({ error: 'Invalid damage amount' });
    }

    const vitals = await db.queryOne<{ health: number; armor: number }>(`
      SELECT health, armor FROM character_vitals WHERE character_id = ?
    `, [req.params.characterId]);

    if (!vitals) {
      return res.status(404).json({ error: 'Character not found' });
    }

    let remainingDamage = amount;
    let newArmor = vitals.armor;
    let newHealth = vitals.health;

    // Calculate damage through armor if applicable
    if (!bypassArmor && vitals.armor > 0) {
      const armorAbsorbed = Math.min(vitals.armor, remainingDamage * 0.7);
      newArmor = Math.max(0, vitals.armor - armorAbsorbed);
      remainingDamage = remainingDamage * 0.3 + Math.max(0, remainingDamage * 0.7 - vitals.armor);
    }

    newHealth = Math.max(0, vitals.health - remainingDamage);

    await db.execute(`
      UPDATE character_vitals SET health = ?, armor = ? WHERE character_id = ?
    `, [newHealth, newArmor, req.params.characterId]);

    const updatedVitals = await db.queryOne(`SELECT * FROM character_vitals WHERE character_id = ?`, [req.params.characterId]);
    res.json({
      ...updatedVitals,
      damageType,
      damageApplied: amount,
      armorAbsorbed: vitals.armor - newArmor,
      healthLost: vitals.health - newHealth,
      isDead: newHealth <= 0,
    });
  } catch (error) {
    logger.error('Failed to apply damage:', error);
    res.status(500).json({ error: 'Failed to apply damage' });
  }
});

// Heal character
vitalsRouter.post('/:characterId/heal', async (req: Request, res: Response) => {
  try {
    const { amount, healType = 'health' } = req.body;

    if (typeof amount !== 'number' || amount < 0) {
      return res.status(400).json({ error: 'Invalid heal amount' });
    }

    const vitals = await db.queryOne<{ health: number; max_health: number; armor: number; max_armor: number }>(`
      SELECT health, max_health, armor, max_armor FROM character_vitals WHERE character_id = ?
    `, [req.params.characterId]);

    if (!vitals) {
      return res.status(404).json({ error: 'Character not found' });
    }

    if (healType === 'health') {
      const newHealth = Math.min(vitals.max_health, vitals.health + amount);
      await db.execute(`UPDATE character_vitals SET health = ? WHERE character_id = ?`, [newHealth, req.params.characterId]);
    } else if (healType === 'armor') {
      const newArmor = Math.min(vitals.max_armor, vitals.armor + amount);
      await db.execute(`UPDATE character_vitals SET armor = ? WHERE character_id = ?`, [newArmor, req.params.characterId]);
    }

    const updatedVitals = await db.queryOne(`SELECT * FROM character_vitals WHERE character_id = ?`, [req.params.characterId]);
    res.json(updatedVitals);
  } catch (error) {
    logger.error('Failed to heal character:', error);
    res.status(500).json({ error: 'Failed to heal character' });
  }
});

// Revive character (restore to defaults)
vitalsRouter.post('/:characterId/revive', async (req: Request, res: Response) => {
  try {
    await db.execute(`
      UPDATE character_vitals 
      SET health = max_health * 0.25, armor = 0, stamina = max_stamina * 0.5,
          hunger = 50, thirst = 50, stress = 75, oxygen = 100
      WHERE character_id = ?
    `, [req.params.characterId]);

    const vitals = await db.queryOne(`SELECT * FROM character_vitals WHERE character_id = ?`, [req.params.characterId]);
    res.json({ ...vitals, revived: true });
  } catch (error) {
    logger.error('Failed to revive character:', error);
    res.status(500).json({ error: 'Failed to revive character' });
  }
});
