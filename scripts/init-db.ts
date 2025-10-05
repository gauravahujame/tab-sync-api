import sqlite3 from "sqlite3";
import { promisify } from "util";
import jwt from "jsonwebtoken";
import logger from "../src/utils/logger";
import { config } from "../src/config";

async function initializeDatabase() {
  try {
    // Create database connection
    const db = new sqlite3.Database(config.databasePath, (err) => {
      if (err) {
        logger.error("Error opening database:", err.message);
        process.exit(1);
      }
    });

    // Promisify database methods for async/await usage
    const dbAll = promisify(db.all.bind(db));
    const dbRun = promisify(db.run.bind(db));
    const dbClose = promisify(db.close.bind(db));

    // Check if users table exists and has any users
    const users = await dbAll("SELECT * FROM users LIMIT 1");

    if (users.length === 0) {
      logger.warn("╔══════════════════════════════════════════════════╗");
      logger.warn("║               NO USERS FOUND                     ║");
      logger.warn("╠══════════════════════════════════════════════════╣");

      // Create default admin user
      const name = "Admin User";
      const email = "admin@tabsync.local";
      const browserName = "default-browser";

      // Generate JWT token
      const payload = {
        id: null, // Will be updated after user creation
        name,
        email,
        browserName,
      };

      const token = jwt.sign(payload, config.jwtSecret, {
        expiresIn: "365d",
      });

      // Insert user first to get the ID
      await dbRun(
        "INSERT INTO users (email, name, token, browser_name, created_at) " +
          "VALUES (?, ?, ?, ?, datetime('now'))",
        [email, name, token, browserName],
      );

      // Get the newly inserted user ID
      const newUser = await dbAll("SELECT last_insert_rowid() as id");
      const userId = newUser[0].id;

      // Update token with correct user ID
      const updatedPayload = {
        id: userId,
        name,
        email,
        browserName,
      };

      const updatedToken = jwt.sign(updatedPayload, config.jwtSecret, {
        expiresIn: "365d",
      });

      // Update the token in database
      await dbRun("UPDATE users SET token = ? WHERE id = ?", [
        updatedToken,
        userId,
      ]);

      // Log the admin user details in a clearly visible format
      logger.warn("║  DEFAULT ADMIN USER CREATED:                     ");
      logger.warn(`║  ID:       ${userId}                             `);
      logger.warn(`║  Email:    ${email}                              `);
      logger.warn(`║  Name:     ${name}                               `);
      logger.warn(`║  Browser:  ${browserName}                        `);
      logger.warn("║                                                  ");
      logger.warn("║  🔑 JWT TOKEN:                                   ");
      logger.warn(`║  ${updatedToken.substring(0, 40)}...`);
      logger.warn("╠══════════════════════════════════════════════════╣");
      logger.warn("║  IMPORTANT: Use this token for authentication    ║");
      logger.warn("║  Add to Authorization header: Bearer <token>     ║");
      logger.warn("╚══════════════════════════════════════════════════╝");

      // Create some sample data if needed
      // await createSampleData(db);
    } else {
      logger.info("Database already initialized with users");
    }

    await dbClose();
  } catch (error) {
    logger.error("Error initializing database:", error);
    process.exit(1);
  }
}

// Uncomment and implement if you want to add sample data
// async function createSampleData(db) {
//   // Add your sample data creation logic here
// }

// Run the initialization
if (require.main === module) {
  initializeDatabase().catch(console.error);
}

export { initializeDatabase };
