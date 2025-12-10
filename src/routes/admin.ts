import express, { Request, Response } from 'express';
import { db } from '../db.js';
import { EventService } from '../services/EventService.js';
import { EventFilters, EventType } from '../types/sync.types.js';
import logger from '../utils/logger.js';
import { promisify } from 'util';

const router = express.Router();
const eventService = new EventService(db);

// Promisify db methods
const dbAll = promisify(db.all.bind(db));
const dbGet = promisify(db.get.bind(db));

/**
 * GET /api/v1/admin/users
 * List all users with event counts
 */
router.get('/users', async (_req: Request, res: Response) => {
    try {
        const users = await dbAll(`
      SELECT 
        u.id,
        u.email,
        u.name,
        u.browser_name,
        u.created_at,
        COUNT(DISTINCT e.instance_id) as instance_count,
        COUNT(e.id) as event_count,
        MAX(e.timestamp) as last_event_at
      FROM users u
      LEFT JOIN events e ON u.id = e.user_id
      GROUP BY u.id
      ORDER BY u.id DESC
    `);

        res.json({
            success: true,
            users,
        });
    } catch (error) {
        logger.error('[ADMIN] Failed to list users', { error: (error as Error).message });
        res.status(500).json({
            success: false,
            error: 'Failed to list users',
        });
    }
});

/**
 * GET /api/v1/admin/instances/:userId
 * List all instance IDs for a user
 */
router.get('/instances/:userId', async (req: Request, res: Response) => {
    const userId = parseInt(req.params.userId, 10);

    if (isNaN(userId)) {
        res.status(400).json({ success: false, error: 'Invalid user ID' });
        return;
    }

    try {
        const instances = await dbAll(`
      SELECT 
        instance_id,
        COUNT(*) as event_count,
        MIN(timestamp) as first_event_at,
        MAX(timestamp) as last_event_at
      FROM events
      WHERE user_id = ?
      GROUP BY instance_id
      ORDER BY last_event_at DESC
    `, userId);

        res.json({
            success: true,
            instances,
        });
    } catch (error) {
        logger.error('[ADMIN] Failed to list instances', { error: (error as Error).message, userId });
        res.status(500).json({
            success: false,
            error: 'Failed to list instances',
        });
    }
});

/**
 * GET /api/v1/admin/events
 * Query events for any user/instance (no auth restrictions)
 */
router.get('/events', async (req: Request, res: Response) => {
    const userId = req.query.userId ? parseInt(req.query.userId as string, 10) : undefined;

    if (!userId || isNaN(userId)) {
        res.status(400).json({ success: false, error: 'userId is required' });
        return;
    }

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
        logger.error('[ADMIN] Query events failed', {
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
 * GET /api/v1/admin/stats/:userId
 * Get event statistics for a user
 */
router.get('/stats/:userId', async (req: Request, res: Response) => {
    const userId = parseInt(req.params.userId, 10);
    const instanceId = req.query.instanceId as string | undefined;

    if (isNaN(userId)) {
        res.status(400).json({ success: false, error: 'Invalid user ID' });
        return;
    }

    try {
        const stats = await eventService.getStats(userId, instanceId);

        res.json({
            success: true,
            stats,
        });
    } catch (error) {
        logger.error('[ADMIN] Stats query failed', {
            error: (error as Error).message,
            userId,
        });
        res.status(500).json({
            success: false,
            error: 'Failed to get event statistics',
        });
    }
});

export const adminRouter = router;
export default router;
