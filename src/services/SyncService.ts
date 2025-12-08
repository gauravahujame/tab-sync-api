/**
 * SyncService - Orchestrate stateless marker-based sync
 *
 * Responsibilities:
 * - Provide sync markers to extensions
 * - Process incoming events
 * - Deduplicate by documentId
 * - Update markers after successful sync
 * - Handle restoration metadata
 */

import { Database } from "sqlite3";
import { promisify } from "util";
import {
  Event,
  RestorationMetadata,
  SyncMarker,
  SyncMarkerRow,
  SyncResult,
} from "../types/sync.types.js";
import logger from "../utils/logger.js";

export class SyncService {
  private dbRun: (sql: string, ...params: any[]) => Promise<void>;
  private dbGet: (sql: string, ...params: any[]) => Promise<any>;
  private dbAll: (sql: string, ...params: any[]) => Promise<any[]>;

  constructor(private db: Database) {
    // Promisify database methods
    this.dbRun = promisify(db.run.bind(db));
    this.dbGet = promisify(db.get.bind(db));
    this.dbAll = promisify(db.all.bind(db));
  }

  /**
   * Get sync marker for an extension instance
   * Tells extension where to start syncing from
   */
  async getMarker(instanceId: string, userId: number): Promise<SyncMarker> {
    logger.info(`[SYNC:MARKER] Fetching marker`, {
      instanceId: instanceId.substring(0, 8),
      userId,
    });

    try {
      // Query marker from database
      const marker = (await this.dbGet(
        `SELECT * FROM sync_markers WHERE user_id = ? AND instance_id = ?`,
        userId,
        instanceId,
      )) as SyncMarkerRow | undefined;

      if (!marker) {
        // First sync for this instance
        logger.info(`[SYNC:MARKER] First sync for instance`, {
          instanceId: instanceId.substring(0, 8),
        });

        // Create initial marker
        await this.dbRun(
          `INSERT INTO sync_markers (user_id, instance_id, last_event_timestamp)
           VALUES (?, ?, 0)`,
          userId,
          instanceId,
        );

        // Count existing events to sync
        const countResult = (await this.dbGet(
          `SELECT COUNT(*) as count FROM events WHERE user_id = ? AND instance_id = ?`,
          userId,
          instanceId,
        )) as { count: number };

        return {
          instanceId,
          lastEventTimestamp: 0,
          firstSync: true,
          eventCountToSync: countResult?.count || 0,
        };
      }

      // Existing marker found
      const eventCountToSync = (await this.dbGet(
        `SELECT COUNT(*) as count FROM events
         WHERE user_id = ? AND instance_id = ? AND timestamp > ?`,
        userId,
        instanceId,
        marker.last_event_timestamp,
      )) as { count: number };

      logger.debug(`[SYNC:MARKER] Marker retrieved`, {
        lastEventTimestamp: marker.last_event_timestamp,
        eventCountToSync: eventCountToSync?.count || 0,
      });

      return {
        instanceId,
        lastEventTimestamp: marker.last_event_timestamp,
        lastSessionId: marker.last_session_id || undefined,
        firstSync: false,
        eventCountToSync: eventCountToSync?.count || 0,
      };
    } catch (error) {
      logger.error(`[SYNC:MARKER] Failed to fetch marker`, {
        error: (error as Error).message,
        instanceId: instanceId.substring(0, 8),
        userId,
      });
      throw error;
    }
  }

