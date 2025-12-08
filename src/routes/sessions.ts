import express, { Request, Response } from 'express';
import { z } from 'zod';
import { db } from '../db.js';
import { authMiddleware } from '../middlewares/auth.js';
import { SessionService } from '../services/SessionService.js';
import logger from '../utils/logger.js';

const router = express.Router();
const sessionService = new SessionService(db);

// Validation schemas
const createSessionSchema = z.object({
  name: z.string().min(1).max(255),
  description: z.string().max(1000).optional(),
  tags: z.array(z.string()).optional(),
  windows: z.array(z.any()).optional(),
  totalTabs: z.number().int().min(0).optional(),
  totalWindows: z.number().int().min(0).optional(),
});

const updateSessionSchema = z.object({
  name: z.string().min(1).max(255).optional(),
  description: z.string().max(1000).optional(),
  tags: z.array(z.string()).optional(),
});

const batchCreateSchema = z.object({
  sessions: z.array(createSessionSchema),
});

/**
 * POST /api/v1/sessions
 * Create a new session
 */
router.post('/', authMiddleware, async (req: Request, res: Response) => {
  const userId = (req as any).user?.id;
  const instanceId = req.headers['x-instance-id'] as string;

  if (!instanceId) {
    return res.status(400).json({
      success: false,
      error: 'X-Instance-ID header is required',
    });
  }

  try {
    const validation = createSessionSchema.safeParse(req.body);
    if (!validation.success) {
      return res.status(400).json({
        success: false,
        error: 'Invalid request',
        details: validation.error.issues,
      });
    }

    const result = await sessionService.createSession(
      userId,
      instanceId,
      validation.data
    );

    res.status(201).json({
      success: true,
       result,
    });
  } catch (error) {
    logger.error('[SESSION:ROUTE] Create failed', {
      error: (error as Error).message,
      userId,
    });
    res.status(500).json({
      success: false,
      error: 'Failed to create session',
    });
  }
});

/**
 * GET /api/v1/sessions
 * List all sessions for the user
 */
router.get('/', authMiddleware, async (req: Request, res: Response) => {
  const userId = (req as any).user?.id;
  const limit = parseInt(req.query.limit as string) || 50;
  const offset = parseInt(req.query.offset as string) || 0;

  try {
    const sessions = await sessionService.listSessions(userId, { limit, offset });

    res.json({
      success: true,
       sessions,
    });
  } catch (error) {
    logger.error('[SESSION:ROUTE] List failed', {
      error: (error as Error).message,
      userId,
    });
    res.status(500).json({
      success: false,
      error: 'Failed to list sessions',
    });
  }
});

/**
 * GET /api/v1/sessions/:sessionId
 * Get session details
 */
router.get('/:sessionId', authMiddleware, async (req: Request, res: Response) => {
  const userId = (req as any).user?.id;
  const { sessionId } = req.params;

  try {
    const session = await sessionService.getSession(userId, sessionId);
    if (!session) {
      return res.status(404).json({
        success: false,
        error: 'Session not found',
      });
    }

    res.json({
      success: true,
       session,
    });
  } catch (error) {
    logger.error('[SESSION:ROUTE] Get failed', {
      error: (error as Error).message,
      sessionId,
    });
    res.status(500).json({
      success: false,
      error: 'Failed to get session',
    });
  }
});

/**
 * PUT /api/v1/sessions/:sessionId
 * Update session metadata
 */
router.put('/:sessionId', authMiddleware, async (req: Request, res: Response) => {
  const userId = (req as any).user?.id;
  const { sessionId } = req.params;

  try {
    const validation = updateSessionSchema.safeParse(req.body);
    if (!validation.success) {
      return res.status(400).json({
        success: false,
        error: 'Invalid request',
        details: validation.error.issues,
      });
    }

    await sessionService.updateSession(userId, sessionId, validation.data);
    res.json({
      success: true,
      message: 'Session updated successfully',
    });
  } catch (error) {
    logger.error('[SESSION:ROUTE] Update failed', {
      error: (error as Error).message,
      sessionId,
    });
    res.status(500).json({
      success: false,
      error: 'Failed to update session',
    });
  }
});

/**
 * DELETE /api/v1/sessions/:sessionId
 * Delete session
 */
router.delete('/:sessionId', authMiddleware, async (req: Request, res: Response) => {
  const userId = (req as any).user?.id;
  const { sessionId } = req.params;

  try {
    await sessionService.deleteSession(userId, sessionId);
    res.json({
      success: true,
      message: 'Session deleted successfully',
    });
  } catch (error) {
    logger.error('[SESSION:ROUTE] Delete failed', {
      error: (error as Error).message,
      sessionId,
    });
    res.status(500).json({
      success: false,
      error: 'Failed to delete session',
    });
  }
});

/**
 * POST /api/v1/sessions/batch
 * Batch create sessions
 */
router.post('/batch', authMiddleware, async (req: Request, res: Response) => {
  const userId = (req as any).user?.id;
  const instanceId = req.headers['x-instance-id'] as string;

  if (!instanceId) {
    return res.status(400).json({
      success: false,
      error: 'X-Instance-ID header is required',
    });
  }

  try {
    const validation = batchCreateSchema.safeParse(req.body);
    if (!validation.success) {
      return res.status(400).json({
        success: false,
        error: 'Invalid request',
        details: validation.error.issues,
      });
    }

    const result = await sessionService.batchCreateSessions(
      userId,
      instanceId,
      validation.data.sessions
    );

    res.status(201).json({
      success: true,
       result,
    });
  } catch (error) {
    logger.error('[SESSION:ROUTE] Batch failed', {
      error: (error as Error).message,
    });
    res.status(500).json({
      success: false,
      error: 'Failed to batch create sessions',
    });
  }
});

export const sessionsRouter = router;
export default router;
