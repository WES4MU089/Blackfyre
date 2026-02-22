import { Router, Request, Response } from 'express';
import { z } from 'zod';
import { db } from '../../db/connection.js';
import { logger } from '../../utils/logger.js';
import { requireAuth } from '../middleware/auth.js';
import { calculateMaxHealth } from '../../utils/formulas.js';

export const applicationsRouter = Router();

// All player application routes require authentication
applicationsRouter.use(requireAuth());

// List available class templates for the creation form
// NOTE: Must come before /:id to avoid "templates" matching as an id param
applicationsRouter.get('/templates', async (_req: Request, res: Response) => {
  try {
    const templates = await loadTemplates();
    res.json({ templates });
  } catch (err) {
    logger.error('Failed to load templates:', err);
    res.status(500).json({ error: 'Failed to load templates' });
  }
});

// List own applications
applicationsRouter.get('/', async (req: Request, res: Response) => {
  try {
    const applications = await db.query(
      `SELECT ca.id, ca.character_id, ca.house_id, ca.status,
              ca.requested_role, ca.is_featured_role,
              ca.submitted_at, ca.updated_at,
              c.name AS character_name,
              h.name AS house_name
       FROM character_applications ca
       JOIN characters c ON ca.character_id = c.id
       LEFT JOIN houses h ON ca.house_id = h.id
       WHERE ca.player_id = ?
       ORDER BY ca.submitted_at DESC`,
      [req.player!.id]
    );
    res.json({ applications });
  } catch (err) {
    logger.error('Failed to fetch player applications:', err);
    res.status(500).json({ error: 'Failed to fetch applications' });
  }
});

// Get single application detail (own only)
applicationsRouter.get('/:id', async (req: Request, res: Response) => {
  try {
    const application = await db.queryOne(
      `SELECT ca.*, c.name AS character_name, h.name AS house_name
       FROM character_applications ca
       JOIN characters c ON ca.character_id = c.id
       LEFT JOIN houses h ON ca.house_id = h.id
       WHERE ca.id = ? AND ca.player_id = ?`,
      [req.params.id, req.player!.id]
    );

    if (!application) {
      return res.status(404).json({ error: 'Application not found' });
    }

    // Load public, visible, non-deleted comments only
    const comments = await db.query(
      `SELECT ac.id, ac.author_id, ac.body, ac.is_private, ac.created_at, ac.edited_at,
              p.discord_username AS author_name
       FROM application_comments ac
       JOIN players p ON ac.author_id = p.id
       WHERE ac.application_id = ? AND ac.is_private = FALSE
         AND ac.is_visible = TRUE AND ac.deleted_at IS NULL
       ORDER BY ac.created_at ASC`,
      [req.params.id]
    );

    res.json({ application, comments });
  } catch (err) {
    logger.error('Failed to fetch application detail:', err);
    res.status(500).json({ error: 'Failed to fetch application' });
  }
});

