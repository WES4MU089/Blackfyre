import { Router, Request, Response } from 'express';
import { db } from '../../db/connection.js';
import { logger } from '../../utils/logger.js';
import { z } from 'zod';
import { connectedPlayers, getIO, getPlayersInRegion } from '../../websocket/index.js';

export const playersRouter = Router();

// Validation schemas
const createPlayerSchema = z.object({
  sl_uuid: z.string().uuid(),
  sl_name: z.string().min(1).max(100),
  sl_legacy_name: z.string().max(100).optional(),
});

const updatePlayerSchema = z.object({
  sl_name: z.string().min(1).max(100).optional(),
  sl_legacy_name: z.string().max(100).optional(),
  is_active: z.boolean().optional(),
  is_banned: z.boolean().optional(),
  ban_reason: z.string().optional(),
});

// Get all players
playersRouter.get('/', async (_req: Request, res: Response) => {
  try {
    const players = await db.query(`
      SELECT id, sl_uuid, sl_name, sl_legacy_name, created_at, 
             last_seen, is_active, is_banned
      FROM players
      ORDER BY created_at DESC
      LIMIT 100
    `);
    res.json(players);
  } catch (error) {
    logger.error('Failed to fetch players:', error);
    res.status(500).json({ error: 'Failed to fetch players' });
  }
});

// Get player by SL UUID
playersRouter.get('/uuid/:uuid', async (req: Request, res: Response) => {
  try {
    const player = await db.queryOne(`
      SELECT id, sl_uuid, sl_name, sl_legacy_name, created_at, 
             last_seen, is_active, is_banned
      FROM players
      WHERE sl_uuid = ?
    `, [req.params.uuid]);

    if (!player) {
      return res.status(404).json({ error: 'Player not found' });
    }

    res.json(player);
  } catch (error) {
    logger.error('Failed to fetch player:', error);
    res.status(500).json({ error: 'Failed to fetch player' });
  }
});

// Get player by ID
playersRouter.get('/:id', async (req: Request, res: Response) => {
  try {
    const player = await db.queryOne(`
      SELECT id, sl_uuid, sl_name, sl_legacy_name, created_at, 
             last_seen, is_active, is_banned, ban_reason
      FROM players
      WHERE id = ?
    `, [req.params.id]);

    if (!player) {
      return res.status(404).json({ error: 'Player not found' });
    }

    res.json(player);
  } catch (error) {
    logger.error('Failed to fetch player:', error);
    res.status(500).json({ error: 'Failed to fetch player' });
  }
});

// Create or login player (upsert)
playersRouter.post('/login', async (req: Request, res: Response) => {
  try {
    const data = createPlayerSchema.parse(req.body);
    
    // Check if player exists
    const existing = await db.queryOne<{ id: number }>(`
      SELECT id FROM players WHERE sl_uuid = ?
    `, [data.sl_uuid]);

    if (existing) {
      // Update last_seen
      await db.execute(`
        UPDATE players SET last_seen = NOW(), sl_name = ? WHERE id = ?
      `, [data.sl_name, existing.id]);
      
      const player = await db.queryOne(`
        SELECT * FROM players WHERE id = ?
      `, [existing.id]);
      
      return res.json({ ...player, isNew: false });
    }

    // Create new player
    const id = await db.insert(`
      INSERT INTO players (sl_uuid, sl_name, sl_legacy_name, last_seen)
      VALUES (?, ?, ?, NOW())
    `, [data.sl_uuid, data.sl_name, data.sl_legacy_name || null]);

    // Create default HUD settings
    await db.insert(`
      INSERT INTO hud_settings (player_id) VALUES (?)
    `, [id]);

    const player = await db.queryOne(`SELECT * FROM players WHERE id = ?`, [id]);
    res.status(201).json({ ...player, isNew: true });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: 'Validation error', details: error.errors });
    }
    logger.error('Failed to create/login player:', error);
    res.status(500).json({ error: 'Failed to process login' });
  }
});

