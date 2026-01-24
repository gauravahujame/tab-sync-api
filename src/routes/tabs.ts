import express from "express";
import { z } from "zod";
import { getDb } from "../db.js";
import type { AuthRequest } from "../types/index.js";
import logger from "../utils/logger.js";

export const tabsRouter = express.Router();

// Schema for mutedInfo object
const mutedInfoSchema = z
  .object({
    muted: z.boolean(),
    reason: z.enum(["user", "capture", "extension"]).optional(),
    extensionId: z.string().optional(),
  })
  .optional();

// Schema for a single tab with all Chrome Tab API fields
const tabSchema = z.object({
  tabId: z.number().optional(),
  url: z.string().url({ message: "Must be a valid URL" }),
  title: z.string().optional(),
  windowId: z.number().min(0, { message: "Window ID is required" }).default(0),
  index: z.number().optional(),
  active: z.boolean().optional(),
  highlighted: z.boolean().optional(),
  pinned: z.boolean().optional(),
  audible: z.boolean().optional(),
  mutedInfo: mutedInfoSchema,
  discarded: z.boolean().optional(),
  autoDiscardable: z.boolean().optional(),
  frozen: z.boolean().optional(),
  groupId: z.number().default(-1),
  incognito: z.boolean().default(false),
  favIconUrl: z.string().optional(),
  pendingUrl: z.string().optional(),
  openerTabId: z.number().nullable().default(null),
  sessionId: z.string().optional(),
  lastAccessed: z.number().optional(),
  status: z.enum(["unloaded", "loading", "complete"]).optional(),
  width: z.number().optional(),
  height: z.number().optional(),
  browserName: z.string().optional(),
});

// Schema for batch tab request
const batchTabsSchema = z.object({
  tabs: z
    .array(tabSchema)
    .min(1, { message: "At least one tab must be provided" })
    .max(5000, { message: "Maximum 5000 tabs per batch allowed" }),
});

/**
 * Check if an error is a unique constraint violation
 */
function isUniqueConstraintError(error: Error): boolean {
  const message = error.message.toLowerCase();
  return (
    message.includes('sqlite_constraint') && message.includes('unique') ||
    message.includes('unique constraint') ||
    message.includes('duplicate key')
  );
}

