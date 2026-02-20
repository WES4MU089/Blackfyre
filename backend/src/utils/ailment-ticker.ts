/**
 * Background ailment ticker — replaces death-timer.ts.
 *
 * Runs every 60 seconds and handles:
 *   A. Wound infection onset (untended wounds develop infection)
 *   B. Terminal clock progression (ailments worsen)
 *   C. Immunity clock improvement (ailments improve / cure)
 *   D. Light wound self-heal
 *
 * Safe to call once at server startup.
 */

import { db } from '../db/connection.js';
import { logger } from './logger.js';

const TICK_INTERVAL_MS = 60_000;

/**
 * Start the periodic ailment ticker.
 */
export function startAilmentTicker(): void {
  setInterval(async () => {
    try {
      await tickWoundInfectionOnset();
      await tickTerminalProgression();
      await tickImmunityImprovement();
      await tickLightWoundSelfHeal();
    } catch (err) {
      logger.error('Ailment ticker failed:', err);
    }
  }, TICK_INTERVAL_MS);
}

/**
 * A. Wound infection onset — untended serious/severe/grave wounds develop infection
 *    after their configured onset period elapses.
 */
async function tickWoundInfectionOnset(): Promise<void> {
  // Find characters with untended wounds past their infection onset time
  const candidates = await db.query<{
    id: number;
    wound_severity: string;
  }>(`
    SELECT c.id, c.wound_severity
    FROM characters c
    JOIN wound_infection_config wic ON c.wound_severity = wic.wound_severity
    LEFT JOIN character_ailments ca ON c.id = ca.character_id
      AND ca.ailment_id = (SELECT id FROM ailment_definitions WHERE ailment_key = 'infection')
    WHERE c.wound_severity IN ('serious', 'severe', 'grave')
      AND c.death_state = 'alive'
      AND c.wound_received_at IS NOT NULL
      AND ca.id IS NULL
      AND TIMESTAMPDIFF(SECOND, c.wound_received_at, NOW()) >= wic.infection_onset_seconds
  `);

  if (candidates.length === 0) return;

  // Load infection ailment definition + stage 1 config
  const infectionDef = await db.queryOne<{ id: number }>(`
    SELECT id FROM ailment_definitions WHERE ailment_key = 'infection'
  `);
  if (!infectionDef) return;

  const stage1 = await db.queryOne<{ terminal_seconds: number; immunity_base_seconds: number }>(`
    SELECT terminal_seconds, immunity_base_seconds FROM ailment_stages
    WHERE ailment_id = ? AND stage_number = 1
  `, [infectionDef.id]);
  if (!stage1) return;

  for (const c of candidates) {
    try {
      // Load character's Fortitude for immunity scaling
      const aptRow = await db.queryOne<{ current_value: number }>(`
        SELECT current_value FROM character_aptitudes
        WHERE character_id = ? AND aptitude_key = 'fortitude'
      `, [c.id]);
      const fortitude = aptRow?.current_value ?? 3;
      const fortitudeModifier = 1 + (fortitude * 0.1);
      const effectiveImmunitySeconds = Math.round(stage1.immunity_base_seconds / fortitudeModifier);

      await db.insert(`
        INSERT INTO character_ailments
          (character_id, ailment_id, current_stage, terminal_expires_at, immunity_expires_at, source)
        VALUES (?, ?, 1,
          DATE_ADD(NOW(), INTERVAL ? SECOND),
          DATE_ADD(NOW(), INTERVAL ? SECOND),
          'wound')
      `, [c.id, infectionDef.id, stage1.terminal_seconds, effectiveImmunitySeconds]);

      logger.info(`Infection onset for character ${c.id} (${c.wound_severity} wounds, Fortitude ${fortitude})`);
    } catch (err) {
      logger.error(`Failed to apply infection onset for character ${c.id}:`, err);
    }
  }
}

/**
 * B. Terminal clock progression — ailments whose terminal clock has expired
 *    advance to the next stage (or kill the character at final stage).
 */
