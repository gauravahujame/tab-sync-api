/**
 * Browsing history routes - Per-visit page tracking with tags
 */

import express, { Response } from 'express';
import { getDb } from '../db.js';
import { AuthRequest } from '../types/index.js';
import { HistoryService } from '../services/HistoryService.js';
import {
  createHistoryEntrySchema,
  updateHistoryEntrySchema,
  parseTagsQuery,
} from '../types/history.types.js';
import logger from '../utils/logger.js';

const router = express.Router();
const historyService = new HistoryService(getDb());

/**
 * POST /api/v1/history
 * Record a page visit (creates or updates existing entry by URL)
 */
router.post('/', async (req: AuthRequest, res: Response) => {
  const userId = req.user?.id;

  try {
    const validation = createHistoryEntrySchema.safeParse(req.body);
    if (!validation.success) {
      return res.status(400).json({
        success: false,
        error: 'Invalid request',
        details: validation.error.issues,
      });
    }

    const entry = await historyService.recordVisit(userId, validation.data);

    res.status(201).json({
      success: true,
      entry,
    });
  } catch (error) {
    logger.error('[HISTORY:ROUTE] Record visit failed', {
      error: (error as Error).message,
      userId,
    });

    res.status(500).json({
      success: false,
      error: 'Failed to record visit',
    });
  }
});

/**
 * GET /api/v1/history
 * List browsing history with optional filters
 */
router.get('/', async (req: AuthRequest, res: Response) => {
  const userId = req.user?.id;

  try {
    const tags = parseTagsQuery(req.query.tags as string | undefined);
    const domain = req.query.domain as string | undefined;
    const from = req.query.from ? parseInt(req.query.from as string, 10) : undefined;
    const to = req.query.to ? parseInt(req.query.to as string, 10) : undefined;
    const search = req.query.search as string | undefined;
    const limit = parseInt(req.query.limit as string, 10) || 50;
    const offset = parseInt(req.query.offset as string, 10) || 0;

    if (limit > 100) {
      return res.status(400).json({
        success: false,
        error: 'Limit cannot exceed 100',
      });
    }

    const result = await historyService.listHistory(userId, {
      tags,
      domain,
      from,
      to,
      search,
      limit,
      offset,
    });

    res.json({
      success: true,
      ...result,
    });
  } catch (error) {
    logger.error('[HISTORY:ROUTE] List history failed', {
      error: (error as Error).message,
      userId,
    });

    res.status(500).json({
      success: false,
      error: 'Failed to list history',
    });
  }
});

/**
 * GET /api/v1/history/tags
 * Get tag summary for the user
 */
router.get('/tags', async (req: AuthRequest, res: Response) => {
  const userId = req.user?.id;

  try {
    const summary = await historyService.getTagSummary(userId);

    res.json({
      success: true,
      summary,
    });
  } catch (error) {
    logger.error('[HISTORY:ROUTE] Tag summary failed', {
      error: (error as Error).message,
      userId,
    });

    res.status(500).json({
      success: false,
      error: 'Failed to get tag summary',
    });
  }
});

/**
 * GET /api/v1/history/domains
 * Get domain summary for the user
 */
router.get('/domains', async (req: AuthRequest, res: Response) => {
  const userId = req.user?.id;

  try {
    const summary = await historyService.getDomainSummary(userId);

    res.json({
      success: true,
      summary,
    });
  } catch (error) {
    logger.error('[HISTORY:ROUTE] Domain summary failed', {
      error: (error as Error).message,
      userId,
    });

    res.status(500).json({
      success: false,
      error: 'Failed to get domain summary',
    });
  }
});

/**
 * GET /api/v1/history/:entryId
 * Get a single history entry
 */
router.get('/:entryId', async (req: AuthRequest, res: Response) => {
  const userId = req.user?.id;
  const entryId = parseInt(req.params.entryId, 10);

  if (isNaN(entryId)) {
    return res.status(400).json({
      success: false,
      error: 'Invalid history entry ID',
    });
  }

  try {
    const entry = await historyService.getHistoryEntry(userId, entryId);
    if (!entry) {
      return res.status(404).json({
        success: false,
        error: 'History entry not found',
      });
    }

    res.json({
      success: true,
      entry,
    });
  } catch (error) {
    logger.error('[HISTORY:ROUTE] Get history entry failed', {
      error: (error as Error).message,
      entryId,
    });

    res.status(500).json({
      success: false,
      error: 'Failed to get history entry',
    });
  }
});

/**
 * PUT /api/v1/history/:entryId
 * Update a history entry (title, tags)
 */
router.put('/:entryId', async (req: AuthRequest, res: Response) => {
  const userId = req.user?.id;
  const entryId = parseInt(req.params.entryId, 10);

  if (isNaN(entryId)) {
    return res.status(400).json({
      success: false,
      error: 'Invalid history entry ID',
    });
  }

  try {
    const validation = updateHistoryEntrySchema.safeParse(req.body);
    if (!validation.success) {
      return res.status(400).json({
        success: false,
        error: 'Invalid request',
        details: validation.error.issues,
      });
    }

    const entry = await historyService.updateHistoryEntry(userId, entryId, validation.data);
    if (!entry) {
      return res.status(404).json({
        success: false,
        error: 'History entry not found',
      });
    }

    res.json({
      success: true,
      entry,
    });
  } catch (error) {
    logger.error('[HISTORY:ROUTE] Update history entry failed', {
      error: (error as Error).message,
      entryId,
    });

    res.status(500).json({
      success: false,
      error: 'Failed to update history entry',
    });
  }
});

/**
 * DELETE /api/v1/history/:entryId
 * Delete a history entry
 */
router.delete('/:entryId', async (req: AuthRequest, res: Response) => {
  const userId = req.user?.id;
  const entryId = parseInt(req.params.entryId, 10);

  if (isNaN(entryId)) {
    return res.status(400).json({
      success: false,
      error: 'Invalid history entry ID',
    });
  }

  try {
    const deleted = await historyService.deleteHistoryEntry(userId, entryId);
    if (!deleted) {
      return res.status(404).json({
        success: false,
        error: 'History entry not found',
      });
    }

    res.json({
      success: true,
      message: 'History entry deleted successfully',
    });
  } catch (error) {
    logger.error('[HISTORY:ROUTE] Delete history entry failed', {
      error: (error as Error).message,
      entryId,
    });

    res.status(500).json({
      success: false,
      error: 'Failed to delete history entry',
    });
  }
});

export const historyRouter = router;
export default router;
