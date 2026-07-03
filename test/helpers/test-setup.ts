/**
 * Test setup helpers for integration tests
 *
 * IMPORTANT: Set process.env BEFORE importing the app or db modules,
 * since they initialize the database connection at module load time.
 */

import jwt from 'jsonwebtoken';
import { closeDatabase } from '../../src/db/DatabaseFactory.js';

export interface TestUser {
  id: number;
  email: string;
  name: string;
  token: string;
}

/**
 * Standard environment configuration for tests.
 * Call this at the very top of a test file before any imports from src/.
 */
export function configureTestEnv(): void {
  process.env.NODE_ENV = 'test';
  process.env.DATABASE_PATH = ':memory:';
  process.env.JWT_SECRET = 'test-secret-key-for-jwt-signing';
  process.env.RATE_LIMIT_ENABLED = 'false';
  process.env.LOG_LEVEL = 'error';
}

/**
 * Wait for the database schema to be ready.
 */
export async function waitForSchema(): Promise<void> {
  const { schemaReady } = await import('../../src/db.js');
  await schemaReady;
}

/**
 * Create a test user directly in the database and return a JWT token
 */
export async function createTestUser(
  overrides: Partial<{ email: string; name: string; password: string }> = {},
): Promise<TestUser> {
  const { getDb } = await import('../../src/db.js');
  const db = getDb();
  const email = overrides.email || `test-${Date.now()}@example.com`;
  const name = overrides.name || 'Test User';
  const password = overrides.password || 'password123';

  const result = await db.run(
    'INSERT INTO users (name, email, token, password_hash, browser_name) VALUES (?, ?, ?, ?, ?)',
    [name, email, '', password, 'chrome-test'],
  );

  const userId = result.lastID!;

  const token = jwt.sign(
    { id: userId, name, email, browserName: 'chrome-test' },
    process.env.JWT_SECRET!,
    { expiresIn: '1h' },
  );

  await db.run('UPDATE users SET token = ? WHERE id = ?', [token, userId]);

  return { id: userId, email, name, token };
}

/**
 * Clean up the in-memory database after tests
 */
export async function teardownTestApp(): Promise<void> {
  await closeDatabase();
}