// Update player
playersRouter.patch('/:id', async (req: Request, res: Response) => {
  try {
    const data = updatePlayerSchema.parse(req.body);
    const updates: string[] = [];
    const values: unknown[] = [];

    if (data.sl_name !== undefined) {
      updates.push('sl_name = ?');
      values.push(data.sl_name);
    }
    if (data.sl_legacy_name !== undefined) {
      updates.push('sl_legacy_name = ?');
      values.push(data.sl_legacy_name);
    }
    if (data.is_active !== undefined) {
      updates.push('is_active = ?');
      values.push(data.is_active);
    }
    if (data.is_banned !== undefined) {
      updates.push('is_banned = ?');
      values.push(data.is_banned);
    }
    if (data.ban_reason !== undefined) {
      updates.push('ban_reason = ?');
      values.push(data.ban_reason);
    }

    if (updates.length === 0) {
      return res.status(400).json({ error: 'No fields to update' });
    }

    values.push(req.params.id);
    await db.execute(`
      UPDATE players SET ${updates.join(', ')} WHERE id = ?
    `, values);

    const player = await db.queryOne(`SELECT * FROM players WHERE id = ?`, [req.params.id]);
    res.json(player);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: 'Validation error', details: error.errors });
    }
    logger.error('Failed to update player:', error);
    res.status(500).json({ error: 'Failed to update player' });
  }
});

// Get player's HUD settings
playersRouter.get('/:id/hud-settings', async (req: Request, res: Response) => {
  try {
    const settings = await db.queryOne(`
      SELECT * FROM hud_settings WHERE player_id = ?
    `, [req.params.id]);

    if (!settings) {
      return res.status(404).json({ error: 'HUD settings not found' });
    }

    res.json(settings);
  } catch (error) {
    logger.error('Failed to fetch HUD settings:', error);
    res.status(500).json({ error: 'Failed to fetch HUD settings' });
  }
});

// Update player's HUD settings
playersRouter.patch('/:id/hud-settings', async (req: Request, res: Response) => {
  try {
    const { theme, opacity, scale, position_preset, custom_positions, 
            visible_elements, keybindings, sound_enabled, notifications_enabled } = req.body;
    
    const updates: string[] = [];
    const values: unknown[] = [];

    if (theme !== undefined) { updates.push('theme = ?'); values.push(theme); }
    if (opacity !== undefined) { updates.push('opacity = ?'); values.push(opacity); }
    if (scale !== undefined) { updates.push('scale = ?'); values.push(scale); }
    if (position_preset !== undefined) { updates.push('position_preset = ?'); values.push(position_preset); }
    if (custom_positions !== undefined) { updates.push('custom_positions = ?'); values.push(JSON.stringify(custom_positions)); }
    if (visible_elements !== undefined) { updates.push('visible_elements = ?'); values.push(JSON.stringify(visible_elements)); }
    if (keybindings !== undefined) { updates.push('keybindings = ?'); values.push(JSON.stringify(keybindings)); }
    if (sound_enabled !== undefined) { updates.push('sound_enabled = ?'); values.push(sound_enabled); }
    if (notifications_enabled !== undefined) { updates.push('notifications_enabled = ?'); values.push(notifications_enabled); }

    if (updates.length === 0) {
      return res.status(400).json({ error: 'No fields to update' });
    }

    values.push(req.params.id);
    await db.execute(`
      UPDATE hud_settings SET ${updates.join(', ')} WHERE player_id = ?
    `, values);

    const settings = await db.queryOne(`SELECT * FROM hud_settings WHERE player_id = ?`, [req.params.id]);
    res.json(settings);
  } catch (error) {
    logger.error('Failed to update HUD settings:', error);
    res.status(500).json({ error: 'Failed to update HUD settings' });
  }
});

