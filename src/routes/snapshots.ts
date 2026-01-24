/**
 * Snapshot routes - Snapshot-based sync endpoints
 */

import express, { Request, Response } from 'express';
import { getDb } from '../db.js';
import { authMiddleware } from '../middlewares/auth.js';
import { SnapshotService } from '../services/SnapshotService.js';
import { validateUploadRequest } from '../types/snapshot.types.js';
import logger from '../utils/logger.js';

const router = express.Router();
const snapshotService = new SnapshotService(getDb());

/**
 * POST /sync/snapshot
 * Upload a new snapshot from client
 * Supports gzip Content-Encoding
 */
router.post('/snapshot', authMiddleware, async (req: Request, res: Response) => {
  const userId = (req as any).user?.id;

  try {
    let body;

    if (req.headers['content-encoding'] === 'gzip') {
      // Express has already decompressed to a Buffer
      if (!Buffer.isBuffer(req.body)) {
        logger.error('[SNAPSHOT:UPLOAD] req.body is NOT a buffer');
        return res.status(400).json({
          success: false,
          error: 'Expected Buffer for gzipped content',
        });
      }

      // Simply parse the decompressed buffer as JSON
      try {
        body = JSON.parse(req.body.toString());
      } catch (parseError) {
        logger.error('[SNAPSHOT:UPLOAD] JSON parse failed', {
          error: (parseError as Error).message,
        });
        return res.status(400).json({
          success: false,
          error: 'Invalid JSON in decompressed body',
        });
      }
    } else {
      body = req.body;
    }

    const validation = validateUploadRequest(body);
    if (!validation.success) {
      logger.warn('[SNAPSHOT:UPLOAD] Validation failed', {
        errors: validation.error?.issues,
      });
      return res.status(400).json({
        success: false,
        error: 'Invalid request payload',
        details: validation.error?.issues,
      });
    }

    const { instanceId, snapshotData, snapshotHash } = validation.data!;

    // Validate X-Instance-ID header matches
    const headerInstanceId = req.headers['x-instance-id'];
    if (headerInstanceId && headerInstanceId !== instanceId) {
      logger.warn('[SNAPSHOT:UPLOAD] Instance ID mismatch', {
        payloadId: instanceId.substring(0, 8),
        headerId: typeof headerInstanceId === 'string' ? headerInstanceId.substring(0, 8) : 'none',
      });
      return res.status(400).json({
        success: false,
        error: 'Instance ID mismatch',
      });
    }

    // Ingest snapshot
    const result = await snapshotService.ingestSnapshot(
      userId,
      instanceId,
      snapshotData,
      snapshotHash,
    );

    logger.info('[SNAPSHOT:UPLOAD] Response sent', {
      versionNumber: result.versionNumber,
      isDuplicate: result.isDuplicate,
    });

    res.json({
      success: true,
      versionNumber: result.versionNumber,
      isDuplicate: result.isDuplicate,
      timestamp: Date.now(),
    });
  } catch (error) {
    logger.error('[SNAPSHOT:UPLOAD] Request failed', {
      error: (error as Error).message,
      userId,
    });

    res.status(500).json({
      success: false,
      error: 'Failed to upload snapshot',
      message: (error as Error).message,
    });
  }
});

/**
 * GET /sync/snapshot/:instanceId/latest
 * Get the latest snapshot for an instance
 */
