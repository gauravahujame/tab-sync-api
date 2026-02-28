import { getDb, schemaReady } from '../../src/db.js';
import jwt from 'jsonwebtoken';

export const waitForSchema = async () => {
  await schemaReady;
};

export const runAsync = async (
  sql: string,
  params: unknown[] = [],
): Promise<{ lastID: number; changes: number }> => {
  const db = getDb();
  const result = await db.run(sql, params as any[]);
  return {
    lastID: result.lastID ?? 0,
    changes: result.changes ?? 0,
  };
};

export const getAsync = async <T = Record<string, unknown>>(
  sql: string,
  params: unknown[] = [],
): Promise<T | undefined> => {
  const db = getDb();
  return db.get<T>(sql, params as any[]);
};

export const allAsync = async <T = Record<string, unknown>>(
  sql: string,
  params: unknown[] = [],
): Promise<T[]> => {
  const db = getDb();
  return db.all<T>(sql, params as any[]);
};

/**
 * Clears all data from the test database
 */
export const clearDatabase = async (): Promise<void> => {
  await waitForSchema();
  const db = getDb();
  const dialect = db.getDialect();

  const tables = [
    'session_tabs',
    'session_windows',
    'sessions',
    'session_restorations',
    'snapshots',
    'users',
    'tabs',
  ];

  for (const table of tables) {
    try {
      await runAsync(`DELETE FROM ${table}`);
    } catch {
      // Ignore missing tables
    }
  }

  // Reset autoincrement counters (SQLite-specific)
  if (dialect === 'sqlite') {
    try {
      await runAsync('DELETE FROM sqlite_sequence');
    } catch {
      // sqlite_sequence may not exist, ignore
    }
  }
};

/**
 * Creates a test user in the database
 */
export const createTestUser = async (userData: {
  email: string;
  name: string;
  token: string;
  browserName: string;
}): Promise<number> => {
  const { email, name, token, browserName } = userData;

  // Check if user already exists
  const existingUser = await getAsync<{ id: number }>('SELECT id FROM users WHERE email = ?', [
    email,
  ]);

  if (existingUser) {
    return existingUser.id;
  }

  // Create new user
  const result = await runAsync(
    'INSERT INTO users (email, name, token, browser_name) VALUES (?, ?, ?, ?)',
    [email, name, token, browserName],
  );

  return result.lastID;
};

/**
 * Creates test tabs in the database
 */
export const createTestTabs = async (
  userId: number,
  tabs: Array<{
    url: string;
    title?: string;
    windowId?: number;
    client_tab_id?: number;
    last_accessed?: number;
    incognito?: boolean;
    group_id?: number;
    browser_name?: string;
  }>,
): Promise<number[]> => {
  const insertedIds: number[] = [];

  for (const tab of tabs) {
    const result = await runAsync(
      `INSERT INTO tabs (
        url, title, window_id, client_tab_id, last_accessed,
        incognito, group_id, browser_name, user_id
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        tab.url,
        tab.title || null,
        tab.windowId || 1,
        tab.client_tab_id || null,
        tab.last_accessed || Date.now(),
        tab.incognito ? 1 : 0,
        tab.group_id || -1,
        tab.browser_name || 'test-browser',
        userId,
      ],
    );

    insertedIds.push(result.lastID);
  }

  return insertedIds;
};

/**
 * Retrieves a user by email
 */
export const getUserByEmail = async (email: string) => {
  return getAsync('SELECT * FROM users WHERE email = ?', [email]);
};

/**
 * Retrieves tabs for a user
 */
export const getUserTabs = async (userId: number) => {
  return allAsync('SELECT * FROM tabs WHERE user_id = ?', [userId]);
};

/**
 * Generates a JWT token for testing
 */
import { config } from '../../src/config.js';

export const generateTestToken = (userId: number, email: string, browserName: string): string => {
  return jwt.sign({ id: userId, email, browserName }, config.jwtSecret, {
    expiresIn: '1h',
  });
};
