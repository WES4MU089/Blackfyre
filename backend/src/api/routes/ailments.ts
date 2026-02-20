/**
 * Ailment & tending API routes.
 *
 * POST /:characterId/tend   — Apply tending (Lore check + ingredients) to a wounded/infected character
 * GET  /:characterId        — Get active ailments for a character
 */

import { Router, Request, Response } from 'express';
import { db } from '../../db/connection.js';
import { logger } from '../../utils/logger.js';
import { rollCombatPool } from '../../combat/dice.js';
import { generateTendingNarrative } from '../../combat/combat-narrator.js';

export const ailmentsRouter = Router();

// Configurable tending values (could move to DB config table later)
const IMMUNITY_BOOST_PER_SUCCESS = 3600; // 1 hour per success
const HARM_TERMINAL_ACCELERATION = 7200; // 2 hours accelerated on critical failure

/**
 * GET /:characterId — Get active ailments for a character.
 */
ailmentsRouter.get('/:characterId', async (req: Request, res: Response) => {
  try {
    const ailments = await db.query(`
      SELECT ca.id, ca.current_stage, ca.terminal_expires_at, ca.immunity_expires_at,
             ca.is_terminal_paused, ca.source, ca.created_at,
             ad.ailment_key, ad.name AS ailment_name, ad.description,
             ast.name AS stage_name, ast.symptoms
      FROM character_ailments ca
      JOIN ailment_definitions ad ON ca.ailment_id = ad.id
      JOIN ailment_stages ast ON ast.ailment_id = ad.id AND ast.stage_number = ca.current_stage
      WHERE ca.character_id = ?
      ORDER BY ca.created_at
    `, [req.params.characterId]);

    // Also include wound info
    const character = await db.queryOne<{
      wound_severity: string;
      wound_received_at: string | null;
      wound_heals_at: string | null;
    }>(`
      SELECT wound_severity, wound_received_at, wound_heals_at
      FROM characters WHERE id = ?
    `, [req.params.characterId]);

    res.json({
      woundSeverity: character?.wound_severity ?? 'healthy',
      woundReceivedAt: character?.wound_received_at ?? null,
      woundHealsAt: character?.wound_heals_at ?? null,
      ailments: ailments.map((a: Record<string, unknown>) => ({
        id: a.id,
        ailmentKey: a.ailment_key,
        name: a.ailment_name,
        description: a.description,
        currentStage: a.current_stage,
        stageName: a.stage_name,
        terminalExpiresAt: a.terminal_expires_at,
        immunityExpiresAt: a.immunity_expires_at,
        isTerminalPaused: a.is_terminal_paused,
        symptoms: typeof a.symptoms === 'string' ? JSON.parse(a.symptoms) : a.symptoms ?? [],
        source: a.source,
      })),
    });
  } catch (error) {
    logger.error('Failed to fetch ailments:', error);
    res.status(500).json({ error: 'Failed to fetch ailments' });
  }
});

/**
 * POST /:characterId/tend — Apply tending to a character.
 *
 * Body: { tenderId: number, ingredientInventoryIds: number[] }
 *
 * Performs a Lore check for the tender. On success, boosts immunity clock.
 * On failure, risk of harm (accelerate terminal clock or waste ingredients).
 */