async function tickTerminalProgression(): Promise<void> {
  const expired = await db.query<{
    id: number;
    character_id: number;
    ailment_id: number;
    current_stage: number;
    ailment_key: string;
    stage_count: number;
    on_final_terminal: string;
  }>(`
    SELECT ca.id, ca.character_id, ca.ailment_id, ca.current_stage,
           ad.ailment_key, ad.stage_count, ad.on_final_terminal
    FROM character_ailments ca
    JOIN ailment_definitions ad ON ca.ailment_id = ad.id
    WHERE ca.is_terminal_paused = FALSE
      AND ca.terminal_expires_at <= NOW()
  `);

  for (const row of expired) {
    try {
      if (row.current_stage >= row.stage_count) {
        // Final stage terminal completed
        if (row.on_final_terminal === 'death') {
          await db.execute(
            `UPDATE characters SET death_state = 'dead' WHERE id = ?`,
            [row.character_id],
          );
          await db.execute(
            `DELETE FROM character_ailments WHERE id = ?`,
            [row.id],
          );
          logger.info(`Character ${row.character_id} died from ${row.ailment_key} (stage ${row.current_stage} terminal)`);
        }
      } else {
        // Progress to next stage
        const nextStage = row.current_stage + 1;
        const stageConfig = await db.queryOne<{
          terminal_seconds: number;
          immunity_base_seconds: number;
        }>(`
          SELECT terminal_seconds, immunity_base_seconds FROM ailment_stages
          WHERE ailment_id = ? AND stage_number = ?
        `, [row.ailment_id, nextStage]);

        if (stageConfig) {
          // Load Fortitude for immunity scaling
          const aptRow = await db.queryOne<{ current_value: number }>(`
            SELECT current_value FROM character_aptitudes
            WHERE character_id = ? AND aptitude_key = 'fortitude'
          `, [row.character_id]);
          const fortitude = aptRow?.current_value ?? 3;
          const fortitudeModifier = 1 + (fortitude * 0.1);
          const effectiveImmunitySeconds = Math.round(stageConfig.immunity_base_seconds / fortitudeModifier);

          await db.execute(`
            UPDATE character_ailments SET
              current_stage = ?,
              terminal_expires_at = DATE_ADD(NOW(), INTERVAL ? SECOND),
              immunity_expires_at = DATE_ADD(NOW(), INTERVAL ? SECOND),
              is_terminal_paused = FALSE,
              terminal_paused_remaining_seconds = NULL
            WHERE id = ?
          `, [nextStage, stageConfig.terminal_seconds, effectiveImmunitySeconds, row.id]);

          logger.info(`Character ${row.character_id} ${row.ailment_key} progressed to stage ${nextStage}`);
        }
      }
    } catch (err) {
      logger.error(`Failed to process terminal progression for ailment ${row.id}:`, err);
    }
  }
}

/**
 * C. Immunity clock improvement — ailments whose immunity clock has completed
 *    improve to the previous stage (or are cured at stage 1).
 */
async function tickImmunityImprovement(): Promise<void> {
  const expired = await db.query<{
    id: number;
    character_id: number;
    ailment_id: number;
    current_stage: number;
    ailment_key: string;
  }>(`
    SELECT ca.id, ca.character_id, ca.ailment_id, ca.current_stage,
           ad.ailment_key
    FROM character_ailments ca
    JOIN ailment_definitions ad ON ca.ailment_id = ad.id
    WHERE ca.immunity_expires_at <= NOW()
  `);

  for (const row of expired) {
    try {
      if (row.current_stage <= 1) {
        // Cured! Remove ailment
        await db.execute(
          `DELETE FROM character_ailments WHERE id = ?`,
          [row.id],
        );
        logger.info(`Character ${row.character_id} cured of ${row.ailment_key} (immunity won at stage 1)`);
      } else {
        // Improve to previous stage
        const prevStage = row.current_stage - 1;
        const stageConfig = await db.queryOne<{
          terminal_seconds: number;
          immunity_base_seconds: number;
        }>(`
          SELECT terminal_seconds, immunity_base_seconds FROM ailment_stages
          WHERE ailment_id = ? AND stage_number = ?
        `, [row.ailment_id, prevStage]);

        if (stageConfig) {
          const aptRow = await db.queryOne<{ current_value: number }>(`
            SELECT current_value FROM character_aptitudes
            WHERE character_id = ? AND aptitude_key = 'fortitude'
          `, [row.character_id]);
          const fortitude = aptRow?.current_value ?? 3;
          const fortitudeModifier = 1 + (fortitude * 0.1);
          const effectiveImmunitySeconds = Math.round(stageConfig.immunity_base_seconds / fortitudeModifier);

          await db.execute(`
            UPDATE character_ailments SET
              current_stage = ?,
              terminal_expires_at = DATE_ADD(NOW(), INTERVAL ? SECOND),
              immunity_expires_at = DATE_ADD(NOW(), INTERVAL ? SECOND),
              is_terminal_paused = FALSE,
              terminal_paused_remaining_seconds = NULL
            WHERE id = ?
          `, [prevStage, stageConfig.terminal_seconds, effectiveImmunitySeconds, row.id]);

          logger.info(`Character ${row.character_id} ${row.ailment_key} improved to stage ${prevStage}`);
        }
      }
    } catch (err) {
      logger.error(`Failed to process immunity improvement for ailment ${row.id}:`, err);
    }
  }
}

/**
 * D. Light wound self-heal — light wounds automatically clear
 *    when their heal timer expires.
 */
async function tickLightWoundSelfHeal(): Promise<void> {
  try {
    const result = await db.execute(`
      UPDATE characters
      SET wound_severity = 'healthy', wound_received_at = NULL, wound_heals_at = NULL
      WHERE wound_severity = 'light'
        AND wound_heals_at IS NOT NULL
        AND wound_heals_at <= NOW()
    `);
    // MariaDB execute returns { affectedRows }
    if (result && typeof result === 'object' && 'affectedRows' in result && (result as { affectedRows: number }).affectedRows > 0) {
      logger.info(`Light wounds self-healed for ${(result as { affectedRows: number }).affectedRows} character(s)`);
    }
  } catch (err) {
    logger.error('Failed to process light wound self-heal:', err);
  }
}
