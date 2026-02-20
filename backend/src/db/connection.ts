import mariadb, { Pool, PoolConnection } from 'mariadb';
import { config } from '../config/index.js';
import { logger } from '../utils/logger.js';

let pool: Pool | null = null;

/**
 * Initialize the database connection pool
 */
export async function initDatabase(): Promise<Pool> {
  if (pool) {
    return pool;
  }

  try {
    pool = mariadb.createPool({
      host: config.database.host,
      port: config.database.port,
      user: config.database.user,
      password: config.database.password,
      database: config.database.database,
      connectionLimit: config.database.connectionLimit,
      acquireTimeout: 30000,
      connectTimeout: 10000,
      idleTimeout: 60000,
      // Enable better error messages
      trace: config.server.isDev,
      // Convert BigInt to Number for JSON serialization
      bigIntAsNumber: true,
      insertIdAsNumber: true,
    });

    // Test the connection
    const conn = await pool.getConnection();
    const rows = await conn.query('SELECT VERSION() as version');
    logger.info(`✅ Connected to MariaDB ${rows[0].version}`);
    conn.release();

    return pool;
  } catch (error) {
    logger.error('❌ Failed to connect to database:', error);
    throw error;
  }
}

/**
 * Get the database connection pool
 */
export function getPool(): Pool {
  if (!pool) {
    throw new Error('Database not initialized. Call initDatabase() first.');
  }
  return pool;
}

/**
 * Get a single connection from the pool
 */
export async function getConnection(): Promise<PoolConnection> {
  const p = getPool();
  return p.getConnection();
}

/**
 * Execute a query with parameters
 */
export async function query<T = unknown>(sql: string, params?: unknown[]): Promise<T[]> {
  const conn = await getConnection();
  try {
    const result = await conn.query(sql, params);
    return result as T[];
  } finally {
    conn.release();
  }
}

/**
 * Execute a query and get a single result
 */
export async function queryOne<T = unknown>(sql: string, params?: unknown[]): Promise<T | null> {
  const results = await query<T>(sql, params);
  return results.length > 0 ? results[0] : null;
}

/**
 * Execute an insert and return the inserted ID
 */
export async function insert(sql: string, params?: unknown[]): Promise<number> {
  const conn = await getConnection();
  try {
    const result = await conn.query(sql, params);
    return Number(result.insertId);
  } finally {
    conn.release();
  }
}

/**
 * Execute an update/delete and return affected rows
 */
export async function execute(sql: string, params?: unknown[]): Promise<number> {
  const conn = await getConnection();
  try {
    const result = await conn.query(sql, params);
    return Number(result.affectedRows);
  } finally {
    conn.release();
  }
}

/**
 * Run a transaction with multiple queries
 */
export async function transaction<T>(
  callback: (conn: PoolConnection) => Promise<T>
): Promise<T> {
  const conn = await getConnection();
  try {
    await conn.beginTransaction();
    const result = await callback(conn);
    await conn.commit();
    return result;
  } catch (error) {
    await conn.rollback();
    throw error;
  } finally {
    conn.release();
  }
}

/**
 * Close the database connection pool
 */
export async function closeDatabase(): Promise<void> {
  if (pool) {
    await pool.end();
    pool = null;
    logger.info('Database connection pool closed');
  }
}

// Export a db object for convenience
export const db = {
  init: initDatabase,
  close: closeDatabase,
  getPool,
  getConnection,
  query,
  queryOne,
  insert,
  execute,
  transaction,
};

export default db;
