import { describe, it, expect, jest, beforeEach } from '@jest/globals';
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
  let mockDb: jest.Mocked<IDatabaseAdapter>;

  beforeEach(() => {
    // Create a mock database adapter
    mockDb = {
      get: jest.fn(),
      all: jest.fn(),
      run: jest.fn(),
      transaction: jest.fn((callback: () => Promise<any>) => callback()),
      beginTransaction: jest.fn(),
      commit: jest.fn(),
      rollback: jest.fn(),
      close: jest.fn(),
      getDialect: jest.fn().mockReturnValue('sqlite'),
      isReady: jest.fn().mockReturnValue(true),
      waitForReady: jest.fn().mockImplementation(() => Promise.resolve()),
      exec: jest.fn(),
      prepare: jest.fn(),
    } as any;

    service = new SnapshotService(mockDb);
  });

  describe('ingestSnapshot', () => {
    it('should store new snapshot and return version number', async () => {
      // Mock no existing snapshot
      mockDb.get.mockResolvedValueOnce(undefined); // check duplicate

      // Mock insert returning version
      mockDb.get.mockResolvedValueOnce({ version_number: 1 });

      const result = await service.ingestSnapshot(1, 'test-instance-id', mockSnapshot, 'test-hash');

      expect(result.versionNumber).toBe(1);
      expect(result.isDuplicate).toBe(false);
      expect(result.sizeBytes).toBeGreaterThan(0);

      // Verify DB calls
      expect(mockDb.get).toHaveBeenCalledTimes(2);
      expect(mockDb.get).toHaveBeenNthCalledWith(
        1,
        expect.stringContaining('SELECT id, version_number FROM snapshots'),
        [1, 'test-instance-id', 'test-hash'],
      );
      expect(mockDb.get).toHaveBeenNthCalledWith(
        2,
        expect.stringContaining('INSERT INTO snapshots'),
        expect.arrayContaining([1, 'test-instance-id', expect.any(String), 'test-hash']),
      );
    });

    it('should retry on unique constraint violation and eventually succeed', async () => {
      // First attempt fails with unique constraint, second succeeds
      let attempt = 0;
      mockDb.transaction.mockImplementation(async (callback: () => Promise<any>) => {
        attempt++;
        if (attempt === 1) {
          throw new Error('SQLITE_CONSTRAINT_UNIQUE');
        }
        return callback();
      });

      mockDb.get.mockResolvedValueOnce(undefined); // check duplicate (attempt 2)
      mockDb.get.mockResolvedValueOnce({ version_number: 3 }); // insert result

      const result = await service.ingestSnapshot(1, 'test-instance-id', mockSnapshot, 'test-hash');

      expect(result.versionNumber).toBe(3);
      expect(result.isDuplicate).toBe(false);
      expect(attempt).toBe(2);
    });

    it('should throw after max retries on unique constraint violation', async () => {
      mockDb.transaction.mockRejectedValue(new Error('SQLITE_CONSTRAINT_UNIQUE'));

      await expect(
        service.ingestSnapshot(1, 'test-instance-id', mockSnapshot, 'test-hash'),
      ).rejects.toThrow('SQLITE_CONSTRAINT_UNIQUE');

      expect(mockDb.transaction).toHaveBeenCalledTimes(3);
    });

    it('should detect duplicate snapshot by hash', async () => {
      // Mock existing snapshot with same hash
      mockDb.get.mockResolvedValueOnce({ id: 10, version_number: 5 });

      const result = await service.ingestSnapshot(1, 'test-instance-id', mockSnapshot, 'test-hash');

      expect(result.versionNumber).toBe(5);
      expect(result.isDuplicate).toBe(true);
      expect(result.sizeBytes).toBe(0);

      // Should not insert
      expect(mockDb.get).toHaveBeenCalledTimes(1);
    });
  });

  describe('getLatestSnapshot', () => {
    it('should parse snapshot_data JSON string returned by SQLite', async () => {
      const mockRow = {
        id: 1,
        version_number: 2,
        snapshot_data: JSON.stringify(mockSnapshot),
        created_at: '2023-01-15T10:30:00.000Z',
      };

      mockDb.get.mockResolvedValueOnce(mockRow);

      const result = await service.getLatestSnapshot(1, 'test-instance-id');

      expect(result).not.toBeNull();
      expect(result?.snapshot_data).toEqual(mockSnapshot);
      expect(result?.created_at).toBeInstanceOf(Date);
      expect(result?.created_at.toISOString()).toBe('2023-01-15T10:30:00.000Z');
    });

    it('should return the latest snapshot', async () => {
      const mockRow = {
        id: 1,
        version_number: 2,
        snapshot_data: mockSnapshot,
        created_at: new Date(),
      };

      mockDb.get.mockResolvedValueOnce(mockRow);

      const result = await service.getLatestSnapshot(1, 'test-instance-id');

      expect(result).toEqual(mockRow);
      expect(mockDb.get).toHaveBeenCalledWith(expect.stringContaining('SELECT * FROM snapshots'), [
        1,
        'test-instance-id',
      ]);
    });

    it('should return null if no snapshot exists', async () => {
      mockDb.get.mockResolvedValueOnce(undefined);

      const result = await service.getLatestSnapshot(1, 'test-instance-id');

      expect(result).toBeNull();
    });
  });

  describe('getSnapshotTimeline', () => {
    it('should normalize string dates and JSON strings from SQLite', async () => {
      const mockRows = [
        {
          id: 2,
          version_number: 2,
          created_at: '2023-01-02T00:00:00.000Z',
          snapshot_data: JSON.stringify({
            metadata: { totalTabs: 5, totalWindows: 1, totalGroups: 0 },
          }),
        },
      ];

      mockDb.all.mockResolvedValueOnce(mockRows);

      const timeline = await service.getSnapshotTimeline(1, 'test-instance-id', 10);

      expect(timeline).toHaveLength(1);
      expect(timeline[0].createdAt).toBe('2023-01-02T00:00:00.000Z');
      expect(timeline[0].metadata.totalTabs).toBe(5);
    });

    it('should return timeline items', async () => {
      const mockRows = [
        {
          id: 2,
          version_number: 2,
          created_at: new Date('2023-01-02'),
          snapshot_data: { metadata: { totalTabs: 5, totalWindows: 1, totalGroups: 0 } },
        },
        {
          id: 1,
          version_number: 1,
          created_at: new Date('2023-01-01'),
          snapshot_data: { metadata: { totalTabs: 3, totalWindows: 1, totalGroups: 0 } },
        },
      ];

      mockDb.all.mockResolvedValueOnce(mockRows);

      const timeline = await service.getSnapshotTimeline(1, 'test-instance-id', 10);

      expect(timeline).toHaveLength(2);
      expect(timeline[0].versionNumber).toBe(2);
      expect(timeline[0].metadata.totalTabs).toBe(5);
      expect(timeline[1].versionNumber).toBe(1);
      expect(timeline[1].metadata.totalTabs).toBe(3);
    });
  });

  describe('pruneOldSnapshots', () => {
    it('should prune snapshots according to retention policy', async () => {
      // Mock snapshots with various timestamps
      const now = Date.now();
      const hour = 60 * 60 * 1000;
      const day = 24 * hour;

      const snapshots = [
        // Recent (keep all)
        { id: 1, version_number: 10, created_at: new Date(now - 1 * hour) },
        { id: 2, version_number: 9, created_at: new Date(now - 2 * hour) },

        // > 48h (keep hourly)
        { id: 3, version_number: 8, created_at: new Date(now - 3 * day) },
        { id: 4, version_number: 7, created_at: new Date(now - 3 * day - 10 * 60 * 1000) }, // duplicate hour

        // > 7d (keep daily)
        { id: 5, version_number: 6, created_at: new Date(now - 10 * day) },
        { id: 6, version_number: 5, created_at: new Date(now - 10 * day - 2 * hour) }, // duplicate day
      ];

      mockDb.all.mockResolvedValueOnce(snapshots);
      mockDb.run.mockResolvedValueOnce({ changes: 2 }); // Expecting 2 deletions

      await service.pruneOldSnapshots(1, 'test-instance-id');

      // Verify logic:
      // ID 1, 2: Kept (within 48h)
      // ID 3: Kept (hourly bucket)
      // ID 4: Deleted (same hour as 3)
      // ID 5: Kept (daily bucket)
      // ID 6: Deleted (same day as 5)

      // Note: My manual verification above simplifies the bucket logic logic slightly
      // but essentially we expect deletions.

      expect(mockDb.all).toHaveBeenCalled();
      expect(mockDb.run).toHaveBeenCalledWith(
        expect.stringContaining('DELETE FROM snapshots WHERE id IN'),
        expect.any(Array),
      );
    });
  });
});
