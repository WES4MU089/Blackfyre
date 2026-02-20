/**
 * Shop WebSocket handlers.
 *
 * Handles purchase requests and shop closure from the trade UI.
 * The shop is opened via the NPC dialog engine's `open_shop` action.
 */

import { Server as SocketServer, Socket } from 'socket.io';
import { connectedPlayers } from './index.js';
import { db } from '../db/connection.js';
import { logger } from '../utils/logger.js';
import { getActiveShop, closeShop, loadContext } from '../npc/dialog-engine.js';
import { findFirstEmptySlot, fetchFullInventory } from '../api/routes/inventory.js';

/**
 * Format a cash value (stored in stars) into Dragon/Stag/Star denominations.
 */
function formatCurrency(stars: number): string {
  const dragons = Math.floor(stars / 10000);
  const stags = Math.floor((stars % 10000) / 100);
  const remaining = stars % 100;

  const parts: string[] = [];
  if (dragons > 0) parts.push(`${dragons} dragon${dragons !== 1 ? 's' : ''}`);
  if (stags > 0) parts.push(`${stags} stag${stags !== 1 ? 's' : ''}`);
  if (remaining > 0 || parts.length === 0) parts.push(`${remaining} star${remaining !== 1 ? 's' : ''}`);

  return parts.join(', ');
}

export function setupShopHandlers(io: SocketServer, socket: Socket): void {

  /**
   * Player requests to buy an item from the shop.
   */
  socket.on('shop:buy', async (data: { itemKey: string }) => {
    const player = connectedPlayers.get(socket.id);
    if (!player?.characterId) return;

    const characterId = player.characterId;
    const shopItems = getActiveShop(characterId);

    if (!shopItems) {
      socket.emit('shop:buy-result', { success: false, message: 'No shop is open.' });
      return;
    }

    if (!shopItems.includes(data.itemKey)) {
      socket.emit('shop:buy-result', { success: false, message: 'This item is not available.' });
      return;
    }

    try {
      // Look up item definition
      const item = await db.queryOne<{ id: number; name: string; base_price: number }>(
        'SELECT id, name, base_price FROM items WHERE item_key = ?',
        [data.itemKey],
      );
      if (!item) {
        socket.emit('shop:buy-result', { success: false, message: 'Item not found.' });
        return;
      }

      const price = Number(item.base_price);

      // Check cash
      const finances = await db.queryOne<{ cash: number }>(
        'SELECT cash FROM character_finances WHERE character_id = ?',
        [characterId],
      );
      if (!finances || Number(finances.cash) < price) {
        socket.emit('shop:buy-result', { success: false, message: "You haven't the coin for that." });
        return;
      }

      // Check inventory space
      const slot = await findFirstEmptySlot(characterId);
      if (slot === null) {
        socket.emit('shop:buy-result', { success: false, message: 'Your inventory is full.' });
        return;
      }

      // Execute purchase transaction
      await db.transaction(async (conn) => {
        await conn.query(
          'UPDATE character_finances SET cash = cash - ? WHERE character_id = ?',
          [price, characterId],
        );
        await conn.query(
          'INSERT INTO character_inventory (character_id, item_id, quantity, slot_number) VALUES (?, ?, 1, ?)',
          [characterId, item.id, slot],
        );
        await conn.query(
          `INSERT INTO transactions (character_id, transaction_type, amount, currency_type, description)
           VALUES (?, 'purchase', ?, 'cash', ?)`,
          [characterId, price, `Blacksmith \u2014 ${item.name} (${formatCurrency(price)})`],
        );
      });

      // Broadcast finances update
      const updatedFinances = await db.queryOne(
        'SELECT * FROM character_finances WHERE character_id = ?',
        [characterId],
      );
      io.to(`character:${characterId}`).emit('finances:changed', updatedFinances);

      // Broadcast inventory update
      const inventory = await fetchFullInventory(characterId);
      io.to(`character:${characterId}`).emit('inventory:changed', inventory);

      // Send purchase result with updated cash for the shop UI
      const newCash = Number((updatedFinances as { cash: number })?.cash ?? 0);
      socket.emit('shop:buy-result', {
        success: true,
        message: `Purchased ${item.name}.`,
        itemName: item.name,
        cash: newCash,
      });

      logger.info(`Shop purchase: character ${characterId} bought ${item.name} (${formatCurrency(price)} deducted)`);
    } catch (err) {
      logger.error(`Shop buy error for character ${characterId}:`, err);
      socket.emit('shop:buy-result', { success: false, message: 'Purchase failed.' });
    }
  });

  /**
   * Player closed the shop window.
   */
  socket.on('shop:close', () => {
    const player = connectedPlayers.get(socket.id);
    if (!player?.characterId) return;
    closeShop(player.characterId);
  });

  /**
   * Clean up shop on disconnect.
   */
  socket.on('disconnect', () => {
    const player = connectedPlayers.get(socket.id);
    if (player?.characterId) {
      closeShop(player.characterId);
    }
  });
}
