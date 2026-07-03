/**
 * Jest setup file
 * Runs before test files are loaded, ensuring the app uses in-memory test DB.
 *
 * CRITICAL: Set env vars BEFORE any dynamic imports from src/ so the config
 * module reads the test database path.
 */

process.env.NODE_ENV = 'test';
process.env.DATABASE_PATH = ':memory:';
process.env.JWT_SECRET = 'test-secret-key-for-jwt-signing';
process.env.RATE_LIMIT_ENABLED = 'false';
process.env.LOG_LEVEL = 'error';
process.env.PORT = '0';

// Reset any previously created database singleton, then import the db module
// and wait for schema initialization. All src/ imports are dynamic to ensure env
// vars are already set. We do NOT import the app here so that unit tests can
// still apply jest.mock on submodules (e.g., jsonwebtoken) in auth tests.
const { resetDatabaseInstance } = await import('../src/db/DatabaseFactory.js');
resetDatabaseInstance();

const { schemaReady } = await import('../src/db.js');
await schemaReady;

console.log('[TEST SETUP] Database schema ready for tests');

export const setupComplete = true;
