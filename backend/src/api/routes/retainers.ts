/**
 * Retainer REST API Routes — management window endpoints.
 *
 * All routes validate ownership via isRetainerOf() before performing actions.
 */

import { Router, Request, Response } from 'express';
import { db } from '../../db/connection.js';
import { logger } from '../../utils/logger.js';
import {
  getRetainerTiers,
  getPlayerRetainers,
  getRetainerDetail,
  hireRetainer,
  dismissRetainer,
  isRetainerOf,
  getRetainerAptCap,
} from '../../retainers/retainer-manager.js';
import { findFirstEmptySlot, fetchFullInventory, fetchFullEquipment } from './inventory.js';
import { calculateMaxHealth } from '../../utils/formulas.js';

export const retainersRouter = Router();

const VALID_SLOTS = ['mainHand', 'offHand', 'armor', 'accessory1', 'accessory2', 'ancillary1', 'ancillary2'] as const;
const VALID_APTITUDES = ['prowess', 'fortitude', 'command', 'cunning', 'stewardship', 'presence', 'lore', 'faith'] as const;

// ── GET /retainers/tiers — list available tiers ──────────────

retainersRouter.get('/tiers', async (_req: Request, res: Response) => {
  try {
    const tiers = await getRetainerTiers();
    res.json(tiers);
  } catch (error) {
    logger.error('Failed to fetch retainer tiers:', error);
    res.status(500).json({ error: 'Failed to fetch retainer tiers' });
  }
});

// ── GET /retainers/:characterId — list player's retainers ───

retainersRouter.get('/:characterId', async (req: Request, res: Response) => {
  try {
    const characterId = parseInt(req.params.characterId, 10);
    const retainers = await getPlayerRetainers(characterId);
    res.json(retainers);
  } catch (error) {
    logger.error('Failed to fetch retainers:', error);
    res.status(500).json({ error: 'Failed to fetch retainers' });
  }
});

// ── GET /retainers/:characterId/:retainerId — full detail ───

retainersRouter.get('/:characterId/:retainerId', async (req: Request, res: Response) => {
  try {
    const characterId = parseInt(req.params.characterId, 10);
    const retainerId = parseInt(req.params.retainerId, 10);
    const detail = await getRetainerDetail(characterId, retainerId);
    res.json(detail);
  } catch (error) {
    const msg = error instanceof Error ? error.message : 'unknown';
    if (msg === 'NOT_YOUR_RETAINER') {
      return res.status(403).json({ error: 'Not your retainer' });
    }
    logger.error('Failed to fetch retainer detail:', error);
    res.status(500).json({ error: 'Failed to fetch retainer detail' });
  }
});

// ── POST /retainers/:characterId/hire — hire a retainer ─────

retainersRouter.post('/:characterId/hire', async (req: Request, res: Response) => {
  try {
    const characterId = parseInt(req.params.characterId, 10);
    const { tier, name, aptitudes } = req.body;

    if (!tier || !name || !aptitudes) {
      return res.status(400).json({ error: 'tier, name, and aptitudes are required' });
    }

    if (typeof name !== 'string' || name.trim().length === 0 || name.trim().length > 50) {
      return res.status(400).json({ error: 'Name must be 1-50 characters' });
    }

    const retainer = await hireRetainer(characterId, tier, name.trim(), aptitudes);
    res.status(201).json(retainer);
  } catch (error) {
    const msg = error instanceof Error ? error.message : 'unknown';
    if (msg === 'INVALID_TIER') return res.status(400).json({ error: 'Invalid tier' });
    if (msg === 'RETAINER_LIMIT_REACHED') return res.status(400).json({ error: 'Maximum 4 retainers reached' });
    if (msg === 'INSUFFICIENT_GOLD') return res.status(400).json({ error: 'Insufficient gold' });
    if (msg.startsWith('MISSING_APTITUDE')) return res.status(400).json({ error: `Missing aptitude: ${msg.split(':')[1]}` });
    if (msg.startsWith('INVALID_APTITUDE')) return res.status(400).json({ error: `Invalid aptitude value: ${msg.split(':')[1]}` });
    if (msg.startsWith('APTITUDE_OUT_OF_RANGE')) return res.status(400).json({ error: `Aptitude out of range (1-7): ${msg.split(':')[1]}` });
    if (msg.startsWith('WRONG_POINT_TOTAL')) return res.status(400).json({ error: `Point total must match tier budget` });
    logger.error('Failed to hire retainer:', error);
    res.status(500).json({ error: 'Failed to hire retainer' });
  }
});

