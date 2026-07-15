import express, { Response } from 'express';
import { z } from 'zod';
import { getDb } from '../db.js';
import { SessionService } from '../services/SessionService.js';
import { AuthRequest } from '../types/index.js';
import logger from '../utils/logger.js';

const router = express.Router();
const sessionService = new SessionService(getDb());

const tabSchema = z.object({
  tabId: z.string().or(z.number()).optional(),
  url: z.string().url().optional(),
  title: z.string().optional(),
  pinned: z.boolean().optional(),
  groupId: z.union([z.string(), z.number()]).optional(),
  active: z.boolean().optional(),
  lastAccessed: z.number().optional(),
});

const windowSchema = z.object({
  windowId: z.string().or(z.number()).optional(),
  name: z.string().optional(),
  focused: z.boolean().optional(),
  type: z.enum(['normal', 'popup', 'panel', 'app', 'devtools']).optional(),
  tabs: z.array(tabSchema).optional(),
});

// Validation schemas
const createSessionSchema = z.object({
  name: z.string().min(1).max(255),
  description: z.string().max(1000).optional(),
  tags: z.array(z.string()).optional(),
  windows: z.array(windowSchema).optional(),
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
router.post('/', async (req: AuthRequest, res: Response) => {
  const userId = req.user?.id;
  const instanceId = req.instanceId;

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

    const result = await sessionService.createSession(userId, instanceId, validation.data);

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
router.get('/', async (req: AuthRequest, res: Response) => {
  const userId = req.user?.id;
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
router.get('/:sessionId', async (req: AuthRequest, res: Response) => {
  const userId = req.user?.id;
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
router.put('/:sessionId', async (req: AuthRequest, res: Response) => {
  const userId = req.user?.id;
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
router.delete('/:sessionId', async (req: AuthRequest, res: Response) => {
  const userId = req.user?.id;
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
router.post('/batch', async (req: AuthRequest, res: Response) => {
  const userId = req.user?.id;
  const instanceId = req.instanceId;

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
      validation.data.sessions,
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