// Legacy route for single tab insertion (backward compatibility)
tabsRouter.post("/", async (req: AuthRequest, res, next) => {
  try {
    const parseResult = tabSchema.safeParse(req.body);

    if (!parseResult.success) {
      return res.status(400).json({
        success: false,
        error: "Invalid tab input",
        details: parseResult.error.format(),
      });
    }

    const {
      tabId,
      url,
      title,
      windowId,
      index,
      active,
      highlighted,
      pinned,
      audible,
      mutedInfo,
      discarded,
      autoDiscardable,
      frozen,
      groupId,
      incognito,
      favIconUrl,
      pendingUrl,
      openerTabId,
      sessionId,
      lastAccessed,
      status,
      width,
      height,
      browserName,
    } = parseResult.data;

    // Check if user exists in the request (from auth middleware)
    if (!req.user || !req.user.id) {
      return res.status(401).json({
        error: "User authentication required",
      });
    }

    const userId = req.user.id;
    const db = getDb();

    try {
      const result = await db.run(
        `INSERT INTO tabs (
          client_tab_id, url, title, window_id, tab_index, active, highlighted, pinned,
          audible, muted_info, discarded, auto_discardable, frozen, group_id, incognito,
          fav_icon_url, pending_url, opener_tab_id, session_id, last_accessed, status,
          width, height, browser_name, user_id
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          tabId || null,
          url,
          title || null,
          windowId,
          index ?? null,
          active ? 1 : 0,
          highlighted ? 1 : 0,
          pinned ? 1 : 0,
          audible ? 1 : 0,
          mutedInfo ? JSON.stringify(mutedInfo) : null,
          discarded ? 1 : 0,
          autoDiscardable !== undefined ? (autoDiscardable ? 1 : 0) : 1,
          frozen ? 1 : 0,
          groupId,
          incognito ? 1 : 0,
          favIconUrl || null,
          pendingUrl || null,
          openerTabId ?? null,
          sessionId || null,
          lastAccessed ?? null,
          status || null,
          width ?? null,
          height ?? null,
          browserName || null,
          userId,
        ],
      );

      res.status(201).json({
        success: true,
        id: result.lastID || null,
      });
    } catch (err) {
      // Handle duplicate constraint errors gracefully
      if (isUniqueConstraintError(err as Error)) {
        logger.debug("Duplicate tab detected, skipping insert:", {
          url,
          windowId,
          tabId: tabId || null,
        });
        return res.json({
          success: true,
          duplicate: true,
          message: "Tab already exists",
        });
      }

      logger.error("Error inserting tab:", {
        error: (err as Error).message,
        tab: parseResult.data,
      });
      return next(err);
    }
  } catch (error) {
    next(error);
  }
});

// New batch tabs endpoint
tabsRouter.post("/batch", async (req: AuthRequest, res, next) => {
  try {
    // Filter out empty objects and objects without required fields before validation
    const filteredBody = {
      ...req.body,
      tabs: Array.isArray(req.body.tabs)
        ? req.body.tabs.filter((tab: any) => {
            // Filter out empty objects or objects without url
            return (
              tab &&
              typeof tab === "object" &&
              Object.keys(tab).length > 0 &&
              tab.url
            );
          })
        : req.body.tabs,
    };

    // If all tabs were filtered out, return success with empty result
    if (!filteredBody.tabs || filteredBody.tabs.length === 0) {
      return res.json({
        success: true,
        stats: {
          total: 0,
          stored: 0,
          duplicates: 0,
          errors: 0,
        },
        message: 'No valid tabs to process',
      });
    }

    const parseResult = batchTabsSchema.safeParse(filteredBody);

    if (!parseResult.success) {
      return res.status(400).json({
        success: false,
        error: 'Invalid batch request',
        details: parseResult.error.format(),
      });
    }

    const { tabs } = parseResult.data;
    const userId = req.user?.id;

    if (!userId) {
      return res.status(401).json({
        success: false,
        error: 'User authentication required',
      });
    }

    const db = getDb();
    const stats = {
      total: tabs.length,
      stored: 0,
      duplicates: 0,
      errors: 0,
    };

    const failedItems: Array<{
      index: number;
      tabId?: number | null;
      windowId: number;
      url: string;
      lastAccessed?: number | null;
      reason: string;
    }> = [];

    const duplicateItems: Array<{
      index: number;
      existingTabId: number;
      existingWindowId: number;
      url: string;
      lastAccessed: number | null;
    }> = [];

    const storedItems: Array<{
      index: number;
      tabId: number | null;
      windowId: number;
      url: string;
      lastAccessed: number | null;
    }> = [];

    // Process tabs with transaction
    try {
      await db.beginTransaction();

      for (let index = 0; index < tabs.length; index++) {
        const tab = tabs[index];
        const {
          tabId,
          url,
          title,
          windowId,
          index: tabIndex,
          active,
          highlighted,
          pinned,
          audible,
          mutedInfo,
          discarded,
          autoDiscardable,
          frozen,
          groupId = -1,
          incognito = false,
          favIconUrl,
          pendingUrl,
          openerTabId,
          sessionId,
          lastAccessed,
          status,
          width,
          height,
          browserName = null,
        } = tab;

        try {
          // Check for existing tab
          const existingTab = await db.get<{ id: number; window_id: number; url: string; last_accessed: number | null }>(
            `SELECT id, window_id, url, last_accessed
             FROM tabs
             WHERE url = ? AND window_id = ? AND client_tab_id = ? AND user_id = ? AND (browser_name = ? OR (browser_name IS NULL AND ? IS NULL))
             LIMIT 1`,
            [url, windowId, tabId || null, userId, browserName, browserName],
          );

          if (existingTab) {
            // Tab already exists, add to duplicates
            stats.duplicates++;
            duplicateItems.push({
              index,
              existingTabId: existingTab.id,
              existingWindowId: existingTab.window_id,
              url: existingTab.url,
              lastAccessed: existingTab.last_accessed,
            });
            continue;
          }

          // Insert new tab
          await db.run(
            `INSERT INTO tabs (
              client_tab_id, url, title, window_id, tab_index, active, highlighted, pinned,
              audible, muted_info, discarded, auto_discardable, frozen, group_id, incognito,
              fav_icon_url, pending_url, opener_tab_id, session_id, last_accessed, status,
              width, height, browser_name, user_id
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            [
              tabId || null,
              url,
              title || null,
              windowId,
              tabIndex ?? null,
              active ? 1 : 0,
              highlighted ? 1 : 0,
              pinned ? 1 : 0,
              audible ? 1 : 0,
              mutedInfo ? JSON.stringify(mutedInfo) : null,
              discarded ? 1 : 0,
              autoDiscardable !== undefined ? (autoDiscardable ? 1 : 0) : 1,
              frozen ? 1 : 0,
              groupId,
              incognito ? 1 : 0,
              favIconUrl || null,
              pendingUrl || null,
              openerTabId ?? null,
              sessionId || null,
              lastAccessed ?? null,
              status || null,
              width ?? null,
              height ?? null,
              browserName,
              userId,
            ],
          );

          stats.stored++;
          storedItems.push({
            index,
            tabId: tabId || null,
            windowId,
            url,
            lastAccessed: lastAccessed ?? null,
          });
        } catch (error) {
          stats.errors++;
          failedItems.push({
            index,
            tabId: tabId || null,
            windowId,
            url,
            lastAccessed: lastAccessed ?? null,
            reason: (error as Error).message,
          });
          logger.error("Error inserting tab:", {
            error: (error as Error).message,
            tab,
          });
        }
      }

      await db.commit();
    } catch (error) {
      await db.rollback();
      logger.error("Error committing transaction:", error);
      return next(error);
    }

    const response = {
      success: stats.errors === 0,
      stats,
      ...(storedItems.length > 0 && { storedItems }),
      ...(failedItems.length > 0 && { failedItems }),
      ...(duplicateItems.length > 0 && { duplicateItems }),
    };

    res.json(response);
  } catch (error) {
    next(error);
  }
});

// Get all tabs for the authenticated user
tabsRouter.get("/", async (req: AuthRequest, res, next) => {
  // Check if user exists in the request (from auth middleware)
  if (!req.user || !req.user.id) {
    return res.status(401).json({
      success: false,
      error: "User authentication required",
    });
  }

  const userId = req.user.id;
  const db = getDb();

  try {
    const rows = await db.all(
      `SELECT
        id,
        client_tab_id as tabId,
        url,
        title,
        window_id as windowId,
        opener_tab_id as openerTabId,
        last_accessed as lastAccessed,
        incognito,
        group_id as groupId,
        browser_name as browserName,
        created_at as createdAt
      FROM tabs
      WHERE user_id = ?
      ORDER BY created_at DESC`,
      [userId],
    );

    res.json(rows);
  } catch (err) {
    logger.error("Error retrieving tabs:", (err as Error).message);
    return next(err);
  }
});
