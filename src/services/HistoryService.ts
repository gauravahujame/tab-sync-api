import { IDatabaseAdapter } from '../db/IDatabaseAdapter.js';
import {
  CreateHistoryEntryInput,
  HistoryEntry,
  HistoryRow,
  UpdateHistoryEntryInput,
  historyRowToResponse,
} from '../types/history.types.js';
import logger from '../utils/logger.js';

export class HistoryService {
  constructor(private db: IDatabaseAdapter) {}

  /**
   * Create or update a history entry for a visited URL
   * If the URL already exists for the user, increment visit count and update metadata
   */
  async recordVisit(userId: number, data: CreateHistoryEntryInput): Promise<HistoryEntry> {
    const visitedAt = data.visitedAt || Date.now();
    const tagsJson = JSON.stringify(data.tags);

    logger.info('[HISTORY:SERVICE] Recording visit', {
      userId,
      domain: data.domain,
      url: data.url.substring(0, 80),
    });

    try {
      await this.db.beginTransaction();

      try {
        // Check if entry already exists for this user + URL
        const existing = await this.db.get<HistoryRow>(
          'SELECT id, visit_count, first_visited_at FROM browsing_history WHERE user_id = ? AND url = ?',
          [userId, data.url],
        );

        if (existing) {
          // Update existing entry: increment visit count, update title/tags/last visited
          await this.db.run(
            `UPDATE browsing_history SET
              title = ?,
              tags = ?,
              visit_count = visit_count + 1,
              last_visited_at = ?,
              updated_at = CURRENT_TIMESTAMP
             WHERE id = ?`,
            [data.title, tagsJson, visitedAt, existing.id],
          );

          const updated = await this.db.get<HistoryRow>(
            'SELECT * FROM browsing_history WHERE id = ?',
            [existing.id],
          );

          await this.db.commit();
          return historyRowToResponse(updated!);
        }

        // Insert new entry
        const result = await this.db.run(
          `INSERT INTO browsing_history (
            user_id, url, title, domain, tags, visit_count,
            last_visited_at, first_visited_at
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
          [userId, data.url, data.title, data.domain, tagsJson, 1, visitedAt, visitedAt],
        );

        const inserted = await this.db.get<HistoryRow>(
          'SELECT * FROM browsing_history WHERE id = ?',
          [result.lastID],
        );

        await this.db.commit();
        return historyRowToResponse(inserted!);
      } catch (error) {
        await this.db.rollback();
        throw error;
      }
    } catch (error) {
      logger.error('[HISTORY:SERVICE] Failed to record visit', {
        error: (error as Error).message,
        url: data.url,
      });
      throw error;
    }
  }

  /**
   * List browsing history for a user with optional filters
   */
  async listHistory(
    userId: number,
    filters: {
      tags?: string[];
      domain?: string;
      from?: number;
      to?: number;
      search?: string;
      limit?: number;
      offset?: number;
    } = {},
  ): Promise<{ entries: HistoryEntry[]; total: number }> {
    const limit = Math.min(filters.limit || 50, 100);
    const offset = filters.offset || 0;

    try {
      const conditions: string[] = ['user_id = ?'];
      const params: any[] = [userId];

      if (filters.domain) {
        conditions.push('domain = ?');
        params.push(filters.domain.toLowerCase().trim());
      }

      if (filters.from) {
        conditions.push('last_visited_at >= ?');
        params.push(filters.from);
      }

      if (filters.to) {
        conditions.push('last_visited_at <= ?');
        params.push(filters.to);
      }

      if (filters.search) {
        conditions.push('(url LIKE ? OR title LIKE ? OR domain LIKE ?)');
        const pattern = `%${filters.search}%`;
        params.push(pattern, pattern, pattern);
      }

      if (filters.tags && filters.tags.length > 0) {
        // SQLite JSON tag matching: tags column contains the tag string
        const tagConditions = filters.tags.map(() => '(tags LIKE ?)').join(' OR ');
        conditions.push(`(${tagConditions})`);
        filters.tags.forEach(tag => params.push(`%"${tag.toLowerCase().trim()}"%`));
      }

      const whereClause = conditions.join(' AND ');

      const countResult = await this.db.get<{ total: number }>(
        `SELECT COUNT(*) as total FROM browsing_history WHERE ${whereClause}`,
        params,
      );

      const queryParams = [...params, limit, offset];
      const rows = await this.db.all<HistoryRow>(
        `SELECT * FROM browsing_history WHERE ${whereClause}
         ORDER BY last_visited_at DESC LIMIT ? OFFSET ?`,
        queryParams,
      );

      return {
        entries: rows.map(historyRowToResponse),
        total: countResult?.total || 0,
      };
    } catch (error) {
      logger.error('[HISTORY:SERVICE] Failed to list history', {
        error: (error as Error).message,
        userId,
      });
      throw error;
    }
  }

  /**
   * Get a single history entry by ID
   */
  async getHistoryEntry(userId: number, entryId: number): Promise<HistoryEntry | null> {
    try {
      const row = await this.db.get<HistoryRow>(
        'SELECT * FROM browsing_history WHERE id = ? AND user_id = ?',
        [entryId, userId],
      );

      return row ? historyRowToResponse(row) : null;
    } catch (error) {
      logger.error('[HISTORY:SERVICE] Failed to get history entry', {
        error: (error as Error).message,
        entryId,
      });
      throw error;
    }
  }

  /**
   * Update history entry metadata (title/tags)
   */
  async updateHistoryEntry(
    userId: number,
    entryId: number,
    data: UpdateHistoryEntryInput,
  ): Promise<HistoryEntry | null> {
    try {
      const existing = await this.getHistoryEntry(userId, entryId);
      if (!existing) {
        return null;
      }

      const fields: string[] = [];
      const values: any[] = [];

      if (data.title !== undefined) {
        fields.push('title = ?');
        values.push(data.title);
      }

      if (data.tags !== undefined) {
        fields.push('tags = ?');
        values.push(JSON.stringify(data.tags));
      }

      if (fields.length === 0) {
        return existing;
      }

      fields.push('updated_at = CURRENT_TIMESTAMP');
      values.push(entryId, userId);

      await this.db.run(
        `UPDATE browsing_history SET ${fields.join(', ')} WHERE id = ? AND user_id = ?`,
        values,
      );

      return this.getHistoryEntry(userId, entryId);
    } catch (error) {
      logger.error('[HISTORY:SERVICE] Failed to update history entry', {
        error: (error as Error).message,
        entryId,
      });
      throw error;
    }
  }

  /**
   * Delete a history entry
   */
  async deleteHistoryEntry(userId: number, entryId: number): Promise<boolean> {
    try {
      const result = await this.db.run(
        'DELETE FROM browsing_history WHERE id = ? AND user_id = ?',
        [entryId, userId],
      );

      return (result.changes || 0) > 0;
    } catch (error) {
      logger.error('[HISTORY:SERVICE] Failed to delete history entry', {
        error: (error as Error).message,
        entryId,
      });
      throw error;
    }
  }

  /**
   * Get tag summary for a user (count per tag)
   */
  async getTagSummary(userId: number): Promise<Record<string, number>> {
    try {
      const rows = await this.db.all<{ tags: string }>(
        'SELECT tags FROM browsing_history WHERE user_id = ?',
        [userId],
      );

      const summary: Record<string, number> = {};
      for (const row of rows) {
        const tags = row.tags ? (JSON.parse(row.tags) as string[]) : [];
        for (const tag of tags) {
          const normalized = tag.toLowerCase().trim();
          if (normalized) {
            summary[normalized] = (summary[normalized] || 0) + 1;
          }
        }
      }

      return summary;
    } catch (error) {
      logger.error('[HISTORY:SERVICE] Failed to get tag summary', {
        error: (error as Error).message,
        userId,
      });
      throw error;
    }
  }

  /**
   * Get domain summary for a user (count per domain)
   */
  async getDomainSummary(userId: number): Promise<Record<string, number>> {
    try {
      const rows = await this.db.all<{ domain: string; count: number }>(
        'SELECT domain, COUNT(*) as count FROM browsing_history WHERE user_id = ? GROUP BY domain ORDER BY count DESC',
        [userId],
      );

      const summary: Record<string, number> = {};
      for (const row of rows) {
        summary[row.domain] = row.count;
      }

      return summary;
    } catch (error) {
      logger.error('[HISTORY:SERVICE] Failed to get domain summary', {
        error: (error as Error).message,
        userId,
      });
      throw error;
    }
  }
}
