import { Server as SocketServer, Socket } from 'socket.io';
import { z } from 'zod';
import { db } from '../db/connection.js';
import { logger } from '../utils/logger.js';
import { calculateMaxHealth } from '../utils/formulas.js';
import { getConnectedPlayer } from './index.js';

// Validation schemas
const createCharacterSchema = z.object({
  templateKey: z.string().min(1).max(30),
  aptitudes: z.record(z.string(), z.number().int().min(1).max(7)),
  name: z.string().min(2).max(100).regex(/^[a-zA-Z\s'-]+$/),
  backstory: z.string().max(5000).optional(),
});

// Cached templates (loaded once)
interface ClassTemplate {
  id: number;
  template_key: string;
  name: string;
  description: string;
  category: string;
  fantasy_examples: string | null;
  locked_aptitudes: Record<string, number>;
  free_aptitude_points: number;
  starting_cash: number;
  starting_bank: number;
  starting_job_key: string;
  starting_job_grade: number;
  starting_items: Array<{ item_key: string; quantity: number }>;
  sort_order: number;
}

let templateCache: ClassTemplate[] | null = null;

function parseTemplateRow(row: Record<string, unknown>): ClassTemplate {
  return {
    id: row.id as number,
    template_key: row.template_key as string,
    name: row.name as string,
    description: row.description as string,
    category: row.category as string,
    fantasy_examples: row.fantasy_examples as string | null,
    locked_aptitudes: typeof row.locked_aptitudes === 'string'
      ? JSON.parse(row.locked_aptitudes)
      : row.locked_aptitudes as Record<string, number>,
    free_aptitude_points: row.free_aptitude_points as number,
    starting_cash: row.starting_cash as number,
    starting_bank: row.starting_bank as number,
    starting_job_key: row.starting_job_key as string,
    starting_job_grade: row.starting_job_grade as number,
    starting_items: typeof row.starting_items === 'string'
      ? JSON.parse(row.starting_items)
      : (row.starting_items as Array<{ item_key: string; quantity: number }>) ?? [],
    sort_order: row.sort_order as number,
  };
}

async function loadTemplates(): Promise<ClassTemplate[]> {
  if (templateCache) return templateCache;
  const rows = await db.query<Record<string, unknown>>(
    `SELECT * FROM class_templates WHERE is_active = TRUE ORDER BY sort_order`
  );
  templateCache = rows.map(parseTemplateRow);
  logger.info(`Loaded ${templateCache.length} class templates`);
  return templateCache;
}

const APTITUDE_KEYS = ['prowess', 'fortitude', 'command', 'cunning', 'stewardship', 'presence', 'lore', 'faith'];
const APTITUDE_TOTAL = 32;

export function setupCreationHandlers(io: SocketServer, socket: Socket): void {

  // Return all active templates
  socket.on('templates:list', async () => {
    try {
      const templates = await loadTemplates();
      socket.emit('templates:list', templates);
    } catch (error) {
      logger.error('Templates list error:', error);
      socket.emit('error', { message: 'Failed to load templates' });
    }
  });

  // Create a new character
  socket.on('character:create', async (data: unknown) => {
    const playerInfo = getConnectedPlayer(socket.id);
    if (!playerInfo?.playerId) {
      return socket.emit('character:create:error', { message: 'Not authenticated' });
    }

    try {
      // Parse input
      const parsed = createCharacterSchema.parse(data);
      const { templateKey, aptitudes, name, backstory } = parsed;

      // Load template
      const templates = await loadTemplates();
      const template = templates.find(t => t.template_key === templateKey);
      if (!template) {
        return socket.emit('character:create:error', { message: 'Invalid template' });
      }

      // ===== APTITUDE VALIDATION =====
      const aptKeys = Object.keys(aptitudes);
      if (aptKeys.length !== 8 || !APTITUDE_KEYS.every(k => aptKeys.includes(k))) {
        return socket.emit('character:create:error', { message: 'Must provide all 8 aptitudes' });
      }

      let aptTotal = 0;
      for (const key of APTITUDE_KEYS) {
        const val = aptitudes[key];
        const lockedMin = template.locked_aptitudes[key] ?? 1;

        if (val < lockedMin) {
          return socket.emit('character:create:error', {
            message: `${key} cannot be below locked minimum of ${lockedMin}`,
            field: key,
          });
        }
        if (val < 1 || val > 7) {
          return socket.emit('character:create:error', {
            message: `${key} must be between 1 and 7 at creation`,
            field: key,
          });
        }
        aptTotal += val;
      }

      if (aptTotal !== APTITUDE_TOTAL) {
        return socket.emit('character:create:error', {
          message: `Aptitude total must be ${APTITUDE_TOTAL}, got ${aptTotal}`,
        });
      }

      // ===== NAME VALIDATION =====
      const trimmedName = name.trim();
      const existing = await db.queryOne<{ id: number }>(
        `SELECT id FROM characters WHERE LOWER(name) = LOWER(?) AND player_id = ?`,
        [trimmedName, playerInfo.playerId]
      );
      if (existing) {
        return socket.emit('character:create:error', {
          message: 'You already have a character with that name',
          field: 'name',
        });
      }

      // ===== CREATE CHARACTER (transaction) =====
      const characterId = await db.transaction(async (conn: { query: (sql: string, params?: unknown[]) => Promise<any> }) => {
        // 1. Insert character
        const result = await conn.query(
          `INSERT INTO characters (player_id, template_key, name, backstory) VALUES (?, ?, ?, ?)`,
          [playerInfo.playerId, templateKey, trimmedName, backstory || null]
        );
        const charId = Number(result.insertId);

        // 2. Insert vitals (health derived from fortitude)
        const fortitude = aptitudes['fortitude'];
        const maxHealth = calculateMaxHealth(fortitude);
        await conn.query(
          `INSERT INTO character_vitals (character_id, health, max_health) VALUES (?, ?, ?)`,
          [charId, maxHealth, maxHealth]
        );

        // 3. Insert finances — cash on hand only; holding vault access requires Head of House
        await conn.query(
          `INSERT INTO character_finances (character_id, cash, bank) VALUES (?, ?, 0)`,
          [charId, template.starting_cash]
        );

        // 4. Insert aptitudes (8 rows)
        for (const key of APTITUDE_KEYS) {
          await conn.query(
            `INSERT INTO character_aptitudes (character_id, aptitude_key, base_value, current_value) VALUES (?, ?, ?, ?)`,
            [charId, key, aptitudes[key], aptitudes[key]]
          );
        }

        // 5. Assign starting job from template
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

        // 7. Insert starting items from template
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

        return charId;
      });

      logger.info(`Character created: ${trimmedName} (ID: ${characterId}) for player ${playerInfo.playerId} using template ${templateKey}`);

      socket.emit('character:created', {
        characterId,
        characterName: trimmedName,
      });

    } catch (error) {
      if (error instanceof z.ZodError) {
        return socket.emit('character:create:error', {
          message: 'Validation error: ' + error.errors.map(e => e.message).join(', '),
        });
      }
      logger.error('Character creation error:', error);
      socket.emit('character:create:error', { message: 'Failed to create character' });
    }
  });
}
