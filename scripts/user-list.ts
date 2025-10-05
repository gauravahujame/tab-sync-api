import dotenv from "dotenv";
import path from "path";
import { fileURLToPath } from "url";
import sqlite3 from "sqlite3";
import { promisify } from "util";

// Load environment variables from .env file
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.resolve(__dirname, "../.env") });

// Get database path
const DB_PATH = process.env.DATABASE_PATH || "./data/tabs.db";

// Connect to the database
const db = new sqlite3.Database(DB_PATH, (err) => {
  if (err) {
    console.error("Failed to connect to database:", err.message);
    process.exit(1);
  }
});

// Promisify database operations
const dbAll = promisify(db.all).bind(db);

async function listUsers() {
  try {
    console.log("\n👥 User List");
    console.log("=".repeat(90));
    console.log(
      "ID  | Name                 | Email                | Browser Name      | Created At          ",
    );
    console.log("-".repeat(90));

    // Get all users
    const users = await dbAll("SELECT * FROM users ORDER BY id");

    if (users.length === 0) {
      console.log(
        "No users found. Create a user first with npm run user:create",
      );
    } else {
      users.forEach((user) => {
        const id = user.id.toString().padEnd(3);
        const name = (user.name || "").substring(0, 20).padEnd(20);
        const email = user.email.substring(0, 20).padEnd(20);
        const browserName = (user.browser_name || "unknown")
          .substring(0, 17)
          .padEnd(17);
        const createdAt = new Date(user.created_at).toLocaleString();

        console.log(
          `${id} | ${name} | ${email} | ${browserName} | ${createdAt}`,
        );
      });

      console.log("=".repeat(90));
      console.log(`Total users: ${users.length}`);
    }

    console.log("\n🔑 User Tokens:");
    console.log("=".repeat(90));

    if (users.length === 0) {
      console.log("No users found.");
    } else {
      users.forEach((user) => {
        console.log(
          `User ID: ${user.id} (${user.name}) - Browser: ${user.browser_name || "unknown"}`,
        );
        console.log("Token:");
        console.log(user.token);
        console.log("-".repeat(90));
      });
    }
  } catch (error) {
    console.error("\n❌ Error:", error.message);
  } finally {
    db.close();
  }
}

listUsers();
