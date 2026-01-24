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
        browser_name TEXT NOT NULL DEFAULT 'unknown',
        created_at TIMESTAMPTZ DEFAULT NOW()
      )
    `);
  }

  await db.exec('CREATE INDEX IF NOT EXISTS idx_users_email ON users(email)');

  // Tabs table
  if (dialect === 'sqlite') {
    await db.exec(`
      CREATE TABLE IF NOT EXISTS tabs (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        client_tab_id INTEGER,
        url TEXT NOT NULL,
        title TEXT,
        window_id INTEGER NOT NULL,
        tab_index INTEGER,
        active BOOLEAN DEFAULT 0,
        highlighted BOOLEAN DEFAULT 0,
        pinned BOOLEAN DEFAULT 0,
        audible BOOLEAN DEFAULT 0,
        muted_info TEXT,
        discarded BOOLEAN DEFAULT 0,
        auto_discardable BOOLEAN DEFAULT 1,
        frozen BOOLEAN DEFAULT 0,
        group_id INTEGER DEFAULT -1,
        incognito BOOLEAN DEFAULT 0,
        fav_icon_url TEXT,
        pending_url TEXT,
        opener_tab_id INTEGER,
        session_id TEXT,
        last_accessed REAL,
        status TEXT,
        width INTEGER,
        height INTEGER,
        browser_name TEXT,
        user_id INTEGER,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        UNIQUE(url, window_id, client_tab_id, user_id, browser_name),
        FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE
      )
    `);
  } else {
    await db.exec(`
      CREATE TABLE IF NOT EXISTS tabs (
        id SERIAL PRIMARY KEY,
        client_tab_id INTEGER,
        url TEXT NOT NULL,
        title TEXT,
        window_id INTEGER NOT NULL,
        tab_index INTEGER,
        active BOOLEAN DEFAULT FALSE,
        highlighted BOOLEAN DEFAULT FALSE,
        pinned BOOLEAN DEFAULT FALSE,
        audible BOOLEAN DEFAULT FALSE,
        muted_info TEXT,
        discarded BOOLEAN DEFAULT FALSE,
        auto_discardable BOOLEAN DEFAULT TRUE,
        frozen BOOLEAN DEFAULT FALSE,
        group_id INTEGER DEFAULT -1,
        incognito BOOLEAN DEFAULT FALSE,
        fav_icon_url TEXT,
        pending_url TEXT,
        opener_tab_id INTEGER,
        session_id TEXT,
        last_accessed DOUBLE PRECISION,
        status TEXT,
        width INTEGER,
        height INTEGER,
        browser_name TEXT,
        user_id INTEGER,
        created_at TIMESTAMPTZ DEFAULT NOW(),
        UNIQUE(url, window_id, client_tab_id, user_id, browser_name),
        FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE
      )
    `);
  }

  await db.exec('CREATE INDEX IF NOT EXISTS idx_tabs_user_id ON tabs(user_id)');

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
      const columns = await db.all<{ name: string }>(
        `PRAGMA table_info(${tableName})`,
      );
      const hasColumn = columns.some((col) => col.name === columnName);

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