  /**
   * Process events received from extension
   * Validates, deduplicates, and stores events
   */
  async processEvents(
    instanceId: string,
    userId: number,
    events: Event[],
    restorationMetadata?: RestorationMetadata[],
  ): Promise<SyncResult> {
    const startTime = Date.now();

    logger.info(`[SYNC:EVENTS] Processing events`, {
      instanceId: instanceId.substring(0, 8),
      userId,
      eventCount: events.length,
      hasRestorations: !!restorationMetadata?.length,
    });

    let processed = 0;
    let duplicates = 0;
    let restorationMappings = 0;
    const errors: string[] = [];

    try {
      // Begin transaction for atomic processing
      await this.dbRun("BEGIN TRANSACTION");

      try {
        // Process each event
        for (const event of events) {
          try {
            // Check for duplicate by documentId
            if (event.documentId) {
              const exists = await this.dbGet(
                `SELECT id FROM events WHERE instance_id = ? AND document_id = ? LIMIT 1`,
                instanceId,
                event.documentId,
              );

              if (exists) {
                duplicates++;
                logger.debug(`[SYNC:DEDUP] Duplicate event`, {
                  documentId: event.documentId,
                  eventType: event.eventType,
                });
                continue;
              }
            }

            // Insert event
            await this.insertEvent(userId, instanceId, event);
            processed++;

            logger.debug(`[SYNC:INSERT] Event stored`, {
              eventType: event.eventType,
              timestamp: event.timestamp,
              documentId: event.documentId || "none",
            });
          } catch (error) {
            logger.error(`[SYNC:ERROR] Failed to process event`, {
              error: (error as Error).message,
              eventType: event.eventType,
            });
            errors.push((error as Error).message);
          }
        }

        // Handle restoration metadata
        if (restorationMetadata && restorationMetadata.length > 0) {
          restorationMappings = await this.handleRestorations(
            userId,
            instanceId,
            restorationMetadata,
          );
        }

        // Update marker with max timestamp from this batch
        if (events.length > 0) {
          const maxTimestamp = Math.max(...events.map((e) => e.timestamp));
          await this.updateMarker(userId, instanceId, maxTimestamp);

          logger.info(`[SYNC:MARKER] Marker updated`, {
            instanceId: instanceId.substring(0, 8),
            newTimestamp: maxTimestamp,
          });
        }

        // Commit transaction
        await this.dbRun("COMMIT");
      } catch (error) {
        // Rollback on error
        await this.dbRun("ROLLBACK");
        throw error;
      }

      const duration = Date.now() - startTime;
      logger.info(`[SYNC:EVENTS] Processing complete`, {
        instanceId: instanceId.substring(0, 8),
        eventsReceived: events.length,
        eventsProcessed: processed,
        duplicateCount: duplicates,
        restorationMappings,
        duration: `${duration}ms`,
        errors: errors.length,
      });

      return {
        instanceId,
        eventsReceived: events.length,
        eventsProcessed: processed,
        duplicateCount: duplicates,
        restorationMappings,
        message:
          errors.length > 0
            ? `Processed with ${errors.length} errors`
            : "Events synced successfully",
      };
    } catch (error) {
      logger.error(`[SYNC:ERROR] Event processing failed`, {
        error: (error as Error).message,
        instanceId: instanceId.substring(0, 8),
        userId,
        eventCount: events.length,
      });
      throw error;
    }
  }

  /**
   * Insert event into database
   */
  private async insertEvent(
    userId: number,
    instanceId: string,
    event: Event,
  ): Promise<void> {
    const sql = `
      INSERT INTO events (
        user_id, instance_id, event_type, document_id,
        tab_id, window_id, url, title, navigation_type, from_address_bar,
        transition_type, transition_qualifiers,
        start_time, end_time, duration_ms, was_active, was_window_focused, user_was_active,
        tab_count, window_count, 
        group_id, group_name, group_color,
        original_session_id, new_window_id,
        timestamp, synced_at, metadata
      ) VALUES (
        ?, ?, ?, ?,
        ?, ?, ?, ?, ?, ?,
        ?, ?,
        ?, ?, ?, ?, ?, ?,
        ?, ?,
        ?, ?, ?,
        ?, ?,
        ?, CURRENT_TIMESTAMP, ?
      )
    `;

    // Extract fields based on event type
    const navigationEvent = event as any;
    const timeEvent = event as any;
    const restorationEvent = event as any;
    const groupEvent = event as any;

    await this.dbRun(
      sql,
      userId,
      instanceId,
      event.eventType,
      event.documentId || null,
      navigationEvent.tabId || null,
      navigationEvent.windowId || null,
      navigationEvent.url || null,
      navigationEvent.title || null,
      navigationEvent.navigationType || null,
      navigationEvent.fromAddressBar ? 1 : 0,
      navigationEvent.transitionType || null,
      navigationEvent.transitionQualifiers ? JSON.stringify(navigationEvent.transitionQualifiers) : null,
      timeEvent.startTime || null,
      timeEvent.endTime || null,
      timeEvent.durationMs || null,
      timeEvent.wasActive !== undefined ? (timeEvent.wasActive ? 1 : 0) : null,
      timeEvent.wasWindowFocused !== undefined
        ? timeEvent.wasWindowFocused
          ? 1
          : 0
        : null,
      timeEvent.userWasActive !== undefined
        ? timeEvent.userWasActive
          ? 1
          : 0
        : null,
      navigationEvent.tabCount || null,
      navigationEvent.windowCount || null,
      groupEvent.groupId || null,
      groupEvent.groupTitle || null, // Note: client sends 'title' or 'groupTitle'? Check listener. 
      // TabGroupListener uses 'title'. But for group events, title is group title.
      // For navigation events, group info might not be present unless enriched. 
      // TabGroupListener captures TAB_GROUP_CREATED with 'title' and 'color'.
      groupEvent.color || groupEvent.groupColor || null,
      restorationEvent.originalSessionId || null,
      restorationEvent.newWindowId || null,
      event.timestamp,
      JSON.stringify((event as any).metadata || null),
    );
  }

