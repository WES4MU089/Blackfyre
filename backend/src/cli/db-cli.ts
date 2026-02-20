#!/usr/bin/env node
/**
 * Blackfyre HUD Database CLI
 * Interactive database management tool
 * 
 * Usage: npm run db:cli
 */

import readline from 'readline';
import { db } from '../db/connection.js';
import { logger } from '../utils/logger.js';

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout,
});

function prompt(question: string): Promise<string> {
  return new Promise((resolve) => {
    rl.question(question, (answer) => resolve(answer.trim()));
  });
}

function printTable(rows: Record<string, unknown>[]): void {
  if (rows.length === 0) {
    console.log('(empty result set)');
    return;
  }

  const columns = Object.keys(rows[0]);
  const widths = columns.map((col) =>
    Math.max(col.length, ...rows.map((row) => String(row[col] ?? 'NULL').length))
  );

  // Header
  const header = columns.map((col, i) => col.padEnd(widths[i])).join(' | ');
  const separator = widths.map((w) => '-'.repeat(w)).join('-+-');

  console.log(header);
  console.log(separator);

  // Rows
  for (const row of rows) {
    const line = columns
      .map((col, i) => String(row[col] ?? 'NULL').padEnd(widths[i]))
      .join(' | ');
    console.log(line);
  }

  console.log(`\n${rows.length} row(s)`);
}

