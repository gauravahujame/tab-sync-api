import sqlite3 from "sqlite3";
import { promisify } from "util";
import bcrypt from "bcryptjs";
import { v4 as uuidv4 } from "uuid";
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
      const userId = uuidv4();
      const apiKey = `sk_${uuidv4().replace(/-/g, "")}`;
      const hashedPassword = await bcrypt.hash("admin123", 10);

      await dbRun(
        "INSERT INTO users (id, email, password, name, role, api_key, is_active, created_at, updated_at) " +
          "VALUES (?, ?, ?, ?, ?, ?, ?, datetime('now'), datetime('now'))",
        [
          userId,
          "admin@example.com",
          hashedPassword,
          "Admin",
          "admin",
          apiKey,
          1,
        ],
      );
      // Log the admin user details in a clearly visible format
      logger.warn("║  DEFAULT ADMIN USER CREATED:                     ");
      logger.warn("║  Email:    admin@example.com                     ");
      logger.warn("║  Password: admin123                              ");
      logger.warn(`║  API Key:  ${apiKey}                             `);
      logger.warn("╠══════════════════════════════════════════════════╣");
      logger.warn("║  IMPORTANT: Change the default credentials       ║");
      logger.warn("║  immediately after first login!                  ║");
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
