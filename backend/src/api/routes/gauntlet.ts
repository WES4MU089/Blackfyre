import { Router, Request, Response } from 'express';
import { z } from 'zod';
import multer from 'multer';
import { join, dirname, extname } from 'path';
import { fileURLToPath } from 'url';
import { mkdirSync, existsSync, unlinkSync } from 'fs';
import { v4 as uuidv4 } from 'uuid';
import { db } from '../../db/connection.js';
import { logger } from '../../utils/logger.js';
import { requireAuth, requirePermission } from '../middleware/auth.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const uploadsBase = join(__dirname, '../../../../uploads/gauntlet');
const mapsDir = join(uploadsBase, 'maps');
const layersDir = join(uploadsBase, 'layers');

// Ensure upload directories exist
for (const dir of [mapsDir, layersDir]) {
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
}

// Multer config
const storage = multer.diskStorage({
  destination: (_req, file, cb) => {
    const dir = file.fieldname === 'baseImage' ? mapsDir : layersDir;
    cb(null, dir);
  },
  filename: (_req, file, cb) => {
    cb(null, `${uuidv4()}${extname(file.originalname)}`);
  },
});

const upload = multer({
  storage,
  limits: { fileSize: 100 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    if (file.mimetype.startsWith('image/')) cb(null, true);
    else cb(new Error('Only image files are allowed'));
  },
});

export const gauntletRouter = Router();
gauntletRouter.use(requireAuth());

// ============================================================================
// MAPS CRUD
// ============================================================================

const createMapSchema = z.object({
  name: z.string().min(1).max(100),
  description: z.string().max(2000).optional(),
  width: z.coerce.number().int().positive(),
  height: z.coerce.number().int().positive(),
  grid_size: z.coerce.number().int().min(1).max(64).default(8),
});

const updateMapSchema = z.object({
  name: z.string().min(1).max(100).optional(),
  description: z.string().max(2000).optional(),
  grid_size: z.coerce.number().int().min(1).max(64).optional(),
  is_active: z.coerce.boolean().optional(),
});

// GET /api/gauntlet/maps — list all maps
gauntletRouter.get('/maps', async (_req: Request, res: Response) => {
  try {
    const maps = await db.query<{
      id: number;
      name: string;
      description: string | null;
      width: number;
      height: number;
      grid_size: number;
      base_image_path: string | null;
      is_active: boolean;
      created_at: string;
    }>(`SELECT id, name, description, width, height, grid_size, base_image_path, is_active, created_at
        FROM gauntlet_maps ORDER BY created_at DESC`);
    res.json(maps);
  } catch (error) {
    logger.error('Failed to list gauntlet maps:', error);
    res.status(500).json({ error: 'Failed to list maps' });
  }
});

// GET /api/gauntlet/maps/:id — single map with terrain types and layers
gauntletRouter.get('/maps/:id', async (req: Request, res: Response) => {
  try {
    const map = await db.queryOne<{
      id: number;
      name: string;
      description: string | null;
      width: number;
      height: number;
      grid_size: number;
      base_image_path: string | null;
      is_active: boolean;
      created_by: number | null;
      created_at: string;
    }>(`SELECT * FROM gauntlet_maps WHERE id = ?`, [req.params.id]);

    if (!map) return res.status(404).json({ error: 'Map not found' });

    const terrainTypes = await db.query(
      `SELECT * FROM gauntlet_terrain_types WHERE map_id = ? ORDER BY sort_order, name`,
      [map.id]
    );

    const layers = await db.query(
      `SELECT * FROM gauntlet_map_layers WHERE map_id = ?`,
      [map.id]
    );

    res.json({ ...map, terrainTypes, layers });
  } catch (error) {
    logger.error('Failed to get gauntlet map:', error);
    res.status(500).json({ error: 'Failed to get map' });
  }
});

