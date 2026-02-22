import { Server as SocketServer, Socket } from 'socket.io';
import crypto from 'crypto';
import { logger } from '../utils/logger.js';
import { db } from '../db/connection.js';
import { verifyJWT } from '../api/routes/auth.js';
import { getPlayerPermissions } from '../utils/permissions.js';
import { setupChatHandlers } from './chat.js';
import { setupCreationHandlers } from './creation.js';
import { setupCombatHandlers } from './combat.js';
import { setupLobbyHandlers, handleLobbyDisconnect } from './lobby.js';
import { setupNpcHandlers } from './npc.js';
import { setupShopHandlers } from './shop.js';
import { setupAllocationHandlers } from './allocation.js';
import { assignSessionId, releaseSessionId, getAllSessions } from './sessionIds.js';

export interface ConnectedPlayer {
  socketId: string;
  userId?: number;
  playerId?: number;
  characterId?: number;
  characterName?: string;
  sessionId?: number;
  slUuid?: string;
  region?: string;
  roleId?: number;
  roleName?: string;
  permissions?: Set<string>;
  isSuperAdmin?: boolean;
}

// Track connected players
export const connectedPlayers = new Map<string, ConnectedPlayer>();

// Store io instance for access from API routes
let ioInstance: SocketServer | null = null;

export function getIO(): SocketServer | null {
  return ioInstance;
}

export function getConnectedPlayer(socketId: string): ConnectedPlayer | undefined {
  return connectedPlayers.get(socketId);
}

export function getPlayersInRegion(region: string): ConnectedPlayer[] {
  return Array.from(connectedPlayers.values()).filter(p => p.region === region);
}