// ===== Submit a new character application (REST — used by the web portal) =====
const submitSchema = z.object({
  templateKey: z.string().min(1).max(30),
  aptitudes: z.record(z.string(), z.number().int().min(1).max(7)),
  name: z.string().min(2).max(100).regex(/^[a-zA-Z\s'-]+$/),
  backstory: z.string().max(5000).optional(),
  fatherName: z.string().min(1).max(150),
  motherName: z.string().min(1).max(150),
  houseId: z.number().int().positive().nullable().optional(),
  isBastard: z.boolean().optional().default(false),
  isDragonSeed: z.boolean().optional().default(false),
  requestedRole: z.enum(['member', 'head_of_house', 'lord_paramount', 'royalty']).optional().default('member'),
  isFeaturedRole: z.boolean().optional().default(false),
  hohContact: z.string().max(2000).nullable().optional(),
  applicationBio: z.string().max(10000).nullable().optional(),
  publicBio: z.string().max(5000).nullable().optional(),
  organizationId: z.number().int().positive().nullable().optional(),
});

const APTITUDE_KEYS = ['prowess', 'fortitude', 'command', 'cunning', 'stewardship', 'presence', 'lore', 'faith'];
const APTITUDE_TOTAL = 32;

interface ClassTemplate {
  id: number;
  template_key: string;
  name: string;
  category: string;
  locked_aptitudes: Record<string, number>;
  free_aptitude_points: number;
  starting_cash: number;
  starting_job_key: string;
  starting_job_grade: number;
  starting_items: Array<{ item_key: string; quantity: number }>;
}

let templateCache: ClassTemplate[] | null = null;

async function loadTemplates(): Promise<ClassTemplate[]> {
  if (templateCache) return templateCache;
  const rows = await db.query<Record<string, unknown>>(
    `SELECT id, template_key, name, category, locked_aptitudes, free_aptitude_points,
            starting_cash, starting_job_key, starting_job_grade, starting_items
     FROM class_templates WHERE is_active = TRUE ORDER BY sort_order`
  );
  templateCache = rows.map(r => ({
    id: r.id as number,
    template_key: r.template_key as string,
    name: r.name as string,
    category: r.category as string,
    locked_aptitudes: typeof r.locked_aptitudes === 'string' ? JSON.parse(r.locked_aptitudes) : r.locked_aptitudes as Record<string, number>,
    free_aptitude_points: r.free_aptitude_points as number,
    starting_cash: r.starting_cash as number,
    starting_job_key: r.starting_job_key as string,
    starting_job_grade: r.starting_job_grade as number,
    starting_items: typeof r.starting_items === 'string'
      ? JSON.parse(r.starting_items)
      : (r.starting_items as Array<{ item_key: string; quantity: number }>) ?? [],
  }));
  return templateCache;
}

function determineApplicationTier(
  template: ClassTemplate,
  data: { houseId?: number | null; isBastard: boolean; isDragonSeed: boolean; requestedRole: string; isFeaturedRole: boolean; orgRequiresApproval?: boolean }
): 1 | 2 | 3 {
  if (data.isFeaturedRole || ['head_of_house', 'lord_paramount', 'royalty'].includes(data.requestedRole)) return 3;
  if (template.category === 'nobility' || data.houseId || data.isBastard || data.isDragonSeed || data.orgRequiresApproval) return 2;
  return 1;
}

applicationsRouter.post('/submit', async (req: Request, res: Response) => {
  try {
    const parsed = submitSchema.parse(req.body);
    const playerId = req.player!.id;

    // Load template
    const templates = await loadTemplates();
    const template = templates.find(t => t.template_key === parsed.templateKey);
    if (!template) {
      return res.status(400).json({ error: 'Invalid template' });
    }

    // Aptitude validation
    const aptKeys = Object.keys(parsed.aptitudes);
    if (aptKeys.length !== 8 || !APTITUDE_KEYS.every(k => aptKeys.includes(k))) {
      return res.status(400).json({ error: 'Must provide all 8 aptitudes' });
    }

    let aptTotal = 0;
    for (const key of APTITUDE_KEYS) {
      const val = parsed.aptitudes[key];
      const lockedMin = template.locked_aptitudes[key] ?? 1;
      if (val < lockedMin) {
        return res.status(400).json({ error: `${key} cannot be below locked minimum of ${lockedMin}` });
      }
      if (val < 1 || val > 7) {
        return res.status(400).json({ error: `${key} must be between 1 and 7 at creation` });
      }
      aptTotal += val;
    }
    if (aptTotal !== APTITUDE_TOTAL) {
      return res.status(400).json({ error: `Aptitude total must be ${APTITUDE_TOTAL}, got ${aptTotal}` });
    }

    // Name uniqueness
    const trimmedName = parsed.name.trim();
    const existing = await db.queryOne<{ id: number }>(
      `SELECT id FROM characters WHERE LOWER(name) = LOWER(?) AND player_id = ?`,
      [trimmedName, playerId]
    );
    if (existing) {
      return res.status(400).json({ error: 'You already have a character with that name' });
    }

    // House validation
    if (parsed.houseId) {
      const house = await db.queryOne<{ id: number }>(
        `SELECT id FROM houses WHERE id = ? AND is_extinct = FALSE`,
        [parsed.houseId]
      );
      if (!house) {
        return res.status(400).json({ error: 'Selected house not found or is extinct' });
      }
    }

    // Organization validation
    let orgRequiresApproval = false;
    if (parsed.organizationId) {
      const org = await db.queryOne<{ id: number; requires_approval: boolean; is_active: boolean }>(
        `SELECT id, requires_approval, is_active FROM organizations WHERE id = ?`,
        [parsed.organizationId]
      );
      if (!org || !org.is_active) {
        return res.status(400).json({ error: 'Selected organization not found or is inactive' });
      }
      orgRequiresApproval = !!org.requires_approval;
    }

    // Determine tier
    const isFeatured = parsed.isFeaturedRole ||
      ['head_of_house', 'lord_paramount', 'royalty'].includes(parsed.requestedRole);
    const tier = determineApplicationTier(template, {
      houseId: parsed.houseId,
      isBastard: parsed.isBastard,
      isDragonSeed: parsed.isDragonSeed,
      requestedRole: parsed.requestedRole,
      isFeaturedRole: isFeatured,
      orgRequiresApproval,
    });

    // Tier 2/3 require application bio
    if (tier >= 2 && (!parsed.applicationBio || parsed.applicationBio.trim().length === 0)) {
      return res.status(400).json({ error: 'An application bio is required for noble or featured characters' });
    }

    const applicationStatus = tier === 1 ? 'none' : 'pending';

    // Resolve region_id from house
    let regionId: number | null = null;
    if (parsed.houseId) {
      const houseRegion = await db.queryOne<{ region_id: number | null }>(
        `SELECT region_id FROM houses WHERE id = ?`,
        [parsed.houseId]
      );
      regionId = houseRegion?.region_id ?? null;
    }

    // Create character + application in transaction
    const characterId = await db.transaction(async (conn: { query: (sql: string, params?: unknown[]) => Promise<any> }) => {
      // 1. Insert character
      const result = await conn.query(
        `INSERT INTO characters (
          player_id, template_key, name, backstory,
          house_id, region_id, is_bastard, is_dragon_seed,
          father_name, mother_name, public_bio, application_status
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          playerId, parsed.templateKey, trimmedName, parsed.backstory || null,
          parsed.houseId ?? null, regionId, parsed.isBastard, parsed.isDragonSeed,
          parsed.fatherName.trim(), parsed.motherName.trim(),
          parsed.publicBio?.trim() || null, applicationStatus,
        ]
      );
      const charId = Number(result.insertId);

      // 2. Insert vitals
      const fortitude = parsed.aptitudes['fortitude'];
      const maxHealth = calculateMaxHealth(fortitude);
      await conn.query(
        `INSERT INTO character_vitals (character_id, health, max_health) VALUES (?, ?, ?)`,
        [charId, maxHealth, maxHealth]
      );

      // 3. Insert finances
      await conn.query(
        `INSERT INTO character_finances (character_id, cash, bank) VALUES (?, ?, 0)`,
        [charId, template.starting_cash]
      );

      // 4. Insert aptitudes (8 rows)
      for (const key of APTITUDE_KEYS) {
        await conn.query(
          `INSERT INTO character_aptitudes (character_id, aptitude_key, base_value, current_value) VALUES (?, ?, ?, ?)`,
          [charId, key, parsed.aptitudes[key], parsed.aptitudes[key]]
        );
      }

      // 5. Assign starting job
      if (template.starting_job_key) {
        const jobRows = await conn.query(
          `SELECT id FROM jobs WHERE job_key = ?`,
          [template.starting_job_key]
        ) as Array<{ id: number }>;
        if (jobRows.length > 0) {
          await conn.query(
            `INSERT INTO character_jobs (character_id, job_id, grade, is_primary) VALUES (?, ?, ?, TRUE)`,
            [charId, jobRows[0].id, template.starting_job_grade]
          );
        }
      }

      // 6. Insert starting items
      if (template.starting_items && template.starting_items.length > 0) {
        let slotNum = 1;
        for (const item of template.starting_items) {
          const itemRows = await conn.query(
            `SELECT id FROM items WHERE item_key = ?`,
            [item.item_key]
          ) as Array<{ id: number }>;
          if (itemRows.length > 0) {
            await conn.query(
              `INSERT INTO character_inventory (character_id, item_id, quantity, slot_number) VALUES (?, ?, ?, ?)`,
              [charId, itemRows[0].id, item.quantity, slotNum]
            );
            slotNum++;
          }
        }
      }

      // 7. Organization membership (Tier 1 = immediate)
      if (parsed.organizationId && tier === 1) {
        await conn.query(
          `INSERT INTO organization_members (organization_id, character_id) VALUES (?, ?)`,
          [parsed.organizationId, charId]
        );
      }

      // 8. Create application record for Tier 2/3
      if (tier >= 2) {
        await conn.query(
          `INSERT INTO character_applications (
            character_id, player_id, house_id, organization_id,
            is_bastard, is_dragon_seed,
            father_name, mother_name,
            requested_role, is_featured_role,
            hoh_contact, application_bio, public_bio,
            status
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'pending')`,
          [
            charId, playerId, parsed.houseId ?? null,
            parsed.organizationId ?? null,
            parsed.isBastard, parsed.isDragonSeed,
            parsed.fatherName.trim(), parsed.motherName.trim(),
            parsed.requestedRole, isFeatured,
            parsed.hohContact?.trim() || null,
            parsed.applicationBio!.trim(),
            parsed.publicBio?.trim() || null,
          ]
        );
      }

      return charId;
    });

    logger.info(`Character created via portal: ${trimmedName} (ID: ${characterId}) for player ${playerId} [Tier ${tier}]`);

    // Notify staff of new Tier 2/3 application
    if (tier >= 2) {
      const { getIO } = await import('../../websocket/index.js');
      const io = getIO();
      if (io) {
        io.to('staff:applications').emit('application:submitted', {
          characterName: trimmedName,
          tier,
          playerId,
        });
      }
    }

    res.json({
      success: true,
      characterId,
      applicationStatus,
      tier,
    });
  } catch (err) {
    if (err instanceof z.ZodError) {
      return res.status(400).json({ error: 'Validation error', details: err.errors });
    }
    logger.error('Failed to submit application:', err);
    res.status(500).json({ error: 'Failed to submit application' });
  }
});

// Resubmit a revision
const resubmitSchema = z.object({
  applicationBio: z.string().min(1).max(10000),
  publicBio: z.string().max(5000).nullable().optional(),
  hohContact: z.string().max(2000).nullable().optional(),
  isBastard: z.boolean().optional(),
  isDragonSeed: z.boolean().optional(),
  houseId: z.number().int().positive().nullable().optional(),
  requestedRole: z.enum(['member', 'head_of_house', 'lord_paramount', 'royalty']).optional(),
  isFeaturedRole: z.boolean().optional(),
});

applicationsRouter.put('/:id', async (req: Request, res: Response) => {
  try {
    const parsed = resubmitSchema.parse(req.body);

    // Verify application belongs to player and is in 'revision' status
    const application = await db.queryOne<{ id: number; character_id: number; status: string }>(
      `SELECT id, character_id, status FROM character_applications
       WHERE id = ? AND player_id = ?`,
      [req.params.id, req.player!.id]
    );

    if (!application) {
      return res.status(404).json({ error: 'Application not found' });
    }

    if (application.status !== 'revision') {
      return res.status(400).json({ error: 'Application is not in revision status' });
    }

    // Auto-set featured role for leadership positions
    const isFeatured = parsed.isFeaturedRole ||
      ['head_of_house', 'lord_paramount', 'royalty'].includes(parsed.requestedRole ?? '');

    await db.transaction(async (conn) => {
      // Update the application
      await conn.query(
        `UPDATE character_applications SET
          application_bio = ?,
          public_bio = ?,
          hoh_contact = ?,
          is_bastard = ?,
          is_dragon_seed = ?,
          house_id = ?,
          requested_role = ?,
          is_featured_role = ?,
          status = 'pending',
          reviewed_by = NULL,
          reviewed_at = NULL
         WHERE id = ?`,
        [
          parsed.applicationBio,
          parsed.publicBio ?? null,
          parsed.hohContact ?? null,
          parsed.isBastard ?? false,
          parsed.isDragonSeed ?? false,
          parsed.houseId ?? null,
          parsed.requestedRole ?? 'member',
          isFeatured,
          application.id,
        ]
      );

      // Update character status back to pending
      await conn.query(
        `UPDATE characters SET application_status = 'pending' WHERE id = ?`,
        [application.character_id]
      );

      // Auto-post private comment noting resubmission
      await conn.query(
        `INSERT INTO application_comments (application_id, author_id, body, is_private)
         VALUES (?, ?, 'Application resubmitted by player — previous version archived.', TRUE)`,
        [application.id, req.player!.id]
      );
    });

    // Broadcast to staff
    const { getIO } = await import('../../websocket/index.js');
    const io = getIO();
    if (io) {
      io.to('staff:applications').emit('application:submitted', {
        applicationId: application.id,
        characterName: 'Resubmission',
        tier: 2,
      });
    }

    res.json({ success: true });
  } catch (err) {
    if (err instanceof z.ZodError) {
      return res.status(400).json({ error: 'Validation error', details: err.errors });
    }
    logger.error('Failed to resubmit application:', err);
    res.status(500).json({ error: 'Failed to resubmit application' });
  }
});

// Post a public comment on own application
const playerCommentSchema = z.object({
  body: z.string().min(1).max(5000),
});

applicationsRouter.post('/:id/comments', async (req: Request, res: Response) => {
  try {
    const parsed = playerCommentSchema.parse(req.body);

    // Verify application belongs to player
    const application = await db.queryOne<{ id: number; status: string }>(
      `SELECT id, status FROM character_applications
       WHERE id = ? AND player_id = ?`,
      [req.params.id, req.player!.id]
    );

    if (!application) {
      return res.status(404).json({ error: 'Application not found' });
    }

    // Only allow commenting on pending or revision applications
    if (application.status !== 'pending' && application.status !== 'revision') {
      return res.status(400).json({ error: 'Cannot comment on this application' });
    }

    const commentId = await db.insert(
      `INSERT INTO application_comments (application_id, author_id, body, is_private)
       VALUES (?, ?, ?, FALSE)`,
      [application.id, req.player!.id, parsed.body]
    );

    // Notify staff via socket
    const { getIO } = await import('../../websocket/index.js');
    const io = getIO();
    if (io) {
      io.to('staff:applications').emit('application:comment', {
        applicationId: application.id,
        commentId,
        isPrivate: false,
      });
    }

    res.json({
      success: true,
      comment: {
        id: commentId,
        author_id: req.player!.id,
        body: parsed.body,
        is_private: false,
        created_at: new Date().toISOString(),
        author_name: req.player!.discordUsername ?? 'Player',
      },
    });
  } catch (err) {
    if (err instanceof z.ZodError) {
      return res.status(400).json({ error: 'Validation error', details: err.errors });
    }
    logger.error('Failed to post player comment:', err);
    res.status(500).json({ error: 'Failed to post comment' });
  }
});