// POST /api/gauntlet/maps — create map (with optional base image)
gauntletRouter.post(
  '/maps',
  requirePermission('content.manage_gauntlet'),
  upload.single('baseImage'),
  async (req: Request, res: Response) => {
    try {
      const data = createMapSchema.parse(req.body);
      const imagePath = req.file
        ? `gauntlet/maps/${req.file.filename}`
        : null;

      const id = await db.insert(
        `INSERT INTO gauntlet_maps (name, description, width, height, grid_size, base_image_path, created_by)
         VALUES (?, ?, ?, ?, ?, ?, ?)`,
        [data.name, data.description ?? null, data.width, data.height, data.grid_size, imagePath, req.player!.id]
      );

      const map = await db.queryOne(`SELECT * FROM gauntlet_maps WHERE id = ?`, [id]);
      res.status(201).json(map);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: 'Validation error', details: error.errors });
      }
      logger.error('Failed to create gauntlet map:', error);
      res.status(500).json({ error: 'Failed to create map' });
    }
  }
);

// PATCH /api/gauntlet/maps/:id — update metadata
gauntletRouter.patch(
  '/maps/:id',
  requirePermission('content.manage_gauntlet'),
  async (req: Request, res: Response) => {
    try {
      const data = updateMapSchema.parse(req.body);
      const updates: string[] = [];
      const values: unknown[] = [];

      if (data.name !== undefined) { updates.push('name = ?'); values.push(data.name); }
      if (data.description !== undefined) { updates.push('description = ?'); values.push(data.description); }
      if (data.grid_size !== undefined) { updates.push('grid_size = ?'); values.push(data.grid_size); }
      if (data.is_active !== undefined) { updates.push('is_active = ?'); values.push(data.is_active); }

      if (updates.length === 0) return res.status(400).json({ error: 'No fields to update' });

      values.push(req.params.id);
      await db.execute(`UPDATE gauntlet_maps SET ${updates.join(', ')} WHERE id = ?`, values);

      const map = await db.queryOne(`SELECT * FROM gauntlet_maps WHERE id = ?`, [req.params.id]);
      res.json(map);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: 'Validation error', details: error.errors });
      }
      logger.error('Failed to update gauntlet map:', error);
      res.status(500).json({ error: 'Failed to update map' });
    }
  }
);

// POST /api/gauntlet/maps/:id/base-image — upload/replace base map image
gauntletRouter.post(
  '/maps/:id/base-image',
  requirePermission('content.manage_gauntlet'),
  upload.single('baseImage'),
  async (req: Request, res: Response) => {
    try {
      if (!req.file) return res.status(400).json({ error: 'No image file provided' });

      const map = await db.queryOne<{ id: number; base_image_path: string | null }>(
        `SELECT id, base_image_path FROM gauntlet_maps WHERE id = ?`,
        [req.params.id]
      );
      if (!map) return res.status(404).json({ error: 'Map not found' });

      // Delete old file if exists
      if (map.base_image_path) {
        const oldPath = join(uploadsBase, '..', map.base_image_path);
        try { unlinkSync(oldPath); } catch { /* file may not exist */ }
      }

      const newPath = `gauntlet/maps/${req.file.filename}`;
      await db.execute(
        `UPDATE gauntlet_maps SET base_image_path = ? WHERE id = ?`,
        [newPath, map.id]
      );

      res.json({ base_image_path: newPath });
    } catch (error) {
      logger.error('Failed to upload base image:', error);
      res.status(500).json({ error: 'Failed to upload image' });
    }
  }
);

// DELETE /api/gauntlet/maps/:id
gauntletRouter.delete(
  '/maps/:id',
  requirePermission('content.manage_gauntlet'),
  async (req: Request, res: Response) => {
    try {
      const map = await db.queryOne<{ id: number; base_image_path: string | null }>(
        `SELECT id, base_image_path FROM gauntlet_maps WHERE id = ?`,
        [req.params.id]
      );
      if (!map) return res.status(404).json({ error: 'Map not found' });

      // Get layers to delete their files
      const layers = await db.query<{ image_path: string }>(
        `SELECT image_path FROM gauntlet_map_layers WHERE map_id = ?`,
        [map.id]
      );

      // Delete files
      const filesToDelete = [
        map.base_image_path,
        ...layers.map(l => l.image_path),
      ].filter(Boolean) as string[];

      for (const filePath of filesToDelete) {
        try { unlinkSync(join(uploadsBase, '..', filePath)); } catch { /* ignore */ }
      }

      // CASCADE will delete terrain_types and layers
      await db.execute(`DELETE FROM gauntlet_maps WHERE id = ?`, [map.id]);
      res.json({ success: true });
    } catch (error) {
      logger.error('Failed to delete gauntlet map:', error);
      res.status(500).json({ error: 'Failed to delete map' });
    }
  }
);

