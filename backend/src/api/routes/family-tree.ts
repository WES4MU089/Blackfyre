import { Router, Request, Response } from 'express';
import { z } from 'zod';
import { db } from '../../db/connection.js';
import { logger } from '../../utils/logger.js';
import { requireAuth } from '../middleware/auth.js';

export const familyTreeRouter = Router();

familyTreeRouter.use(requireAuth());

// Get approved family tree for a house (public view)
familyTreeRouter.get('/houses/:houseId/tree', async (req: Request, res: Response) => {
  try {
    const house = await db.queryOne<{ id: number; name: string }>(
      `SELECT id, name FROM houses WHERE id = ?`,
      [req.params.houseId]
    );

    if (!house) {
      return res.status(404).json({ error: 'House not found' });
    }

    // Get all NPCs for this house
    const npcs = await db.query(
      `SELECT id, name, title, epithet, portrait_url, public_bio, is_deceased
       FROM family_tree_npcs
       WHERE house_id = ?
       ORDER BY name`,
      [house.id]
    );

    // Get all approved edges for this house
    const edges = await db.query(
      `SELECT id, relationship, from_character_id, from_npc_id, to_character_id, to_npc_id
       FROM family_tree_edges
       WHERE house_id = ? AND status = 'approved'
       ORDER BY id`,
      [house.id]
    );

    // Get character data for characters referenced in edges
    const characterIds = new Set<number>();
    for (const edge of edges as Array<Record<string, unknown>>) {
      if (edge.from_character_id) characterIds.add(edge.from_character_id as number);
      if (edge.to_character_id) characterIds.add(edge.to_character_id as number);
    }

    let characters: Array<Record<string, unknown>> = [];
    if (characterIds.size > 0) {
      const ids = [...characterIds];
      const placeholders = ids.map(() => '?').join(',');
      characters = await db.query(
        `SELECT c.id, c.name, c.title, c.epithet, c.portrait_url, c.is_active,
                c.public_bio, c.level
         FROM characters c
         WHERE c.id IN (${placeholders})`,
        ids
      );
    }

    // Also include characters in this house even if no edges yet
    const houseMembers = await db.query(
      `SELECT c.id, c.name, c.title, c.epithet, c.portrait_url, c.is_active,
              c.public_bio, c.level
       FROM characters c
       WHERE c.house_id = ? AND c.application_status IN ('none', 'approved')`,
      [house.id]
    );

    // Merge house members into characters list (deduplicate)
    const charMap = new Map<number, Record<string, unknown>>();
    for (const c of characters) charMap.set(c.id as number, c);
    for (const c of houseMembers as Array<Record<string, unknown>>) charMap.set(c.id as number, c);

    res.json({
      house: { id: house.id, name: house.name },
      npcs,
      edges,
      characters: [...charMap.values()],
    });
  } catch (err) {
    logger.error('Failed to fetch family tree:', err);
    res.status(500).json({ error: 'Failed to fetch family tree' });
  }
});

// Player suggests a new NPC or edge (pending approval)
const suggestNpcSchema = z.object({
  type: z.literal('npc'),
  name: z.string().min(1).max(150),
  title: z.string().max(100).nullable().optional(),
  epithet: z.string().max(100).nullable().optional(),
  publicBio: z.string().max(5000).nullable().optional(),
  isDeceased: z.boolean().optional().default(false),
});

const suggestEdgeSchema = z.object({
  type: z.literal('edge'),
  relationship: z.enum(['parent', 'spouse', 'sibling']),
  fromCharacterId: z.number().int().positive().nullable().optional(),
  fromNpcId: z.number().int().positive().nullable().optional(),
  toCharacterId: z.number().int().positive().nullable().optional(),
  toNpcId: z.number().int().positive().nullable().optional(),
});

const suggestionSchema = z.discriminatedUnion('type', [suggestNpcSchema, suggestEdgeSchema]);

familyTreeRouter.post('/houses/:houseId/suggestions', async (req: Request, res: Response) => {
  try {
    const parsed = suggestionSchema.parse(req.body);

    const house = await db.queryOne<{ id: number }>(
      `SELECT id FROM houses WHERE id = ?`,
      [req.params.houseId]
    );

    if (!house) {
      return res.status(404).json({ error: 'House not found' });
    }

    if (parsed.type === 'npc') {
      const id = await db.insert(
        `INSERT INTO family_tree_npcs (house_id, name, title, epithet, public_bio, is_deceased, created_by)
         VALUES (?, ?, ?, ?, ?, ?, ?)`,
        [
          house.id, parsed.name, parsed.title ?? null,
          parsed.epithet ?? null, parsed.publicBio ?? null,
          parsed.isDeceased, req.player!.id,
        ]
      );
      // NPC suggestions don't have a pending/approved status on the NPC itself,
      // but staff will review via the pending edges or admin panel
      res.status(201).json({ success: true, npcId: id });
    } else {
      // Validate at least one from and one to
      if (!parsed.fromCharacterId && !parsed.fromNpcId) {
        return res.status(400).json({ error: 'Must specify a from node (character or NPC)' });
      }
      if (!parsed.toCharacterId && !parsed.toNpcId) {
        return res.status(400).json({ error: 'Must specify a to node (character or NPC)' });
      }

      const id = await db.insert(
        `INSERT INTO family_tree_edges (house_id, relationship, from_character_id, from_npc_id, to_character_id, to_npc_id, created_by, status)
         VALUES (?, ?, ?, ?, ?, ?, ?, 'pending')`,
        [
          house.id, parsed.relationship,
          parsed.fromCharacterId ?? null, parsed.fromNpcId ?? null,
          parsed.toCharacterId ?? null, parsed.toNpcId ?? null,
          req.player!.id,
        ]
      );

      // Notify staff of new suggestion
      const { getIO } = await import('../../websocket/index.js');
      const io = getIO();
      if (io) {
        io.to('staff:applications').emit('familytree:suggestion', {
          edgeId: id,
          houseId: house.id,
        });
      }

      res.status(201).json({ success: true, edgeId: id });
    }
  } catch (err) {
    if (err instanceof z.ZodError) {
      return res.status(400).json({ error: 'Validation error', details: err.errors });
    }
    logger.error('Failed to submit family tree suggestion:', err);
    res.status(500).json({ error: 'Failed to submit suggestion' });
  }
});
