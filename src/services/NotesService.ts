/**
 * NotesService - Domain-scoped user notes
 *
 * Responsibilities:
 * - CRUD operations for user notes
 * - Domain-scoped queries (retrieve all notes for a domain)
 * - Input sanitization and validation at the service level
 */

import { IDatabaseAdapter } from '../db/IDatabaseAdapter.js';
import { CreateNoteInput, NoteRow, UpdateNoteInput } from '../types/note.types.js';
import logger from '../utils/logger.js';

export class NotesService {
  constructor(private db: IDatabaseAdapter) {}

  /**
   * Create a new note
   */
  async createNote(userId: number, input: CreateNoteInput): Promise<NoteRow> {
    const { domain, url, title, content } = input;

    logger.info('[NOTES:CREATE] Creating note', {
      userId,
      domain,
      contentLength: content.length,
    });

    try {
      const result = await this.db.get<NoteRow>(
        `INSERT INTO notes (user_id, domain, url, title, content)
         VALUES ($1, $2, $3, $4, $5)
         RETURNING *`,
        [userId, domain, url || '', title || '', content],
      );

      if (!result) {
        throw new Error('Failed to create note - no row returned');
      }

      logger.info('[NOTES:CREATE] Note created', {
        noteId: result.id,
        domain,
      });

      return result;
    } catch (error) {
      logger.error('[NOTES:CREATE] Failed to create note', {
        error: (error as Error).message,
        userId,
        domain,
      });
      throw error;
    }
  }

  /**
   * Get all notes for a specific domain
   */
  async getNotesByDomain(
    userId: number,
    domain: string,
    options: { limit?: number; offset?: number } = {},
  ): Promise<{ notes: NoteRow[]; total: number }> {
    const { limit = 50, offset = 0 } = options;
    const normalizedDomain = domain.toLowerCase().trim();

    try {
      const [notes, countResult] = await Promise.all([
        this.db.all<NoteRow>(
          `SELECT * FROM notes
           WHERE user_id = $1 AND domain = $2
           ORDER BY updated_at DESC
           LIMIT $3 OFFSET $4`,
          [userId, normalizedDomain, limit, offset],
        ),
        this.db.get<{ count: number }>(
          `SELECT COUNT(*) as count FROM notes
           WHERE user_id = $1 AND domain = $2`,
          [userId, normalizedDomain],
        ),
      ]);

      return {
        notes,
        total: countResult?.count || 0,
      };
    } catch (error) {
      logger.error('[NOTES:GET_BY_DOMAIN] Failed to get notes', {
        error: (error as Error).message,
        userId,
        domain: normalizedDomain,
      });
      throw error;
    }
  }

  /**
   * Get a single note by ID
   */
  async getNoteById(userId: number, noteId: number): Promise<NoteRow | null> {
    try {
      const note = await this.db.get<NoteRow>(
        `SELECT * FROM notes WHERE id = $1 AND user_id = $2`,
        [noteId, userId],
      );

      return note || null;
    } catch (error) {
      logger.error('[NOTES:GET] Failed to get note', {
        error: (error as Error).message,
        noteId,
        userId,
      });
      throw error;
    }
  }

  /**
   * Update an existing note
   */
  async updateNote(
    userId: number,
    noteId: number,
    input: UpdateNoteInput,
  ): Promise<NoteRow | null> {
    logger.info('[NOTES:UPDATE] Updating note', { noteId, userId });

    try {
      // Verify ownership first
      const existing = await this.getNoteById(userId, noteId);
      if (!existing) {
        return null;
      }

      const updates: string[] = [];
      const values: any[] = [];
      let paramIndex = 1;

      if (input.content !== undefined) {
        updates.push(`content = $${paramIndex++}`);
        values.push(input.content);
      }

      if (input.title !== undefined) {
        updates.push(`title = $${paramIndex++}`);
        values.push(input.title);
      }

      if (updates.length === 0) {
        return existing;
      }

      updates.push(`updated_at = NOW()`);

      values.push(noteId);
      values.push(userId);

      const result = await this.db.get<NoteRow>(
        `UPDATE notes SET ${updates.join(', ')}
         WHERE id = $${paramIndex++} AND user_id = $${paramIndex}
         RETURNING *`,
        values,
      );

      logger.info('[NOTES:UPDATE] Note updated', { noteId });
      return result || null;
    } catch (error) {
      logger.error('[NOTES:UPDATE] Failed to update note', {
        error: (error as Error).message,
        noteId,
        userId,
      });
      throw error;
    }
  }

  /**
   * Delete a note
   */
  async deleteNote(userId: number, noteId: number): Promise<boolean> {
    logger.info('[NOTES:DELETE] Deleting note', { noteId, userId });

    try {
      const result = await this.db.run(
        `DELETE FROM notes WHERE id = $1 AND user_id = $2`,
        [noteId, userId],
      );

      const deleted = result.changes > 0;
      if (deleted) {
        logger.info('[NOTES:DELETE] Note deleted', { noteId });
      } else {
        logger.warn('[NOTES:DELETE] Note not found or unauthorized', { noteId, userId });
      }

      return deleted;
    } catch (error) {
      logger.error('[NOTES:DELETE] Failed to delete note', {
        error: (error as Error).message,
        noteId,
        userId,
      });
      throw error;
    }
  }

  /**
   * Get all notes for the user (across all domains)
   */
  async getAllNotes(
    userId: number,
    options: { limit?: number; offset?: number } = {},
  ): Promise<{ notes: NoteRow[]; total: number }> {
    const { limit = 100, offset = 0 } = options;

    try {
      const [notes, countResult] = await Promise.all([
        this.db.all<NoteRow>(
          `SELECT * FROM notes
           WHERE user_id = $1
           ORDER BY updated_at DESC
           LIMIT $2 OFFSET $3`,
          [userId, limit, offset],
        ),
        this.db.get<{ count: number }>(
          `SELECT COUNT(*) as count FROM notes WHERE user_id = $1`,
          [userId],
        ),
      ]);

      return {
        notes,
        total: countResult?.count || 0,
      };
    } catch (error) {
      logger.error('[NOTES:GET_ALL] Failed to get notes', {
        error: (error as Error).message,
        userId,
      });
      throw error;
    }
  }

  /**
   * Get domain summary (count of notes per domain)
   */
  async getDomainSummary(
    userId: number,
  ): Promise<{ domain: string; count: number; latestAt: string }[]> {
    try {
      const result = await this.db.all<{ domain: string; count: number; latest_at: Date }>(
        `SELECT domain, COUNT(*) as count, MAX(updated_at) as latest_at
         FROM notes
         WHERE user_id = $1
         GROUP BY domain
         ORDER BY latest_at DESC`,
        [userId],
      );

      return result.map(row => ({
        domain: row.domain,
        count: row.count,
        latestAt: new Date(row.latest_at).toISOString(),
      }));
    } catch (error) {
      logger.error('[NOTES:SUMMARY] Failed to get domain summary', {
        error: (error as Error).message,
        userId,
      });
      throw error;
    }
  }
}
