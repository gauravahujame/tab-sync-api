import express from 'express';
import type { Request, Response, NextFunction } from 'express';

import { db } from '../db.ts';

const router = express.Router();

router.post('/batch', (req: Request, res: Response, next: NextFunction) => {
  const { tabs } = req.body;
  if (!Array.isArray(tabs)) {
    return res.status(400).json({ success: false, error: "Missing or invalid 'tabs' array" });
  }

  const stats = {
    total: tabs.length,
    stored: 0,
    duplicates: 0,
    failed: 0
  };
  const errors: { index: number; url: string; error: string }[] = [];

  let completed = 0;

  tabs.forEach((tab, i) => {
    db.run(
      `
      INSERT INTO tabs (url, title, window_id, session_id, opened_at)
      VALUES (?, ?, ?, ?, ?)
      `,
      [tab.url, tab.title, tab.windowId, tab.sessionId, tab.openedAt],
      function (err) {
        if (err) {
          if ('code' in err && (err as any).code === 'SQLITE_CONSTRAINT') {
            stats.duplicates++;
          } else {
            stats.failed++;
            errors.push({ index: i, url: tab.url, error: err.message });
          }
        } else {
          stats.stored++;
        }
        completed++;
        // Send response only after all inserts are done
        if (completed === tabs.length) {
          res.json({
            success: stats.failed === 0,
            stats,
            ...(errors.length ? { errors } : {})
          });
        }
      }
    );
  });

  // Handle empty batch immediately
  if (tabs.length === 0) {
    res.json({ success: true, stats });
  }
});

router.get('/', (req: Request, res: Response) => {
  // Validate and parse pagination
  const page = parseInt(req.query.page as string, 10) || 1;
  const pageSize = Math.min(parseInt(req.query.pageSize as string, 10) || 20, 100);

  if (page <= 0 || isNaN(page)) {
    return res.status(400).json({ success: false, error: 'Invalid "page" parameter.' });
  }
  if (pageSize <= 0 || isNaN(pageSize) || pageSize > 100) {
    return res.status(400).json({ success: false, error: 'Invalid "pageSize". Must be between 1 and 100.' });
  }

  // Validate filters
  let windowId: number | undefined;
  if (typeof req.query.windowId === 'string') {
    windowId = parseInt(req.query.windowId, 10);
    if (isNaN(windowId)) {
      return res.status(400).json({ success: false, error: 'Invalid "windowId". Must be a number.' });
    }
  }
  let sessionId: string | undefined;
  if (typeof req.query.sessionId === 'string') {
    sessionId = req.query.sessionId;
    if (!sessionId) {
      return res.status(400).json({ success: false, error: 'Invalid "sessionId". Must be a non-empty string.' });
    }
  }

  // Construct query and parameters
  let sql = `SELECT * FROM tabs WHERE deleted_at IS NULL`;
  const queryParams: any[] = [];

  if (typeof windowId === 'number') {
    sql += ` AND window_id = ?`;
    queryParams.push(windowId);
  }
  if (typeof sessionId === 'string') {
    sql += ` AND session_id = ?`;
    queryParams.push(sessionId);
  }

  sql += ` ORDER BY opened_at DESC LIMIT ? OFFSET ?`;
  queryParams.push(pageSize, pageSize * (page - 1));

  db.all(sql, queryParams, (err, rows) => {
    if (err) return res.status(500).json({ success: false, error: err.message });
    res.json({
      success: true,
      page,
      pageSize,
      count: rows.length,
      tabs: rows
    });
  });
});

/**
 * GET /api/v1/tabs/:id
 */
router.get('/:id', (req: Request, res: Response) => {
  const id = parseInt(req.params.id, 10);
  if (isNaN(id) || id <= 0) {
    return res.status(400).json({ success: false, error: 'Invalid "id". Must be a positive integer.' });
  }

  db.get(
    `SELECT * FROM tabs WHERE id = ? AND deleted_at IS NULL`,
    [id],
    (err, row) => {
      if (err) return res.status(500).json({ success: false, error: err.message });
      if (!row) return res.status(404).json({ success: false, error: 'Tab not found.' });
      res.json({ success: true, tab: row });
    }
  );
});

export default router;