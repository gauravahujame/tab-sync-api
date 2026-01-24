/**
 * SQLite Database Adapter
 * Implements IDatabaseAdapter for SQLite using sqlite3 package
 */

import fs from 'fs';
import path from 'path';
import sqlite3 from 'sqlite3';
import { BaseDatabaseAdapter, PreparedStatement, convertPlaceholders } from './IDatabaseAdapter.js';
import logger from '../utils/logger.js';

export class SQLiteAdapter extends BaseDatabaseAdapter {
  private db: sqlite3.Database;

  constructor(databasePath: string) {
    super();

    // Ensure database directory exists
    const dbDir = path.dirname(databasePath);
    if (!fs.existsSync(dbDir)) {
      fs.mkdirSync(dbDir, { recursive: true });
    }

    console.log('🔌 Connecting to SQLite database...');
    this.db = new sqlite3.Database(databasePath, (err) => {
      if (err) {
        console.error('❌ Failed to connect to SQLite database:', err.message);
        logger.error('Failed to connect to SQLite database:', err.message);
        process.exit(1);
      }

      console.log('✅ SQLite database connected successfully');

      // Enable foreign key constraints
      this.db.run('PRAGMA foreign_keys = ON', (pragmaErr) => {
        if (pragmaErr) {
          logger.error('Failed to enable foreign keys:', pragmaErr.message);
        }
        this.markReady();
      });
    });
  }

  getDialect(): 'sqlite' | 'postgres' {
    return 'sqlite';
  }

  async run(sql: string, params: any[] = []): Promise<{ changes: number; lastID?: number }> {
    const convertedSql = convertPlaceholders(sql, 'sqlite');
    return new Promise((resolve, reject) => {
      this.db.run(convertedSql, params, function (err) {
        if (err) {
          reject(err);
        } else {
          resolve({ changes: this.changes, lastID: this.lastID });
        }
      });
    });
  }

  async get<T = any>(sql: string, params: any[] = []): Promise<T | undefined> {
    const convertedSql = convertPlaceholders(sql, 'sqlite');
    return new Promise((resolve, reject) => {
      this.db.get(convertedSql, params, (err, row) => {
        if (err) {
          reject(err);
        } else {
          resolve(row as T | undefined);
        }
      });
    });
  }

  async all<T = any>(sql: string, params: any[] = []): Promise<T[]> {
    const convertedSql = convertPlaceholders(sql, 'sqlite');
    return new Promise((resolve, reject) => {
      this.db.all(convertedSql, params, (err, rows) => {
        if (err) {
          reject(err);
        } else {
          resolve(rows as T[]);
        }
      });
    });
  }

  async transaction<T>(callback: () => Promise<T>): Promise<T> {
    await this.beginTransaction();
    try {
      const result = await callback();
      await this.commit();
      return result;
    } catch (error) {
      await this.rollback();
      throw error;
    }
  }

  async beginTransaction(): Promise<void> {
    return new Promise((resolve, reject) => {
      this.db.run('BEGIN TRANSACTION', (err) => {
        if (err) reject(err);
        else resolve();
      });
    });
  }

  async commit(): Promise<void> {
    return new Promise((resolve, reject) => {
      this.db.run('COMMIT', (err) => {
        if (err) reject(err);
        else resolve();
      });
    });
  }

  async rollback(): Promise<void> {
    return new Promise((resolve, reject) => {
      this.db.run('ROLLBACK', (err) => {
        if (err) reject(err);
        else resolve();
      });
    });
  }

  async close(): Promise<void> {
    return new Promise((resolve, reject) => {
      this.db.close((err) => {
        if (err) reject(err);
        else resolve();
      });
    });
  }

  async exec(sql: string): Promise<void> {
    return new Promise((resolve, reject) => {
      this.db.exec(sql, (err) => {
        if (err) reject(err);
        else resolve();
      });
    });
  }

  async prepare(sql: string): Promise<PreparedStatement> {
    const convertedSql = convertPlaceholders(sql, 'sqlite');
    return new Promise((resolve, reject) => {
      const stmt = this.db.prepare(convertedSql, (err) => {
        if (err) {
          reject(err);
        } else {
          resolve(new SQLitePreparedStatement(stmt));
        }
      });
    });
  }

  /**
   * Get the underlying sqlite3.Database instance for legacy compatibility
   * @deprecated Use adapter methods instead
   */
  getRawDatabase(): sqlite3.Database {
    return this.db;
  }

  /**
   * Serialize database operations (SQLite-specific)
   */
  serialize(callback: () => void): void {
    this.db.serialize(callback);
  }
}

class SQLitePreparedStatement implements PreparedStatement {
  constructor(private stmt: sqlite3.Statement) {}

  async run(params: any[] = []): Promise<{ changes: number; lastID?: number }> {
    return new Promise((resolve, reject) => {
      this.stmt.run(params, function (err) {
        if (err) reject(err);
        else resolve({ changes: this.changes, lastID: this.lastID });
      });
    });
  }

  async get<T = any>(params: any[] = []): Promise<T | undefined> {
    return new Promise((resolve, reject) => {
      this.stmt.get(params, (err, row) => {
        if (err) reject(err);
        else resolve(row as T | undefined);
      });
    });
  }

  async all<T = any>(params: any[] = []): Promise<T[]> {
    return new Promise((resolve, reject) => {
      this.stmt.all(params, (err, rows) => {
        if (err) reject(err);
        else resolve(rows as T[]);
      });
    });
  }

  async finalize(): Promise<void> {
    return new Promise((resolve, reject) => {
      this.stmt.finalize((err) => {
        if (err) reject(err);
        else resolve();
      });
    });
  }
}
