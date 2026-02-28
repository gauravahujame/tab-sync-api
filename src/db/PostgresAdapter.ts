/**
 * PostgreSQL Database Adapter
 * Implements IDatabaseAdapter for PostgreSQL using pg package
 */

import pg from 'pg';
import { BaseDatabaseAdapter, PreparedStatement, convertPlaceholders } from './IDatabaseAdapter.js';
import logger from '../utils/logger.js';

const { Pool } = pg;

export interface PostgresConfig {
  host: string;
  port: number;
  user: string;
  password: string;
  database: string;
}

export class PostgresAdapter extends BaseDatabaseAdapter {
  private pool: pg.Pool;
  private transactionClient: pg.PoolClient | null = null;

  constructor(config: PostgresConfig) {
    super();

    console.log('🔌 Connecting to PostgreSQL database...');
    this.pool = new Pool({
      host: config.host,
      port: config.port,
      user: config.user,
      password: config.password,
      database: config.database,
      max: 20,
      idleTimeoutMillis: 30000,
      connectionTimeoutMillis: 2000,
    });

    // Test connection
    this.pool
      .connect()
      .then(client => {
        console.log('✅ PostgreSQL database connected successfully');
        client.release();
        this.markReady();
      })
      .catch(err => {
        console.error('❌ Failed to connect to PostgreSQL database:', err.message);
        logger.error('Failed to connect to PostgreSQL database:', err.message);
        process.exit(1);
      });

    // Handle pool errors
    this.pool.on('error', err => {
      logger.error('Unexpected PostgreSQL pool error:', err.message);
    });
  }

  getDialect(): 'sqlite' | 'postgres' {
    return 'postgres';
  }

  async run(sql: string, params: any[] = []): Promise<{ changes: number; lastID?: number }> {
    const convertedSql = convertPlaceholders(sql, 'postgres');
    const client = this.transactionClient || this.pool;

    // For INSERT statements, try to get the returning ID
    let finalSql = convertedSql;
    const isInsert = sql.trim().toUpperCase().startsWith('INSERT');

    if (isInsert && !convertedSql.toUpperCase().includes('RETURNING')) {
      finalSql = convertedSql.replace(/;?\s*$/, ' RETURNING id;');
    }

    try {
      const result = await client.query(finalSql, params);
      return {
        changes: result.rowCount || 0,
        lastID: result.rows[0]?.id,
      };
    } catch (error) {
      // If RETURNING id fails (table doesn't have id column), try without
      if (isInsert && (error as Error).message.includes('column "id" does not exist')) {
        const result = await client.query(convertedSql, params);
        return { changes: result.rowCount || 0 };
      }
      throw error;
    }
  }

  async get<T = any>(sql: string, params: any[] = []): Promise<T | undefined> {
    const convertedSql = convertPlaceholders(sql, 'postgres');
    const client = this.transactionClient || this.pool;
    const result = await client.query(convertedSql, params);
    return result.rows[0] as T | undefined;
  }

  async all<T = any>(sql: string, params: any[] = []): Promise<T[]> {
    const convertedSql = convertPlaceholders(sql, 'postgres');
    const client = this.transactionClient || this.pool;
    const result = await client.query(convertedSql, params);
    return result.rows as T[];
  }

  async transaction<T>(callback: () => Promise<T>): Promise<T> {
    const client = await this.pool.connect();
    this.transactionClient = client;

    try {
      await client.query('BEGIN');
      const result = await callback();
      await client.query('COMMIT');
      return result;
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      this.transactionClient = null;
      client.release();
    }
  }

  async beginTransaction(): Promise<void> {
    if (!this.transactionClient) {
      this.transactionClient = await this.pool.connect();
    }
    await this.transactionClient.query('BEGIN');
  }

  async commit(): Promise<void> {
    if (this.transactionClient) {
      await this.transactionClient.query('COMMIT');
      this.transactionClient.release();
      this.transactionClient = null;
    }
  }

  async rollback(): Promise<void> {
    if (this.transactionClient) {
      await this.transactionClient.query('ROLLBACK');
      this.transactionClient.release();
      this.transactionClient = null;
    }
  }

  async close(): Promise<void> {
    await this.pool.end();
  }

  async exec(sql: string): Promise<void> {
    const client = this.transactionClient || this.pool;
    await client.query(sql);
  }

  async prepare(sql: string): Promise<PreparedStatement> {
    return new PostgresPreparedStatement(this.pool, sql);
  }
}

class PostgresPreparedStatement implements PreparedStatement {
  private convertedSql: string;

  constructor(
    private pool: pg.Pool,
    sql: string,
  ) {
    this.convertedSql = convertPlaceholders(sql, 'postgres');
  }

  async run(params: any[] = []): Promise<{ changes: number; lastID?: number }> {
    const result = await this.pool.query(this.convertedSql, params);
    return {
      changes: result.rowCount || 0,
      lastID: result.rows[0]?.id,
    };
  }

  async get<T = any>(params: any[] = []): Promise<T | undefined> {
    const result = await this.pool.query(this.convertedSql, params);
    return result.rows[0] as T | undefined;
  }

  async all<T = any>(params: any[] = []): Promise<T[]> {
    const result = await this.pool.query(this.convertedSql, params);
    return result.rows as T[];
  }

  async finalize(): Promise<void> {
    // PostgreSQL doesn't need explicit statement finalization
  }
}