// ============================================================================
// TERRAIN TYPES CRUD
// ============================================================================

const createTerrainSchema = z.object({
  name: z.string().min(1).max(50),
  hex_color: z.string().regex(/^#[0-9A-Fa-f]{6}$/, 'Must be a hex color like #FF0000'),
  movement_cost: z.coerce.number().min(0).max(99).default(1.0),
  is_passable: z.coerce.boolean().default(true),
  attrition_rate: z.coerce.number().min(0).max(99).default(0),
  defense_bonus: z.coerce.number().int().default(0),
  ambush_bonus: z.coerce.number().int().default(0),
  description: z.string().max(500).optional(),
  sort_order: z.coerce.number().int().default(0),
});

const updateTerrainSchema = createTerrainSchema.partial();

// GET /api/gauntlet/maps/:mapId/terrain
gauntletRouter.get('/maps/:mapId/terrain', async (req: Request, res: Response) => {
  try {
    const terrainTypes = await db.query(
      `SELECT * FROM gauntlet_terrain_types WHERE map_id = ? ORDER BY sort_order, name`,
      [req.params.mapId]
    );
    res.json(terrainTypes);
  } catch (error) {
    logger.error('Failed to list terrain types:', error);
    res.status(500).json({ error: 'Failed to list terrain types' });
  }
});

// POST /api/gauntlet/maps/:mapId/terrain
gauntletRouter.post(
  '/maps/:mapId/terrain',
  requirePermission('content.manage_gauntlet'),
  async (req: Request, res: Response) => {
    try {
      const data = createTerrainSchema.parse(req.body);
      const mapId = Number(req.params.mapId);

      // Verify map exists
      const map = await db.queryOne(`SELECT id FROM gauntlet_maps WHERE id = ?`, [mapId]);
      if (!map) return res.status(404).json({ error: 'Map not found' });

      const id = await db.insert(
        `INSERT INTO gauntlet_terrain_types
         (map_id, name, hex_color, movement_cost, is_passable, attrition_rate, defense_bonus, ambush_bonus, description, sort_order)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [mapId, data.name, data.hex_color.toUpperCase(), data.movement_cost, data.is_passable, data.attrition_rate, data.defense_bonus, data.ambush_bonus, data.description ?? null, data.sort_order]
      );

      const terrain = await db.queryOne(`SELECT * FROM gauntlet_terrain_types WHERE id = ?`, [id]);
      res.status(201).json(terrain);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: 'Validation error', details: error.errors });
      }
      logger.error('Failed to create terrain type:', error);
      res.status(500).json({ error: 'Failed to create terrain type' });
    }
  }
);

// PATCH /api/gauntlet/terrain/:id
gauntletRouter.patch(
  '/terrain/:id',
  requirePermission('content.manage_gauntlet'),
  async (req: Request, res: Response) => {
    try {
      const data = updateTerrainSchema.parse(req.body);
      const updates: string[] = [];
      const values: unknown[] = [];

      if (data.name !== undefined) { updates.push('name = ?'); values.push(data.name); }
      if (data.hex_color !== undefined) { updates.push('hex_color = ?'); values.push(data.hex_color.toUpperCase()); }
      if (data.movement_cost !== undefined) { updates.push('movement_cost = ?'); values.push(data.movement_cost); }
      if (data.is_passable !== undefined) { updates.push('is_passable = ?'); values.push(data.is_passable); }
      if (data.attrition_rate !== undefined) { updates.push('attrition_rate = ?'); values.push(data.attrition_rate); }
      if (data.defense_bonus !== undefined) { updates.push('defense_bonus = ?'); values.push(data.defense_bonus); }
      if (data.ambush_bonus !== undefined) { updates.push('ambush_bonus = ?'); values.push(data.ambush_bonus); }
      if (data.description !== undefined) { updates.push('description = ?'); values.push(data.description); }
      if (data.sort_order !== undefined) { updates.push('sort_order = ?'); values.push(data.sort_order); }

      if (updates.length === 0) return res.status(400).json({ error: 'No fields to update' });

      values.push(req.params.id);
      await db.execute(`UPDATE gauntlet_terrain_types SET ${updates.join(', ')} WHERE id = ?`, values);

      const terrain = await db.queryOne(`SELECT * FROM gauntlet_terrain_types WHERE id = ?`, [req.params.id]);
      res.json(terrain);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: 'Validation error', details: error.errors });
      }
      logger.error('Failed to update terrain type:', error);
      res.status(500).json({ error: 'Failed to update terrain type' });
    }
  }
);

// DELETE /api/gauntlet/terrain/:id
gauntletRouter.delete(
  '/terrain/:id',
  requirePermission('content.manage_gauntlet'),
  async (req: Request, res: Response) => {
    try {
      const affected = await db.execute(`DELETE FROM gauntlet_terrain_types WHERE id = ?`, [req.params.id]);
      if (affected === 0) return res.status(404).json({ error: 'Terrain type not found' });
      res.json({ success: true });
    } catch (error) {
      logger.error('Failed to delete terrain type:', error);
      res.status(500).json({ error: 'Failed to delete terrain type' });
    }
  }
);

// ============================================================================
// MAP LAYERS
// ============================================================================

// POST /api/gauntlet/maps/:mapId/layers — upload a layer
gauntletRouter.post(
  '/maps/:mapId/layers',
  requirePermission('content.manage_gauntlet'),
  upload.single('layerImage'),
  async (req: Request, res: Response) => {
    try {
      if (!req.file) return res.status(400).json({ error: 'No image file provided' });

      const mapId = Number(req.params.mapId);
      const layerType = req.body.layer_type as string;

      if (!['terrain', 'passability'].includes(layerType)) {
        return res.status(400).json({ error: 'layer_type must be "terrain" or "passability"' });
      }

      const map = await db.queryOne<{ id: number }>(`SELECT id FROM gauntlet_maps WHERE id = ?`, [mapId]);
      if (!map) return res.status(404).json({ error: 'Map not found' });

      // Delete existing layer of this type if present
      const existing = await db.queryOne<{ id: number; image_path: string }>(
        `SELECT id, image_path FROM gauntlet_map_layers WHERE map_id = ? AND layer_type = ?`,
        [mapId, layerType]
      );
      if (existing) {
        try { unlinkSync(join(uploadsBase, '..', existing.image_path)); } catch { /* ignore */ }
        await db.execute(`DELETE FROM gauntlet_map_layers WHERE id = ?`, [existing.id]);
      }

      const imagePath = `gauntlet/layers/${req.file.filename}`;
      const id = await db.insert(
        `INSERT INTO gauntlet_map_layers (map_id, layer_type, image_path) VALUES (?, ?, ?)`,
        [mapId, layerType, imagePath]
      );

      const layer = await db.queryOne(`SELECT * FROM gauntlet_map_layers WHERE id = ?`, [id]);
      res.status(201).json(layer);
    } catch (error) {
      logger.error('Failed to upload map layer:', error);
      res.status(500).json({ error: 'Failed to upload layer' });
    }
  }
);

// DELETE /api/gauntlet/layers/:id
gauntletRouter.delete(
  '/layers/:id',
  requirePermission('content.manage_gauntlet'),
  async (req: Request, res: Response) => {
    try {
      const layer = await db.queryOne<{ id: number; image_path: string }>(
        `SELECT id, image_path FROM gauntlet_map_layers WHERE id = ?`,
        [req.params.id]
      );
      if (!layer) return res.status(404).json({ error: 'Layer not found' });

      try { unlinkSync(join(uploadsBase, '..', layer.image_path)); } catch { /* ignore */ }
      await db.execute(`DELETE FROM gauntlet_map_layers WHERE id = ?`, [layer.id]);
      res.json({ success: true });
    } catch (error) {
      logger.error('Failed to delete map layer:', error);
      res.status(500).json({ error: 'Failed to delete layer' });
    }
  }
);
