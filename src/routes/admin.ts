import express, { Request, Response } from 'express';
import { getDb } from '../db.js';
import logger from '../utils/logger.js';

const router = express.Router();
const db = getDb();

/**
 * GET /api/v1/admin/users
 * List all users with snapshot counts
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
        COUNT(DISTINCT s.instance_id) as instance_count,
        COUNT(s.id) as snapshot_count,
        MAX(s.created_at) as last_snapshot_at
      FROM users u
      LEFT JOIN snapshots s ON u.id = s.user_id
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
 * List all instance IDs for a user (based on snapshots)
 */
router.get('/instances/:userId', async (req: Request, res: Response) => {
  const userId = parseInt(req.params.userId, 10);

  if (isNaN(userId)) {
    res.status(400).json({ success: false, error: 'Invalid user ID' });
    return;
  }

  try {
    const instances = await db.all(
      `
      SELECT
        instance_id,
        COUNT(*) as snapshot_count,
        MIN(created_at) as first_snapshot_at,
        MAX(created_at) as last_snapshot_at,
        MAX(version_number) as latest_version,
        SUM(size_bytes) as total_size_bytes
      FROM snapshots
      WHERE user_id = ?
      GROUP BY instance_id
      ORDER BY last_snapshot_at DESC
    `,
      [userId],
    );

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
 * Get snapshot statistics for a user
 */
router.get('/stats/:userId', async (req: Request, res: Response) => {
  const userId = parseInt(req.params.userId, 10);
  const instanceId = req.query.instanceId as string | undefined;

  if (isNaN(userId)) {
    res.status(400).json({ success: false, error: 'Invalid user ID' });
    return;
  }

  try {
    let query: string;
    let params: any[];

    if (instanceId) {
      query = `
        SELECT
          COUNT(*) as total_snapshots,
          COUNT(DISTINCT instance_id) as instance_count,
          MAX(version_number) as latest_version,
          MIN(created_at) as first_snapshot_at,
          MAX(created_at) as last_snapshot_at,
          SUM(size_bytes) as total_size_bytes,
          AVG(size_bytes) as avg_snapshot_size
        FROM snapshots
        WHERE user_id = ? AND instance_id = ?
      `;
      params = [userId, instanceId];
    } else {
      query = `
        SELECT
          COUNT(*) as total_snapshots,
          COUNT(DISTINCT instance_id) as instance_count,
          MAX(version_number) as latest_version,
          MIN(created_at) as first_snapshot_at,
          MAX(created_at) as last_snapshot_at,
          SUM(size_bytes) as total_size_bytes,
          AVG(size_bytes) as avg_snapshot_size
        FROM snapshots
        WHERE user_id = ?
      `;
      params = [userId];
    }

    const stats = await db.get(query, params);

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
      error: 'Failed to get snapshot statistics',
    });
  }
});

export const adminRouter = router;
export default router;
