import { Router, Request, Response } from 'express';
import { db } from '../../db/connection.js';
import { logger } from '../../utils/logger.js';
import { findFirstEmptySlot, fetchFullInventory, fetchFullEquipment } from './inventory.js';

export const equipmentRouter = Router();

const VALID_SLOTS = ['mainHand', 'offHand', 'armor', 'accessory1', 'accessory2', 'ancillary1', 'ancillary2'] as const;

// Get character equipped items
equipmentRouter.get('/character/:characterId', async (req: Request, res: Response) => {
  try {
    interface EquipmentRow {
      slot_id: string; item_id: number; item_key: string;
      itemName: string; iconUrl: string | null;
      category: string; rarity: string; tier: number; material: string | null;
      is_two_handed: boolean; model_data: string | null;
    }

    const rows = await db.query<EquipmentRow>(`
      SELECT ce.slot_id, ce.item_id, i.item_key, i.name AS itemName, i.icon_url AS iconUrl,
             i.category, i.rarity, i.tier, i.material, i.is_two_handed, i.model_data
      FROM character_equipment ce
      JOIN items i ON ce.item_id = i.id
      WHERE ce.character_id = ?
    `, [req.params.characterId]);

    // Build slot map matching frontend EquippedItem shape
    const equipment: Record<string, unknown> = {};
    for (const slot of VALID_SLOTS) {
      const row = rows.find(r => r.slot_id === slot);
      equipment[slot] = row ? {
        slotId: row.slot_id,
        itemName: row.itemName,
        iconUrl: row.iconUrl || null,
        category: row.category,
        rarity: row.rarity,
        tier: row.tier,
        material: row.material,
      } : null;
    }

    res.json(equipment);
  } catch (error) {
    logger.error('Failed to fetch equipment:', error);
    res.status(500).json({ error: 'Failed to fetch equipment' });
  }
});

