import { Router, Request, Response } from 'express';
import { db } from '../../db/connection.js';
import { logger } from '../../utils/logger.js';

export { findFirstEmptySlot, fetchFullInventory, fetchFullEquipment };

export const inventoryRouter = Router();

const MAX_SLOTS = 25;

// Find the first empty inventory slot (1-25) for a character
async function findFirstEmptySlot(characterId: number | string | string[], conn?: { query: typeof db.query }): Promise<number | null> {
  const source = conn || db;
  const occupied = await source.query<{ slot_number: number }>(`
    SELECT slot_number FROM character_inventory
    WHERE character_id = ? AND slot_number IS NOT NULL
    ORDER BY slot_number
  `, [characterId]);

  const usedSlots = new Set(occupied.map(r => r.slot_number));
  for (let i = 1; i <= MAX_SLOTS; i++) {
    if (!usedSlots.has(i)) return i;
  }
  return null; // inventory full
}

// Shared query to fetch full inventory for a character (used by multiple endpoints)
async function fetchFullInventory(characterId: number | string | string[]) {
  return db.query(`
    SELECT ci.id AS inventory_id, ci.item_id, ci.quantity, ci.slot_number,
           ci.durability, ci.metadata,
           i.item_key, i.name, i.description, i.icon_url, i.category, i.rarity,
           i.tier, i.material, i.slot_type, i.is_two_handed, i.weight,
           i.max_stack, i.is_usable, i.is_tradeable, i.base_price, i.model_data
    FROM character_inventory ci
    JOIN items i ON ci.item_id = i.id
    WHERE ci.character_id = ?
    ORDER BY ci.slot_number
  `, [characterId]);
}