// ── DELETE /retainers/:characterId/:retainerId — dismiss ────

retainersRouter.delete('/:characterId/:retainerId', async (req: Request, res: Response) => {
  try {
    const characterId = parseInt(req.params.characterId, 10);
    const retainerId = parseInt(req.params.retainerId, 10);
    await dismissRetainer(characterId, retainerId);
    res.json({ success: true, message: 'Retainer dismissed' });
  } catch (error) {
    const msg = error instanceof Error ? error.message : 'unknown';
    if (msg === 'NOT_YOUR_RETAINER') {
      return res.status(403).json({ error: 'Not your retainer' });
    }
    logger.error('Failed to dismiss retainer:', error);
    res.status(500).json({ error: 'Failed to dismiss retainer' });
  }
});

// ── POST /retainers/:characterId/:retainerId/equip — equip item on retainer ──

retainersRouter.post('/:characterId/:retainerId/equip', async (req: Request, res: Response) => {
  try {
    const characterId = parseInt(req.params.characterId, 10);
    const retainerId = parseInt(req.params.retainerId, 10);
    const { slot_id, inventory_id } = req.body;

    // Validate ownership
    if (!(await isRetainerOf(retainerId, characterId))) {
      return res.status(403).json({ error: 'Not your retainer' });
    }

    if (!slot_id || !VALID_SLOTS.includes(slot_id)) {
      return res.status(400).json({ error: `Invalid slot. Must be one of: ${VALID_SLOTS.join(', ')}` });
    }
    if (!inventory_id) {
      return res.status(400).json({ error: 'inventory_id required' });
    }

    // Get inventory item (from retainer's inventory)
    const invItem = await db.queryOne<{
      id: number; item_id: number; quantity: number;
      slot_type: string; is_two_handed: boolean; name: string;
    }>(`
      SELECT ci.id, ci.item_id, ci.quantity, i.slot_type, i.is_two_handed, i.name
      FROM character_inventory ci
      JOIN items i ON ci.item_id = i.id
      WHERE ci.id = ? AND ci.character_id = ?
    `, [inventory_id, retainerId]);

    if (!invItem) {
      return res.status(404).json({ error: 'Item not found in retainer inventory' });
    }

    await db.transaction(async (conn) => {
      // Unequip current item in slot (return to retainer inventory)
      const currentEquip = await conn.query(
        'SELECT id, item_id FROM character_equipment WHERE character_id = ? AND slot_id = ?',
        [retainerId, slot_id],
      );
      if (currentEquip.length > 0) {
        const emptySlot = await findFirstEmptySlot(retainerId, conn);
        await conn.query(
          'INSERT INTO character_inventory (character_id, item_id, quantity, slot_number) VALUES (?, ?, 1, ?)',
          [retainerId, currentEquip[0].item_id, emptySlot],
        );
        await conn.query('DELETE FROM character_equipment WHERE id = ?', [currentEquip[0].id]);
      }

      // Two-handed check: auto-unequip offHand
      if (invItem.is_two_handed && slot_id === 'mainHand') {
        const offHand = await conn.query(
          'SELECT id, item_id FROM character_equipment WHERE character_id = ? AND slot_id = ?',
          [retainerId, 'offHand'],
        );
        if (offHand.length > 0) {
          const emptySlot2 = await findFirstEmptySlot(retainerId, conn);
          await conn.query(
            'INSERT INTO character_inventory (character_id, item_id, quantity, slot_number) VALUES (?, ?, 1, ?)',
            [retainerId, offHand[0].item_id, emptySlot2],
          );
          await conn.query('DELETE FROM character_equipment WHERE id = ?', [offHand[0].id]);
        }
      }

      // Remove from inventory
      if (invItem.quantity > 1) {
        await conn.query('UPDATE character_inventory SET quantity = quantity - 1 WHERE id = ?', [invItem.id]);
      } else {
        await conn.query('DELETE FROM character_inventory WHERE id = ?', [invItem.id]);
      }

      // Equip
      await conn.query(
        'INSERT INTO character_equipment (character_id, slot_id, item_id) VALUES (?, ?, ?)',
        [retainerId, slot_id, invItem.item_id],
      );
    });

    const [inventory, equipment] = await Promise.all([
      fetchFullInventory(retainerId),
      fetchFullEquipment(retainerId),
    ]);

    res.json({ success: true, message: `Equipped ${invItem.name}`, inventory, equipment });
  } catch (error) {
    logger.error('Failed to equip retainer item:', error);
    res.status(500).json({ error: 'Failed to equip item' });
  }
});