ailmentsRouter.post('/:characterId/tend', async (req: Request, res: Response) => {
  try {
    const patientId = Number(req.params.characterId);
    const { tenderId, ingredientInventoryIds } = req.body;

    if (!tenderId || !Array.isArray(ingredientInventoryIds) || ingredientInventoryIds.length === 0) {
      return res.status(400).json({ error: 'tenderId and ingredientInventoryIds are required' });
    }

    // Validate patient has wounds or active ailment
    const patient = await db.queryOne<{
      wound_severity: string;
      death_state: string;
      name: string;
    }>(`
      SELECT wound_severity, death_state, name FROM characters WHERE id = ?
    `, [patientId]);

    if (!patient) return res.status(404).json({ error: 'Patient not found' });
    if (patient.death_state === 'dead') return res.status(400).json({ error: 'Patient is dead' });
    if (patient.wound_severity === 'healthy') {
      // Check for active ailments even without wounds
      const hasAilment = await db.queryOne(`
        SELECT 1 FROM character_ailments WHERE character_id = ? LIMIT 1
      `, [patientId]);
      if (!hasAilment) {
        return res.status(400).json({ error: 'Patient has no wounds or ailments to tend' });
      }
    }

    // Load tender's Lore aptitude
    const tenderApt = await db.queryOne<{ current_value: number }>(`
      SELECT current_value FROM character_aptitudes
      WHERE character_id = ? AND aptitude_key = 'lore'
    `, [tenderId]);
    const lore = tenderApt?.current_value ?? 1;

    const tenderChar = await db.queryOne<{ name: string }>(`
      SELECT name FROM characters WHERE id = ?
    `, [tenderId]);
    const tenderName = tenderChar?.name ?? 'Unknown';

    // Validate tender has the specified ingredients
    const ingredients = await db.query<{ id: number; item_id: number; quantity: number }>(`
      SELECT id, item_id, quantity FROM character_inventory
      WHERE id IN (${ingredientInventoryIds.map(() => '?').join(',')})
        AND character_id = ?
    `, [...ingredientInventoryIds, tenderId]);

    if (ingredients.length !== ingredientInventoryIds.length) {
      return res.status(400).json({ error: 'Some ingredients not found in tender\'s inventory' });
    }

    // Roll Lore check
    const lorePool = rollCombatPool(lore);
    const successes = lorePool.successes;
    const succeeded = successes >= 1;

    let causedHarm = false;
    let immunityBoostApplied = 0;
    let terminalAcceleration = 0;

    // Consume ingredients regardless of success
    for (const inv of ingredients) {
      if (inv.quantity > 1) {
        await db.execute(`UPDATE character_inventory SET quantity = quantity - 1 WHERE id = ?`, [inv.id]);
      } else {
        await db.execute(`DELETE FROM character_inventory WHERE id = ?`, [inv.id]);
      }
    }

    if (succeeded) {
      // Boost immunity clock on active infection
      const ailment = await db.queryOne<{ id: number }>(`
        SELECT ca.id FROM character_ailments ca
        JOIN ailment_definitions ad ON ca.ailment_id = ad.id
        WHERE ca.character_id = ? AND ad.ailment_key = 'infection'
      `, [patientId]);

      if (ailment) {
        immunityBoostApplied = successes * IMMUNITY_BOOST_PER_SUCCESS;
        await db.execute(`
          UPDATE character_ailments
          SET immunity_expires_at = DATE_SUB(immunity_expires_at, INTERVAL ? SECOND)
          WHERE id = ?
        `, [immunityBoostApplied, ailment.id]);
      } else {
        // No infection yet — tending speeds up wound healing or delays infection onset
        // For light wounds: reduce wound_heals_at
        if (patient.wound_severity === 'light') {
          const boostSeconds = successes * IMMUNITY_BOOST_PER_SUCCESS;
          await db.execute(`
            UPDATE characters
            SET wound_heals_at = DATE_SUB(wound_heals_at, INTERVAL ? SECOND)
            WHERE id = ? AND wound_heals_at IS NOT NULL
          `, [boostSeconds, patientId]);
        }
        // For serious+ wounds without infection: push back the infection onset
        // by updating wound_received_at forward (making the wound "newer")
        if (['serious', 'severe', 'grave'].includes(patient.wound_severity)) {
          const delaySeconds = successes * IMMUNITY_BOOST_PER_SUCCESS;
          await db.execute(`
            UPDATE characters
            SET wound_received_at = DATE_ADD(wound_received_at, INTERVAL ? SECOND)
            WHERE id = ?
          `, [delaySeconds, patientId]);
        }
      }
    } else {
      // Failed Lore check — 50% chance of harm
      causedHarm = Math.random() < 0.5;

      if (causedHarm) {
        const ailment = await db.queryOne<{ id: number }>(`
          SELECT ca.id FROM character_ailments ca
          JOIN ailment_definitions ad ON ca.ailment_id = ad.id
          WHERE ca.character_id = ? AND ad.ailment_key = 'infection'
        `, [patientId]);

        if (ailment) {
          terminalAcceleration = HARM_TERMINAL_ACCELERATION;
          await db.execute(`
            UPDATE character_ailments
            SET terminal_expires_at = DATE_SUB(terminal_expires_at, INTERVAL ? SECOND)
            WHERE id = ? AND is_terminal_paused = FALSE
          `, [terminalAcceleration, ailment.id]);
        }
      }
    }

    const narrative = generateTendingNarrative(tenderName, patient.name, succeeded, causedHarm);

    res.json({
      success: succeeded,
      loreRoll: {
        pool: lorePool.effectivePool,
        dice: lorePool.dice,
        successes: lorePool.successes,
      },
      causedHarm,
      immunityBoostApplied,
      terminalAcceleration,
      narrative,
    });
  } catch (error) {
    logger.error('Failed to process tending:', error);
    res.status(500).json({ error: 'Failed to process tending' });
  }
});
