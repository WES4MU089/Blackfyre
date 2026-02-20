/**
 * NPC Dialog WebSocket handlers.
 *
 * Handles player option selections and dialog closure.
 * The initial dialog open is triggered via the REST API
 * (LSL touch → POST /api/npc/interact → socket emit).
 */

import { Server as SocketServer, Socket } from 'socket.io';
import { connectedPlayers } from './index.js';
import { selectOption, closeDialog, getActiveSession } from '../npc/dialog-engine.js';
import { logger } from '../utils/logger.js';

export function setupNpcHandlers(io: SocketServer, socket: Socket): void {

  /**
   * Player selected a dialog option.
   */
  socket.on('npc:select-option', async (data: { optionId: string }) => {
    const player = connectedPlayers.get(socket.id);
    if (!player?.characterId) return;

    const session = getActiveSession(player.characterId);
    if (!session) {
      socket.emit('npc:error', { message: 'No active dialog' });
      return;
    }

    try {
      const result = await selectOption(player.characterId, data.optionId, io);

      if ('close' in result) {
        socket.emit('npc:dialog-close');
      } else {
        socket.emit('npc:dialog-node', result);
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Dialog error';
      logger.error(`NPC dialog error for character ${player.characterId}:`, err);
      socket.emit('npc:error', { message });
    }
  });

  /**
   * Player closed the dialog window.
   */
  socket.on('npc:close', () => {
    const player = connectedPlayers.get(socket.id);
    if (!player?.characterId) return;

    closeDialog(player.characterId);
  });

  /**
   * Clean up dialog session on disconnect.
   */
  socket.on('disconnect', () => {
    const player = connectedPlayers.get(socket.id);
    if (player?.characterId) {
      closeDialog(player.characterId);
    }
  });
}
