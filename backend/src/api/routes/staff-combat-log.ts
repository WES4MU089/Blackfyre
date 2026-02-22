import { Router, Request, Response } from 'express';
import { db } from '../../db/connection.js';
import { logger } from '../../utils/logger.js';
import { requireAuth, requirePermission } from '../middleware/auth.js';

export const staffCombatLogRouter = Router();

staffCombatLogRouter.use(requireAuth());

// GET / — paginated combat session list + duels
staffCombatLogRouter.get(
  '/',
  requirePermission('system.view_combat_log'),
  async (req: Request, res: Response) => {
    try {
      const region = req.query.region as string | undefined;
      const status = req.query.status as string | undefined;
      const characterName = req.query.characterName as string | undefined;
      const startDate = req.query.startDate as string | undefined;
      const endDate = req.query.endDate as string | undefined;
      const limit = Math.min(parseInt(req.query.limit as string) || 50, 200);
      const offset = parseInt(req.query.offset as string) || 0;

      // --- Sessions ---
      let sessionSql = `
        SELECT cs.id, cs.lobby_id, cs.status, cs.winning_team,
               cs.current_round, cs.created_at, cs.completed_at,
               cl.region AS lobby_region
        FROM combat_sessions cs
        LEFT JOIN combat_lobbies cl ON cs.lobby_id = cl.id
        WHERE 1=1
      `;
      const sessionParams: unknown[] = [];

      if (region) {
        sessionSql += ` AND cl.region LIKE ?`;
        sessionParams.push(`%${region}%`);
      }
      if (status) {
        sessionSql += ` AND cs.status = ?`;
        sessionParams.push(status);
      }
      if (characterName) {
        sessionSql += ` AND cs.id IN (
          SELECT csc2.session_id FROM combat_session_combatants csc2
          JOIN characters ch2 ON csc2.character_id = ch2.id
          WHERE ch2.name LIKE ?
        )`;
        sessionParams.push(`%${characterName}%`);
      }
      if (startDate) {
        sessionSql += ` AND cs.created_at >= ?`;
        sessionParams.push(startDate);
      }
      if (endDate) {
        sessionSql += ` AND cs.created_at <= ?`;
        sessionParams.push(endDate);
      }

      sessionSql += ` ORDER BY cs.created_at DESC LIMIT ? OFFSET ?`;
      sessionParams.push(limit, offset);

      const sessions = await db.query<{
        id: number; lobby_id: number | null; status: string; winning_team: number | null;
        current_round: number; created_at: string; completed_at: string | null;
        lobby_region: string | null;
      }>(sessionSql, sessionParams);

      // Fetch combatants for each session
      const sessionsWithCombatants = await Promise.all(
        sessions.map(async (s) => {
          const combatants = await db.query<{
            character_id: number; character_name: string; team: number;
            is_alive: boolean; is_yielded: boolean;
          }>(
            `SELECT csc.character_id, ch.name AS character_name, csc.team,
                    csc.is_alive, csc.is_yielded
             FROM combat_session_combatants csc
             JOIN characters ch ON csc.character_id = ch.id
             WHERE csc.session_id = ?
             ORDER BY csc.team ASC, ch.name ASC`,
            [s.id]
          );
          return { ...s, combatants };
        })
      );

      // Session count
      let countSql = `
        SELECT COUNT(*) AS total FROM combat_sessions cs
        LEFT JOIN combat_lobbies cl ON cs.lobby_id = cl.id
        WHERE 1=1
      `;
      const countParams: unknown[] = [];
      if (region) { countSql += ` AND cl.region LIKE ?`; countParams.push(`%${region}%`); }
      if (status) { countSql += ` AND cs.status = ?`; countParams.push(status); }
      if (characterName) {
        countSql += ` AND cs.id IN (SELECT csc2.session_id FROM combat_session_combatants csc2 JOIN characters ch2 ON csc2.character_id = ch2.id WHERE ch2.name LIKE ?)`;
        countParams.push(`%${characterName}%`);
      }
      if (startDate) { countSql += ` AND cs.created_at >= ?`; countParams.push(startDate); }
      if (endDate) { countSql += ` AND cs.created_at <= ?`; countParams.push(endDate); }

      const countResult = await db.queryOne<{ total: number }>(countSql, countParams);

      // --- Duels ---
      let duelSql = `
        SELECT d.id, d.status, d.outcome, d.total_rounds,
               d.created_at, d.completed_at,
               d.attacker_hp_start, d.attacker_hp_end,
               d.defender_hp_start, d.defender_hp_end,
               ca.name AS attacker_name, cd.name AS defender_name,
               cw.name AS winner_name
        FROM duels d
        JOIN characters ca ON d.attacker_character_id = ca.id
        JOIN characters cd ON d.defender_character_id = cd.id
        LEFT JOIN characters cw ON d.winner_character_id = cw.id
        WHERE 1=1
      `;
      const duelParams: unknown[] = [];

      if (characterName) {
        duelSql += ` AND (ca.name LIKE ? OR cd.name LIKE ?)`;
        duelParams.push(`%${characterName}%`, `%${characterName}%`);
      }
      if (status) {
        duelSql += ` AND d.status = ?`;
        duelParams.push(status);
      }
      if (startDate) {
        duelSql += ` AND d.created_at >= ?`;
        duelParams.push(startDate);
      }
      if (endDate) {
        duelSql += ` AND d.created_at <= ?`;
        duelParams.push(endDate);
      }

      duelSql += ` ORDER BY d.created_at DESC LIMIT ? OFFSET ?`;
      duelParams.push(limit, offset);

      const duels = await db.query(duelSql, duelParams);

      let duelCountSql = `SELECT COUNT(*) AS total FROM duels d
        JOIN characters ca ON d.attacker_character_id = ca.id
        JOIN characters cd ON d.defender_character_id = cd.id
        WHERE 1=1`;
      const duelCountParams: unknown[] = [];
      if (characterName) { duelCountSql += ` AND (ca.name LIKE ? OR cd.name LIKE ?)`; duelCountParams.push(`%${characterName}%`, `%${characterName}%`); }
      if (status) { duelCountSql += ` AND d.status = ?`; duelCountParams.push(status); }
      if (startDate) { duelCountSql += ` AND d.created_at >= ?`; duelCountParams.push(startDate); }
      if (endDate) { duelCountSql += ` AND d.created_at <= ?`; duelCountParams.push(endDate); }

      const duelCountResult = await db.queryOne<{ total: number }>(duelCountSql, duelCountParams);

      res.json({
        sessions: sessionsWithCombatants,
        total: countResult?.total ?? 0,
        duels,
        duelsTotal: duelCountResult?.total ?? 0,
        limit,
        offset,
      });
    } catch (err) {
      logger.error('Failed to fetch combat log:', err);
      res.status(500).json({ error: 'Failed to fetch combat log' });
    }
  }
);