// Equip an item from inventory
equipmentRouter.post('/character/:characterId/equip', async (req: Request, res: Response) => {
  try {
    const { slot_id, inventory_id } = req.body;
    const characterId = req.params.characterId;

    // Validate slot
    if (!slot_id || !VALID_SLOTS.includes(slot_id)) {
      return res.status(400).json({ error: `Invalid slot. Must be one of: ${VALID_SLOTS.join(', ')}` });
    }

    if (!inventory_id) {
      return res.status(400).json({ error: 'inventory_id required' });
    }

    // Get the inventory item with full item data
    const invItem = await db.queryOne<{
      id: number; item_id: number; quantity: number;
      slot_type: string; is_two_handed: boolean; category: string; name: string;
    }>(`
      SELECT ci.id, ci.item_id, ci.quantity, i.slot_type, i.is_two_handed, i.category, i.name
      FROM character_inventory ci
      JOIN items i ON ci.item_id = i.id
      WHERE ci.id = ? AND ci.character_id = ?
    `, [inventory_id, characterId]);

    if (!invItem) {
      return res.status(404).json({ error: 'Item not found in inventory' });
    }

    // Validate slot_type matches the target slot
    if (invItem.slot_type && invItem.slot_type !== slot_id) {
      // Allow mainHand items in mainHand, offHand items in offHand, armor in armor
      // Accessories and ancillaries are more flexible
      const slotGroup = slot_id.startsWith('accessory') ? 'accessory' : slot_id.startsWith('ancillary') ? 'ancillary' : slot_id;
      const itemGroup = invItem.slot_type.startsWith('accessory') ? 'accessory' : invItem.slot_type.startsWith('ancillary') ? 'ancillary' : invItem.slot_type;

      if (slotGroup !== itemGroup) {
        return res.status(400).json({ error: `${invItem.name} cannot be equipped in ${slot_id} slot` });
      }
    }

    await db.transaction(async (conn) => {
      // Check if something is already equipped in this slot
      const currentEquip = await conn.query(`
        SELECT ce.id, ce.item_id FROM character_equipment ce
        WHERE ce.character_id = ? AND ce.slot_id = ?
      `, [characterId, slot_id]);

      // If replacing, return old item to inventory with a proper slot_number
      if (currentEquip.length > 0) {
        const emptySlot = await findFirstEmptySlot(characterId, conn);
        await conn.query(`
          INSERT INTO character_inventory (character_id, item_id, quantity, slot_number)
          VALUES (?, ?, 1, ?)
        `, [characterId, currentEquip[0].item_id, emptySlot]);

        await conn.query(`
          DELETE FROM character_equipment WHERE id = ?
        `, [currentEquip[0].id]);
      }

      // Two-handed weapon check: auto-unequip offHand
      if (invItem.is_two_handed && slot_id === 'mainHand') {
        const offHandEquip = await conn.query(`
          SELECT ce.id, ce.item_id FROM character_equipment ce
          WHERE ce.character_id = ? AND ce.slot_id = 'offHand'
        `, [characterId]);

        if (offHandEquip.length > 0) {
          const emptySlot2 = await findFirstEmptySlot(characterId, conn);
          await conn.query(`
            INSERT INTO character_inventory (character_id, item_id, quantity, slot_number)
            VALUES (?, ?, 1, ?)
          `, [characterId, offHandEquip[0].item_id, emptySlot2]);

          await conn.query(`
            DELETE FROM character_equipment WHERE id = ?
          `, [offHandEquip[0].id]);
        }
      }

      // Remove item from inventory
      if (invItem.quantity > 1) {
        await conn.query(`
          UPDATE character_inventory SET quantity = quantity - 1 WHERE id = ?
        `, [invItem.id]);
      } else {
        await conn.query(`
          DELETE FROM character_inventory WHERE id = ?
        `, [invItem.id]);
      }

      // Equip the item
      await conn.query(`
        INSERT INTO character_equipment (character_id, slot_id, item_id)
        VALUES (?, ?, ?)
      `, [characterId, slot_id, invItem.item_id]);
    });

    // Return full updated state
    const [inventory, equipment] = await Promise.all([
      fetchFullInventory(characterId),
      fetchFullEquipment(characterId),
    ]);

    res.json({ success: true, message: `Equipped ${invItem.name} in ${slot_id}`, inventory, equipment });
  } catch (error) {
    logger.error('Failed to equip item:', error);
    res.status(500).json({ error: 'Failed to equip item' });
  }
});

// Unequip an item (return to inventory)
equipmentRouter.post('/character/:characterId/unequip', async (req: Request, res: Response) => {
  try {
    const { slot_id } = req.body;
    const characterId = req.params.characterId;

    if (!slot_id || !VALID_SLOTS.includes(slot_id)) {
      return res.status(400).json({ error: `Invalid slot. Must be one of: ${VALID_SLOTS.join(', ')}` });
    }

    const equipped = await db.queryOne<{ id: number; item_id: number }>(`
      SELECT ce.id, ce.item_id FROM character_equipment ce
      WHERE ce.character_id = ? AND ce.slot_id = ?
    `, [characterId, slot_id]);

    if (!equipped) {
      return res.status(404).json({ error: 'No item equipped in that slot' });
    }

    // Find target slot: use provided slot_number or find first empty
    const targetSlot = req.body.target_slot_number || await findFirstEmptySlot(characterId);
    if (!targetSlot) {
      return res.status(400).json({ error: 'Inventory is full' });
    }

    await db.transaction(async (conn) => {
      // Return item to inventory with proper slot_number
      await conn.query(`
        INSERT INTO character_inventory (character_id, item_id, quantity, slot_number)
        VALUES (?, ?, 1, ?)
      `, [characterId, equipped.item_id, targetSlot]);

      // Remove from equipment
      await conn.query(`
        DELETE FROM character_equipment WHERE id = ?
      `, [equipped.id]);
    });

    // Return full updated state
    const [inventory, equipment] = await Promise.all([
      fetchFullInventory(characterId),
      fetchFullEquipment(characterId),
    ]);

    res.json({ success: true, message: `Unequipped item from ${slot_id}`, inventory, equipment });
  } catch (error) {
    logger.error('Failed to unequip item:', error);
    res.status(500).json({ error: 'Failed to unequip item' });
  }
});
