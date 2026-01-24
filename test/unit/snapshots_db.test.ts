import { beforeAll, afterAll, describe, it, expect } from '@jest/globals';
import { clearDatabase } from '../utils/test-utils.js';
import { db } from '../../src/db.js';
import { promisify } from 'util';

const runAsync = promisify(db.run.bind(db));
const getAsync = promisify(db.get.bind(db));

describe('Snapshot Tables', () => {
  beforeAll(async () => {
    // Ensure the database is clean before tests
    await clearDatabase();
  });

  afterAll(async () => {
    // Clean up after all tests
    await clearDatabase();
  });

  describe('Table Creation', () => {
    it('should create snapshots table with correct schema', async () => {
      const tableInfo = await getAsync(
        "SELECT sql FROM sqlite_master WHERE type='table' AND name='snapshots'",
      );

      expect(tableInfo).toBeDefined();
      expect(tableInfo.sql).toContain('CREATE TABLE snapshots');
      expect(tableInfo.sql).toContain('id INTEGER PRIMARY KEY AUTOINCREMENT');
      expect(tableInfo.sql).toContain('version_number INTEGER');
      expect(tableInfo.sql).toContain('snapshot_data TEXT');
      expect(tableInfo.sql).toContain('snapshot_hash TEXT');
      expect(tableInfo.sql).toContain('FOREIGN KEY(user_id) REFERENCES users(id)');
    });

    it('should create migration_checkpoints table with correct schema', async () => {
      const tableInfo = await getAsync(
        "SELECT sql FROM sqlite_master WHERE type='table' AND name='migration_checkpoints'",
      );

      expect(tableInfo).toBeDefined();
      expect(tableInfo.sql).toContain('CREATE TABLE migration_checkpoints');
      expect(tableInfo.sql).toContain('id INTEGER PRIMARY KEY AUTOINCREMENT');
      expect(tableInfo.sql).toContain('events_processed INTEGER');
      expect(tableInfo.sql).toContain('intermediate_state TEXT');
      expect(tableInfo.sql).toContain('status TEXT');
    });

    it('should create indexes for snapshots table', async () => {
      const indexes = await getAsync(
        "SELECT name FROM sqlite_master WHERE type='index' AND tbl_name='snapshots'",
      );

      // Sqlite returns one index at a time with db.get, we might need db.all to check all
      // But db.get only returns one. Let's use a query that returns all indexes names.
      // Since `db` is the raw sqlite3 instance in test, and we wrapped it.
      // Wait, in db.test.ts, `db` is imported from `../../src/db.js`.
      // `db` in `src/db.js` exports the raw db for SQLite.

      // Let's rely on the previous test pattern.
      // Actually, let's just check one key index.
      // Or better, let's try to query for specific index names.

      // We can use pragma index_list
      // But let's stick to simple SQL checks if possible.

      const indexList = await new Promise<any[]>((resolve, reject) => {
        db.all('PRAGMA index_list(snapshots)', (err, rows) => {
          if (err) reject(err);
          else resolve(rows);
        });
      });

      const names = indexList.map(i => i.name);
      expect(names).toContain('idx_snapshots_user_instance');
      expect(names).toContain('idx_snapshots_hash');
    });
  });
});
