import sqlite3 from 'sqlite3';
import { config } from '@base/config';
import fs from 'fs';
import path from 'path';

const dbDir = path.dirname(config.databasePath);
if (!fs.existsSync(dbDir)) {
  fs.mkdirSync(dbDir, { recursive: true });
}

export const db = new sqlite3.Database(config.databasePath, (err) => {
  if (err) {
    console.error('Failed to connect to database:', err.message);
    process.exit(1);
  }
});

db.serialize(() => {
  db.run(`
    CREATE TABLE IF NOT EXISTS tabs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      url TEXT NOT NULL,
      title TEXT,
      window_id INTEGER,
      session_id TEXT,
      opened_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      UNIQUE(url, window_id, session_id)
    )
  `);
  db.run(`
    CREATE INDEX IF NOT EXISTS idx_tab_url ON tabs(url, window_id, session_id)
  `);
});
