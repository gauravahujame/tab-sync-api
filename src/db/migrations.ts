/**
 * Database migrations for snapshot-based sync
 * Creates tables for snapshots and user-saved sessions
 * Supports both SQLite and PostgreSQL
 */

import { IDatabaseAdapter } from './IDatabaseAdapter.js';
import logger from '../utils/logger.js';

/**
 * Run all sync-related migrations
 */
export async function runSyncMigrations(db: IDatabaseAdapter): Promise<void> {
  const dialect = db.getDialect();
  logger.info('[MIGRATIONS] Starting sync migrations...');

  // 1. Create sessions table (for user-saved sessions)
  if (dialect === 'sqlite') {
    await db.exec(`
      CREATE TABLE IF NOT EXISTS sessions (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id INTEGER NOT NULL,
        session_id TEXT NOT NULL,
        instance_id TEXT NOT NULL,
        name TEXT,
        description TEXT,
        tags TEXT,
        captured_at INTEGER NOT NULL,
        tab_count INTEGER NOT NULL DEFAULT 0,
        window_count INTEGER NOT NULL DEFAULT 0,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        UNIQUE(user_id, session_id),
        FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE
      )
    `);
  } else {
    await db.exec(`
      CREATE TABLE IF NOT EXISTS sessions (
        id SERIAL PRIMARY KEY,
        user_id INTEGER NOT NULL,
        session_id TEXT NOT NULL,
        instance_id TEXT NOT NULL,
        name TEXT,
        description TEXT,
        tags TEXT,
        captured_at BIGINT NOT NULL,
        tab_count INTEGER NOT NULL DEFAULT 0,
        window_count INTEGER NOT NULL DEFAULT 0,
        created_at TIMESTAMPTZ DEFAULT NOW(),
        UNIQUE(user_id, session_id),
        FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE
      )
    `);
  }
  logger.info('[MIGRATIONS] ✅ sessions table created');

  // 2. Create session_windows table
  if (dialect === 'sqlite') {
    await db.exec(`
      CREATE TABLE IF NOT EXISTS session_windows (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        session_id INTEGER NOT NULL,
        window_id INTEGER NOT NULL,
        focused INTEGER DEFAULT 0,
        incognito INTEGER DEFAULT 0,
        type TEXT,
        window_order INTEGER NOT NULL,
        FOREIGN KEY(session_id) REFERENCES sessions(id) ON DELETE CASCADE
      )
    `);
  } else {
    await db.exec(`
      CREATE TABLE IF NOT EXISTS session_windows (
        id SERIAL PRIMARY KEY,
        session_id INTEGER NOT NULL,
        window_id INTEGER NOT NULL,
        focused BOOLEAN DEFAULT FALSE,
        incognito BOOLEAN DEFAULT FALSE,
        type TEXT,
        window_order INTEGER NOT NULL,
        FOREIGN KEY(session_id) REFERENCES sessions(id) ON DELETE CASCADE
      )
    `);
  }
  logger.info('[MIGRATIONS] ✅ session_windows table created');

  // 3. Create session_tabs table
  if (dialect === 'sqlite') {
    await db.exec(`
      CREATE TABLE IF NOT EXISTS session_tabs (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        session_window_id INTEGER NOT NULL,
        tab_id INTEGER NOT NULL,
        url TEXT NOT NULL,
        title TEXT,
        tab_index INTEGER NOT NULL,
        active INTEGER DEFAULT 0,
        pinned INTEGER DEFAULT 0,
        group_id INTEGER,
        fav_icon_url TEXT,
        FOREIGN KEY(session_window_id) REFERENCES session_windows(id) ON DELETE CASCADE
      )
    `);
  } else {
    await db.exec(`
      CREATE TABLE IF NOT EXISTS session_tabs (
        id SERIAL PRIMARY KEY,
        session_window_id INTEGER NOT NULL,
        tab_id INTEGER NOT NULL,
        url TEXT NOT NULL,
        title TEXT,
        tab_index INTEGER NOT NULL,
        active BOOLEAN DEFAULT FALSE,
        pinned BOOLEAN DEFAULT FALSE,
        group_id INTEGER,
        fav_icon_url TEXT,
        FOREIGN KEY(session_window_id) REFERENCES session_windows(id) ON DELETE CASCADE
      )
    `);
  }
  logger.info('[MIGRATIONS] ✅ session_tabs table created');

  // 4. Create session_restorations table
  if (dialect === 'sqlite') {
    await db.exec(`
      CREATE TABLE IF NOT EXISTS session_restorations (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id INTEGER NOT NULL,
        instance_id TEXT NOT NULL,
        original_session_id TEXT NOT NULL,
        new_window_id INTEGER,
        restored_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE
      )
    `);
  } else {
    await db.exec(`
      CREATE TABLE IF NOT EXISTS session_restorations (
        id SERIAL PRIMARY KEY,
        user_id INTEGER NOT NULL,
        instance_id TEXT NOT NULL,
        original_session_id TEXT NOT NULL,
        new_window_id INTEGER,
        restored_at TIMESTAMPTZ DEFAULT NOW(),
        FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE
      )
    `);
  }
  logger.info('[MIGRATIONS] ✅ session_restorations table created');

  // 5. Create snapshots table
  if (dialect === 'sqlite') {
    await db.exec(`
      CREATE TABLE IF NOT EXISTS snapshots (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id INTEGER NOT NULL,
        instance_id TEXT NOT NULL,
        version_number INTEGER NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        snapshot_data TEXT NOT NULL,
        snapshot_hash TEXT NOT NULL,
        size_bytes INTEGER,
        UNIQUE(user_id, instance_id, version_number),
        FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE
      )
    `);
  } else {
    await db.exec(`
      CREATE TABLE IF NOT EXISTS snapshots (
        id SERIAL PRIMARY KEY,
        user_id INTEGER NOT NULL,
        instance_id TEXT NOT NULL,
        version_number BIGINT NOT NULL,
        created_at TIMESTAMPTZ DEFAULT NOW(),
        snapshot_data JSONB NOT NULL,
        snapshot_hash VARCHAR(64) NOT NULL,
        size_bytes INTEGER,
        UNIQUE(user_id, instance_id, version_number),
        FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE
      )
    `);
  }
  logger.info('[MIGRATIONS] ✅ snapshots table created');

  // Create indices for performance
  const indices = [
    // Sessions indices
    'CREATE INDEX IF NOT EXISTS idx_sessions_user_id ON sessions(user_id)',
    'CREATE INDEX IF NOT EXISTS idx_sessions_instance ON sessions(instance_id)',
    'CREATE INDEX IF NOT EXISTS idx_sessions_user_instance ON sessions(user_id, instance_id)',
    'CREATE INDEX IF NOT EXISTS idx_sessions_captured_at ON sessions(captured_at)',
    'CREATE INDEX IF NOT EXISTS idx_sessions_session_id ON sessions(session_id)',

    // Session windows indices
    'CREATE INDEX IF NOT EXISTS idx_session_windows_session_id ON session_windows(session_id)',

    // Session tabs indices
    'CREATE INDEX IF NOT EXISTS idx_session_tabs_window_id ON session_tabs(session_window_id)',

    // Session restorations indices
    'CREATE INDEX IF NOT EXISTS idx_session_restorations_user_instance ON session_restorations(user_id, instance_id)',
    'CREATE INDEX IF NOT EXISTS idx_session_restorations_session_id ON session_restorations(original_session_id)',

    // Snapshots indices
    'CREATE INDEX IF NOT EXISTS idx_snapshots_user_instance ON snapshots(user_id, instance_id)',
    'CREATE INDEX IF NOT EXISTS idx_snapshots_instance_version ON snapshots(instance_id, version_number DESC)',
    'CREATE INDEX IF NOT EXISTS idx_snapshots_hash ON snapshots(instance_id, snapshot_hash)',
    'CREATE INDEX IF NOT EXISTS idx_snapshots_created ON snapshots(created_at)',
    'CREATE INDEX IF NOT EXISTS idx_snapshots_user_instance_version ON snapshots(user_id, instance_id, version_number DESC)',
  ];

  let indexErrors = 0;
  for (const indexSql of indices) {
    try {
      await db.exec(indexSql);
    } catch (error) {
      logger.error('[MIGRATIONS] Failed to create index:', (error as Error).message);
      indexErrors++;
    }
  }

  if (indexErrors > 0) {
    logger.warn(`[MIGRATIONS] ⚠️ ${indexErrors} indices failed to create`);
  }
  logger.info(`[MIGRATIONS] ✅ ${indices.length - indexErrors}/${indices.length} indices created`);
  logger.info('[MIGRATIONS] 🎉 All migrations completed successfully');
}

/**
 * Verify that all required tables exist
 */
export async function verifySyncTables(db: IDatabaseAdapter): Promise<boolean> {
  const dialect = db.getDialect();
  const requiredTables = [
    'sessions',
    'session_windows',
    'session_tabs',
    'session_restorations',
    'snapshots',
  ];

  try {
    let existingTables: string[];

    if (dialect === 'sqlite') {
      const rows = await db.all<{ name: string }>(
        "SELECT name FROM sqlite_master WHERE type='table'",
      );
      existingTables = rows.map(row => row.name);
    } else {
      const rows = await db.all<{ tablename: string }>(
        "SELECT tablename FROM pg_tables WHERE schemaname = 'public'",
      );
      existingTables = rows.map(row => row.tablename);
    }

    const missingTables = requiredTables.filter(table => !existingTables.includes(table));

    if (missingTables.length > 0) {
      logger.warn('[MIGRATIONS] Missing tables:', missingTables);
      return false;
    }

    logger.info('[MIGRATIONS] ✅ All tables verified');
    return true;
  } catch (error) {
    logger.error('[MIGRATIONS] Failed to verify tables:', (error as Error).message);
    return false;
  }
}
