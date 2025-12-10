import { Database } from 'sqlite3';
import { promisify } from 'util';
import { EventFilters } from '../types/sync.types.js';
import logger from '../utils/logger.js';

export class EventService {
  private dbRun: (sql: string, ...params: any[]) => Promise<void>;
  private dbGet: (sql: string, ...params: any[]) => Promise<any>;
  private dbAll: (sql: string, ...params: any[]) => Promise<any[]>;

  constructor(db: Database) {
    this.dbRun = promisify(db.run.bind(db));
    this.dbGet = promisify(db.get.bind(db));
    this.dbAll = promisify(db.all.bind(db));
  }

  /**
   * Query events with filters
   */
  async queryEvents(userId: number, filters: EventFilters = {}): Promise<any> {
    const limit = Math.min(filters.limit || 100, 1000);
    const offset = filters.offset || 0;

    logger.debug('[EVENT:SERVICE] Querying events', {
      userId,
      filters,
    });

    try {
      let sql = 'SELECT * FROM events WHERE user_id = ?';
      const params: any[] = [userId];

      if (filters.instanceId) {
        sql += ' AND instance_id = ?';
        params.push(filters.instanceId);
      }

      if (filters.eventTypes && filters.eventTypes.length > 0) {
        sql += ` AND event_type IN (${filters.eventTypes.map(() => '?').join(',')})`;
        params.push(...filters.eventTypes);
      }

      if (filters.fromTimestamp) {
        sql += ' AND timestamp >= ?';
        params.push(filters.fromTimestamp);
      }

      if (filters.toTimestamp) {
        sql += ' AND timestamp <= ?';
        params.push(filters.toTimestamp);
      }

      sql += ' ORDER BY timestamp DESC LIMIT ? OFFSET ?';
      params.push(limit, offset);

      const events = await this.dbAll(sql, ...params);

      // Get total count
      let countSql = 'SELECT COUNT(*) as total FROM events WHERE user_id = ?';
      const countParams: any[] = [userId];

      if (filters.instanceId) {
        countSql += ' AND instance_id = ?';
        countParams.push(filters.instanceId);
      }

      const countResult = await this.dbGet(countSql, ...countParams);

      logger.debug('[EVENT:SERVICE] Query complete', {
        count: events.length,
        total: countResult.total,
      });

      return {
        total: countResult.total,
        count: events.length,
        offset,
        limit,
        events: events.map((e: any) => ({
          id: e.id,
          eventType: e.event_type,
          documentId: e.document_id,
          timestamp: e.timestamp,
          instanceId: e.instance_id,
          tabId: e.tab_id,
          windowId: e.window_id,
          url: e.url,
          title: e.title,
          navigationType: e.navigation_type,
          fromAddressBar: Boolean(e.from_address_bar),
          startTime: e.start_time,
          endTime: e.end_time,
          durationMs: e.duration_ms,
          wasActive: e.was_active !== null ? Boolean(e.was_active) : null,
          wasWindowFocused: e.was_window_focused !== null ? Boolean(e.was_window_focused) : null,
          userWasActive: e.user_was_active !== null ? Boolean(e.user_was_active) : null,
          tabCount: e.tab_count,
          windowCount: e.window_count,
          originalSessionId: e.original_session_id,
          newWindowId: e.new_window_id,
          syncedAt: e.synced_at,
          metadata: e.metadata ? JSON.parse(e.metadata) : null,
        })),
      };
    } catch (error) {
      logger.error('[EVENT:SERVICE] Query failed', {
        error: (error as Error).message,
        userId,
      });
      throw error;
    }
  }

  /**
   * Get event statistics
   */
  async getStats(userId: number, instanceId?: string): Promise<any> {
    logger.debug('[EVENT:SERVICE] Getting stats', { userId, instanceId });

    try {
      let sql = `
        SELECT
          COUNT(*) as total_events,
          COUNT(DISTINCT event_type) as unique_event_types,
          COUNT(DISTINCT DATE(datetime(timestamp / 1000, 'unixepoch'))) as active_days,
          MAX(timestamp) as last_event_timestamp,
          MIN(timestamp) as first_event_timestamp
        FROM events
        WHERE user_id = ?
      `;

      const params: any[] = [userId];

      if (instanceId) {
        sql += ' AND instance_id = ?';
        params.push(instanceId);
      }

      const stats = await this.dbGet(sql, ...params);

      // Get event counts by type
      let typeSql = `
        SELECT event_type, COUNT(*) as count
        FROM events
        WHERE user_id = ?
      `;

      const typeParams: any[] = [userId];

      if (instanceId) {
        typeSql += ' AND instance_id = ?';
        typeParams.push(instanceId);
      }

      typeSql += ' GROUP BY event_type';

      const eventsByType = await this.dbAll(typeSql, ...typeParams);

      return {
        totalEvents: stats.total_events,
        uniqueEventTypes: stats.unique_event_types,
        activeDays: stats.active_days,
        lastEventTimestamp: stats.last_event_timestamp,
        firstEventTimestamp: stats.first_event_timestamp,
        eventsByType: eventsByType.reduce((acc: any, row: any) => {
          acc[row.event_type] = row.count;
          return acc;
        }, {}),
      };
    } catch (error) {
      logger.error('[EVENT:SERVICE] Stats query failed', {
        error: (error as Error).message,
        userId,
      });
      throw error;
    }
  }

  /**
   * Delete old events (cleanup)
   */
  async deleteOldEvents(userId: number, olderThanTimestamp: number): Promise<number> {
    logger.info('[EVENT:SERVICE] Deleting old events', {
      userId,
      olderThan: new Date(olderThanTimestamp).toISOString(),
    });

    try {
      const result = await this.dbRun(
        'DELETE FROM events WHERE user_id = ? AND timestamp < ?',
        userId,
        olderThanTimestamp
      );

      logger.info('[EVENT:SERVICE] Old events deleted', {
        deletedCount: (result as any).changes || 0,
      });

      return (result as any).changes || 0;
    } catch (error) {
      logger.error('[EVENT:SERVICE] Failed to delete old events', {
        error: (error as Error).message,
      });
      throw error;
    }
  }
}