// Shared query to fetch full equipment for a character
async function fetchFullEquipment(characterId: number | string | string[]) {
  const VALID_SLOTS = ['mainHand', 'offHand', 'armor', 'accessory1', 'accessory2', 'ancillary1', 'ancillary2'];
  const rows = await db.query(`
    SELECT ce.id AS equipment_id, ce.slot_id, ce.item_id,
           i.item_key, i.name AS itemName, i.description, i.icon_url AS iconUrl,
           i.category, i.rarity, i.tier, i.material,
           i.slot_type, i.is_two_handed, i.weight, i.base_price, i.model_data
    FROM character_equipment ce
    JOIN items i ON ce.item_id = i.id
    WHERE ce.character_id = ?
  `, [characterId]) as Array<{
    equipment_id: number; slot_id: string; item_id: number;
    item_key: string; itemName: string; description: string | null; iconUrl: string | null;
    category: string; rarity: string; tier: number; material: string | null;
    slot_type: string | null; is_two_handed: boolean; weight: number;
    base_price: number; model_data: string | null;
  }>;

  const equipment: Record<string, unknown> = {};
  for (const slot of VALID_SLOTS) {
    const row = rows.find(r => r.slot_id === slot);
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
  return equipment;
}

// Get character inventory
inventoryRouter.get('/:characterId', async (req: Request, res: Response) => {
  try {
    const inventory = await db.query(`
      SELECT ci.*, i.item_key, i.name, i.description, i.category, i.rarity,
             i.weight, i.max_stack, i.is_usable, i.is_tradeable, i.base_price, i.icon_url
      FROM character_inventory ci
      JOIN items i ON ci.item_id = i.id
      WHERE ci.character_id = ?
      ORDER BY ci.slot_number, i.category, i.name
    `, [req.params.characterId]);

    // Calculate total weight
    const totalWeight = inventory.reduce((sum: number, item: { weight: number; quantity: number }) => {
      return sum + (item.weight * item.quantity);
    }, 0);

    res.json({
      items: inventory,
      totalWeight,
      itemCount: inventory.length,
    });
  } catch (error) {
    logger.error('Failed to fetch inventory:', error);
    res.status(500).json({ error: 'Failed to fetch inventory' });
  }
});

// Add item to inventory
inventoryRouter.post('/:characterId/items', async (req: Request, res: Response) => {
  try {
    const { item_key, quantity = 1, slot_number, metadata } = req.body;

    // Get item definition
    const item = await db.queryOne<{ id: number; max_stack: number; name: string }>(`
      SELECT id, max_stack, name FROM items WHERE item_key = ?
    `, [item_key]);

    if (!item) {
      return res.status(404).json({ error: 'Item not found' });
    }

    // Check if item already exists in inventory and can stack
    const existing = await db.queryOne<{ id: number; quantity: number }>(`
      SELECT id, quantity FROM character_inventory
      WHERE character_id = ? AND item_id = ? AND quantity < ?
    `, [req.params.characterId, item.id, item.max_stack]);

    if (existing && item.max_stack > 1) {
      // Add to existing stack
      const newQuantity = Math.min(existing.quantity + quantity, item.max_stack);
      await db.execute(`
        UPDATE character_inventory SET quantity = ? WHERE id = ?
      `, [newQuantity, existing.id]);
    } else {
      // Create new inventory slot
      await db.insert(`
        INSERT INTO character_inventory (character_id, item_id, quantity, slot_number, metadata)
        VALUES (?, ?, ?, ?, ?)
      `, [req.params.characterId, item.id, quantity, slot_number || null, metadata ? JSON.stringify(metadata) : null]);
    }

    res.json({ success: true, message: `Added ${quantity}x ${item.name} to inventory` });
  } catch (error) {
    logger.error('Failed to add item:', error);
    res.status(500).json({ error: 'Failed to add item' });
  }
});

// Remove item from inventory
inventoryRouter.delete('/:characterId/items/:inventoryId', async (req: Request, res: Response) => {
  try {
    const { quantity } = req.body || {};

    const item = await db.queryOne<{ quantity: number }>(`
      SELECT quantity FROM character_inventory WHERE id = ? AND character_id = ?
    `, [req.params.inventoryId, req.params.characterId]);

    if (!item) {
      return res.status(404).json({ error: 'Item not found in inventory' });
    }

    const removeCount = quantity || item.quantity;

    if (removeCount >= item.quantity) {
      await db.execute(`DELETE FROM character_inventory WHERE id = ?`, [req.params.inventoryId]);
    } else {
      await db.execute(`
        UPDATE character_inventory SET quantity = quantity - ? WHERE id = ?
      `, [removeCount, req.params.inventoryId]);
    }

    res.json({ success: true, removed: removeCount });
  } catch (error) {
    logger.error('Failed to remove item:', error);
    res.status(500).json({ error: 'Failed to remove item' });
  }
});

// Use an item
inventoryRouter.post('/:characterId/items/:inventoryId/use', async (req: Request, res: Response) => {
  try {
    const inventoryItem = await db.queryOne<{ id: number; quantity: number; item_id: number }>(`
      SELECT ci.*, i.item_key, i.is_usable, i.category
      FROM character_inventory ci
      JOIN items i ON ci.item_id = i.id
      WHERE ci.id = ? AND ci.character_id = ?
    `, [req.params.inventoryId, req.params.characterId]) as { id: number; quantity: number; item_key: string; is_usable: boolean; category: string } | null;

    if (!inventoryItem) {
      return res.status(404).json({ error: 'Item not found in inventory' });
    }

    if (!inventoryItem.is_usable) {
      return res.status(400).json({ error: 'This item cannot be used' });
    }

    // Handle different item types
    let effect: { type: string; value: number } | null = null;

    switch (inventoryItem.item_key) {
      case 'bread':
        await db.execute(`
          UPDATE character_vitals SET hunger = LEAST(100, hunger + 20) WHERE character_id = ?
        `, [req.params.characterId]);
        effect = { type: 'hunger', value: 20 };
        break;
      case 'water_skin':
        await db.execute(`
          UPDATE character_vitals SET thirst = LEAST(100, thirst + 30) WHERE character_id = ?
        `, [req.params.characterId]);
        effect = { type: 'thirst', value: 30 };
        break;
      case 'bandage':
        await db.execute(`
          UPDATE character_vitals SET health = LEAST(max_health, health + 15) WHERE character_id = ?
        `, [req.params.characterId]);
        effect = { type: 'health', value: 15 };
        break;
      case 'poultice':
        await db.execute(`
          UPDATE character_vitals SET health = LEAST(max_health, health + 30) WHERE character_id = ?
        `, [req.params.characterId]);
        effect = { type: 'health', value: 30 };
        break;
      case 'milk_of_poppy':
        await db.execute(`
          UPDATE character_vitals SET stress = GREATEST(0, stress - 30) WHERE character_id = ?
        `, [req.params.characterId]);
        // Apply milk_of_poppy status effect
        const mopEffect = await db.queryOne<{ id: number }>(`
          SELECT id FROM status_effects WHERE effect_key = 'milk_of_poppy'
        `);
        if (mopEffect) {
          await db.insert(`
            INSERT INTO character_status_effects (character_id, effect_id, source_type, expires_at)
            VALUES (?, ?, 'item', DATE_ADD(NOW(), INTERVAL 1200 SECOND))
          `, [req.params.characterId, mopEffect.id]);
        }
        effect = { type: 'stress', value: -30 };
        break;
      case 'maester_kit':
        // Improve wound severity by one tier and restore some health
        const charWound = await db.queryOne<{ wound_severity: string }>(`
          SELECT wound_severity FROM characters WHERE id = ?
        `, [req.params.characterId]);
        if (!charWound || charWound.wound_severity === 'healthy') {
          return res.status(400).json({ error: 'Character has no wounds to treat' });
        }
        const severityOrder: Record<string, string> = {
          grave: 'severe', severe: 'serious', serious: 'light', light: 'healthy',
        };
        const newSeverity = severityOrder[charWound.wound_severity] ?? 'healthy';
        if (newSeverity === 'healthy') {
          await db.execute(`
            UPDATE characters SET wound_severity = 'healthy', wound_received_at = NULL, wound_heals_at = NULL
            WHERE id = ?
          `, [req.params.characterId]);
        } else if (newSeverity === 'light') {
          const healConfig = await db.queryOne<{ self_heal_seconds: number }>(`
            SELECT self_heal_seconds FROM wound_heal_config WHERE wound_severity = 'light'
          `);
          const healSeconds = healConfig?.self_heal_seconds ?? 86400;
          await db.execute(`
            UPDATE characters SET wound_severity = 'light',
              wound_heals_at = DATE_ADD(NOW(), INTERVAL ? SECOND)
            WHERE id = ?
          `, [healSeconds, req.params.characterId]);
        } else {
          await db.execute(`
            UPDATE characters SET wound_severity = ? WHERE id = ?
          `, [newSeverity, req.params.characterId]);
        }
        // Restore some health
        await db.execute(`
          UPDATE character_vitals SET health = LEAST(max_health, health + 25) WHERE character_id = ?
        `, [req.params.characterId]);
        effect = { type: 'heal_wounds', value: 25 };
        break;
      case 'infection_poultice': {
        // Find active infection ailment on the character
        const ailment = await db.queryOne<{
          id: number; terminal_expires_at: string; is_terminal_paused: boolean;
        }>(`
          SELECT ca.id, ca.terminal_expires_at, ca.is_terminal_paused
          FROM character_ailments ca
          JOIN ailment_definitions ad ON ca.ailment_id = ad.id
          WHERE ca.character_id = ? AND ad.ailment_key = 'infection'
        `, [req.params.characterId]);
        if (!ailment) {
          return res.status(400).json({ error: 'No infection to treat' });
        }
        const MEDICINE_TERMINAL_PAUSE_SECONDS = 28800; // 8 hours
        const MEDICINE_IMMUNITY_BOOST_SECONDS = 21600; // 6 hours
        await db.execute(`
          UPDATE character_ailments SET
            is_terminal_paused = TRUE,
            terminal_paused_remaining_seconds = GREATEST(0,
              TIMESTAMPDIFF(SECOND, NOW(), terminal_expires_at)),
            terminal_expires_at = DATE_ADD(terminal_expires_at,
              INTERVAL ? SECOND),
            immunity_expires_at = DATE_SUB(immunity_expires_at,
              INTERVAL ? SECOND)
          WHERE id = ?
        `, [MEDICINE_TERMINAL_PAUSE_SECONDS, MEDICINE_IMMUNITY_BOOST_SECONDS, ailment.id]);
        effect = { type: 'medicine', value: MEDICINE_IMMUNITY_BOOST_SECONDS };
        break;
      }
      default:
        return res.status(400).json({ error: 'Item use not implemented' });
    }

    // Remove one from stack
    if (inventoryItem.quantity > 1) {
      await db.execute(`UPDATE character_inventory SET quantity = quantity - 1 WHERE id = ?`, [req.params.inventoryId]);
    } else {
      await db.execute(`DELETE FROM character_inventory WHERE id = ?`, [req.params.inventoryId]);
    }

    res.json({ success: true, effect, itemUsed: inventoryItem.item_key });
  } catch (error) {
    logger.error('Failed to use item:', error);
    res.status(500).json({ error: 'Failed to use item' });
  }
});

// Transfer item between characters
inventoryRouter.post('/:characterId/items/:inventoryId/transfer', async (req: Request, res: Response) => {
  try {
    const { targetCharacterId, quantity } = req.body;

    if (!targetCharacterId) {
      return res.status(400).json({ error: 'Target character ID required' });
    }

    const item = await db.queryOne<{ id: number; quantity: number; item_id: number; is_tradeable: boolean }>(`
      SELECT ci.*, i.is_tradeable
      FROM character_inventory ci
      JOIN items i ON ci.item_id = i.id
      WHERE ci.id = ? AND ci.character_id = ?
    `, [req.params.inventoryId, req.params.characterId]) as { id: number; quantity: number; item_id: number; is_tradeable: boolean } | null;

    if (!item) {
      return res.status(404).json({ error: 'Item not found' });
    }

    if (!item.is_tradeable) {
      return res.status(400).json({ error: 'Item cannot be traded' });
    }

    const transferQuantity = quantity || item.quantity;

    await db.transaction(async (conn) => {
      // Remove from source
      if (transferQuantity >= item.quantity) {
        await conn.query(`DELETE FROM character_inventory WHERE id = ?`, [item.id]);
      } else {
        await conn.query(`UPDATE character_inventory SET quantity = quantity - ? WHERE id = ?`, [transferQuantity, item.id]);
      }

      // Add to target
      await conn.query(`
        INSERT INTO character_inventory (character_id, item_id, quantity)
        VALUES (?, ?, ?)
        ON DUPLICATE KEY UPDATE quantity = quantity + ?
      `, [targetCharacterId, item.item_id, transferQuantity, transferQuantity]);
    });

    res.json({ success: true, transferred: transferQuantity });
  } catch (error) {
    logger.error('Failed to transfer item:', error);
    res.status(500).json({ error: 'Failed to transfer item' });
  }
});

// Move / swap inventory slots
inventoryRouter.patch('/:characterId/move', async (req: Request, res: Response) => {
  try {
    const { sourceSlot, targetSlot } = req.body;
    const characterId = req.params.characterId;

    if (!sourceSlot || !targetSlot || sourceSlot === targetSlot) {
      return res.status(400).json({ error: 'sourceSlot and targetSlot are required and must differ' });
    }

    if (sourceSlot < 1 || sourceSlot > MAX_SLOTS || targetSlot < 1 || targetSlot > MAX_SLOTS) {
      return res.status(400).json({ error: `Slots must be between 1 and ${MAX_SLOTS}` });
    }

    await db.transaction(async (conn) => {
      // Get the source item
      const sourceItem = await conn.query(`
        SELECT id FROM character_inventory
        WHERE character_id = ? AND slot_number = ?
      `, [characterId, sourceSlot]);

      if (sourceItem.length === 0) {
        throw new Error('No item in source slot');
      }

      // Get the target item (may be empty)
      const targetItem = await conn.query(`
        SELECT id FROM character_inventory
        WHERE character_id = ? AND slot_number = ?
      `, [characterId, targetSlot]);

      if (targetItem.length > 0) {
        // Swap: move target to a temp slot, then reassign both
        await conn.query(`UPDATE character_inventory SET slot_number = 0 WHERE id = ?`, [targetItem[0].id]);
        await conn.query(`UPDATE character_inventory SET slot_number = ? WHERE id = ?`, [targetSlot, sourceItem[0].id]);
        await conn.query(`UPDATE character_inventory SET slot_number = ? WHERE id = ?`, [sourceSlot, targetItem[0].id]);
      } else {
        // Simple move
        await conn.query(`UPDATE character_inventory SET slot_number = ? WHERE id = ?`, [targetSlot, sourceItem[0].id]);
      }
    });

    const inventory = await fetchFullInventory(characterId);
    res.json({ success: true, inventory });
  } catch (error) {
    logger.error('Failed to move item:', error);
    const message = error instanceof Error ? error.message : 'Failed to move item';
    res.status(500).json({ error: message });
  }
});

// Get all available items (for shop/admin)
inventoryRouter.get('/items/all', async (_req: Request, res: Response) => {
  try {
    const items = await db.query(`
      SELECT * FROM items ORDER BY category, rarity, name
    `);
    res.json(items);
  } catch (error) {
    logger.error('Failed to fetch items:', error);
    res.status(500).json({ error: 'Failed to fetch items' });
  }
});
