import { beforeAll, afterAll, beforeEach, describe, it, expect } from '@jest/globals';
import { clearDatabase } from '../utils/test-utils.js';
import { db } from '../../src/db.js';
import { SnapshotService } from '../../src/services/SnapshotService.js';
import { IDatabaseAdapter } from '../../src/db/IDatabaseAdapter.js';
import { TabiumSnapshot } from '../../src/types/snapshot.types.js';

// Mock snapshot data
const mockSnapshot: TabiumSnapshot = {
  version: '1.0.0',
  instanceId: 'test-instance-id',
  capturedAt: Date.now(),
  windows: [
    {
      windowId: 'window-1',
      state: 'normal',
      focused: true,
      tabs: [
        {
          tabId: 'tab-1',
          url: 'https://example.com',
          title: 'Example',
          pinned: false,
          index: 0,
          suspended: false,
        },
      ],
    },
  ],
  groups: [],
  metadata: {
    totalTabs: 1,
    totalWindows: 1,
    totalGroups: 0,
    deviceInfo: {
      platform: 'test',
      chromeVersion: '1.0.0',
    },
  },
};

describe('SnapshotService', () => {
  let service: SnapshotService;
  // We need to cast db to IDatabaseAdapter because in tests it might be the raw sqlite instance
  // depending on how the test setup mocks it.
  // In `src/db.ts`, `getDb()` returns `IDatabaseAdapter`.
  // Let's rely on the fact that `db` imported from `../../src/db.js` is what we use in `db.test.ts`.
  // However, SnapshotService expects IDatabaseAdapter.
  // In `src/db.ts`, `export const db` exports the raw db for SQLiteAdapter.
  // `getDb()` returns the adapter.
  // We should import `getDb` instead of `db` to pass to SnapshotService if possible,
  // or construct an adapter.
  // But wait, `src/db.ts` does: `export const db = dbAdapter instanceof SQLiteAdapter ? dbAdapter.getRawDatabase() : dbAdapter;`
  // So `db` is likely the raw sqlite3 object in test env (sqlite).
  // `SnapshotService` expects `IDatabaseAdapter`.
  // So we need `getDb()`.
});
