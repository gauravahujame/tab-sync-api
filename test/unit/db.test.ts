import { beforeAll, afterAll, describe, it, expect } from '@jest/globals';
import { clearDatabase, runAsync, getAsync, allAsync } from '../utils/test-utils.js';

describe('Database Module', () => {
  beforeAll(async () => {
    // Ensure the database is clean before tests
    await clearDatabase();
  });

  afterAll(async () => {
    // Clean up after all tests
    await clearDatabase();
  });

  describe('Table Creation', () => {
    it('should create users table with correct schema', async () => {
      const tableInfo = await getAsync<{ sql: string }>(
        "SELECT sql FROM sqlite_master WHERE type='table' AND name='users'",
      );

      expect(tableInfo).toBeDefined();
      expect(tableInfo?.sql).toContain('CREATE TABLE users');
      expect(tableInfo?.sql).toContain('id INTEGER PRIMARY KEY AUTOINCREMENT');
      expect(tableInfo?.sql).toContain('email TEXT UNIQUE NOT NULL');
      expect(tableInfo?.sql).toContain('token TEXT');
    });

    it('should create tabs table with correct schema', async () => {
      const tableInfo = await getAsync<{ sql: string }>(
        "SELECT sql FROM sqlite_master WHERE type='table' AND name='tabs'",
      );

      expect(tableInfo).toBeDefined();
      expect(tableInfo?.sql).toContain('CREATE TABLE tabs');
      expect(tableInfo?.sql).toContain('id INTEGER PRIMARY KEY AUTOINCREMENT');
      expect(tableInfo?.sql).toContain('url TEXT NOT NULL');
      expect(tableInfo?.sql).toContain('user_id INTEGER');
      expect(tableInfo?.sql).toContain('FOREIGN KEY(user_id) REFERENCES users(id)');
    });

    it('should create indexes for better query performance', async () => {
      const indexes = await allAsync("SELECT name FROM sqlite_master WHERE type='index'");

      const indexNames = indexes.map((i: any) => i.name);

      expect(indexNames).toContain('idx_users_email');
      expect(indexNames).toContain('idx_tabs_user_id');
    });
  });

  describe('Foreign Key Constraints', () => {
    it('should enforce foreign key constraints', async () => {
      // This should fail because there's no user with ID 999
      await expect(
        runAsync('INSERT INTO tabs (url, window_id, user_id) VALUES (?, ?, ?)', [
          'https://test.com',
          1,
          999,
        ]),
      ).rejects.toBeDefined();

      // This should work after creating a user
      await runAsync('INSERT INTO users (email, name, token) VALUES (?, ?, ?)', [
        'test@example.com',
        'Test User',
        'test-token',
      ]);

      const user = await getAsync<{ id: number }>('SELECT id FROM users WHERE email = ?', [
        'test@example.com',
      ]);
      if (!user) throw new Error('User not found');

      const result = await runAsync('INSERT INTO tabs (url, window_id, user_id) VALUES (?, ?, ?)', [
        'https://test.com',
        1,
        user.id,
      ]);
      expect(result).toBeDefined();
    });
  });

  describe('Unique Constraints', () => {
    it('should enforce unique email constraint for users', async () => {
      await runAsync('INSERT INTO users (email, name, token) VALUES (?, ?, ?)', [
        'unique@example.com',
        'Unique User',
        'unique-token',
      ]);

      // Try to insert a user with the same email
      await expect(
        runAsync('INSERT INTO users (email, name, token) VALUES (?, ?, ?)', [
          'unique@example.com',
          'Duplicate User',
          'another-token',
        ]),
      ).rejects.toBeDefined();
    });

    it('should enforce unique constraint for tabs', async () => {
      const user = await getAsync<{ id: number }>('SELECT id FROM users WHERE email = ?', [
        'unique@example.com',
      ]);
      if (!user) throw new Error('User not found');

      // First insert should work
      const result = await runAsync(
        `INSERT INTO tabs
         (url, window_id, client_tab_id, user_id, browser_name)
         VALUES (?, ?, ?, ?, ?)`,
        ['https://unique-tab.com', 1, 1001, user.id, 'test-browser'],
      );
      expect(result).toBeDefined();

      // Duplicate insert should fail
      await expect(
        runAsync(
          `INSERT INTO tabs
           (url, window_id, client_tab_id, user_id, browser_name)
           VALUES (?, ?, ?, ?, ?)`,
          ['https://unique-tab.com', 1, 1001, user.id, 'test-browser'],
        ),
      ).rejects.toBeDefined();

      // Different client_tab_id should work
      const result2 = await runAsync(
        `INSERT INTO tabs
         (url, window_id, client_tab_id, user_id, browser_name)
         VALUES (?, ?, ?, ?, ?)`,
        ['https://unique-tab.com', 1, 1002, user.id, 'test-browser'],
      );
      expect(result2).toBeDefined();
    });
  });
});