export function setupWebSocket(io: SocketServer): void {
  ioInstance = io;

  io.on('connection', (socket: Socket) => {
    logger.debug(`WebSocket connected: ${socket.id}`);

    // Initialize player in tracking
    connectedPlayers.set(socket.id, { socketId: socket.id });

    // Register ALL event handlers synchronously FIRST, then run async auth.
    // This prevents a race condition where the client emits events (e.g.
    // characters:list) before handlers are registered due to async auth awaits.

    // Player authentication/registration
    socket.on('player:auth', async (data: { slUuid: string; slName: string }) => {
      try {
        const { slUuid, slName } = data;

        // Get or create player
        let player = await db.queryOne<{ id: number }>(`
          SELECT id FROM players WHERE sl_uuid = ?
        `, [slUuid]);

        if (!player) {
          const id = await db.insert(`
            INSERT INTO players (sl_uuid, sl_name, last_seen) VALUES (?, ?, NOW())
          `, [slUuid, slName]);
          player = { id };

          // Create default HUD settings
          await db.insert(`INSERT INTO hud_settings (player_id) VALUES (?)`, [id]);
        } else {
          await db.execute(`UPDATE players SET last_seen = NOW(), sl_name = ? WHERE id = ?`, [slName, player.id]);
        }

        // Update tracking
        const playerInfo = connectedPlayers.get(socket.id);
        if (playerInfo) {
          playerInfo.playerId = player.id;
          playerInfo.slUuid = slUuid;
        }

        // Join player-specific room
        socket.join(`player:${player.id}`);

        socket.emit('player:authenticated', { playerId: player.id });
        logger.info(`Player authenticated: ${slName} (${player.id})`);
      } catch (error) {
        logger.error('Player auth error:', error);
        socket.emit('error', { message: 'Authentication failed' });
      }
    });

    // List player's characters (for character switcher)
    socket.on('characters:list', async () => {
      try {
        const playerInfo = connectedPlayers.get(socket.id);
        if (!playerInfo?.playerId) {
          return socket.emit('error', { message: 'Not authenticated' });
        }

        const characters = await db.query(`
          SELECT c.id, c.name, c.level, c.is_active, c.portrait_url,
                 c.application_status,
                 cv.health, cv.max_health
          FROM characters c
          LEFT JOIN character_vitals cv ON c.id = cv.character_id
          WHERE c.player_id = ? AND c.owner_character_id IS NULL
          ORDER BY c.created_at DESC
        `, [playerInfo.playerId]);

        socket.emit('characters:list', characters);
      } catch (error) {
        logger.error('Characters list error:', error);
        socket.emit('error', { message: 'Failed to list characters' });
      }
    });

    // Character selection
    socket.on('character:select', async (data: { characterId: number }) => {
      try {
        const { characterId } = data;
        const playerInfo = connectedPlayers.get(socket.id);

        if (!playerInfo?.playerId) {
          return socket.emit('error', { message: 'Not authenticated' });
        }

        // Verify character belongs to player (exclude retainers)
        const character = await db.queryOne<{ id: number; name: string; application_status: string }>(`
          SELECT id, name, application_status FROM characters WHERE id = ? AND player_id = ? AND owner_character_id IS NULL
        `, [characterId, playerInfo.playerId]);

        if (!character) {
          return socket.emit('error', { message: 'Character not found' });
        }

        // Block selection of unapproved characters
        if (character.application_status !== 'none' && character.application_status !== 'approved') {
          return socket.emit('error', { message: 'This character is pending application review and cannot be played yet.' });
        }

        // Already playing this character — no-op
        if (playerInfo.characterId === characterId) {
          return;
        }

        // Release previous session ID if switching characters
        if (playerInfo.characterId) {
          socket.leave(`character:${playerInfo.characterId}`);
          releaseSessionId(socket.id);
        }

        // Join new character room
        playerInfo.characterId = characterId;
        playerInfo.characterName = character.name;
        socket.join(`character:${characterId}`);

        // Assign GTA World-style session ID
        const sessionId = assignSessionId(socket.id, characterId, character.name);
        playerInfo.sessionId = sessionId;

        // Load full character data
        const fullCharacter = await loadCharacterData(characterId);
        socket.emit('character:loaded', fullCharacter);

        // Notify this client of their session ID
        socket.emit('session:assigned', { sessionId });

        // Broadcast updated player list to all clients
        io.emit('session:player-list', getAllSessions());

        logger.info(`Character selected: ${character.name} (${characterId}) for player ${playerInfo.playerId}, session ID ${sessionId}`);
      } catch (error) {
        logger.error('Character select error:', error);
        socket.emit('error', { message: 'Failed to select character' });
      }
    });

    // Delete a character (requires name confirmation from client)
    socket.on('character:delete', async (data: { characterId: number; confirmName: string }) => {
      try {
        const playerInfo = connectedPlayers.get(socket.id);
        if (!playerInfo?.playerId) {
          return socket.emit('error', { message: 'Not authenticated' });
        }

        const { characterId, confirmName } = data;

        // Verify character belongs to this player and is not a retainer
        const character = await db.queryOne<{ id: number; name: string }>(
          `SELECT id, name FROM characters WHERE id = ? AND player_id = ? AND owner_character_id IS NULL`,
          [characterId, playerInfo.playerId]
        );

        if (!character) {
          return socket.emit('error', { message: 'Character not found' });
        }

        // Name must match exactly
        if (confirmName !== character.name) {
          return socket.emit('error', { message: 'Character name does not match' });
        }

        // If deleting the currently active character, release session
        if (playerInfo.characterId === characterId) {
          socket.leave(`character:${characterId}`);
          releaseSessionId(socket.id);
          playerInfo.characterId = undefined;
          playerInfo.characterName = undefined;
          playerInfo.sessionId = undefined;
        }

        await db.execute(`DELETE FROM characters WHERE id = ?`, [characterId]);

        socket.emit('character:deleted', { characterId });
        logger.info(`Character deleted: ${character.name} (${characterId}) by player ${playerInfo.playerId}`);

        // Send updated character list
        const characters = await db.query(`
          SELECT c.id, c.name, c.level, c.is_active, c.portrait_url,
                 c.application_status,
                 cv.health, cv.max_health
          FROM characters c
          LEFT JOIN character_vitals cv ON c.id = cv.character_id
          WHERE c.player_id = ? AND c.owner_character_id IS NULL
          ORDER BY c.created_at DESC
        `, [playerInfo.playerId]);

        socket.emit('characters:list', characters);

        // Update session list if they were playing the deleted character
        io.emit('session:player-list', getAllSessions());
      } catch (error) {
        logger.error('Character delete error:', error);
        socket.emit('error', { message: 'Failed to delete character' });
      }
    });

    // Dismiss a retainer from the character panel
    socket.on('retainer:dismiss', async (data: { retainerId: number }) => {
      try {
        const playerInfo = connectedPlayers.get(socket.id);
        if (!playerInfo?.characterId) {
          return socket.emit('error', { message: 'No character selected' });
        }

        const { dismissRetainer, getPlayerRetainers } = await import('../retainers/retainer-manager.js');
        await dismissRetainer(playerInfo.characterId, data.retainerId);

        // Send updated retainer list
        const retainerRows = await getPlayerRetainers(playerInfo.characterId);
        const retainers = retainerRows.map(r => ({
          id: r.characterId,
          name: r.name,
          tier: r.tier,
          tierName: r.tierName,
          level: r.level,
          health: r.health,
          maxHealth: r.maxHealth,
          isAvailable: r.health > 0,
        }));
        socket.emit('retainers:changed', retainers);

        logger.info(`Retainer ${data.retainerId} dismissed by character ${playerInfo.characterId} (via panel)`);
      } catch (err) {
        const msg = err instanceof Error ? err.message : 'unknown';
        logger.error(`Retainer dismiss error: ${msg}`);
        socket.emit('error', { message: msg === 'NOT_YOUR_RETAINER' ? 'That is not your retainer.' : 'Failed to dismiss retainer.' });
      }
    });

    // Real-time vitals update
    socket.on('vitals:update', async (data: Partial<{
      health: number;
      stamina: number;
      hunger: number;
      thirst: number;
      stress: number;
      oxygen: number;
    }>) => {
      const playerInfo = connectedPlayers.get(socket.id);
      if (!playerInfo?.characterId) return;

      try {
        const updates: string[] = [];
        const values: unknown[] = [];

        for (const [key, value] of Object.entries(data)) {
          if (typeof value === 'number') {
            updates.push(`${key} = ?`);
            values.push(Math.max(0, Math.min(100, value)));
          }
        }

        if (updates.length > 0) {
          values.push(playerInfo.characterId);
          await db.execute(`
            UPDATE character_vitals SET ${updates.join(', ')} WHERE character_id = ?
          `, values);

          // Broadcast to all sessions of this character
          io.to(`character:${playerInfo.characterId}`).emit('vitals:changed', data);
        }
      } catch (error) {
        logger.error('Vitals update error:', error);
      }
    });

    // Request current HUD state
    socket.on('hud:sync', async () => {
      const playerInfo = connectedPlayers.get(socket.id);
      if (!playerInfo?.characterId) return;

      try {
        const data = await loadCharacterData(playerInfo.characterId);
        socket.emit('hud:state', data);
      } catch (error) {
        logger.error('HUD sync error:', error);
      }
    });

    // Ping for latency measurement
    socket.on('ping', (timestamp: number) => {
      socket.emit('pong', timestamp);
    });

    // Region tracking - SL scripts / client report region changes
    socket.on('region:update', (data: { region: string }) => {
      const playerInfo = connectedPlayers.get(socket.id);
      if (!playerInfo?.characterId) return;

      const oldRegion = playerInfo.region;
      playerInfo.region = data.region;

      if (oldRegion) {
        socket.leave(`region:${oldRegion}`);
      }
      socket.join(`region:${data.region}`);

      logger.debug(`Player ${playerInfo.playerId} moved to region: ${data.region}`);
    });

    // Position tracking - SL scripts report XYZ coordinates
    socket.on('position:update', async (data: { region: string; x: number; y: number; z: number }) => {
      const playerInfo = connectedPlayers.get(socket.id);
      if (!playerInfo?.characterId) return;

      // Update region tracking if changed
      if (data.region && data.region !== playerInfo.region) {
        const oldRegion = playerInfo.region;
        playerInfo.region = data.region;
        if (oldRegion) socket.leave(`region:${oldRegion}`);
        socket.join(`region:${data.region}`);
      }

      try {
        await db.execute(
          `INSERT INTO character_positions (character_id, region, pos_x, pos_y, pos_z)
           VALUES (?, ?, ?, ?, ?)
           ON DUPLICATE KEY UPDATE
             region = VALUES(region), pos_x = VALUES(pos_x),
             pos_y = VALUES(pos_y), pos_z = VALUES(pos_z)`,
          [playerInfo.characterId, data.region, data.x, data.y, data.z],
        );
      } catch (error) {
        logger.error('Position update error:', error);
      }
    });

    // Request player list (for clients joining late)
    socket.on('session:request-list', () => {
      socket.emit('session:player-list', getAllSessions());
    });

    // Chat system handlers
    setupChatHandlers(io, socket);

    // Character creation handlers
    setupCreationHandlers(io, socket);

    // Combat handlers
    setupCombatHandlers(io, socket);

    // Lobby handlers
    setupLobbyHandlers(io, socket);

    // NPC dialog handlers
    setupNpcHandlers(io, socket);

    // Shop handlers
    setupShopHandlers(io, socket);

    // Point allocation handlers
    setupAllocationHandlers(io, socket);

    // --- Async JWT authentication (runs AFTER all handlers are registered) ---
    // This is intentionally at the bottom so all socket.on() handlers above
    // are registered synchronously before any async work begins.
    const token = socket.handshake.auth?.token as string | undefined;
    if (token) {
      const payload = verifyJWT(token);
      if (payload) {
        (async () => {
          try {
            // JWT userId maps directly to players.id
            const player = await db.queryOne<{
              id: number;
              sl_uuid: string | null;
              role_id: number | null;
              is_super_admin: boolean;
            }>(
              `SELECT id, sl_uuid, role_id, is_super_admin FROM players WHERE id = ? AND is_active = 1`,
              [payload.userId]
            );

            if (!player) {
              logger.warn(`JWT userId=${payload.userId} has no matching player record`);
              socket.disconnect(true);
              return;
            }

            // Load role name and permissions
            let roleName: string | null = null;
            if (player.role_id) {
              const role = await db.queryOne<{ name: string }>(
                `SELECT name FROM roles WHERE id = ?`,
                [player.role_id]
              );
              roleName = role?.name ?? null;
            }
            const permissions = await getPlayerPermissions(player.id);

            const playerInfo = connectedPlayers.get(socket.id);
            if (playerInfo) {
              playerInfo.playerId = player.id;
              playerInfo.userId = payload.userId;
              playerInfo.roleId = player.role_id ?? undefined;
              playerInfo.roleName = roleName ?? undefined;
              playerInfo.permissions = permissions;
              playerInfo.isSuperAdmin = !!player.is_super_admin;
              if (player.sl_uuid) {
                playerInfo.slUuid = player.sl_uuid;
              }
            }
            socket.join(`player:${player.id}`);

            // Join staff room if player has any application-related permission
            if (!!player.is_super_admin || permissions.has('applications.view_queue')) {
              socket.join('staff:applications');
            }

            socket.emit('player:authenticated', {
              playerId: player.id,
              roleName,
              permissions: Array.from(permissions),
              isSuperAdmin: !!player.is_super_admin,
            });
            logger.info(`Socket authenticated via JWT: playerId=${player.id}, slUuid=${player.sl_uuid || 'not linked'}, role=${roleName || 'none'}`);

            // Auto-send character list
            const characters = await db.query(`
              SELECT c.id, c.name, c.level, c.is_active, c.portrait_url,
                     c.application_status,
                     cv.health, cv.max_health
              FROM characters c
              LEFT JOIN character_vitals cv ON c.id = cv.character_id
              WHERE c.player_id = ? AND c.owner_character_id IS NULL
              ORDER BY c.created_at DESC
            `, [player.id]);
            socket.emit('characters:list', characters);

            if (!player.sl_uuid) {
              // No SL account linked — generate a linking code
              const code = crypto.randomBytes(3).toString('hex').toUpperCase();
              const expiresAt = new Date(Date.now() + 15 * 60 * 1000);

              await db.execute(
                `UPDATE players SET sl_verification_code = ?, sl_verification_expires_at = ? WHERE id = ?`,
                [code, expiresAt, player.id]
              );

              socket.join(`user:${payload.userId}`);
              socket.emit('sl:link-required', { code, expiresAt: expiresAt.toISOString() });
              logger.info(`SL linking code generated for playerId=${player.id}: ${code}`);
            }
          } catch (error) {
            logger.error('Socket JWT auth lookup failed:', error);
          }
        })();
      } else {
        logger.warn(`Invalid JWT on socket connection: ${socket.id}`);
        socket.disconnect(true);
        return;
      }
    }

    // Disconnect handling
    socket.on('disconnect', (reason: string) => {
      const playerInfo = connectedPlayers.get(socket.id);
      logger.debug(`WebSocket disconnected: ${socket.id} - ${reason}`);

      if (playerInfo?.playerId) {
        // Update last seen
        db.execute(`UPDATE players SET last_seen = NOW() WHERE id = ?`, [playerInfo.playerId])
          .catch(err => logger.error('Failed to update last_seen:', err));
      }

      // Clean up lobby membership
      if (playerInfo?.characterId) {
        handleLobbyDisconnect(io, playerInfo.characterId)
          .catch(err => logger.error('Failed to handle lobby disconnect:', err));
      }

      // Release session ID and broadcast updated list
      releaseSessionId(socket.id);
      io.emit('session:player-list', getAllSessions());

      connectedPlayers.delete(socket.id);
    });
  });

  logger.info('WebSocket handlers initialized');
}


