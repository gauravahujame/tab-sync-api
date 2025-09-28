import { db } from "../../src/db.js";
import { promisify } from "util";
import jwt from "jsonwebtoken";

// Promisify database methods
const runAsync = promisify(db.run.bind(db));
const getAsync = promisify(db.get.bind(db));
const allAsync = promisify(db.all.bind(db));

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
}): Promise<number> => {
  const { email, name, token } = userData;

  // Check if user already exists
  const existingUser = await getAsync("SELECT id FROM users WHERE email = ?", [
    email,
  ]);

  if (existingUser) {
    return existingUser.id;
  }

  // Create new user
  const result = await runAsync(
    "INSERT INTO users (email, name, token) VALUES (?, ?, ?)",
    [email, name, token],
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
export const generateTestToken = (userId: number, email: string): string => {
  return jwt.sign({ userId, email }, process.env.JWT_SECRET || "test-secret", {
    expiresIn: "1h",
  });
};
