/**
 * Sync routes - Stateless marker-based sync endpoints
 */

import express, { Request, Response } from 'express';
import { z } from 'zod';
import { db } from '../db.js';
import { authMiddleware } from '../middlewares/auth.js';
import { SyncService } from '../services/SyncService.js';
import { SyncEventPayload } from '../types/sync.types.js';
import logger from '../utils/logger.js';

const router = express.Router();
const syncService = new SyncService(db);

// Validation schemas
const eventSchema = z.object({
  eventType: z.enum([
    'navigation',
    'tab-created',
    'tab-removed',
    'tab-activated',
    'tab-updated',
    'tab-batch-created',
    'window-created',
    'window-removed',
    'window-focused',
    'time-entry',
    'idle-state-changed',
    'session-captured',
    'session-restored',
    'tab-group-created',
    'tab-group-updated',
    'tab-group-removed',
  ]),
  documentId: z.string().optional(),
  timestamp: z.number(),
  instanceId: z.string(),
  // Optional fields based on event type
  tabId: z.number().optional(),
  windowId: z.number().optional(),
  url: z.string().optional(),
  title: z.string().optional(),
  navigationType: z.string().optional(),
  fromAddressBar: z.boolean().optional(),
  // New fields for robust capture
  transitionType: z.string().optional(),
  transitionQualifiers: z.array(z.string()).optional(),
  groupId: z.number().optional(),
  groupTitle: z.string().optional(), // TabGroupListener usually sends 'title' but let's be flexible or aligned with SyncService
  groupName: z.string().optional(), // Alias if needed
  groupColor: z.string().optional(),
  color: z.string().optional(), // Alias for group color

  startTime: z.number().optional(),
  endTime: z.number().optional(),
  durationMs: z.number().optional(),
  wasActive: z.boolean().optional(),
  wasWindowFocused: z.boolean().optional(),
  userWasActive: z.boolean().optional(),
  tabCount: z.number().optional(),
  windowCount: z.number().optional(),
  originalSessionId: z.string().optional(),
  newWindowId: z.number().optional(),
  metadata: z.any().optional(),
});

const syncEventsSchema = z.object({
  instanceId: z.string().uuid(),
  fromTimestamp: z.number(),
  events: z.array(eventSchema),
  restorationMetadata: z
    .array(
      z.object({
        eventType: z.literal('session-restored'),
        originalSessionId: z.string(),
        restoredAt: z.number(),
        newWindowId: z.number().optional(),
      }),
    )
    .optional(),
});

/**
 * GET /sync/marker/:instanceId
 * Get sync marker for an instance (tells extension where to resume sync)
 */
router.get('/marker/:instanceId', authMiddleware, async (req: Request, res: Response) => {
  const { instanceId } = req.params;
  const userId = (req as any).user?.id;

  logger.info('[SYNC:MARKER] Request received', {
    instanceId: instanceId.substring(0, 8),
    userId,
  });

  try {
    // Validate instance ID format
    if (!instanceId || instanceId.length !== 36) {
      return res.status(400).json({
        success: false,
        error: 'Invalid instance ID format (expected UUID)',
      });
    }

    // Validate X-Instance-ID header matches
    const headerInstanceId = req.headers['x-instance-id'];
    if (headerInstanceId && headerInstanceId !== instanceId) {
      logger.warn('[SYNC:MARKER] Instance ID mismatch', {
        paramId: instanceId.substring(0, 8),
        headerId: typeof headerInstanceId === 'string' ? headerInstanceId.substring(0, 8) : 'none',
      });
      return res.status(400).json({
        success: false,
        error: 'Instance ID mismatch',
      });
    }

    const marker = await syncService.getMarker(instanceId, userId);

    logger.info('[SYNC:MARKER] Response sent', {
      lastEventTimestamp: marker.lastEventTimestamp,
      firstSync: marker.firstSync,
    });

    res.json({
      success: true,
      data: marker,
    });
  } catch (error) {
    logger.error('[SYNC:MARKER] Request failed', {
      error: (error as Error).message,
      instanceId: instanceId.substring(0, 8),
    });

    res.status(500).json({
      success: false,
      error: 'Failed to get sync marker',
      message: (error as Error).message,
    });
  }
});

/**
 * POST /sync/events
 * Process events from extension
 */
router.post('/events', authMiddleware, async (req: Request, res: Response) => {
  const userId = (req as any).user?.id;

  logger.info('[SYNC:EVENTS] Request received', {
    userId,
    eventCount: req.body?.events?.length || 0,
  });

  try {
    // Validate request body
    const validation = syncEventsSchema.safeParse(req.body);
    if (!validation.success) {
      logger.warn('[SYNC:EVENTS] Validation failed', {
        errors: validation.error.issues,
      });
      return res.status(400).json({
        success: false,
        error: 'Invalid request payload',
        details: validation.error.issues,
      });
    }

    const payload = validation.data as SyncEventPayload;

    // Validate X-Instance-ID header matches
    const headerInstanceId = req.headers['x-instance-id'];
    if (headerInstanceId && headerInstanceId !== payload.instanceId) {
      logger.warn('[SYNC:EVENTS] Instance ID mismatch', {
        payloadId: payload.instanceId.substring(0, 8),
        headerId: typeof headerInstanceId === 'string' ? headerInstanceId.substring(0, 8) : 'none',
      });
      return res.status(400).json({
        success: false,
        error: 'Instance ID mismatch',
      });
    }

    // Process events
    const result = await syncService.processEvents(
      payload.instanceId,
      userId,
      payload.events,
      payload.restorationMetadata,
    );

    logger.info('[SYNC:EVENTS] Response sent', {
      eventsProcessed: result.eventsProcessed,
      duplicateCount: result.duplicateCount,
    });

    res.json({
      success: true,
      data: result,
    });
  } catch (error) {
    logger.error('[SYNC:EVENTS] Request failed', {
      error: (error as Error).message,
      userId,
    });

    res.status(500).json({
      success: false,
      error: 'Failed to process events',
      message: (error as Error).message,
    });
  }
});

/**
 * GET /sync/stats/:instanceId
 * Get sync statistics for debugging
 */
router.get('/stats/:instanceId', authMiddleware, async (req: Request, res: Response) => {
  const { instanceId } = req.params;
  const userId = (req as any).user?.id;

  try {
    const stats = await syncService.getSyncStats(userId, instanceId);

    if (!stats) {
      return res.status(404).json({
        success: false,
        error: 'No sync data found for instance',
      });
    }

    res.json({
      success: true,
      data: stats,
    });
  } catch (error) {
    logger.error('[SYNC:STATS] Request failed', {
      error: (error as Error).message,
      instanceId: instanceId.substring(0, 8),
    });

    res.status(500).json({
      success: false,
      error: 'Failed to get sync stats',
      message: (error as Error).message,
    });
  }
});

export const syncRouter = router;
export default router;
