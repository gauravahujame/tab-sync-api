import { Database } from 'sqlite3';
import { promisify } from 'util';
import logger from '../utils/logger.js';

export class SessionService {
  private dbRun: (sql: string, ...params: any[]) => Promise<void>;
  private dbGet: (sql: string, ...params: any[]) => Promise<any>;
  private dbAll: (sql: string, ...params: any[]) => Promise<any[]>;

  constructor(private db: Database) {
    this.dbRun = promisify(db.run.bind(db));
    this.dbGet = promisify(db.get.bind(db));
    this.dbAll = promisify(db.all.bind(db));
  }

  /**
   * Create a new session
   */
  async createSession(
    userId: number,
    instanceId: string,
    sessionData: {
      name: string;
      description?: string;
      tags?: string[];
      windows?: any[];
      totalTabs?: number;
      totalWindows?: number;
    }
  ): Promise<any> {
    const sessionId = `session-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

    logger.info('[SESSION:SERVICE] Creating session', {
      sessionId: sessionId.substring(0, 20),
      userId,
      name: sessionData.name,
    });

    try {
      await this.dbRun('BEGIN TRANSACTION');

      try {
        // Insert session
        await this.dbRun(
          `INSERT INTO sessions (
            user_id, session_id, instance_id, name, description, tags,
            captured_at, tab_count, window_count
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          userId,
          sessionId,
          instanceId,
          sessionData.name,
          sessionData.description || null,
          JSON.stringify(sessionData.tags || []),
          Date.now(),
          sessionData.totalTabs || 0,
          sessionData.totalWindows || 0
        );

        // Get the session internal ID
        const session = await this.dbGet(
          'SELECT id FROM sessions WHERE session_id = ?',
          sessionId
        );

        // Store windows and tabs if provided
        if (sessionData.windows && sessionData.windows.length > 0) {
          let windowOrder = 0;
          for (const window of sessionData.windows) {
            await this.dbRun(
              `INSERT INTO session_windows (
                session_id, window_id, focused, incognito, type, window_order
              ) VALUES (?, ?, ?, ?, ?, ?)`,
              session.id,
              window.id || windowOrder,
              window.focused ? 1 : 0,
              window.incognito ? 1 : 0,
              window.type || 'normal',
              windowOrder
            );

            const sessionWindow = await this.dbGet(
              'SELECT id FROM session_windows WHERE session_id = ? AND window_order = ?',
              session.id,
              windowOrder
            );

            // Store tabs
            if (window.tabs && window.tabs.length > 0) {
              for (const tab of window.tabs) {
                await this.dbRun(
                  `INSERT INTO session_tabs (
                    session_window_id, tab_id, url, title, tab_index,
                    active, pinned, group_id, fav_icon_url
                  ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
                  sessionWindow.id,
                  tab.id || 0,
                  tab.url,
                  tab.title || null,
                  tab.index || 0,
                  tab.active ? 1 : 0,
                  tab.pinned ? 1 : 0,
                  tab.groupId || null,
                  tab.favIconUrl || null
                );
              }
            }

            windowOrder++;
          }
        }

        await this.dbRun('COMMIT');

        logger.info('[SESSION:SERVICE] Session created successfully', {
          sessionId: sessionId.substring(0, 20),
          windowCount: sessionData.windows?.length || 0,
        });

        return {
          sessionId,
          name: sessionData.name,
          description: sessionData.description,
          tags: sessionData.tags,
          totalTabs: sessionData.totalTabs,
          totalWindows: sessionData.totalWindows,
          capturedAt: Date.now(),
        };
      } catch (error) {
        await this.dbRun('ROLLBACK');
        throw error;
      }
    } catch (error) {
      logger.error('[SESSION:SERVICE] Failed to create session', {
        error: (error as Error).message,
        sessionName: sessionData.name,
      });
      throw error;
    }
  }

  /**
   * Get session details with windows and tabs
   */
  async getSession(userId: number, sessionId: string): Promise<any> {
    logger.debug('[SESSION:SERVICE] Getting session', { sessionId, userId });

    try {
      const session = await this.dbGet(
        `SELECT * FROM sessions WHERE user_id = ? AND session_id = ?`,
        userId,
        sessionId
      );

      if (!session) {
        logger.warn('[SESSION:SERVICE] Session not found', { sessionId });
        return null;
      }

      // Get windows
      const windows = await this.dbAll(
        `SELECT * FROM session_windows WHERE session_id = ? ORDER BY window_order`,
        session.id
      );

      // Get tabs for each window
      for (const window of windows) {
        const tabs = await this.dbAll(
          `SELECT * FROM session_tabs WHERE session_window_id = ? ORDER BY tab_index`,
          window.id
        );
        window.tabs = tabs;
      }

      return {
        sessionId: session.session_id,
        name: session.name,
        description: session.description,
        tags: session.tags ? JSON.parse(session.tags) : [],
        capturedAt: session.captured_at,
        tabCount: session.tab_count,
        windowCount: session.window_count,
        windows: windows.map((w: any) => ({
          windowId: w.window_id,
          focused: Boolean(w.focused),
          incognito: Boolean(w.incognito),
          type: w.type,
          tabs: w.tabs.map((t: any) => ({
            tabId: t.tab_id,
            url: t.url,
            title: t.title,
            index: t.tab_index,
            active: Boolean(t.active),
            pinned: Boolean(t.pinned),
            groupId: t.group_id,
            favIconUrl: t.fav_icon_url,
          })),
        })),
      };
    } catch (error) {
      logger.error('[SESSION:SERVICE] Failed to get session', {
        error: (error as Error).message,
        sessionId,
      });
      throw error;
    }
  }

  /**
   * Get all sessions for a user
   */
  async listSessions(
    userId: number,
    options: { limit?: number; offset?: number } = {}
  ): Promise<any> {
    const limit = Math.min(options.limit || 50, 100);
    const offset = options.offset || 0;

    try {
      const sessions = await this.dbAll(
        `SELECT * FROM sessions WHERE user_id = ?
         ORDER BY captured_at DESC LIMIT ? OFFSET ?`,
        userId,
        limit,
        offset
      );

      return sessions.map((s: any) => ({
        sessionId: s.session_id,
        name: s.name,
        description: s.description,
        tags: s.tags ? JSON.parse(s.tags) : [],
        capturedAt: s.captured_at,
        tabCount: s.tab_count,
        windowCount: s.window_count,
      }));
    } catch (error) {
      logger.error('[SESSION:SERVICE] Failed to list sessions', {
        error: (error as Error).message,
        userId,
      });
      throw error;
    }
  }

  /**
   * Update session metadata
   */
  async updateSession(
    userId: number,
    sessionId: string,
    updates: {
      name?: string;
      description?: string;
      tags?: string[];
    }
  ): Promise<void> {
    logger.info('[SESSION:SERVICE] Updating session', { sessionId, userId });

    try {
      const fields: string[] = [];
      const values: any[] = [];

      if (updates.name !== undefined) {
        fields.push('name = ?');
        values.push(updates.name);
      }
      if (updates.description !== undefined) {
        fields.push('description = ?');
        values.push(updates.description);
      }
      if (updates.tags !== undefined) {
        fields.push('tags = ?');
        values.push(JSON.stringify(updates.tags));
      }

      if (fields.length === 0) {
        logger.warn('[SESSION:SERVICE] No fields to update');
        return;
      }

      values.push(userId, sessionId);

      await this.dbRun(
        `UPDATE sessions SET ${fields.join(', ')} WHERE user_id = ? AND session_id = ?`,
        ...values
      );

      logger.info('[SESSION:SERVICE] Session updated', { sessionId });
    } catch (error) {
      logger.error('[SESSION:SERVICE] Failed to update session', {
        error: (error as Error).message,
        sessionId,
      });
      throw error;
    }
  }

  /**
   * Delete session
   */
  async deleteSession(userId: number, sessionId: string): Promise<void> {
    logger.info('[SESSION:SERVICE] Deleting session', { sessionId, userId });

    try {
      await this.dbRun(
        `DELETE FROM sessions WHERE user_id = ? AND session_id = ?`,
        userId,
        sessionId
      );

      logger.info('[SESSION:SERVICE] Session deleted', { sessionId });
    } catch (error) {
      logger.error('[SESSION:SERVICE] Failed to delete session', {
        error: (error as Error).message,
        sessionId,
      });
      throw error;
    }
  }

  /**
   * Batch create sessions
   */
  async batchCreateSessions(
    userId: number,
    instanceId: string,
    sessions: any[]
  ): Promise<any> {
    logger.info('[SESSION:SERVICE] Batch creating sessions', {
      userId,
      count: sessions.length,
    });

    const result = {
      created: 0,
      failed: 0,
      sessionIds: [] as string[],
      errors: [] as string[],
    };

    for (const sessionData of sessions) {
      try {
        const session = await this.createSession(userId, instanceId, sessionData);
        result.sessionIds.push(session.sessionId);
        result.created++;
      } catch (error) {
        result.failed++;
        result.errors.push((error as Error).message);
        logger.error('[SESSION:SERVICE] Batch create error', {
          error: (error as Error).message,
        });
      }
    }

    logger.info('[SESSION:SERVICE] Batch create complete', {
      created: result.created,
      failed: result.failed,
    });

    return result;
  }
}
