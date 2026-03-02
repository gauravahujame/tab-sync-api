/**
 * Database Schema Creation
 * Creates core tables for both SQLite and PostgreSQL
 */

import { IDatabaseAdapter } from './IDatabaseAdapter.js';
import logger from '../utils/logger.js';

/**
 * Create core database tables
 */
export async function createTables(db: IDatabaseAdapter): Promise<void> {
  const dialect = db.getDialect();

  // Users table
  if (dialect === 'sqlite') {
    await db.exec(`
      CREATE TABLE IF NOT EXISTS users (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        email TEXT UNIQUE NOT NULL,
        name TEXT,
        token TEXT,
        password_hash TEXT,
        browser_name TEXT NOT NULL DEFAULT 'unknown',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);
  } else {
    await db.exec(`
      CREATE TABLE IF NOT EXISTS users (
        id SERIAL PRIMARY KEY,
        email TEXT UNIQUE NOT NULL,
        name TEXT,
        token TEXT,
        password_hash TEXT,
        browser_name TEXT NOT NULL DEFAULT 'unknown',
        created_at TIMESTAMPTZ DEFAULT NOW()
      )
    `);
  }

  await db.exec('CREATE INDEX IF NOT EXISTS idx_users_email ON users(email)');

  // Ensure password_hash exists for earlier migrations
  await ensureColumnExists(db, 'users', 'password_hash', 'TEXT');

  logger.info('[SCHEMA] Core tables created successfully');
}

/**
 * Ensure a column exists in a table (for migrations)
 */
export async function ensureColumnExists(
  db: IDatabaseAdapter,
  tableName: string,
  columnName: string,
  columnDefinition: string,
): Promise<void> {
  const dialect = db.getDialect();

  try {
    if (dialect === 'sqlite') {
      const columns = await db.all<{ name: string }>(`PRAGMA table_info(${tableName})`);
      const hasColumn = columns.some(col => col.name === columnName);

      if (!hasColumn) {
        await db.run(`ALTER TABLE ${tableName} ADD COLUMN ${columnDefinition}`);
        logger.info(`[SCHEMA] Added column ${columnName} to ${tableName}`);
      }
    } else {
      // PostgreSQL
      const result = await db.get<{ exists: boolean }>(
        `SELECT EXISTS (
          SELECT FROM information_schema.columns
          WHERE table_name = $1 AND column_name = $2
        ) as exists`,
        [tableName, columnName],
      );

      if (!result?.exists) {
        await db.run(`ALTER TABLE ${tableName} ADD COLUMN ${columnDefinition}`);
        logger.info(`[SCHEMA] Added column ${columnName} to ${tableName}`);
      }
    }
  } catch (error) {
    logger.error(`[SCHEMA] Failed to ensure column ${columnName} in ${tableName}:`, error);
  }
}
