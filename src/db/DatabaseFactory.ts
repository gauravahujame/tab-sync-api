/**
 * Database Factory
 * Creates the appropriate database adapter based on configuration
 */

import { config } from '../config.js';
import { IDatabaseAdapter } from './IDatabaseAdapter.js';
import { SQLiteAdapter } from './SQLiteAdapter.js';
import { PostgresAdapter, PostgresConfig } from './PostgresAdapter.js';
import logger from '../utils/logger.js';

let instance: IDatabaseAdapter | null = null;

/**
 * Create or get the database adapter instance
 * Uses singleton pattern to ensure only one connection pool
 */
export function getDatabase(): IDatabaseAdapter {
  if (instance) {
    return instance;
  }

  const dbType = config.database.type;

  console.log(`📊 Database type: ${dbType}`);

  if (dbType === 'postgres') {
    const pgConfig: PostgresConfig = {
      host: config.database.postgres.host,
      port: config.database.postgres.port,
      user: config.database.postgres.username,
      password: config.database.postgres.password,
      database: config.database.postgres.database,
    };

    logger.info('Initializing PostgreSQL database adapter', {
      host: pgConfig.host,
      port: pgConfig.port,
      database: pgConfig.database,
    });

    instance = new PostgresAdapter(pgConfig);
  } else {
    logger.info('Initializing SQLite database adapter', {
      path: config.database.sqlitePath,
    });

    instance = new SQLiteAdapter(config.database.sqlitePath);
  }

  return instance;
}

/**
 * Close the database connection
 */
export async function closeDatabase(): Promise<void> {
  if (instance) {
    await instance.close();
    instance = null;
  }
}

/**
 * Reset the database instance (for testing)
 */
export function resetDatabaseInstance(): void {
  instance = null;
}