// Region update from SL scripts - bridges REST to WebSocket proximity rooms
const regionUpdateSchema = z.object({
  sl_uuid: z.string(),
  region: z.string().min(1).max(100),
});

playersRouter.post('/region', async (req: Request, res: Response) => {
  try {
    const { sl_uuid, region } = regionUpdateSchema.parse(req.body);

    // Find the connected socket for this SL UUID and update their region
    for (const [socketId, player] of connectedPlayers) {
      if (player.slUuid === sl_uuid) {
        player.region = region;
        logger.debug(`Region updated via REST for ${sl_uuid}: ${region}`);
      }
    }

    // Also update last_seen
    await db.execute(
      `UPDATE players SET last_seen = NOW() WHERE sl_uuid = ?`,
      [sl_uuid]
    );

    res.json({ ok: true, region });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: 'Validation error', details: error.errors });
    }
    logger.error('Failed to update region:', error);
    res.status(500).json({ error: 'Failed to update region' });
  }
});

// Keepalive from SL inworld HUD — bridges location data to Electron HUD via WebSocket
const keepaliveSchema = z.object({
  sl_uuid: z.string(),
  sim_name: z.string().min(1).max(100),
  grid_x: z.number(),
  grid_y: z.number(),
  pos_x: z.number(),
  pos_y: z.number(),
  pos_z: z.number(),
  display_name: z.string().min(1).max(100),
});

playersRouter.post('/keepalive', async (req: Request, res: Response) => {
  try {
    const data = keepaliveSchema.parse(req.body);
    const io = getIO();

    // Update last_seen
    await db.execute(
      `UPDATE players SET last_seen = NOW() WHERE sl_uuid = ?`,
      [data.sl_uuid]
    );

    // Find connected socket(s) for this SL UUID and forward location to Electron HUD
    for (const [_socketId, player] of connectedPlayers) {
      if (player.slUuid === data.sl_uuid) {
        // Update region tracking
        const oldRegion = player.region;
        player.region = data.sim_name;

        // Persist position to character_positions (used by combat lobby proximity checks)
        if (player.characterId) {
          await db.execute(
            `INSERT INTO character_positions (character_id, region, pos_x, pos_y, pos_z)
             VALUES (?, ?, ?, ?, ?)
             ON DUPLICATE KEY UPDATE
               region = VALUES(region), pos_x = VALUES(pos_x),
               pos_y = VALUES(pos_y), pos_z = VALUES(pos_z)`,
            [player.characterId, data.sim_name, data.pos_x, data.pos_y, data.pos_z],
          );
        }

        // Forward location to the player's Electron HUD
        if (io && player.playerId) {
          io.to(`player:${player.playerId}`).emit('location:update', {
            simName: data.sim_name,
            gridX: data.grid_x,
            gridY: data.grid_y,
            posX: data.pos_x,
            posY: data.pos_y,
            posZ: data.pos_z,
          });

          // If region changed, update room membership and broadcast player counts
          if (oldRegion !== data.sim_name) {
            // Get the actual socket to manage room membership
            const sock = io.sockets.sockets.get(player.socketId);
            if (sock) {
              if (oldRegion) sock.leave(`region:${oldRegion}`);
              sock.join(`region:${data.sim_name}`);
            }

            const regionPlayers = getPlayersInRegion(data.sim_name);
            io.to(`region:${data.sim_name}`).emit('region:player-count', {
              count: regionPlayers.length,
            });

            // Also update old region count
            if (oldRegion) {
              const oldRegionPlayers = getPlayersInRegion(oldRegion);
              io.to(`region:${oldRegion}`).emit('region:player-count', {
                count: oldRegionPlayers.length,
              });
            }
          }
        }
      }
    }

    res.json({ ok: true });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: 'Validation error', details: error.errors });
    }
    logger.error('Failed to process keepalive:', error);
    res.status(500).json({ error: 'Failed to process keepalive' });
  }
});

