import { beforeAll, afterAll, describe, it, expect } from '@jest/globals';
import { clearDatabase, runAsync, getAsync, allAsync } from '../utils/test-utils.js';

describe('Database Module', () => {
  beforeAll(async () => {
    // Ensure the database is clean before tests
    await clearDatabase();
  }, 30000);

  afterAll(async () => {
    // Clean up after all tests
    await clearDatabase();
  }, 30000);

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

    it('should create indexes for better query performance', async () => {
      const indexes = await allAsync("SELECT name FROM sqlite_master WHERE type='index'");

      const indexNames = indexes.map((i: any) => i.name);

      expect(indexNames).toContain('idx_users_email');
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

  });
});