  /**
   * Handle session restoration metadata
   * Creates mappings to prevent duplicate event counts
   */
  private async handleRestorations(
    userId: number,
    instanceId: string,
    restorationData: RestorationMetadata[],
  ): Promise<number> {
    let count = 0;

    for (const restoration of restorationData) {
      try {
        await this.dbRun(
          `INSERT INTO session_restorations (user_id, instance_id, original_session_id, new_window_id)
           VALUES (?, ?, ?, ?)`,
          userId,
          instanceId,
          restoration.originalSessionId,
          restoration.newWindowId || null,
        );

        count++;

        logger.debug(`[SYNC:RESTORE] Restoration mapping created`, {
          originalSessionId: restoration.originalSessionId,
          newWindowId: restoration.newWindowId,
        });
      } catch (error) {
        logger.error(`[SYNC:RESTORE] Failed to create restoration mapping`, {
          error: (error as Error).message,
          restoration,
        });
      }
    }

    return count;
  }

  /**
   * Update marker after successful event processing
   */
  private async updateMarker(
    userId: number,
    instanceId: string,
    maxTimestamp: number,
  ): Promise<void> {
    await this.dbRun(
      `UPDATE sync_markers
       SET last_event_timestamp = ?, updated_at = CURRENT_TIMESTAMP
       WHERE user_id = ? AND instance_id = ?`,
      maxTimestamp,
      userId,
      instanceId,
    );
  }

  /**
   * Get sync statistics for debugging
   */
  async getSyncStats(userId: number, instanceId: string) {
    try {
      const marker = (await this.dbGet(
        `SELECT * FROM sync_markers WHERE user_id = ? AND instance_id = ?`,
        userId,
        instanceId,
      )) as SyncMarkerRow | undefined;

      const eventCount = (await this.dbGet(
        `SELECT COUNT(*) as count FROM events WHERE user_id = ? AND instance_id = ?`,
        userId,
        instanceId,
      )) as { count: number };

      const recentEvents = (await this.dbAll(
        `SELECT event_type, COUNT(*) as count
         FROM events
         WHERE user_id = ? AND instance_id = ?
         GROUP BY event_type`,
        userId,
        instanceId,
      )) as Array<{
        event_type: string;
        count: number;
      }>;

      return {
        hasMarker: !!marker,
        lastEventTimestamp: marker?.last_event_timestamp || 0,
        totalEvents: eventCount?.count || 0,
        eventsByType: recentEvents.reduce(
          (acc, row) => {
            acc[row.event_type] = row.count;
            return acc;
          },
          {} as Record<string, number>,
        ),
      };
    } catch (error) {
      logger.error(`[SYNC:STATS] Failed to get sync stats`, {
        error: (error as Error).message,
        userId,
        instanceId: instanceId.substring(0, 8),
      });
      return null;
    }
  }
}
