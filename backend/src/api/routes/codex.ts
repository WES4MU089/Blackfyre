import { Router, Request, Response } from 'express';
import { db } from '../../db/connection.js';
import { logger } from '../../utils/logger.js';
import { requireAuth, requirePermission } from '../middleware/auth.js';

export const codexRouter = Router();

// ─── Public Routes ────────────────────────────────────────────────────────────

// GET /api/codex/categories — list all categories (with published entry counts)
codexRouter.get('/categories', async (_req: Request, res: Response) => {
  try {
    const categories = await db.query(
      `SELECT c.id, c.slug, c.name, c.description, c.icon, c.sort_order,
              COUNT(e.id) AS entry_count
       FROM codex_categories c
       LEFT JOIN codex_entries e ON e.category_id = c.id AND e.is_published = 1
       GROUP BY c.id
       ORDER BY c.sort_order ASC`
    );
    res.json({ categories });
  } catch (err) {
    logger.error('Failed to fetch codex categories:', err);
    res.status(500).json({ error: 'Failed to fetch categories' });
  }
});

// GET /api/codex/categories/:slug — category + its published entries
codexRouter.get('/categories/:slug', async (req: Request, res: Response) => {
  try {
    const category = await db.queryOne<{
      id: number; slug: string; name: string; description: string | null; icon: string | null;
    }>(
      `SELECT id, slug, name, description, icon FROM codex_categories WHERE slug = ?`,
      [req.params.slug]
    );

    if (!category) {
      return res.status(404).json({ error: 'Category not found' });
    }

    const entries = await db.query(
      `SELECT id, slug, title, summary, image_url, created_at, updated_at
       FROM codex_entries
       WHERE category_id = ? AND is_published = 1
       ORDER BY title ASC`,
      [category.id]
    );

    res.json({ category, entries });
  } catch (err) {
    logger.error('Failed to fetch codex category:', err);
    res.status(500).json({ error: 'Failed to fetch category' });
  }
});

// GET /api/codex/entries/:slug — single published entry
codexRouter.get('/entries/:slug', async (req: Request, res: Response) => {
  try {
    const entry = await db.queryOne(
      `SELECT e.id, e.slug, e.title, e.content, e.summary, e.image_url,
              e.created_at, e.updated_at,
              c.slug AS category_slug, c.name AS category_name
       FROM codex_entries e
       JOIN codex_categories c ON e.category_id = c.id
       WHERE e.slug = ? AND e.is_published = 1`,
      [req.params.slug]
    );

    if (!entry) {
      return res.status(404).json({ error: 'Entry not found' });
    }

    res.json({ entry });
  } catch (err) {
    logger.error('Failed to fetch codex entry:', err);
    res.status(500).json({ error: 'Failed to fetch entry' });
  }
});

// ─── Staff Routes ─────────────────────────────────────────────────────────────

// POST /api/codex/staff/entries — create entry
codexRouter.post(
  '/staff/entries',
  requireAuth(),
  requirePermission('content.manage_codex'),
  async (req: Request, res: Response) => {
    try {
      const { category_id, slug, title, content, summary, image_url, is_published } = req.body;

      if (!category_id || !slug || !title || !content) {
        return res.status(400).json({ error: 'category_id, slug, title, and content are required' });
      }

      const insertId = await db.execute(
        `INSERT INTO codex_entries (category_id, slug, title, content, summary, image_url, is_published, created_by)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
        [category_id, slug, title, content, summary || null, image_url || null, is_published ? 1 : 0, req.player!.id]
      );

      res.status(201).json({ id: insertId });
    } catch (err: any) {
      if (err.code === 'ER_DUP_ENTRY') {
        return res.status(409).json({ error: 'An entry with that slug already exists' });
      }
      logger.error('Failed to create codex entry:', err);
      res.status(500).json({ error: 'Failed to create entry' });
    }
  }
);

// PATCH /api/codex/staff/entries/:id — update entry
codexRouter.patch(
  '/staff/entries/:id',
  requireAuth(),
  requirePermission('content.manage_codex'),
  async (req: Request, res: Response) => {
    try {
      const id = Number(req.params.id);
      const allowed = ['slug', 'title', 'content', 'summary', 'image_url', 'is_published', 'category_id'];
      const updates: string[] = [];
      const values: unknown[] = [];

      for (const key of allowed) {
        if (req.body[key] !== undefined) {
          updates.push(`${key} = ?`);
          values.push(key === 'is_published' ? (req.body[key] ? 1 : 0) : req.body[key]);
        }
      }

      if (updates.length === 0) {
        return res.status(400).json({ error: 'No fields to update' });
      }

      values.push(id);
      await db.execute(
        `UPDATE codex_entries SET ${updates.join(', ')} WHERE id = ?`,
        values
      );

      res.json({ success: true });
    } catch (err: any) {
      if (err.code === 'ER_DUP_ENTRY') {
        return res.status(409).json({ error: 'An entry with that slug already exists' });
      }
      logger.error('Failed to update codex entry:', err);
      res.status(500).json({ error: 'Failed to update entry' });
    }
  }
);

// DELETE /api/codex/staff/entries/:id — delete entry
codexRouter.delete(
  '/staff/entries/:id',
  requireAuth(),
  requirePermission('content.manage_codex'),
  async (req: Request, res: Response) => {
    try {
      await db.execute(`DELETE FROM codex_entries WHERE id = ?`, [Number(req.params.id)]);
      res.status(204).send();
    } catch (err) {
      logger.error('Failed to delete codex entry:', err);
      res.status(500).json({ error: 'Failed to delete entry' });
    }
  }
);

// GET /api/codex/staff/entries — list ALL entries (including unpublished) for staff
codexRouter.get(
  '/staff/entries',
  requireAuth(),
  requirePermission('content.manage_codex'),
  async (_req: Request, res: Response) => {
    try {
      const entries = await db.query(
        `SELECT e.id, e.slug, e.title, e.summary, e.image_url, e.is_published,
                e.created_at, e.updated_at,
                c.slug AS category_slug, c.name AS category_name
         FROM codex_entries e
         JOIN codex_categories c ON e.category_id = c.id
         ORDER BY c.sort_order ASC, e.title ASC`
      );
      res.json({ entries });
    } catch (err) {
      logger.error('Failed to fetch staff codex entries:', err);
      res.status(500).json({ error: 'Failed to fetch entries' });
    }
  }
);
