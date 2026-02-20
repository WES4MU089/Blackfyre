import { Router, Request, Response } from 'express';
import { z } from 'zod';
import { db } from '../../db/connection.js';
import { logger } from '../../utils/logger.js';
import { getIO, connectedPlayers } from '../../websocket/index.js';
import { getTree, loadContext, startDialog } from '../../npc/dialog-engine.js';

export const npcRouter = Router();

const interactSchema = z.object({
  sl_uuid: z.string().min(1),
  npc_type: z.string().min(1).max(50),
  npc_name: z.string().min(1).max(100),
});

/**
 * POST /api/npc/interact
 *
 * Called by LSL object scripts when a player touches an NPC.
 * Looks up the player by SL UUID, loads the dialog tree,
 * and emits the greeting node to the player's Electron HUD.
 */
npcRouter.post('/interact', async (req: Request, res: Response) => {
  try {
    const data = interactSchema.parse(req.body);
    const io = getIO();

    if (!io) {
      return res.status(503).json({ error: 'WebSocket server not available' });
    }

    // Find the player by SL UUID
    const player = await db.queryOne<{ id: number }>(
      'SELECT id FROM players WHERE sl_uuid = ?',
      [data.sl_uuid],
    );

    if (!player) {
      logger.warn(`NPC interact: unknown sl_uuid ${data.sl_uuid}`);
      return res.status(404).json({ error: 'Player not found' });
    }

    // Find the connected socket for this player and get their character
    let characterId: number | undefined;
    let targetSocketId: string | undefined;

    for (const [socketId, cp] of connectedPlayers) {
      if (cp.slUuid === data.sl_uuid && cp.characterId) {
        characterId = cp.characterId;
        targetSocketId = socketId;
        break;
      }
    }

    if (!characterId || !targetSocketId) {
      logger.warn(`NPC interact: player ${player.id} has no active character or socket`);
      return res.status(400).json({ error: 'No active character' });
    }

    // Load the dialog tree
    const tree = getTree(data.npc_type);
    if (!tree) {
      logger.warn(`NPC interact: unknown npc_type '${data.npc_type}'`);
      return res.status(400).json({ error: 'Unknown NPC type' });
    }

    // Load dialog context (health, gold, etc.)
    const context = await loadContext(characterId);

    // Start the dialog session and get the greeting payload
    const payload = startDialog(tree, context);

    // Emit to the player's socket
    const sock = io.sockets.sockets.get(targetSocketId);
    if (sock) {
      sock.emit('npc:dialog-open', payload);
      logger.info(`NPC dialog opened: ${data.npc_name} (${data.npc_type}) → character ${characterId}`);
    } else {
      logger.warn(`NPC interact: socket ${targetSocketId} not found`);
    }

    res.json({ ok: true });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: 'Validation error', details: error.errors });
    }
    logger.error('NPC interact error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});
