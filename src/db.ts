import fs from "fs";
import path from "path";
import sqlite3 from "sqlite3";
import { config } from "./config.js";
import logger from "./utils/logger.js";
import { runSyncMigrations, verifySyncTables } from "./db/migrations.js";

// Ensure database directory exists
const dbDir = path.dirname(config.databasePath);
if (!fs.existsSync(dbDir)) {
  fs.mkdirSync(dbDir, { recursive: true });
}

type TableColumn = {
  name: string;
};

const ensureColumnExists = (
  tableName: string,
  columnName: string,
  columnDefinition: string,
) => {
  db.all(`PRAGMA table_info(${tableName})`, (err, columns: TableColumn[]) => {
    if (err) {
      logger.error(`Failed to inspect table ${tableName}:`, err.message);
      return;
    }

    const hasColumn = columns.some((column) => column.name === columnName);

    if (hasColumn) {
      return;
    }

    db.run(
      `ALTER TABLE ${tableName} ADD COLUMN ${columnDefinition}`,
      (alterErr) => {
        if (alterErr) {
          logger.error(
            `Failed to add column ${columnName} to ${tableName}:`,
            alterErr.message,
          );
          return;
        }

        logger.info(
          `Added missing column ${columnName} to ${tableName} table with definition: ${columnDefinition}`,
        );
      },
    );
  });
};

// Promise that resolves when schema is ready
let schemaReadyResolve: () => void;
export const schemaReady = new Promise<void>((resolve) => {
  schemaReadyResolve = resolve;
});

// Initialize database connection
console.log("🔌 Connecting to database...");
const db = new sqlite3.Database(config.databasePath, (err) => {
  if (err) {
    console.error("❌ Failed to connect to database:", err.message);
    logger.error("Failed to connect to database:", err.message);
    process.exit(1);
  }

  console.log("✅ Database connected successfully");

  // Enable foreign key constraints
  db.run("PRAGMA foreign_keys = ON");

  // Create tables and resolve when done
  console.log("📋 Creating database tables...");
  createTables(() => {
    // Schema is ready
    console.log("✅ All tables created, schema is ready!");
    schemaReadyResolve();
  });
});

/**
 * Create database tables with proper schema
 */

const createTables = (onComplete: () => void) => {
  // Create users table
  db.run(
    `
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      email TEXT UNIQUE NOT NULL,
      name TEXT,
      token TEXT,
      browser_name TEXT NOT NULL DEFAULT 'unknown',
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )
  `,
    (err) => {
      if (err) {
        logger.error("Error creating users table:", err.message);
        return;
      }

      ensureColumnExists(
        "users",
        "browser_name",
        "browser_name TEXT NOT NULL DEFAULT 'unknown'",
      );

      db.run(
        "UPDATE users SET browser_name = 'unknown' WHERE browser_name IS NULL OR TRIM(browser_name) = ''",
        (updateErr) => {
          if (updateErr) {
            logger.error(
              "Failed to backfill browser_name values in users table:",
              updateErr.message,
            );
          }
        },
      );

      // Create email index
      db.run("CREATE INDEX IF NOT EXISTS idx_users_email ON users(email)");

      // Create tabs table
      db.run(
        `
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
    `,
        async (err) => {
          if (err) {
            logger.error('Error creating tabs table:', err.message);
            return;
          }

          // Ensure all columns exist
          ensureColumnExists('tabs', 'tab_index', 'tab_index INTEGER');
          ensureColumnExists('tabs', 'active', 'active BOOLEAN DEFAULT 0');
          ensureColumnExists('tabs', 'highlighted', 'highlighted BOOLEAN DEFAULT 0');
          ensureColumnExists('tabs', 'pinned', 'pinned BOOLEAN DEFAULT 0');
          ensureColumnExists('tabs', 'audible', 'audible BOOLEAN DEFAULT 0');
          ensureColumnExists('tabs', 'muted_info', 'muted_info TEXT');
          ensureColumnExists('tabs', 'discarded', 'discarded BOOLEAN DEFAULT 0');
          ensureColumnExists('tabs', 'auto_discardable', 'auto_discardable BOOLEAN DEFAULT 1');
          ensureColumnExists('tabs', 'frozen', 'frozen BOOLEAN DEFAULT 0');
          ensureColumnExists('tabs', 'fav_icon_url', 'fav_icon_url TEXT');
          ensureColumnExists('tabs', 'pending_url', 'pending_url TEXT');
          ensureColumnExists('tabs', 'session_id', 'session_id TEXT');
          ensureColumnExists('tabs', 'status', 'status TEXT');
          ensureColumnExists('tabs', 'width', 'width INTEGER');
          ensureColumnExists('tabs', 'height', 'height INTEGER');

          // Create index on user_id
          db.run(
            'CREATE INDEX IF NOT EXISTS idx_tabs_user_id ON tabs(user_id)',
            async () => {
              // ✅ NOW RUN SYNC MIGRATIONS
              try {
                console.log('🔄 Running sync migrations...');
                await runSyncMigrations(db);

                console.log('✅ Verifying sync tables...');
                const verified = await verifySyncTables(db);

                if (verified) {
                  console.log('✅ All sync tables created and verified');
                  onComplete();
                } else {
                  logger.error('❌ Sync table verification failed');
                  process.exit(1);
                }
              } catch (error) {
                logger.error('❌ Migrations failed:', error);
                process.exit(1);
              }
            },
          );
        },
      );
    },
  );
};

export { db };
