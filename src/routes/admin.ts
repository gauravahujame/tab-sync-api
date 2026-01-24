import express, { Request, Response } from 'express';
import { getDb } from '../db.js';
// import { EventService } from '../services/EventService.js';
// import { EventFilters, EventType } from '../types/sync.types.js';
import logger from '../utils/logger.js';

const router = express.Router();
const db = getDb();
// const eventService = new EventService(db);


/**
 * GET /api/v1/admin/users
 * List all users with event counts
 */
router.get('/users', async (_req: Request, res: Response) => {
    try {
        const users = await db.all(`
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
        const instances = await db.all(`
      SELECT
        instance_id,
        COUNT(*) as event_count,
        MIN(timestamp) as first_event_at,
        MAX(timestamp) as last_event_at
      FROM events
      WHERE user_id = ?
      GROUP BY instance_id
      ORDER BY last_event_at DESC
    `, [userId]);

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
 * GET /api/v1/admin/stats/:userId
 * Get event statistics for a user
 */
// router.get('/stats/:userId', async (req: Request, res: Response) => {
//     const userId = parseInt(req.params.userId, 10);
//     const instanceId = req.query.instanceId as string | undefined;

//     if (isNaN(userId)) {
//         res.status(400).json({ success: false, error: 'Invalid user ID' });
//         return;
//     }

//     try {
//         const stats = await eventService.getStats(userId, instanceId);

//         res.json({
//             success: true,
//             stats,
//         });
//     } catch (error) {
//         logger.error('[ADMIN] Stats query failed', {
//             error: (error as Error).message,
//             userId,
//         });
//         res.status(500).json({
//             success: false,
//             error: 'Failed to get event statistics',
//         });
//     }
// });

export const adminRouter = router;
export default router;
