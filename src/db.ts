import sqlite3 from 'sqlite3';
import { config } from './config.js';
import fs from 'fs';
import path from 'path';
import logger from './utils/logger.js';

// Ensure database directory exists
const dbDir = path.dirname(config.databasePath);
if (!fs.existsSync(dbDir)) {
  fs.mkdirSync(dbDir, { recursive: true });
}

// Initialize database connection
const db = new sqlite3.Database(config.databasePath, (err) => {
  if (err) {
    logger.error('Failed to connect to database:', err.message);
    process.exit(1);
  }
  
  // Enable foreign key constraints
  db.run('PRAGMA foreign_keys = ON');
  
  // Create tables
  createTables();
});

/**
 * Create database tables with proper schema
 */
const createTables = () => {
  // Create users table
  db.run(`
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      email TEXT UNIQUE NOT NULL,
      name TEXT,
      token TEXT,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )
  `, (err) => {
    if (err) {
      logger.error('Error creating users table:', err.message);
      return;
    }
    
    // Create email index
    db.run('CREATE INDEX IF NOT EXISTS idx_users_email ON users(email)');
    
    // Create tabs table with all required fields
    db.run(`
      CREATE TABLE IF NOT EXISTS tabs (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        client_tab_id INTEGER,
        url TEXT NOT NULL,
        title TEXT,
        window_id INTEGER NOT NULL,
        opener_tab_id INTEGER,
        last_accessed REAL,
        incognito BOOLEAN DEFAULT 0,
        group_id INTEGER DEFAULT -1,
        browser_name TEXT,
        user_id INTEGER,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        UNIQUE(url, window_id, client_tab_id, user_id, browser_name),
        FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE
      )
    `, (err) => {
      if (err) {
        logger.error('Error creating tabs table:', err.message);
        return;
      }
      
      // Create index on user_id for better query performance
      db.run('CREATE INDEX IF NOT EXISTS idx_tabs_user_id ON tabs(user_id)');
      
      logger.info('Database schema initialized successfully');
    });
  });
};

export { db };
