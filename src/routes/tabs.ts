import express from 'express';
import { db } from '../db.js';
import { z } from 'zod';

export const tabsRouter = express.Router();

const tabSchema = z.object({
  url: z.string().url(),
  title: z.string().optional(),
  window_id: z.number().optional(),
  session_id: z.string().optional()
});

tabsRouter.post('/', (req, res) => {
  const parseResult = tabSchema.safeParse(req.body);
  if (!parseResult.success) {
    return res.status(400).json({ error: "Invalid tab input" });
  }

  const { url, title, window_id, session_id } = parseResult.data;

  db.run(
    `INSERT OR IGNORE INTO tabs (url, title, window_id, session_id) VALUES (?, ?, ?, ?)`,
    [url, title, window_id, session_id],
    function (err) {
      if (err) return res.status(500).json({ error: "DB error" });
      res.json({ id: this.lastID });
    }
  );
});

tabsRouter.get('/', (_req, res) => {
  db.all(`SELECT * FROM tabs ORDER BY created_at DESC`, [], (err, rows) => {
    if (err) return res.status(500).json({ error: "DB error" });
    res.json(rows);
  });
});