// SL Account Linking — generate verification code (called from Electron HUD)
const linkSLSchema = z.object({
  player_id: z.number(),
});

playersRouter.post('/link-sl', async (req: Request, res: Response) => {
  try {
    const data = linkSLSchema.parse(req.body);

    // Generate 6-character verification code
    const code = Math.random().toString(36).substring(2, 8).toUpperCase();
    const expiresAt = new Date(Date.now() + 15 * 60 * 1000); // 15 minutes

    await db.execute(
      `UPDATE players SET sl_verification_code = ?, sl_verification_expires_at = ? WHERE id = ?`,
      [code, expiresAt, data.player_id]
    );

    logger.info(`SL link code generated for player ${data.player_id}: ${code}`);
    res.json({ code, expiresAt: expiresAt.toISOString() });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: 'Validation error', details: error.errors });
    }
    logger.error('Failed to generate SL link code:', error);
    res.status(500).json({ error: 'Failed to generate link code' });
  }
});

// SL Account Verification — called from LSL HUD inworld
// Note: verification_code uses z.preprocess to coerce numbers to strings because
// LSL's JSON builder may send all-digit hex codes as unquoted numbers
const verifySLSchema = z.object({
  sl_uuid: z.string(),
  verification_code: z.preprocess(v => String(v), z.string().min(1).max(64)),
});

playersRouter.post('/verify-sl', async (req: Request, res: Response) => {
  try {
    const { sl_uuid, verification_code } = verifySLSchema.parse(req.body);

    // Find the player with this verification code
    const player = await db.queryOne<{ id: number }>(
      `SELECT id FROM players
       WHERE sl_verification_code = ? AND sl_verification_expires_at > NOW() AND is_active = 1`,
      [verification_code.toUpperCase()]
    );

    if (!player) {
      return res.status(400).json({ error: 'Invalid or expired verification code' });
    }

    // Check if an SL-only player row already exists with this UUID (created by inworld HUD login)
    const slRecord = await db.queryOne<{ id: number; sl_name: string }>(
      `SELECT id, sl_name FROM players WHERE sl_uuid = ? AND id != ?`,
      [sl_uuid, player.id]
    );

    if (slRecord) {
      // Merge: copy sl_name to the Discord player, reassign characters, delete orphan row
      await db.execute(`UPDATE players SET sl_name = ? WHERE id = ?`, [slRecord.sl_name, player.id]);
      await db.execute(`UPDATE characters SET player_id = ? WHERE player_id = ?`, [player.id, slRecord.id]);
      await db.execute(`UPDATE hud_settings SET player_id = ? WHERE player_id = ?`, [player.id, slRecord.id]);
      await db.execute(`DELETE FROM players WHERE id = ?`, [slRecord.id]);
      logger.info(`Merged SL player record ${slRecord.id} into Discord player ${player.id}`);
    }

    // Now link the SL UUID to this player and clear the verification code
    await db.execute(
      `UPDATE players SET sl_uuid = ?, sl_verification_code = NULL, sl_verification_expires_at = NULL WHERE id = ?`,
      [sl_uuid, player.id]
    );

    // Update the connected socket with the new SL identity
    const io = getIO();
    if (io) {
      for (const [_socketId, cp] of connectedPlayers) {
        if (cp.playerId === player.id) {
          cp.slUuid = sl_uuid;
          const sock = io.sockets.sockets.get(cp.socketId);
          if (sock) {
            sock.emit('sl:linked', { playerId: player.id, slUuid: sl_uuid });
          }
          break;
        }
      }
    }

    logger.info(`SL account linked: ${sl_uuid} -> playerId ${player.id}`);
    res.json({ success: true, player_id: player.id });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: 'Validation error', details: error.errors });
    }
    logger.error('Failed to verify SL account:', error);
    res.status(500).json({ error: 'Failed to verify SL account' });
  }
});
