import { db } from "../../src/db.js";
import jwt from "jsonwebtoken";
import type { RunResult } from "sqlite3";

export const runAsync = (
  sql: string,
  params: unknown[] = [],
): Promise<{ lastID: number; changes: number }> =>
  new Promise((resolve, reject) => {
    db.run(sql, params, function (this: RunResult, err: Error | null) {
      if (err) {
        reject(err);
        return;
      }

      resolve({
        lastID: this?.lastID ?? 0,
        changes: this?.changes ?? 0,
      });
    });
  });

export const getAsync = <T = Record<string, unknown>>(
  sql: string,
  params: unknown[] = [],
): Promise<T | undefined> =>
  new Promise((resolve, reject) => {
    db.get(sql, params, (err: Error | null, row: unknown) => {
      if (err) {
        reject(err);
        return;
      }

      resolve(row as T | undefined);
    });
  });

export const allAsync = <T = Record<string, unknown>>(
  sql: string,
  params: unknown[] = [],
): Promise<T[]> =>
  new Promise((resolve, reject) => {
    db.all(sql, params, (err: Error | null, rows: unknown[]) => {
      if (err) {
        reject(err);
        return;
      }

      resolve(rows as T[]);
    });
  });

/**
 * Clears all data from the test database
 */
export const clearDatabase = async (): Promise<void> => {
  await runAsync("DELETE FROM tabs");
  await runAsync("DELETE FROM users");
  await runAsync("DELETE FROM sqlite_sequence"); // Reset autoincrement counters
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
  const existingUser = (await getAsync("SELECT id FROM users WHERE email = ?", [
    email,
  ])) as { id: number } | undefined;

  if (existingUser) {
    return existingUser.id;
  }

  // Create new user
  const result = await runAsync(
    "INSERT INTO users (email, name, token, browser_name) VALUES (?, ?, ?, ?)",
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
        tab.browser_name || "test-browser",
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
  return getAsync("SELECT * FROM users WHERE email = ?", [email]);
};

/**
 * Retrieves tabs for a user
 */
export const getUserTabs = async (userId: number) => {
  return allAsync("SELECT * FROM tabs WHERE user_id = ?", [userId]);
};

/**
 * Generates a JWT token for testing
 */
export const generateTestToken = (
  userId: number,
  email: string,
  browserName: string,
): string => {
  return jwt.sign(
    { userId, email, browserName },
    process.env.JWT_SECRET || "test-secret",
    {
      expiresIn: "1h",
    },
  );
};