// ── POST /retainers/:characterId/:retainerId/unequip — unequip from retainer ──

retainersRouter.post('/:characterId/:retainerId/unequip', async (req: Request, res: Response) => {
  try {
    const characterId = parseInt(req.params.characterId, 10);
    const retainerId = parseInt(req.params.retainerId, 10);
    const { slot_id } = req.body;

    if (!(await isRetainerOf(retainerId, characterId))) {
      return res.status(403).json({ error: 'Not your retainer' });
    }

    if (!slot_id || !VALID_SLOTS.includes(slot_id)) {
      return res.status(400).json({ error: `Invalid slot` });
    }

    const equipped = await db.queryOne<{ id: number; item_id: number }>(
      'SELECT id, item_id FROM character_equipment WHERE character_id = ? AND slot_id = ?',
      [retainerId, slot_id],
    );
    if (!equipped) {
      return res.status(404).json({ error: 'No item equipped in that slot' });
    }

    const targetSlot = await findFirstEmptySlot(retainerId);
    if (!targetSlot) {
      return res.status(400).json({ error: 'Retainer inventory is full' });
    }

    await db.transaction(async (conn) => {
      await conn.query(
        'INSERT INTO character_inventory (character_id, item_id, quantity, slot_number) VALUES (?, ?, 1, ?)',
        [retainerId, equipped.item_id, targetSlot],
      );
      await conn.query('DELETE FROM character_equipment WHERE id = ?', [equipped.id]);
    });

    const [inventory, equipment] = await Promise.all([
      fetchFullInventory(retainerId),
      fetchFullEquipment(retainerId),
    ]);

    res.json({ success: true, message: `Unequipped from ${slot_id}`, inventory, equipment });
  } catch (error) {
    logger.error('Failed to unequip retainer item:', error);
    res.status(500).json({ error: 'Failed to unequip item' });
  }
});

// ── POST /retainers/:characterId/:retainerId/transfer — move item between player & retainer ──

retainersRouter.post('/:characterId/:retainerId/transfer', async (req: Request, res: Response) => {
  try {
    const characterId = parseInt(req.params.characterId, 10);
    const retainerId = parseInt(req.params.retainerId, 10);
    const { inventory_id, direction } = req.body;

    if (!(await isRetainerOf(retainerId, characterId))) {
      return res.status(403).json({ error: 'Not your retainer' });
    }

    if (!inventory_id || !direction || !['to_retainer', 'to_player'].includes(direction)) {
      return res.status(400).json({ error: 'inventory_id and direction (to_retainer|to_player) required' });
    }

    const sourceId = direction === 'to_retainer' ? characterId : retainerId;
    const targetId = direction === 'to_retainer' ? retainerId : characterId;

    // Verify item exists in source inventory
    const invItem = await db.queryOne<{ id: number; item_id: number; quantity: number }>(
      'SELECT id, item_id, quantity FROM character_inventory WHERE id = ? AND character_id = ?',
      [inventory_id, sourceId],
    );
    if (!invItem) {
      return res.status(404).json({ error: 'Item not found in source inventory' });
    }

    const targetSlot = await findFirstEmptySlot(targetId);
    if (!targetSlot) {
      return res.status(400).json({ error: 'Target inventory is full' });
    }

    await db.transaction(async (conn) => {
      // Remove 1 from source
      if (invItem.quantity > 1) {
        await conn.query('UPDATE character_inventory SET quantity = quantity - 1 WHERE id = ?', [invItem.id]);
      } else {
        await conn.query('DELETE FROM character_inventory WHERE id = ?', [invItem.id]);
      }
      // Add to target
      await conn.query(
        'INSERT INTO character_inventory (character_id, item_id, quantity, slot_number) VALUES (?, ?, 1, ?)',
        [targetId, invItem.item_id, targetSlot],
      );
    });

    // Return both inventories
    const [playerInv, retainerInv] = await Promise.all([
      fetchFullInventory(characterId),
      fetchFullInventory(retainerId),
    ]);

    res.json({ success: true, playerInventory: playerInv, retainerInventory: retainerInv });
  } catch (error) {
    logger.error('Failed to transfer item:', error);
    res.status(500).json({ error: 'Failed to transfer item' });
  }
});

