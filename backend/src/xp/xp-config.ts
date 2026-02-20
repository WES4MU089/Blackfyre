import { db } from '../db/connection.js';
import { logger } from '../utils/logger.js';

const configCache = new Map<string, number>();

/**
 * Load all XP configuration values from the xp_config table into memory.
 * Called once at server startup.
 */
export async function loadXpConfig(): Promise<void> {
  const rows = await db.query<{ config_key: string; config_value: number }>(
    'SELECT config_key, config_value FROM xp_config'
  );
  configCache.clear();
  for (const row of rows) {
    configCache.set(row.config_key, Number(row.config_value));
  }
  logger.info(`Loaded ${configCache.size} XP config values`);
}

/**
 * Get a cached XP config value by key.
 * Falls back to the provided default if not found.
 */
export function getXpConfig(key: string, defaultValue: number): number {
  return configCache.get(key) ?? defaultValue;
}