// Helper to load full character data for HUD
async function loadCharacterData(characterId: number): Promise<Record<string, unknown>> {
  const { getPlayerRetainers } = await import('../retainers/retainer-manager.js');

  const [character, vitals, finances, jobs, effects, inventory, aptitudes, equipmentRows, retainerRows] = await Promise.all([
    db.queryOne(`SELECT * FROM characters WHERE id = ?`, [characterId]),
    db.queryOne(`SELECT * FROM character_vitals WHERE character_id = ?`, [characterId]),
    db.queryOne(`SELECT * FROM character_finances WHERE character_id = ?`, [characterId]),
    db.query(`
      SELECT cj.*, j.name as job_name, jg.name as grade_name, jg.salary
      FROM character_jobs cj
      JOIN jobs j ON cj.job_id = j.id
      LEFT JOIN job_grades jg ON j.id = jg.job_id AND cj.grade = jg.grade
      WHERE cj.character_id = ?
    `, [characterId]),
    db.query(`
      SELECT cse.*, se.name, se.effect_type, se.icon_url
      FROM character_status_effects cse
      JOIN status_effects se ON cse.effect_id = se.id
      WHERE cse.character_id = ? AND (cse.expires_at IS NULL OR cse.expires_at > NOW())
    `, [characterId]),
    db.query(`
      SELECT ci.id AS inventory_id, ci.item_id, ci.quantity, ci.slot_number,
             ci.durability, ci.metadata,
             i.item_key, i.name, i.description, i.icon_url, i.category, i.rarity,
             i.tier, i.material, i.slot_type, i.is_two_handed, i.weight,
             i.max_stack, i.is_usable, i.is_tradeable, i.base_price, i.model_data
      FROM character_inventory ci
      JOIN items i ON ci.item_id = i.id
      WHERE ci.character_id = ?
      ORDER BY ci.slot_number
    `, [characterId]),
    db.query(`
      SELECT * FROM character_aptitudes
      WHERE character_id = ?
      ORDER BY FIELD(aptitude_key, 'prowess','fortitude','command','cunning','stewardship','presence','lore','faith')
    `, [characterId]),
    db.query(`
      SELECT ce.id AS equipment_id, ce.slot_id, ce.item_id,
             i.item_key, i.name AS itemName, i.description, i.icon_url AS iconUrl,
             i.category, i.rarity, i.tier, i.material,
             i.slot_type, i.is_two_handed, i.weight, i.base_price, i.model_data
      FROM character_equipment ce
      JOIN items i ON ce.item_id = i.id
      WHERE ce.character_id = ?
    `, [characterId]),
    getPlayerRetainers(characterId),
  ]);

  // Character level + segment-based XP
  const charData = character as { level: number; xp_segments: number; unspent_aptitude_points: number } | null;

  // Transform equipment rows into Record<slotId, EquippedItem | null>
  const validSlots = ['mainHand', 'offHand', 'armor', 'accessory1', 'accessory2', 'ancillary1', 'ancillary2'];
  const equipment: Record<string, unknown> = {};
  const typedEquipRows = equipmentRows as Array<{
    equipment_id: number; slot_id: string; item_id: number;
    item_key: string; itemName: string; description: string | null; iconUrl: string | null;
    category: string; rarity: string; tier: number; material: string | null;
    slot_type: string | null; is_two_handed: boolean; weight: number;
    base_price: number; model_data: string | null;
  }>;
  for (const slot of validSlots) {
    const row = typedEquipRows.find(r => r.slot_id === slot);
    equipment[slot] = row ? {
      equipmentId: row.equipment_id,
      slotId: row.slot_id,
      itemId: row.item_id,
      itemKey: row.item_key,
      itemName: row.itemName,
      description: row.description,
      iconUrl: row.iconUrl || null,
      category: row.category,
      rarity: row.rarity,
      tier: row.tier,
      material: row.material,
      slotType: row.slot_type,
      isTwoHanded: !!row.is_two_handed,
      weight: Number(row.weight),
      basePrice: Number(row.base_price),
      modelData: row.model_data ? (typeof row.model_data === 'string' ? JSON.parse(row.model_data) : row.model_data) : null,
    } : null;
  }

  // Transform aptitude rows to match frontend Aptitude interface
  const APTITUDE_NAMES: Record<string, string> = {
    prowess: 'Prowess', fortitude: 'Fortitude', command: 'Command', cunning: 'Cunning',
    stewardship: 'Stewardship', presence: 'Presence', lore: 'Lore', faith: 'Faith',
  };
  const formattedAptitudes = (aptitudes as Array<{
    aptitude_key: string; base_value: number; current_value: number;
  }>).map(a => ({
    id: a.aptitude_key,
    name: APTITUDE_NAMES[a.aptitude_key] ?? a.aptitude_key,
    baseValue: Number(a.base_value),
    currentValue: Number(a.current_value),
  }));

  // Transform inventory rows to match frontend InventoryItem interface
  const formattedInventory = (inventory as Array<{
    inventory_id: number; item_id: number; quantity: number; slot_number: number;
    durability: number; metadata: string | null;
    item_key: string; name: string; description: string | null; icon_url: string | null;
    category: string; rarity: string; tier: number; material: string | null;
    slot_type: string | null; is_two_handed: boolean; weight: number;
    max_stack: number; is_usable: boolean; is_tradeable: boolean;
    base_price: number; model_data: string | null;
  }>).map(row => ({
    inventory_id: row.inventory_id,
    item_id: row.item_id,
    item_key: row.item_key,
    name: row.name,
    description: row.description,
    icon_url: row.icon_url,
    category: row.category,
    rarity: row.rarity,
    tier: row.tier,
    material: row.material,
    slot_type: row.slot_type,
    is_two_handed: !!row.is_two_handed,
    weight: Number(row.weight),
    max_stack: row.max_stack,
    is_usable: !!row.is_usable,
    is_tradeable: !!row.is_tradeable,
    base_price: Number(row.base_price),
    model_data: row.model_data ? (typeof row.model_data === 'string' ? JSON.parse(row.model_data) : row.model_data) : null,
    quantity: row.quantity,
    slot_number: row.slot_number,
    durability: Number(row.durability),
    metadata: row.metadata ? (typeof row.metadata === 'string' ? JSON.parse(row.metadata) : row.metadata) : null,
  }));

  // Transform retainers to match frontend RetainerInfo interface
  const formattedRetainers = retainerRows.map(r => ({
    id: r.characterId,
    name: r.name,
    tier: r.tier,
    tierName: r.tierName,
    level: r.level,
    health: r.health,
    maxHealth: r.maxHealth,
    isAvailable: r.health > 0,
  }));

  return {
    character,
    level: charData?.level ?? 1,
    xpSegments: Number(charData?.xp_segments ?? 0),
    segmentsPerLevel: 10,
    unspentAptitudePoints: charData?.unspent_aptitude_points ?? 0,
    vitals,
    finances,
    jobs,
    activeEffects: effects,
    inventory: formattedInventory,
    aptitudes: formattedAptitudes,
    equipment,
    retainers: formattedRetainers,
  };
}

// Export for broadcasting from API routes
export function broadcastToCharacter(io: SocketServer, characterId: number, event: string, data: unknown): void {
  io.to(`character:${characterId}`).emit(event, data);
}

export function broadcastToPlayer(io: SocketServer, playerId: number, event: string, data: unknown): void {
  io.to(`player:${playerId}`).emit(event, data);
}
