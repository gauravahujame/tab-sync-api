import express from "express";
import type { AuthRequest } from "../middlewares/auth.js";
import { db } from "../db.js";
import { z } from "zod";
import logger from "../utils/logger.js";

export const tabsRouter = express.Router();

// Schema for a single tab
const tabSchema = z.object({
  tabId: z.number().optional(),
  url: z.string().url({ message: "Must be a valid URL" }),
  title: z.string().optional(),
  windowId: z.number().min(0, { message: "Window ID is required" }).default(0),
  openerTabId: z.number().nullable().default(null),
  lastAccessed: z.number().optional(),
  incognito: z.boolean().default(false),
  groupId: z.number().default(-1),
  browserName: z.string().optional(),
});

// Schema for batch tab request
const batchTabsSchema = z.object({
  tabs: z
    .array(tabSchema)
    .min(1, { message: "At least one tab must be provided" })
    .max(5000, { message: "Maximum 5000 tabs per batch allowed" }),
});

// Legacy route for single tab insertion (backward compatibility)
tabsRouter.post("/", (req: AuthRequest, res, next) => {
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
      openerTabId,
      lastAccessed,
      incognito,
      groupId,
      browserName,
    } = parseResult.data;

    // Check if user exists in the request (from auth middleware)
    if (!req.user || !req.user.id) {
      return res.status(401).json({
        error: "User authentication required",
      });
    }

    const userId = req.user.id;

    db.run(
      `INSERT INTO tabs (client_tab_id, url, title, window_id, opener_tab_id, last_accessed, incognito, group_id, browser_name, user_id) 
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        tabId || null,
        url,
        title || null,
        windowId,
        openerTabId ?? null, // Use null coalescing to handle undefined/undefined
        lastAccessed ?? null,
        incognito ? 1 : 0,
        groupId,
        browserName || null,
        userId,
      ],
      function (err) {
        if (err) {
          logger.error("Error inserting tab:", {
            error: err.message,
            tab: parseResult.data,
          });
          return next(err);
        }

        res.json({
          success: true,
          id: this.lastID || null,
        });
      },
    );
  } catch (error) {
    next(error);
  }
});

// New batch tabs endpoint
tabsRouter.post("/batch", (req: AuthRequest, res, next) => {
  try {
    const parseResult = batchTabsSchema.safeParse(req.body);

    if (!parseResult.success) {
      return res.status(400).json({
        success: false,
        error: "Invalid batch request",
        details: parseResult.error.format(),
      });
    }

    const { tabs } = parseResult.data;
    const userId = req.user?.id;

    if (!userId) {
      return res.status(401).json({
        success: false,
        error: "User authentication required",
      });
    }

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

    db.serialize(async () => {
      db.run("BEGIN TRANSACTION");

      const insertStmt = db.prepare(
        `INSERT INTO tabs (
          client_tab_id, url, title, window_id, 
          opener_tab_id, last_accessed, incognito, group_id, browser_name, user_id
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      );

      // Prepare statement to find existing tabs
      const findExistingTabStmt = db.prepare(
        `SELECT id, window_id, url, last_accessed 
         FROM tabs 
         WHERE url = ? AND window_id = ? AND client_tab_id = ? AND user_id = ? AND (browser_name = ? OR (browser_name IS NULL AND ? IS NULL))
         LIMIT 1`,
      );

      let completed = 0;
      const totalTabs = tabs.length;

      const checkCompletion = () => {
        completed++;
        if (completed === totalTabs) {
          db.run("COMMIT", (commitErr: Error | null) => {
            // Finalize statements before sending response
            insertStmt.finalize((finalizeErr1) => {
              if (finalizeErr1) {
                logger.error(
                  "Error finalizing insert statement:",
                  finalizeErr1,
                );
              }

              findExistingTabStmt.finalize((finalizeErr2) => {
                if (finalizeErr2) {
                  logger.error(
                    "Error finalizing find statement:",
                    finalizeErr2,
                  );
                }

                if (commitErr) {
                  return db.run("ROLLBACK", () => {
                    logger.error("Error committing transaction:", commitErr);
                    next(commitErr);
                  });
                }

                const response = {
                  success: stats.errors === 0,
                  stats,
                  ...(storedItems.length > 0 && { storedItems }),
                  ...(failedItems.length > 0 && { failedItems }),
                  ...(duplicateItems.length > 0 && { duplicateItems }),
                };

                res.json(response);
              });
            });
          });
        }
      };

      if (tabs.length === 0) {
        return res.json({
          success: true,
          stats,
          message: "No tabs to insert",
        });
      }

      const processTab = async (tab: any, index: number) => {
        try {
          const {
            tabId,
            url,
            title,
            windowId,
            openerTabId,
            lastAccessed,
            incognito = false,
            groupId = -1,
            browserName = null,
          } = tab;

          // First, check if the tab already exists for the same browser
          findExistingTabStmt.get(
            [url, windowId, tabId || null, userId, browserName, browserName],
            (err: Error | null, existingTab: any) => {
              if (err) {
                stats.errors++;
                failedItems.push({
                  index,
                  tabId: tabId || null,
                  windowId,
                  url,
                  lastAccessed: lastAccessed ?? null,
                  reason: `Error checking for existing tab: ${err.message}`,
                });
                logger.error("Error checking for existing tab:", {
                  error: err.message,
                  tab,
                });
                return checkCompletion();
              }

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
                return checkCompletion();
              }

              // Tab doesn't exist, insert it
              insertStmt.run(
                tabId || null,
                url,
                title || null,
                windowId,
                openerTabId ?? null,
                lastAccessed ?? null,
                incognito ? 1 : 0,
                groupId,
                browserName,
                userId,
                function (this: { changes: number }, insertErr: Error | null) {
                  if (insertErr) {
                    stats.errors++;
                    failedItems.push({
                      index,
                      tabId: tabId || null,
                      windowId,
                      url,
                      lastAccessed: lastAccessed ?? null,
                      reason: insertErr.message,
                    });
                    logger.error("Error inserting tab:", {
                      error: insertErr.message,
                      tab,
                    });
                  } else if (this.changes > 0) {
                    stats.stored++;
                    storedItems.push({
                      index,
                      tabId: tabId || null,
                      windowId,
                      url,
                      lastAccessed: lastAccessed ?? null,
                    });
                  } else {
                    // This case shouldn't happen since we checked for existence
                    stats.duplicates++;
                  }
                  checkCompletion();
                },
              );
            },
          );
        } catch (error) {
          stats.errors++;
          failedItems.push({
            index,
            tabId: tab.tabId || null,
            windowId: tab.windowId,
            url: tab.url || "unknown",
            lastAccessed: tab.lastAccessed ?? null,
            reason: error instanceof Error ? error.message : "Unknown error",
          });
          logger.error("Unexpected error processing tab:", { error, tab });
          checkCompletion();
        }
      };

      // Process all tabs
      tabs.forEach(processTab);

      // Note: Statements will be finalized in the checkCompletion function
      // after all operations are complete
    });
  } catch (error) {
    next(error);
  }
});

// Get all tabs for the authenticated user
tabsRouter.get("/", (req: AuthRequest, res, next) => {
  // Check if user exists in the request (from auth middleware)
  if (!req.user || !req.user.id) {
    return res.status(401).json({
      success: false,
      error: "User authentication required",
    });
  }

  const userId = req.user.id;

  const query = `
    SELECT
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
    ORDER BY created_at DESC
  `;

  db.all(query, [userId], (err, rows) => {
    if (err) {
      logger.error("Error retrieving tabs:", err.message);
      return next(err);
    }
    res.json(rows);
  });
});
