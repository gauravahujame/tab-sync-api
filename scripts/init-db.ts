import jwt from 'jsonwebtoken'; // Changed this line
import bcrypt from 'bcryptjs';
import sqlite3 from 'sqlite3';
import { config } from '../src/config.js';
import logger from '../src/utils/logger.js';

interface DbUser {
  id: number;
  email: string;
  name: string;
  token: string;
  browser_name: string;
  created_at: string;
}

async function initializeDatabase() {
  try {
    const db = new sqlite3.Database(config.databasePath, err => {
      if (err) {
        logger.error('Error opening database:', err.message);
        process.exit(1);
      }
    });

    // Wrap methods manually
    const dbAll = (sql: string, params: any[] = []): Promise<any[]> =>
      new Promise((resolve, reject) => {
        db.all(sql, params, (err, rows) => {
          if (err) reject(err);
          else resolve(rows);
        });
      });
    const dbRun = (sql: string, params: any[] = []): Promise<void> =>
      new Promise((resolve, reject) => {
        db.run(sql, params, err => {
          if (err) reject(err);
          else resolve();
        });
      });
    const dbClose = (): Promise<void> =>
      new Promise((resolve, reject) => {
        db.close(err => {
          if (err) reject(err);
          else resolve();
        });
      });

    // === ENSURE TABLES ARE CREATED ===
    async function ensureTables() {
      await dbRun(
        `CREATE TABLE IF NOT EXISTS users (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          email TEXT UNIQUE NOT NULL,
          name TEXT,
          token TEXT,
          password_hash TEXT,
          browser_name TEXT NOT NULL DEFAULT 'unknown',
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )`,
      );
      await dbRun(`CREATE INDEX IF NOT EXISTS idx_users_email ON users(email)`);

      await dbRun(
        `CREATE TABLE IF NOT EXISTS tabs (
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
        )`,
      );
      await dbRun(`CREATE INDEX IF NOT EXISTS idx_tabs_user_id ON tabs(user_id)`);
    }

    // RUN TABLE INIT
    await ensureTables();

    // Check for users
    const users = (await dbAll('SELECT * FROM users LIMIT 1')) as DbUser[];

    if (users.length === 0) {
      logger.info('Database initialized. No users found. Use the registration endpoint to create users.');
    } else {
      logger.info('Database already initialized with users');
    }

    await dbClose();
  } catch (error) {
    logger.error('Error initializing database:', error);
    process.exit(1);
  }
}

initializeDatabase().catch(console.error);
export { initializeDatabase };
