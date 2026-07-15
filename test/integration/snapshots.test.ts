import { beforeAll, afterAll, describe, it, expect } from '@jest/globals';
import { clearDatabase, createTestUser } from '../utils/test-utils.js';
import { createTestClient } from '../utils/test-client.js';
import { TabiumSnapshot } from '../../src/types/snapshot.types.js';

const INSTANCE_ID = '123e4567-e89b-12d3-a456-426614174000';
const WINDOW_ID = '123e4567-e89b-12d3-a456-426614174001';
const TAB_ID = '123e4567-e89b-12d3-a456-426614174002';

// 64-character hex strings to satisfy the SHA-256 hash schema
const hashFor = (version: number): string =>
  `${version.toString().padStart(2, '0')}${'a'.repeat(62)}`;

const makeSnapshot = (version: number): TabiumSnapshot => ({
  version: '1.0.0',
  instanceId: INSTANCE_ID,
  capturedAt: 1700000000000 + version,
  windows: [
    {
      windowId: WINDOW_ID,
      state: 'normal',
      focused: true,
      tabs: [
        {
          tabId: TAB_ID,
          url: `https://example.com/page-${version}`,
          title: `Page ${version}`,
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
});

describe('Snapshot Sync API', () => {
  const testUser = {
    email: 'snapshot-test@example.com',
    name: 'Snapshot Test User',
    token: 'snapshot-token',
    browserName: 'test-browser',
  };

  type TestClient = ReturnType<typeof createTestClient>;
  let client: TestClient;
  let userId: number;

  beforeAll(async () => {
    userId = await createTestUser(testUser);
    client = createTestClient(userId, testUser.email, testUser.browserName);
  });

  afterAll(async () => {
    await clearDatabase();
  });

  describe('POST /api/v1/sync/snapshot', () => {
    it('should upload a new snapshot and assign version 1', async () => {
      const response = await client
        .post('/api/v1/sync/snapshot')
        .set('X-Instance-ID', INSTANCE_ID)
        .send({
          instanceId: INSTANCE_ID,
          snapshotData: makeSnapshot(1),
          snapshotHash: hashFor(1),
        });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.versionNumber).toBe(1);
      expect(response.body.isDuplicate).toBe(false);
    });

    it('should detect duplicate snapshots by hash', async () => {
      const response = await client
        .post('/api/v1/sync/snapshot')
        .set('X-Instance-ID', INSTANCE_ID)
        .send({
          instanceId: INSTANCE_ID,
          snapshotData: makeSnapshot(1),
          snapshotHash: hashFor(1),
        });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.versionNumber).toBe(1);
      expect(response.body.isDuplicate).toBe(true);
    });

    it('should assign incrementing versions for new snapshots', async () => {
      const response = await client
        .post('/api/v1/sync/snapshot')
        .set('X-Instance-ID', INSTANCE_ID)
        .send({
          instanceId: INSTANCE_ID,
          snapshotData: makeSnapshot(2),
          snapshotHash: hashFor(2),
        });

      expect(response.status).toBe(200);
      expect(response.body.versionNumber).toBe(2);
      expect(response.body.isDuplicate).toBe(false);
    });

    it('should reject mismatched instance IDs', async () => {
      const response = await client
        .post('/api/v1/sync/snapshot')
        .set('X-Instance-ID', '123e4567-e89b-12d3-a456-426614174999')
        .send({
          instanceId: INSTANCE_ID,
          snapshotData: makeSnapshot(3),
          snapshotHash: hashFor(3),
        });

      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
    });
  });

  describe('GET /api/v1/sync/snapshot/:instanceId/latest', () => {
    it('should retrieve the latest snapshot', async () => {
      const response = await client
        .get(`/api/v1/sync/snapshot/${INSTANCE_ID}/latest`)
        .set('X-Instance-ID', INSTANCE_ID);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.versionNumber).toBe(2);
      expect(response.body.snapshotData).toHaveProperty('windows');
      expect(response.body.createdAt).toBeDefined();
    });
  });

  describe('GET /api/v1/sync/snapshot/:instanceId/timeline', () => {
    it('should return a normalized timeline', async () => {
      const response = await client
        .get(`/api/v1/sync/snapshot/${INSTANCE_ID}/timeline`)
        .set('X-Instance-ID', INSTANCE_ID);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.snapshots).toHaveLength(2);
      expect(typeof response.body.snapshots[0].createdAt).toBe('string');
      expect(response.body.snapshots[0].metadata).toEqual({
        totalTabs: 1,
        totalWindows: 1,
        totalGroups: 0,
      });
    });
  });
});
