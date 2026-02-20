/**
 * Shop API routes — herbalist NPC and general item purchasing.
 *
 * POST /buy — Purchase an item from the shop
 */

import { Router, Request, Response } from 'express';
import { db } from '../../db/connection.js';
import { logger } from '../../utils/logger.js';
import { findFirstEmptySlot } from './inventory.js';

export const shopRouter = Router();

/**
 * POST /buy — Purchase an item.
 *
 * Body: { characterId: number, itemKey: string, quantity?: number }
 */
shopRouter.post('/buy', async (req: Request, res: Response) => {
  try {
    const { characterId, itemKey, quantity = 1 } = req.body;

    if (!characterId || !itemKey) {
      return res.status(400).json({ error: 'characterId and itemKey are required' });
    }

    if (quantity < 1 || quantity > 99) {
      return res.status(400).json({ error: 'Quantity must be between 1 and 99' });
    }

    // Get item definition
    const item = await db.queryOne<{
      id: number;
      name: string;
      base_price: number;
      max_stack: number;
    }>(`
      SELECT id, name, base_price, max_stack FROM items WHERE item_key = ?
    `, [itemKey]);

    if (!item) return res.status(404).json({ error: 'Item not found in shop' });

    const totalCost = item.base_price * quantity;

    // Check character has enough gold
    const finances = await db.queryOne<{ gold: number }>(`
      SELECT gold FROM character_finances WHERE character_id = ?
    `, [characterId]);

    if (!finances) return res.status(404).json({ error: 'Character finances not found' });
    if (finances.gold < totalCost) {
      return res.status(400).json({
        error: `Not enough gold. Cost: ${totalCost}, you have: ${finances.gold}`,
      });
    }

    await db.transaction(async (conn) => {
      // Deduct gold
      await conn.query(
        `UPDATE character_finances SET gold = gold - ? WHERE character_id = ?`,
        [totalCost, characterId],
      );

      // Try to stack onto existing inventory
      let remaining = quantity;

      if (item.max_stack > 1) {
        const existingStacks = await conn.query<{ id: number; quantity: number }>(`
          SELECT id, quantity FROM character_inventory
          WHERE character_id = ? AND item_id = ? AND quantity < ?
          ORDER BY quantity DESC
        `, [characterId, item.id, item.max_stack]);

        for (const stack of existingStacks) {
          if (remaining <= 0) break;
          const canAdd = Math.min(remaining, item.max_stack - stack.quantity);
          await conn.query(
            `UPDATE character_inventory SET quantity = quantity + ? WHERE id = ?`,
            [canAdd, stack.id],
          );
          remaining -= canAdd;
        }
      }

      // Create new stacks for remainder
      while (remaining > 0) {
        const slot = await findFirstEmptySlot(characterId, conn as unknown as { query: typeof db.query });
        if (slot === null) {
          throw new Error('INVENTORY_FULL');
        }
        const stackSize = Math.min(remaining, item.max_stack);
        await conn.query(`
          INSERT INTO character_inventory (character_id, item_id, quantity, slot_number)
          VALUES (?, ?, ?, ?)
        `, [characterId, item.id, stackSize, slot]);
        remaining -= stackSize;
      }
    });

    res.json({
      success: true,
      message: `Purchased ${quantity}x ${item.name} for ${totalCost} gold`,
      totalCost,
    });
  } catch (error) {
    if (error instanceof Error && error.message === 'INVENTORY_FULL') {
      return res.status(400).json({ error: 'Inventory full — cannot carry more items' });
    }
    logger.error('Failed to process purchase:', error);
    res.status(500).json({ error: 'Failed to process purchase' });
  }
});
