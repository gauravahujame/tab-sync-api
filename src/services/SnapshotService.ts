/**
 * SnapshotService - Snapshot storage and retrieval
 *
 * Responsibilities:
 * - Ingest snapshots from clients
 * - Assign version numbers (race-condition safe)
 * - Hash-based deduplication
 * - Retention policy enforcement
 * - Timeline queries
 */

import { IDatabaseAdapter } from '../db/IDatabaseAdapter.js';
import {
  RETENTION_POLICY,
  SnapshotIngestResult,
  SnapshotRow,
  SnapshotTimelineItem,
  TabiumSnapshot,
} from '../types/snapshot.types.js';
import logger from '../utils/logger.js';

export class SnapshotService {
  constructor(private db: IDatabaseAdapter) {}

  /**
   * Ingest a snapshot from client
   * Assigns version number atomically, handles deduplication
   */
  async ingestSnapshot(
    userId: number,
    instanceId: string,
    snapshotData: TabiumSnapshot,
    snapshotHash: string,
  ): Promise<SnapshotIngestResult> {
    logger.info('[SNAPSHOT:INGEST] Processing snapshot', {
      userId,
      instanceId: instanceId.substring(0, 8),
      hash: snapshotHash.substring(0, 8),
    });

    const MAX_RETRIES = 3;

    const doIngest = async (): Promise<SnapshotIngestResult> => {
      // Check for duplicate using hash inside the transaction for consistency
      const existing = await this.db.get<SnapshotRow>(
        `SELECT id, version_number FROM snapshots
         WHERE user_id = $1 AND instance_id = $2 AND snapshot_hash = $3
         ORDER BY version_number DESC LIMIT 1`,
        [userId, instanceId, snapshotHash],
      );

      if (existing) {
        logger.info('[SNAPSHOT:DEDUP] Duplicate snapshot detected', {
          versionNumber: existing.version_number,
        });
        return {
          versionNumber: existing.version_number,
          isDuplicate: true,
          sizeBytes: 0,
        };
      }

      // Calculate size
      const snapshotJson = JSON.stringify(snapshotData);
      const sizeBytes = Buffer.byteLength(snapshotJson, 'utf8');

      // Insert with atomic version number assignment.
      // The single INSERT...SELECT statement is atomic; concurrent transactions
      // can still collide on the unique (user_id, instance_id, version_number)
      // constraint, so the caller retries on unique-constraint violations.
      // snapshot_data is stringified so it is stored correctly as TEXT in SQLite
      // and as JSONB in PostgreSQL.
      const result = await this.db.get<{ version_number: number }>(
        `INSERT INTO snapshots (user_id, instance_id, version_number, snapshot_data, snapshot_hash, size_bytes)
         SELECT $1, $2, COALESCE(MAX(version_number), 0) + 1, $3, $4, $5
         FROM snapshots
         WHERE user_id = $1 AND instance_id = $2
         RETURNING version_number`,
        [userId, instanceId, snapshotJson, snapshotHash, sizeBytes],
      );

      const versionNumber = result?.version_number ?? 1;

      return {
        versionNumber,
        isDuplicate: false,
        sizeBytes,
      };
    };

    try {
      let lastError: Error | undefined;

      for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
        try {
          const result = await this.db.transaction(doIngest);

          logger.info('[SNAPSHOT:INGEST] Snapshot stored', {
            versionNumber: result.versionNumber,
            sizeBytes: result.sizeBytes,
            tabCount: snapshotData.metadata?.totalTabs,
          });

          return result;
        } catch (error) {
          lastError = error as Error;
          const message = lastError.message?.toLowerCase() || '';
          const isUniqueViolation =
            message.includes('unique constraint') ||
            message.includes('uniqueconstraint') ||
            message.includes('sqlstate 23505') ||
            message.includes('sqlite_constraint_unique');

          if (!isUniqueViolation || attempt === MAX_RETRIES) {
            throw error;
          }

          logger.warn('[SNAPSHOT:INGEST] Version collision, retrying', {
            attempt,
            userId,
            instanceId: instanceId.substring(0, 8),
          });
        }
      }

      throw lastError || new Error('Failed to ingest snapshot after retries');
    } catch (error) {
      logger.error('[SNAPSHOT:INGEST] Failed to ingest snapshot', {
        error: (error as Error).message,
        userId,
        instanceId: instanceId.substring(0, 8),
      });
      throw error;
    }
  }

  /**
   * Parse a snapshot_data value that may be a JSON string (SQLite) or already an object (PostgreSQL)
   */
  private parseSnapshotData(raw: unknown): TabiumSnapshot {
    if (raw === null || raw === undefined) {
      throw new Error('Snapshot data is null or undefined');
    }
    if (typeof raw === 'string') {
      return JSON.parse(raw) as TabiumSnapshot;
    }
    return raw as TabiumSnapshot;
  }

  /**
   * Parse a date value that may be a Date, string, or number
   */
  private parseDate(raw: unknown): Date {
    if (raw instanceof Date) {
      return raw;
    }
    if (typeof raw === 'number') {
      return new Date(raw);
    }
    return new Date(raw as string | number);
  }

  /**
   * Get the latest snapshot for an instance
   */
  async getLatestSnapshot(userId: number, instanceId: string): Promise<SnapshotRow | null> {
    try {
      const snapshot = await this.db.get<SnapshotRow>(
        `SELECT * FROM snapshots
         WHERE user_id = $1 AND instance_id = $2
         ORDER BY version_number DESC LIMIT 1`,
        [userId, instanceId],
      );

      if (!snapshot) return null;

      return {
        ...snapshot,
        snapshot_data: this.parseSnapshotData(snapshot.snapshot_data),
        created_at: this.parseDate(snapshot.created_at),
      };
    } catch (error) {
      logger.error('[SNAPSHOT:GET] Failed to get latest snapshot', {
        error: (error as Error).message,
        userId,
        instanceId: instanceId.substring(0, 8),
      });
      throw error;
    }
  }

  /**
   * Get snapshot at a specific version
   */
  async getSnapshotAtVersion(
    userId: number,
    instanceId: string,
    versionNumber: number,
  ): Promise<SnapshotRow | null> {
    try {
      const snapshot = await this.db.get<SnapshotRow>(
        `SELECT * FROM snapshots
         WHERE user_id = $1 AND instance_id = $2 AND version_number = $3`,
        [userId, instanceId, versionNumber],
      );

      if (!snapshot) return null;

      return {
        ...snapshot,
        snapshot_data: this.parseSnapshotData(snapshot.snapshot_data),
        created_at: this.parseDate(snapshot.created_at),
      };
    } catch (error) {
      logger.error('[SNAPSHOT:GET] Failed to get snapshot at version', {
        error: (error as Error).message,
        userId,
        instanceId: instanceId.substring(0, 8),
        versionNumber,
      });
      throw error;
    }
  }

  /**
   * Get snapshot timeline for UI display
   */
  async getSnapshotTimeline(
    userId: number,
    instanceId: string,
    limit: number = 100,
  ): Promise<SnapshotTimelineItem[]> {
    try {
      const snapshots = await this.db.all<SnapshotRow>(
        `SELECT id, version_number, created_at, snapshot_data
         FROM snapshots
         WHERE user_id = $1 AND instance_id = $2
         ORDER BY version_number DESC
         LIMIT $3`,
        [userId, instanceId, limit],
      );

      return snapshots.map(s => ({
        versionNumber: s.version_number,
        createdAt: this.parseDate(s.created_at).toISOString(),
        metadata: {
          totalTabs: this.parseSnapshotData(s.snapshot_data).metadata?.totalTabs || 0,
          totalWindows: this.parseSnapshotData(s.snapshot_data).metadata?.totalWindows || 0,
          totalGroups: this.parseSnapshotData(s.snapshot_data).metadata?.totalGroups || 0,
        },
      }));
    } catch (error) {
      logger.error('[SNAPSHOT:TIMELINE] Failed to get timeline', {
        error: (error as Error).message,
        userId,
        instanceId: instanceId.substring(0, 8),
      });
      throw error;
    }
  }

  /**
   * Prune old snapshots according to retention policy
   * Retention: 48h all, 7d hourly, 30d daily, 90d weekly, beyond monthly
   */
  async pruneOldSnapshots(userId: number, instanceId: string): Promise<number> {
    const now = Date.now();

    logger.info('[SNAPSHOT:PRUNE] Starting pruning', {
      userId,
      instanceId: instanceId.substring(0, 8),
    });

    try {
      const allSnapshots = await this.db.all<SnapshotRow>(
        `SELECT id, version_number, created_at FROM snapshots
         WHERE user_id = $1 AND instance_id = $2
         ORDER BY version_number DESC`,
        [userId, instanceId],
      );

      if (allSnapshots.length === 0) {
        return 0;
      }

      const toKeep = new Set<number>();

      // Keep all from last 48 hours
      allSnapshots
        .filter(s => now - new Date(s.created_at).getTime() < RETENTION_POLICY.HOURS_48)
        .forEach(s => toKeep.add(s.id));

      // Keep hourly for last 7 days
      const hourlyBuckets = this.bucketByInterval(
        allSnapshots.filter(
          s =>
            now - new Date(s.created_at).getTime() < RETENTION_POLICY.DAYS_7 &&
            now - new Date(s.created_at).getTime() >= RETENTION_POLICY.HOURS_48,
        ),
        60 * 60 * 1000, // 1 hour
      );
      hourlyBuckets.forEach(bucket => toKeep.add(bucket[0].id));

      // Keep daily for last 30 days
      const dailyBuckets = this.bucketByInterval(
        allSnapshots.filter(
          s =>
            now - new Date(s.created_at).getTime() < RETENTION_POLICY.DAYS_30 &&
            now - new Date(s.created_at).getTime() >= RETENTION_POLICY.DAYS_7,
        ),
        24 * 60 * 60 * 1000, // 1 day
      );
      dailyBuckets.forEach(bucket => toKeep.add(bucket[0].id));

      // Keep weekly for last 90 days
      const weeklyBuckets = this.bucketByInterval(
        allSnapshots.filter(
          s =>
            now - new Date(s.created_at).getTime() < RETENTION_POLICY.DAYS_90 &&
            now - new Date(s.created_at).getTime() >= RETENTION_POLICY.DAYS_30,
        ),
        7 * 24 * 60 * 60 * 1000, // 1 week
      );
      weeklyBuckets.forEach(bucket => toKeep.add(bucket[0].id));

      // Keep monthly beyond 90 days
      const monthlyBuckets = this.bucketByInterval(
        allSnapshots.filter(
          s => now - new Date(s.created_at).getTime() >= RETENTION_POLICY.DAYS_90,
        ),
        30 * 24 * 60 * 60 * 1000, // ~1 month
      );
      monthlyBuckets.forEach(bucket => toKeep.add(bucket[0].id));

      // Delete snapshots not in toKeep set
      const toDelete = allSnapshots.filter(s => !toKeep.has(s.id));

      if (toDelete.length > 0) {
        const deleteIds = toDelete.map(s => s.id);

        if (this.db.getDialect() === 'postgres') {
          await this.db.run(`DELETE FROM snapshots WHERE id = ANY($1)`, [deleteIds]);
        } else {
          // SQLite approach
          const placeholders = deleteIds.map(() => '?').join(',');
          await this.db.run(`DELETE FROM snapshots WHERE id IN (${placeholders})`, deleteIds);
        }
      }

      logger.info('[SNAPSHOT:PRUNE] Pruning complete', {
        kept: toKeep.size,
        deleted: toDelete.length,
      });

      return toDelete.length;
    } catch (error) {
      logger.error('[SNAPSHOT:PRUNE] Failed to prune snapshots', {
        error: (error as Error).message,
        userId,
        instanceId: instanceId.substring(0, 8),
      });
      throw error;
    }
  }

  /**
   * Group snapshots into time buckets
   */
  private bucketByInterval(snapshots: SnapshotRow[], intervalMs: number): SnapshotRow[][] {
    const buckets = new Map<number, SnapshotRow[]>();

    snapshots.forEach(s => {
      const bucketKey = Math.floor(this.parseDate(s.created_at).getTime() / intervalMs);
      if (!buckets.has(bucketKey)) {
        buckets.set(bucketKey, []);
      }
      buckets.get(bucketKey)!.push(s);
    });

    return Array.from(buckets.values());
  }

  /**
   * Get statistics for an instance
   */
  async getStats(
    userId: number,
    instanceId: string,
  ): Promise<{
    totalSnapshots: number;
    latestVersion: number | null;
    totalSizeBytes: number;
    oldestSnapshot: Date | null;
    newestSnapshot: Date | null;
  }> {
    try {
      const stats = await this.db.get<{
        total: number;
        latest_version: number | null;
        total_size: number;
        oldest: Date | null;
        newest: Date | null;
      }>(
        `SELECT
           COUNT(*) as total,
           MAX(version_number) as latest_version,
           COALESCE(SUM(size_bytes), 0) as total_size,
           MIN(created_at) as oldest,
           MAX(created_at) as newest
         FROM snapshots
         WHERE user_id = $1 AND instance_id = $2`,
        [userId, instanceId],
      );

      return {
        totalSnapshots: stats?.total || 0,
        latestVersion: stats?.latest_version || null,
        totalSizeBytes: stats?.total_size || 0,
        oldestSnapshot: stats?.oldest || null,
        newestSnapshot: stats?.newest || null,
      };
    } catch (error) {
      logger.error('[SNAPSHOT:STATS] Failed to get stats', {
        error: (error as Error).message,
        userId,
        instanceId: instanceId.substring(0, 8),
      });
      throw error;
    }
  }
}