// GET /:sessionId/actions — full action log for a session
staffCombatLogRouter.get(
  '/:sessionId/actions',
  requirePermission('system.view_combat_log'),
  async (req: Request, res: Response) => {
    try {
      const sessionId = Number(req.params.sessionId);

      const session = await db.queryOne<{
        id: number; lobby_id: number | null; status: string; winning_team: number | null;
        current_round: number; created_at: string; completed_at: string | null;
        lobby_region: string | null;
      }>(
        `SELECT cs.id, cs.lobby_id, cs.status, cs.winning_team,
                cs.current_round, cs.created_at, cs.completed_at,
                cl.region AS lobby_region
         FROM combat_sessions cs
         LEFT JOIN combat_lobbies cl ON cs.lobby_id = cl.id
         WHERE cs.id = ?`,
        [sessionId]
      );

      if (!session) return res.status(404).json({ error: 'Session not found' });

      const combatants = await db.query<{
        character_id: number; character_name: string; team: number;
        is_alive: boolean; is_yielded: boolean;
        current_health: number; max_health: number;
      }>(
        `SELECT csc.character_id, ch.name AS character_name, csc.team,
                csc.is_alive, csc.is_yielded,
                csc.current_health, csc.max_health
         FROM combat_session_combatants csc
         JOIN characters ch ON csc.character_id = ch.id
         WHERE csc.session_id = ?
         ORDER BY csc.team ASC, ch.name ASC`,
        [sessionId]
      );

      const actions = await db.query<{
        id: number; round_number: number; turn_number: number;
        actor_character_id: number; actor_name: string;
        action_type: string;
        target_character_id: number | null; target_name: string | null;
        roll_data: string | null;
        damage_dealt: number; damage_label: string | null;
        crit: boolean; crit_effect: string | null;
        status_effects_applied: string | null;
        narrative: string | null;
        created_at: string;
      }>(
        `SELECT cal.id, cal.round_number, cal.turn_number,
                cal.actor_character_id, ca.name AS actor_name,
                cal.action_type,
                cal.target_character_id, ct.name AS target_name,
                cal.roll_data, cal.damage_dealt, cal.damage_label,
                cal.crit, cal.crit_effect,
                cal.status_effects_applied, cal.narrative, cal.created_at
         FROM combat_action_log cal
         JOIN characters ca ON cal.actor_character_id = ca.id
         LEFT JOIN characters ct ON cal.target_character_id = ct.id
         WHERE cal.session_id = ?
         ORDER BY cal.round_number ASC, cal.turn_number ASC, cal.id ASC`,
        [sessionId]
      );

      // Parse JSON fields
      const parsedActions = actions.map(a => ({
        ...a,
        roll_data: a.roll_data ? JSON.parse(a.roll_data as string) : null,
        status_effects_applied: a.status_effects_applied ? JSON.parse(a.status_effects_applied as string) : [],
      }));

      res.json({ session, combatants, actions: parsedActions });
    } catch (err) {
      logger.error('Failed to fetch combat session actions:', err);
      res.status(500).json({ error: 'Failed to fetch session actions' });
    }
  }
);

