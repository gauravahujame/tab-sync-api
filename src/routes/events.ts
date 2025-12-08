import express, { Request, Response } from 'express';
import { db } from '../db.js';
import { authMiddleware } from '../middlewares/auth.js';
import { EventService } from '../services/EventService.js';
import { EventFilters, EventType } from '../types/sync.types.js';
import logger from '../utils/logger.js';

const router = express.Router();
const eventService = new EventService(db);

/**
 * GET /api/v1/events
 * Query events with filters
 */
router.get('/', authMiddleware, async (req: Request, res: Response) => {
  const userId = (req as any).user?.id;

  const filters: EventFilters = {
    instanceId: req.query.instanceId as string,
    eventTypes: req.query.eventTypes
      ? ((Array.isArray(req.query.eventTypes)
          ? req.query.eventTypes
          : (req.query.eventTypes as string).split(',')) as EventType[])
      : undefined,
    fromTimestamp: req.query.fromTimestamp
      ? parseInt(req.query.fromTimestamp as string)
      : undefined,
    toTimestamp: req.query.toTimestamp ? parseInt(req.query.toTimestamp as string) : undefined,
    limit: req.query.limit ? parseInt(req.query.limit as string) : 100,
    offset: req.query.offset ? parseInt(req.query.offset as string) : 0,
  };

  try {
    const result = await eventService.queryEvents(userId, filters);

    res.json({
      success: true,
      result,
    });
  } catch (error) {
    logger.error('[EVENT:ROUTE] Query failed', {
      error: (error as Error).message,
      userId,
    });
    res.status(500).json({
      success: false,
      error: 'Failed to query events',
    });
  }
});

/**
 * GET /api/v1/events/stats
 * Get event statistics
 */
router.get('/stats', authMiddleware, async (req: Request, res: Response) => {
  const userId = (req as any).user?.id;
  const instanceId = req.query.instanceId as string | undefined;

  try {
    const stats = await eventService.getStats(userId, instanceId);

    res.json({
      success: true,
      stats,
    });
  } catch (error) {
    logger.error('[EVENT:ROUTE] Stats failed', {
      error: (error as Error).message,
      userId,
    });
    res.status(500).json({
      success: false,
      error: 'Failed to get event statistics',
    });
  }
});

export const eventsRouter = router;
export default router;