router.get('/snapshot/:instanceId/latest', authMiddleware, async (req: Request, res: Response) => {
  const { instanceId } = req.params;
  const userId = (req as any).user?.id;

  logger.info('[SNAPSHOT:LATEST] Request received', {
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

    const snapshot = await snapshotService.getLatestSnapshot(userId, instanceId);

    if (!snapshot) {
      return res.status(404).json({
        success: false,
        error: 'No snapshots found',
      });
    }

    res.json({
      success: true,
      versionNumber: snapshot.version_number,
      snapshotData: snapshot.snapshot_data,
      createdAt: snapshot.created_at,
    });
  } catch (error) {
    logger.error('[SNAPSHOT:LATEST] Request failed', {
      error: (error as Error).message,
      instanceId: instanceId.substring(0, 8),
    });

    res.status(500).json({
      success: false,
      error: 'Failed to get latest snapshot',
      message: (error as Error).message,
    });
  }
});

/**
 * GET /sync/snapshot/:instanceId/version/:version
 * Get a specific snapshot version
 */
router.get(
  '/snapshot/:instanceId/version/:version',
  authMiddleware,
  async (req: Request, res: Response) => {
    const { instanceId, version } = req.params;
    const userId = (req as any).user?.id;
    const versionNumber = parseInt(version, 10);

    logger.info('[SNAPSHOT:VERSION] Request received', {
      instanceId: instanceId.substring(0, 8),
      versionNumber,
      userId,
    });

    try {
      if (isNaN(versionNumber) || versionNumber < 1) {
        return res.status(400).json({
          success: false,
          error: 'Invalid version number',
        });
      }

      const snapshot = await snapshotService.getSnapshotAtVersion(
        userId,
        instanceId,
        versionNumber,
      );

      if (!snapshot) {
        return res.status(404).json({
          success: false,
          error: 'Snapshot version not found',
        });
      }

      res.json({
        success: true,
        versionNumber: snapshot.version_number,
        snapshotData: snapshot.snapshot_data,
        createdAt: snapshot.created_at,
      });
    } catch (error) {
      logger.error('[SNAPSHOT:VERSION] Request failed', {
        error: (error as Error).message,
        instanceId: instanceId.substring(0, 8),
        versionNumber,
      });

      res.status(500).json({
        success: false,
        error: 'Failed to get snapshot version',
        message: (error as Error).message,
      });
    }
  },
);

/**
 * GET /sync/snapshot/:instanceId/timeline
 * Get snapshot timeline for UI display
 */
router.get(
  '/snapshot/:instanceId/timeline',
  authMiddleware,
  async (req: Request, res: Response) => {
    const { instanceId } = req.params;
    const userId = (req as any).user?.id;
    const limit = parseInt(req.query.limit as string, 10) || 100;

    logger.info('[SNAPSHOT:TIMELINE] Request received', {
      instanceId: instanceId.substring(0, 8),
      userId,
      limit,
    });

    try {
      const snapshots = await snapshotService.getSnapshotTimeline(userId, instanceId, limit);

      res.json({
        success: true,
        snapshots,
        total: snapshots.length,
      });
    } catch (error) {
      logger.error('[SNAPSHOT:TIMELINE] Request failed', {
        error: (error as Error).message,
        instanceId: instanceId.substring(0, 8),
      });

      res.status(500).json({
        success: false,
        error: 'Failed to get snapshot timeline',
        message: (error as Error).message,
      });
    }
  },
);

/**
 * GET /sync/snapshot/:instanceId/stats
 * Get snapshot statistics
 */
router.get('/snapshot/:instanceId/stats', authMiddleware, async (req: Request, res: Response) => {
  const { instanceId } = req.params;
  const userId = (req as any).user?.id;

  try {
    const stats = await snapshotService.getStats(userId, instanceId);

    res.json({
      success: true,
      data: stats,
    });
  } catch (error) {
    logger.error('[SNAPSHOT:STATS] Request failed', {
      error: (error as Error).message,
      instanceId: instanceId.substring(0, 8),
    });

    res.status(500).json({
      success: false,
      error: 'Failed to get snapshot stats',
      message: (error as Error).message,
    });
  }
});

/**
 * POST /sync/snapshot/:instanceId/prune
 * Trigger snapshot pruning (admin/maintenance)
 */
router.post('/snapshot/:instanceId/prune', authMiddleware, async (req: Request, res: Response) => {
  const { instanceId } = req.params;
  const userId = (req as any).user?.id;

  logger.info('[SNAPSHOT:PRUNE] Request received', {
    instanceId: instanceId.substring(0, 8),
    userId,
  });

  try {
    const deletedCount = await snapshotService.pruneOldSnapshots(userId, instanceId);

    res.json({
      success: true,
      deletedCount,
    });
  } catch (error) {
    logger.error('[SNAPSHOT:PRUNE] Request failed', {
      error: (error as Error).message,
      instanceId: instanceId.substring(0, 8),
    });

    res.status(500).json({
      success: false,
      error: 'Failed to prune snapshots',
      message: (error as Error).message,
    });
  }
});

export const snapshotRouter = router;
export default router;
