/**
 * Database Module
 * Provides database connection using adapter pattern
 * Supports both SQLite and PostgreSQL
 */

import { getDatabase, closeDatabase } from './db/DatabaseFactory.js';
import { IDatabaseAdapter } from './db/IDatabaseAdapter.js';
import { SQLiteAdapter } from './db/SQLiteAdapter.js';
import { runSyncMigrations, verifySyncTables } from './db/migrations.js';
import { createTables } from './db/schema.js';
import logger from './utils/logger.js';

// Get database adapter instance
const dbAdapter = getDatabase();

// Promise that resolves when schema is ready
let schemaReadyResolve: () => void;
export const schemaReady = new Promise<void>((resolve) => {
  schemaReadyResolve = resolve;
});

// Initialize database schema
async function initializeSchema(): Promise<void> {
  try {
    await dbAdapter.waitForReady();
    console.log('📋 Creating database tables...');

    // Create tables based on dialect
    await createTables(dbAdapter);

    // Run sync migrations
    console.log('🔄 Running sync migrations...');
    await runSyncMigrations(dbAdapter);

    // Verify tables
    console.log('✅ Verifying sync tables...');
    const verified = await verifySyncTables(dbAdapter);

    if (verified) {
      console.log('✅ All tables created, schema is ready!');
      schemaReadyResolve();
    } else {
      logger.error('❌ Sync table verification failed');
      process.exit(1);
    }
  } catch (error) {
    logger.error('❌ Database initialization failed:', error);
    process.exit(1);
  }
}

// Start initialization
initializeSchema();

/**
 * Get the database adapter
 * This is the primary way to access the database
 */
export function getDb(): IDatabaseAdapter {
  return dbAdapter;
}

/**
 * Get raw SQLite database for legacy compatibility
 * @deprecated Use getDb() adapter methods instead
 */
export function getRawDb(): any {
  if (dbAdapter instanceof SQLiteAdapter) {
    return dbAdapter.getRawDatabase();
  }
  throw new Error('Raw database access is only available for SQLite');
}

// Export adapter for backward compatibility
// Legacy code uses `db` directly for sqlite3 operations
export const db = dbAdapter instanceof SQLiteAdapter 
  ? dbAdapter.getRawDatabase() 
  : dbAdapter;

// Export close function
export { closeDatabase };
