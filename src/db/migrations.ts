/**
 * Database migrations for sync architecture
 * Creates tables for markers, events, sessions, and restorations
 */

import { Database } from 'sqlite3';
import logger from '../utils/logger.js';

/**
 * Run all sync-related migrations
 */
export async function runSyncMigrations(db: Database): Promise<void> {
  return new Promise((resolve, reject) => {
    logger.info('[MIGRATIONS] Starting sync migrations...');

    db.serialize(() => {
      // 1. Create sync_markers table
      db.run(
        `
        CREATE TABLE IF NOT EXISTS sync_markers (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          user_id INTEGER NOT NULL,
          instance_id TEXT NOT NULL,
          last_event_timestamp INTEGER NOT NULL DEFAULT 0,
          last_session_id TEXT,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          UNIQUE(user_id, instance_id),
          FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE
        )
      `,
        (err) => {
          if (err) {
            logger.error('[MIGRATIONS] Failed to create sync_markers table:', err.message);
            return reject(err);
          }
          logger.info('[MIGRATIONS] ✅ sync_markers table created');
        },
      );

      // 2. Create events table
      db.run(
        `
        CREATE TABLE IF NOT EXISTS events (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          user_id INTEGER NOT NULL,
          instance_id TEXT NOT NULL,
          event_type TEXT NOT NULL,
          document_id TEXT,

          -- Tab/Window fields
          tab_id INTEGER,
          window_id INTEGER,
          url TEXT,
          title TEXT,

          -- Navigation fields
          navigation_type TEXT,
          from_address_bar INTEGER DEFAULT 0,
          transition_type TEXT,
          transition_qualifiers TEXT,

          -- Time tracking fields
          start_time INTEGER,
          end_time INTEGER,
          duration_ms INTEGER,
          was_active INTEGER,
          was_window_focused INTEGER,
          user_was_active INTEGER,

          -- Context fields
          tab_count INTEGER,
          window_count INTEGER,
          
          -- Group fields
          group_id INTEGER,
          group_name TEXT,
          group_color TEXT,

          -- Session restoration fields
          original_session_id TEXT,
          new_window_id INTEGER,

          -- Metadata
          timestamp INTEGER NOT NULL,
          synced_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          metadata TEXT,

          FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE
        )
      `,
        (err) => {
          if (err) {
            logger.error('[MIGRATIONS] Failed to create events table:', err.message);
            return reject(err);
          }

          // Ensure new columns exist (for existing tables)
          const columnsToAdd = [
            'transition_type TEXT',
            'transition_qualifiers TEXT',
            'group_id INTEGER',
            'group_name TEXT',
            'group_color TEXT'
          ];

          db.all(`PRAGMA table_info(events)`, (err, columns: any[]) => {
            if (err) return;
            const existingNames = columns.map(c => c.name);

            columnsToAdd.forEach(def => {
              const name = def.split(' ')[0];
              if (!existingNames.includes(name)) {
                db.run(`ALTER TABLE events ADD COLUMN ${def}`, (alterErr) => {
                  if (alterErr) logger.error(`[MIGRATIONS] Failed to add ${name}:`, alterErr.message);
                  else logger.info(`[MIGRATIONS] Added column ${name} to events`);
                });
              }
            });
          });

          logger.info('[MIGRATIONS] ✅ events table created/verified');
        },
      );

      // 3. Create sessions table
      db.run(
        `
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
      `,
        (err) => {
          if (err) {
            logger.error('[MIGRATIONS] Failed to create sessions table:', err.message);
            return reject(err);
          }
          logger.info('[MIGRATIONS] ✅ sessions table created');
        },
      );

      // 4. Create session_windows table
      db.run(
        `
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
      `,
        (err) => {
          if (err) {
            logger.error('[MIGRATIONS] Failed to create session_windows table:', err.message);
            return reject(err);
          }
          logger.info('[MIGRATIONS] ✅ session_windows table created');
        },
      );

      // 5. Create session_tabs table
      db.run(
        `
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
      `,
        (err) => {
          if (err) {
            logger.error('[MIGRATIONS] Failed to create session_tabs table:', err.message);
            return reject(err);
          }
          logger.info('[MIGRATIONS] ✅ session_tabs table created');
        },
      );

      // 6. Create session_restorations table
      db.run(
        `
        CREATE TABLE IF NOT EXISTS session_restorations (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          user_id INTEGER NOT NULL,
          instance_id TEXT NOT NULL,
          original_session_id TEXT NOT NULL,
          new_window_id INTEGER,
          restored_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE
        )
      `,
        (err) => {
          if (err) {
            logger.error('[MIGRATIONS] Failed to create session_restorations table:', err.message);
            return reject(err);
          }
          logger.info('[MIGRATIONS] ✅ session_restorations table created');
        },
      );

      // Create indices for performance
      const indices = [
        // Sync markers indices
        'CREATE INDEX IF NOT EXISTS idx_sync_markers_user_instance ON sync_markers(user_id, instance_id)',
        'CREATE INDEX IF NOT EXISTS idx_sync_markers_instance ON sync_markers(instance_id)',

        // Events indices
        'CREATE INDEX IF NOT EXISTS idx_events_user_id ON events(user_id)',
        'CREATE INDEX IF NOT EXISTS idx_events_instance ON events(instance_id)',
        'CREATE INDEX IF NOT EXISTS idx_events_user_instance ON events(user_id, instance_id)',
        'CREATE INDEX IF NOT EXISTS idx_events_timestamp ON events(timestamp)',
        'CREATE INDEX IF NOT EXISTS idx_events_document_id ON events(document_id)',
        'CREATE INDEX IF NOT EXISTS idx_events_instance_document ON events(instance_id, document_id)',
        'CREATE INDEX IF NOT EXISTS idx_events_type ON events(event_type)',
        'CREATE INDEX IF NOT EXISTS idx_events_user_type ON events(user_id, event_type)',

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
      ];

      let indexCount = 0;
      let indexErrors = 0;

      indices.forEach((indexSql, idx) => {
        db.run(indexSql, (err) => {
          if (err) {
            logger.error(`[MIGRATIONS] Failed to create index ${idx + 1}:`, err.message);
            indexErrors++;
          }
          indexCount++;

          // When all indices are processed
          if (indexCount === indices.length) {
            if (indexErrors > 0) {
              logger.warn(`[MIGRATIONS] ⚠️  ${indexErrors} indices failed to create`);
            }
            logger.info(`[MIGRATIONS] ✅ ${indices.length - indexErrors}/${indices.length} indices created`);
            logger.info('[MIGRATIONS] 🎉 All sync migrations completed successfully');
            resolve();
          }
        });
      });
    });
  });
}

/**
 * Verify that all sync tables exist
 */
export async function verifySyncTables(db: Database): Promise<boolean> {
  return new Promise((resolve) => {
    const requiredTables = [
      'sync_markers',
      'events',
      'sessions',
      'session_windows',
      'session_tabs',
      'session_restorations',
    ];

    db.all(
      "SELECT name FROM sqlite_master WHERE type='table'",
      (err, rows: Array<{ name: string }>) => {
        if (err) {
          logger.error('[MIGRATIONS] Failed to verify tables:', err.message);
          return resolve(false);
        }

        const existingTables = rows.map((row) => row.name);
        const missingTables = requiredTables.filter((table) => !existingTables.includes(table));

        if (missingTables.length > 0) {
          logger.warn('[MIGRATIONS] Missing tables:', missingTables);
          return resolve(false);
        }

        logger.info('[MIGRATIONS] ✅ All sync tables verified');
        resolve(true);
      },
    );
  });
}