// GET /duels/:duelId/rounds — full round log for a duel
staffCombatLogRouter.get(
  '/duels/:duelId/rounds',
  requirePermission('system.view_combat_log'),
  async (req: Request, res: Response) => {
    try {
      const duelId = Number(req.params.duelId);

      const duel = await db.queryOne<{
        id: number; status: string; outcome: string | null; total_rounds: number;
        attacker_hp_start: number | null; attacker_hp_end: number | null;
        defender_hp_start: number | null; defender_hp_end: number | null;
        created_at: string; completed_at: string | null;
        attacker_name: string; defender_name: string; winner_name: string | null;
      }>(
        `SELECT d.id, d.status, d.outcome, d.total_rounds,
                d.attacker_hp_start, d.attacker_hp_end,
                d.defender_hp_start, d.defender_hp_end,
                d.created_at, d.completed_at,
                ca.name AS attacker_name, cd.name AS defender_name,
                cw.name AS winner_name
         FROM duels d
         JOIN characters ca ON d.attacker_character_id = ca.id
         JOIN characters cd ON d.defender_character_id = cd.id
         LEFT JOIN characters cw ON d.winner_character_id = cw.id
         WHERE d.id = ?`,
        [duelId]
      );

      if (!duel) return res.status(404).json({ error: 'Duel not found' });

      const rounds = await db.query(
        `SELECT * FROM duel_rounds WHERE duel_id = ? ORDER BY round_number ASC`,
        [duelId]
      );

      res.json({ duel, rounds });
    } catch (err) {
      logger.error('Failed to fetch duel rounds:', err);
      res.status(500).json({ error: 'Failed to fetch duel rounds' });
    }
  }
);