const commands: Record<string, { desc: string; fn: () => Promise<void> }> = {
  help: {
    desc: 'Show available commands',
    fn: async () => {
      console.log('\nAvailable commands:');
      console.log('-'.repeat(50));
      for (const [cmd, info] of Object.entries(commands)) {
        console.log(`  ${cmd.padEnd(20)} ${info.desc}`);
      }
      console.log('\nYou can also type SQL queries directly.');
    },
  },

  tables: {
    desc: 'List all tables',
    fn: async () => {
      const tables = await db.query<{ table_name: string }>(`
        SELECT table_name FROM information_schema.tables
        WHERE table_schema = DATABASE()
        ORDER BY table_name
      `);
      printTable(tables);
    },
  },

  players: {
    desc: 'List all players',
    fn: async () => {
      const players = await db.query(`
        SELECT id, sl_uuid, sl_name, created_at, last_seen, is_active, is_banned
        FROM players
        LIMIT 50
      `);
      printTable(players);
    },
  },

  characters: {
    desc: 'List all characters',
    fn: async () => {
      const characters = await db.query(`
        SELECT c.id, c.name, p.sl_name as player, c.created_at,
               cv.health, cf.cash, cf.bank
        FROM characters c
        JOIN players p ON c.player_id = p.id
        LEFT JOIN character_vitals cv ON c.id = cv.character_id
        LEFT JOIN character_finances cf ON c.id = cf.character_id
        LIMIT 50
      `);
      printTable(characters);
    },
  },

  jobs: {
    desc: 'List all jobs',
    fn: async () => {
      const jobs = await db.query(`
        SELECT id, job_key, name, category, base_salary, is_active
        FROM jobs
        ORDER BY category, name
      `);
      printTable(jobs);
    },
  },

  items: {
    desc: 'List all items',
    fn: async () => {
      const items = await db.query(`
        SELECT id, item_key, name, category, rarity, base_price
        FROM items
        ORDER BY category, rarity, name
      `);
      printTable(items);
    },
  },

  skills: {
    desc: 'List all skills',
    fn: async () => {
      const skills = await db.query(`SELECT * FROM skills ORDER BY category, name`);
      printTable(skills);
    },
  },

  stats: {
    desc: 'Show database statistics',
    fn: async () => {
      const stats = await db.query<{ table_name: string; row_count: number }>(`
        SELECT table_name, table_rows as row_count
        FROM information_schema.tables
        WHERE table_schema = DATABASE()
        ORDER BY table_rows DESC
      `);
      printTable(stats);

      const total = stats.reduce((sum, t) => sum + (t.row_count || 0), 0);
      console.log(`\nTotal rows: ${total}`);
    },
  },

  'create-player': {
    desc: 'Create a test player',
    fn: async () => {
      const uuid = await prompt('SL UUID (or press Enter for random): ');
      const name = await prompt('SL Name: ');

      if (!name) {
        console.log('Name is required');
        return;
      }

      const finalUuid = uuid || `test-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

      const id = await db.insert(`
        INSERT INTO players (sl_uuid, sl_name, last_seen) VALUES (?, ?, NOW())
      `, [finalUuid, name]);

      await db.insert(`INSERT INTO hud_settings (player_id) VALUES (?)`, [id]);

      console.log(`✅ Created player ID: ${id}`);
      console.log(`   UUID: ${finalUuid}`);
    },
  },

  'create-character': {
    desc: 'Create a character for a player',
    fn: async () => {
      const playerId = await prompt('Player ID: ');
      const charName = await prompt('Character Name: ');

      if (!playerId || !charName) {
        console.log('Player ID and character name are required');
        return;
      }

      const charId = await db.transaction(async (conn) => {
        const result = await conn.query(`
          INSERT INTO characters (player_id, name) VALUES (?, ?)
        `, [playerId, charName]);

        const id = Number(result.insertId);

        await conn.query(`INSERT INTO character_vitals (character_id) VALUES (?)`, [id]);
        await conn.query(`INSERT INTO character_finances (character_id) VALUES (?)`, [id]);

        // Assign unemployed job
        const job = await conn.query(`SELECT id FROM jobs WHERE job_key = 'unemployed'`);
        if (job.length > 0) {
          await conn.query(`
            INSERT INTO character_jobs (character_id, job_id, is_primary) VALUES (?, ?, TRUE)
          `, [id, job[0].id]);
        }

        return id;
      });

      console.log(`✅ Created character ID: ${charId}`);
    },
  },

  'give-money': {
    desc: 'Give money to a character',
    fn: async () => {
      const charId = await prompt('Character ID: ');
      const amount = await prompt('Amount: ');
      const currency = await prompt('Currency (cash/bank/crypto) [cash]: ');

      if (!charId || !amount) {
        console.log('Character ID and amount are required');
        return;
      }

      const curr = currency || 'cash';
      await db.execute(`
        UPDATE character_finances SET ${curr} = ${curr} + ? WHERE character_id = ?
      `, [Number(amount), charId]);

      console.log(`✅ Added $${amount} ${curr} to character ${charId}`);
    },
  },

  'give-item': {
    desc: 'Give item to a character',
    fn: async () => {
      const charId = await prompt('Character ID: ');
      const itemKey = await prompt('Item Key: ');
      const quantity = await prompt('Quantity [1]: ');

      if (!charId || !itemKey) {
        console.log('Character ID and item key are required');
        return;
      }

      const item = await db.queryOne<{ id: number; name: string }>(`
        SELECT id, name FROM items WHERE item_key = ?
      `, [itemKey]);

      if (!item) {
        console.log(`Item "${itemKey}" not found`);
        return;
      }

      await db.insert(`
        INSERT INTO character_inventory (character_id, item_id, quantity) VALUES (?, ?, ?)
      `, [charId, item.id, Number(quantity) || 1]);

      console.log(`✅ Gave ${quantity || 1}x ${item.name} to character ${charId}`);
    },
  },

  clear: {
    desc: 'Clear console',
    fn: async () => {
      console.clear();
    },
  },

  exit: {
    desc: 'Exit CLI',
    fn: async () => {
      console.log('Goodbye!');
      await db.close();
      rl.close();
      process.exit(0);
    },
  },
};

async function runQuery(sql: string): Promise<void> {
  try {
    const result = await db.query(sql);

    if (Array.isArray(result) && result.length > 0 && typeof result[0] === 'object') {
      printTable(result as Record<string, unknown>[]);
    } else {
      console.log('Query executed successfully');
      console.log(result);
    }
  } catch (error) {
    console.error(`Error: ${error instanceof Error ? error.message : error}`);
  }
}

async function main(): Promise<void> {
  console.log('='.repeat(50));
  console.log('  Blackfyre HUD Database CLI');
  console.log('  Type "help" for available commands');
  console.log('  Type SQL queries directly to execute them');
  console.log('='.repeat(50));

  try {
    await db.init();
    console.log('Connected to database\n');
  } catch (error) {
    console.error('Failed to connect to database:', error);
    process.exit(1);
  }

  while (true) {
    const input = await prompt('\nblackfyre> ');

    if (!input) continue;

    const cmd = input.toLowerCase();

    if (commands[cmd]) {
      try {
        await commands[cmd].fn();
      } catch (error) {
        console.error(`Error: ${error instanceof Error ? error.message : error}`);
      }
    } else if (input.match(/^(select|insert|update|delete|show|describe|explain)/i)) {
      await runQuery(input);
    } else {
      console.log(`Unknown command: ${cmd}. Type "help" for available commands.`);
    }
  }
}

main().catch(console.error);