// ── PATCH /retainers/:characterId/:retainerId/aptitude — allocate level-up point ──

retainersRouter.patch('/:characterId/:retainerId/aptitude', async (req: Request, res: Response) => {
  try {
    const characterId = parseInt(req.params.characterId, 10);
    const retainerId = parseInt(req.params.retainerId, 10);
    const { aptitude_key } = req.body;

    if (!(await isRetainerOf(retainerId, characterId))) {
      return res.status(403).json({ error: 'Not your retainer' });
    }

    if (!aptitude_key || !VALID_APTITUDES.includes(aptitude_key)) {
      return res.status(400).json({ error: `Invalid aptitude key` });
    }

    // Check unspent points and get tier for cap lookup
    const charRow = await db.queryOne<{ unspent_aptitude_points: number; retainer_tier: number | null }>(
      'SELECT unspent_aptitude_points, retainer_tier FROM characters WHERE id = ?',
      [retainerId],
    );
    if (!charRow || charRow.unspent_aptitude_points <= 0) {
      return res.status(400).json({ error: 'No unspent aptitude points' });
    }
    const aptCap = getRetainerAptCap(charRow.retainer_tier ?? 2);

    // Check current value against per-tier cap
    const apt = await db.queryOne<{ current_value: number }>(
      'SELECT current_value FROM character_aptitudes WHERE character_id = ? AND aptitude_key = ?',
      [retainerId, aptitude_key],
    );
    if (!apt) {
      return res.status(404).json({ error: 'Aptitude not found' });
    }
    if (apt.current_value >= aptCap) {
      return res.status(400).json({ error: `Aptitude already at maximum (${aptCap})` });
    }

    const newValue = apt.current_value + 1;

    await db.transaction(async (conn) => {
      await conn.query(
        'UPDATE character_aptitudes SET current_value = ? WHERE character_id = ? AND aptitude_key = ?',
        [newValue, retainerId, aptitude_key],
      );
      await conn.query(
        'UPDATE characters SET unspent_aptitude_points = unspent_aptitude_points - 1 WHERE id = ?',
        [retainerId],
      );

      // Recalculate max_health if fortitude changed
      if (aptitude_key === 'fortitude') {
        const maxHealth = calculateMaxHealth(newValue);
        await conn.query(
          'UPDATE character_vitals SET max_health = ?, health = LEAST(health, ?) WHERE character_id = ?',
          [maxHealth, maxHealth, retainerId],
        );
      }
    });

    // Return updated aptitudes
    const aptitudes = await db.query(
      `SELECT aptitude_key, base_value, current_value FROM character_aptitudes
       WHERE character_id = ?
       ORDER BY FIELD(aptitude_key, 'prowess','fortitude','command','cunning','stewardship','presence','lore','faith')`,
      [retainerId],
    );
    const updated = await db.queryOne<{ unspent_aptitude_points: number }>(
      'SELECT unspent_aptitude_points FROM characters WHERE id = ?',
      [retainerId],
    );

    res.json({ aptitudes, unspentAptitudePoints: updated?.unspent_aptitude_points ?? 0 });
  } catch (error) {
    logger.error('Failed to allocate retainer aptitude:', error);
    res.status(500).json({ error: 'Failed to allocate aptitude point' });
  }
});
