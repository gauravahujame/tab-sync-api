/**
 * Notes routes - Domain-scoped user notes endpoints
 */

import express, { Request, Response } from 'express';
import { getDb } from '../db.js';
import { authMiddleware } from '../middlewares/auth.js';
import { NotesService } from '../services/NotesService.js';
import {
  createNoteSchema,
  updateNoteSchema,
  noteRowToResponse,
} from '../types/note.types.js';
import logger from '../utils/logger.js';

const router = express.Router();
const notesService = new NotesService(getDb());

/**
 * POST /api/v1/notes
 * Create a new note
 */
router.post('/', authMiddleware, async (req: Request, res: Response) => {
  const userId = (req as any).user?.id;

  try {
    const validation = createNoteSchema.safeParse(req.body);
    if (!validation.success) {
      return res.status(400).json({
        success: false,
        error: 'Invalid request',
        details: validation.error.issues,
      });
    }

    const note = await notesService.createNote(userId, validation.data);

    res.status(201).json({
      success: true,
      note: noteRowToResponse(note),
    });
  } catch (error) {
    logger.error('[NOTES:ROUTE] Create failed', {
      error: (error as Error).message,
      userId,
    });
    res.status(500).json({
      success: false,
      error: 'Failed to create note',
    });
  }
});

/**
 * GET /api/v1/notes/domain/:domain
 * Get all notes for a specific domain
 */
router.get('/domain/:domain', authMiddleware, async (req: Request, res: Response) => {
  const userId = (req as any).user?.id;
  const { domain } = req.params;
  const limit = parseInt(req.query.limit as string) || 50;
  const offset = parseInt(req.query.offset as string) || 0;

  try {
    if (!domain || domain.trim().length === 0) {
      return res.status(400).json({
        success: false,
        error: 'Domain parameter is required',
      });
    }

    const result = await notesService.getNotesByDomain(userId, domain, { limit, offset });

    res.json({
      success: true,
      notes: result.notes.map(noteRowToResponse),
      total: result.total,
      domain: domain.toLowerCase().trim(),
    });
  } catch (error) {
    logger.error('[NOTES:ROUTE] Get by domain failed', {
      error: (error as Error).message,
      userId,
      domain,
    });
    res.status(500).json({
      success: false,
      error: 'Failed to get notes',
    });
  }
});

/**
 * GET /api/v1/notes
 * Get all notes for the user
 */
router.get('/', authMiddleware, async (req: Request, res: Response) => {
  const userId = (req as any).user?.id;
  const limit = parseInt(req.query.limit as string) || 100;
  const offset = parseInt(req.query.offset as string) || 0;

  try {
    const result = await notesService.getAllNotes(userId, { limit, offset });

    res.json({
      success: true,
      notes: result.notes.map(noteRowToResponse),
      total: result.total,
    });
  } catch (error) {
    logger.error('[NOTES:ROUTE] List failed', {
      error: (error as Error).message,
      userId,
    });
    res.status(500).json({
      success: false,
      error: 'Failed to list notes',
    });
  }
});

/**
 * GET /api/v1/notes/summary
 * Get domain summary (count of notes per domain)
 */
router.get('/summary', authMiddleware, async (req: Request, res: Response) => {
  const userId = (req as any).user?.id;

  try {
    const summary = await notesService.getDomainSummary(userId);

    res.json({
      success: true,
      summary,
    });
  } catch (error) {
    logger.error('[NOTES:ROUTE] Summary failed', {
      error: (error as Error).message,
      userId,
    });
    res.status(500).json({
      success: false,
      error: 'Failed to get notes summary',
    });
  }
});

/**
 * GET /api/v1/notes/:noteId
 * Get a single note by ID
 */
router.get('/:noteId', authMiddleware, async (req: Request, res: Response) => {
  const userId = (req as any).user?.id;
  const noteId = parseInt(req.params.noteId, 10);

  if (isNaN(noteId)) {
    return res.status(400).json({
      success: false,
      error: 'Invalid note ID',
    });
  }

  try {
    const note = await notesService.getNoteById(userId, noteId);
    if (!note) {
      return res.status(404).json({
        success: false,
        error: 'Note not found',
      });
    }

    res.json({
      success: true,
      note: noteRowToResponse(note),
    });
  } catch (error) {
    logger.error('[NOTES:ROUTE] Get failed', {
      error: (error as Error).message,
      noteId,
    });
    res.status(500).json({
      success: false,
      error: 'Failed to get note',
    });
  }
});

/**
 * PUT /api/v1/notes/:noteId
 * Update a note
 */
router.put('/:noteId', authMiddleware, async (req: Request, res: Response) => {
  const userId = (req as any).user?.id;
  const noteId = parseInt(req.params.noteId, 10);

  if (isNaN(noteId)) {
    return res.status(400).json({
      success: false,
      error: 'Invalid note ID',
    });
  }

  try {
    const validation = updateNoteSchema.safeParse(req.body);
    if (!validation.success) {
      return res.status(400).json({
        success: false,
        error: 'Invalid request',
        details: validation.error.issues,
      });
    }

    const note = await notesService.updateNote(userId, noteId, validation.data);
    if (!note) {
      return res.status(404).json({
        success: false,
        error: 'Note not found',
      });
    }

    res.json({
      success: true,
      note: noteRowToResponse(note),
    });
  } catch (error) {
    logger.error('[NOTES:ROUTE] Update failed', {
      error: (error as Error).message,
      noteId,
    });
    res.status(500).json({
      success: false,
      error: 'Failed to update note',
    });
  }
});

/**
 * DELETE /api/v1/notes/:noteId
 * Delete a note
 */
router.delete('/:noteId', authMiddleware, async (req: Request, res: Response) => {
  const userId = (req as any).user?.id;
  const noteId = parseInt(req.params.noteId, 10);

  if (isNaN(noteId)) {
    return res.status(400).json({
      success: false,
      error: 'Invalid note ID',
    });
  }

  try {
    const deleted = await notesService.deleteNote(userId, noteId);
    if (!deleted) {
      return res.status(404).json({
        success: false,
        error: 'Note not found',
      });
    }

    res.json({
      success: true,
      message: 'Note deleted successfully',
    });
  } catch (error) {
    logger.error('[NOTES:ROUTE] Delete failed', {
      error: (error as Error).message,
      noteId,
    });
    res.status(500).json({
      success: false,
      error: 'Failed to delete note',
    });
  }
});

export const notesRouter = router;
export default router;
