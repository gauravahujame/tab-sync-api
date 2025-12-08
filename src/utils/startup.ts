import fs from "fs";
import jwt from "jsonwebtoken";
import path from "path";
import { config } from "../config.js";

export async function initializeStartup(): Promise<void> {
  try {
    console.log("📊 Starting database initialization...");

    // Ensure database directory exists
    const dbDir = path.dirname(config.databasePath);
    if (!fs.existsSync(dbDir)) {
      fs.mkdirSync(dbDir, { recursive: true });
      console.log(`✅ Created database directory: ${dbDir}`);
    }

    // Dynamically import db INSIDE the function to avoid circular dependency
    console.log("⏳ Importing database module...");
    const { db, schemaReady } = await import("../db.js");

    // Wait for schema to be ready
    console.log("⏳ Waiting for schema to be ready...");
    await schemaReady;
    console.log("✅ Schema is ready!");

    // Run sync migrations
    console.log("⏳ Running sync migrations...");
    const { runSyncMigrations, verifySyncTables } = await import("../db/migrations.js");
    await runSyncMigrations(db);
    const syncTablesOk = await verifySyncTables(db);
    if (syncTablesOk) {
      console.log("✅ Sync migrations verified successfully");
    } else {
      console.warn("⚠️  Some sync tables may be missing");
    }

    // Helper functions for database operations
    const run = (sql: string, params: unknown[] = []) =>
      new Promise<void>((resolve, reject) => {
        db.run(sql, params, (err: Error | null) => {
          if (err) reject(err);
          else resolve();
        });
      });

    const get = <T = any>(sql: string, params: unknown[] = []) =>
      new Promise<T | undefined>((resolve, reject) => {
        db.get(sql, params, (err: Error | null, row: T) => {
          if (err) reject(err);
          else resolve(row);
        });
      });

    const all = <T = any>(sql: string, params: unknown[] = []) =>
      new Promise<T[]>((resolve, reject) => {
        db.all(sql, params, (err: Error | null, rows: T[]) => {
          if (err) reject(err);
          else resolve(rows);
        });
      });

    try {
      const userCountRow = await get<{ count: number }>(
        "SELECT COUNT(*) as count FROM users",
      );
      const userCount = userCountRow?.count ?? 0;

      if (userCount === 0) {
        console.log("╔══════════════════════════════════════════════════╗");
        console.log("║               NO USERS FOUND                     ║");
        console.log("╠══════════════════════════════════════════════════╣");
        console.log("║  Auto-generating default user...                 ║");

        const name = "Admin User";
        const email = "admin@tabsync.local";
        const browserName = "default-browser";

        const payload = { id: null, name, email, browserName };
        const token = jwt.sign(payload, config.jwtSecret, {
          expiresIn: "365d",
        });

        await run(
          `INSERT INTO users (email, name, token, browser_name, created_at)
           VALUES (?, ?, ?, ?, datetime('now'))`,
          [email, name, token, browserName],
        );

        const newUser = await get<{ id: number }>(
          "SELECT last_insert_rowid() as id",
        );
        const userId = newUser!.id;

        const updatedPayload = { id: userId, name, email, browserName };
        const updatedToken = jwt.sign(updatedPayload, config.jwtSecret, {
          expiresIn: "365d",
        });

        await run(`UPDATE users SET token = ? WHERE id = ?`, [
          updatedToken,
          userId,
        ]);

        console.warn("║  ✅ DEFAULT USER CREATED:                        ");
        console.log(`║  ID:       ${userId}                             `);
        console.log(`║  Email:    ${email}                              `);
        console.log(`║  Name:     ${name}                               `);
        console.log(`║  Browser:  ${browserName}                        `);
        console.log("║  🔑 JWT TOKEN:                                   ");
        console.log(`║  ${updatedToken.substring(0, 40)}...`);
        console.log("╠══════════════════════════════════════════════════╣");
        console.log("║  IMPORTANT: Use this token for authentication    ║");
        console.log("║  Add to Authorization header: Bearer <token>     ║");
        console.log("╚══════════════════════════════════════════════════╝");
      } else {
        const existingUsers = await all<{
          id: number;
          email: string;
          browser_name: string;
        }>("SELECT id, email, browser_name FROM users LIMIT 5");
        console.log(`✅ Found ${userCount} existing user(s)`);
        existingUsers.forEach((user) => {
          console.log(
            `   User -> ID: ${user.id}, Email: ${user.email}, Browser: ${user.browser_name}`,
          );
        });
      }
    } catch (error: any) {
      if (error.message?.includes("no such table")) {
        console.log("ℹ️  Users table will be created by db module.");
      } else {
        throw error;
      }
    }

    console.log("✅ Database initialization complete.");
  } catch (error) {
    console.error("❌ Error during startup initialization:", error);
    throw error;
  }
}
