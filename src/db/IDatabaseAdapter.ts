/**
 * Database Adapter Interface
 * Provides an abstraction layer for database operations
 * supporting both SQLite and PostgreSQL
 */

export interface QueryResult<T = any> {
  rows: T[];
  rowCount: number;
  lastInsertId?: number;
}

export interface IDatabaseAdapter {
  /**
   * Execute a write operation (INSERT, UPDATE, DELETE)
   * @param sql SQL query string (use ? for SQLite, $1/$2/etc for PostgreSQL)
   * @param params Query parameters
   * @returns Promise resolving to affected row count and last insert ID
   */
  run(sql: string, params?: any[]): Promise<{ changes: number; lastID?: number }>;

  /**
   * Get a single row
   * @param sql SQL query string
   * @param params Query parameters
   * @returns Promise resolving to a single row or undefined
   */
  get<T = any>(sql: string, params?: any[]): Promise<T | undefined>;

  /**
   * Get multiple rows
   * @param sql SQL query string
   * @param params Query parameters
   * @returns Promise resolving to an array of rows
   */
  all<T = any>(sql: string, params?: any[]): Promise<T[]>;

  /**
   * Execute multiple statements within a transaction
   * @param callback Async function containing transaction operations
   * @returns Promise resolving to the callback result
   */
  transaction<T>(callback: () => Promise<T>): Promise<T>;

  /**
   * Begin a transaction manually
   */
  beginTransaction(): Promise<void>;

  /**
   * Commit the current transaction
   */
  commit(): Promise<void>;

  /**
   * Rollback the current transaction
   */
  rollback(): Promise<void>;

  /**
   * Close the database connection
   */
  close(): Promise<void>;

  /**
   * Get the database dialect
   * @returns 'sqlite' or 'postgres'
   */
  getDialect(): 'sqlite' | 'postgres';

  /**
   * Check if the database connection is ready
   */
  isReady(): boolean;

  /**
   * Wait for the database to be ready
   */
  waitForReady(): Promise<void>;

  /**
   * Execute raw SQL (for migrations/schema creation)
   * @param sql SQL statement(s) to execute
   */
  exec(sql: string): Promise<void>;

  /**
   * Prepare a statement for repeated execution
   * Returns a simplified interface for batch operations
   */
  prepare(sql: string): Promise<PreparedStatement>;
}

export interface PreparedStatement {
  run(params?: any[]): Promise<{ changes: number; lastID?: number }>;
  get<T = any>(params?: any[]): Promise<T | undefined>;
  all<T = any>(params?: any[]): Promise<T[]>;
  finalize(): Promise<void>;
}

/**
 * Helper to convert SQLite-style ? placeholders to PostgreSQL $1, $2, etc.
 */
export function convertPlaceholders(sql: string, dialect: 'sqlite' | 'postgres'): string {
  if (dialect === 'sqlite') {
    return sql;
  }

  // Convert ? to $1, $2, etc. for PostgreSQL
  let index = 0;
  return sql.replace(/\?/g, () => `$${++index}`);
}

/**
 * Base adapter class with common functionality
 */
export abstract class BaseDatabaseAdapter implements IDatabaseAdapter {
  protected ready = false;
  protected readyPromise: Promise<void>;
  protected readyResolve!: () => void;

  constructor() {
    this.readyPromise = new Promise(resolve => {
      this.readyResolve = resolve;
    });
  }

  abstract run(sql: string, params?: any[]): Promise<{ changes: number; lastID?: number }>;
  abstract get<T = any>(sql: string, params?: any[]): Promise<T | undefined>;
  abstract all<T = any>(sql: string, params?: any[]): Promise<T[]>;
  abstract transaction<T>(callback: () => Promise<T>): Promise<T>;
  abstract beginTransaction(): Promise<void>;
  abstract commit(): Promise<void>;
  abstract rollback(): Promise<void>;
  abstract close(): Promise<void>;
  abstract getDialect(): 'sqlite' | 'postgres';
  abstract exec(sql: string): Promise<void>;
  abstract prepare(sql: string): Promise<PreparedStatement>;

  isReady(): boolean {
    return this.ready;
  }

  async waitForReady(): Promise<void> {
    return this.readyPromise;
  }

  protected markReady(): void {
    this.ready = true;
    this.readyResolve();
  }
}
