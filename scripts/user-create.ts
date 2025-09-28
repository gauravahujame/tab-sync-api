import jwt from "jsonwebtoken";
import dotenv from "dotenv";
import path from "path";
import fs from "fs";
import { fileURLToPath } from "url";
import sqlite3 from "sqlite3";
import readline from "readline";
import { promisify } from "util";

// Load environment variables from .env file
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.resolve(__dirname, "../.env") });

// Get JWT secret from environment variables or use default for development
const JWT_SECRET =
  process.env.JWT_SECRET || "default-secret-key-change-in-production";
const DB_PATH = process.env.DATABASE_PATH || "./data/tabs.db";

// Create readline interface for user input
const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout,
});

// Simple question function
const question = (query: string) => {
  return new Promise<string>((resolve) => {
    rl.question(query, (answer) => {
      resolve(answer);
    });
  });
};

// Connect to the database
const dbDir = path.dirname(DB_PATH);
fs.mkdirSync(dbDir, { recursive: true });

const db = new sqlite3.Database(DB_PATH, (err) => {
  if (err) {
    console.error("Failed to connect to database:", err.message);
    process.exit(1);
  }
});

// Promisify database operations
const dbRun = promisify(db.run).bind(db);
const dbGet = promisify(db.get).bind(db);
// const dbAll = promisify(db.all).bind(db);

async function createUser() {
  try {
    console.log("\n🧑‍💻 User Creation Tool");
    console.log("=".repeat(50));

    // Get user information
    const name = await question("Enter your name: ");
    if (!name.trim()) {
      throw new Error("Name cannot be empty");
    }

    const email = await question("Enter your email: ");
    if (!email.trim() || !email.includes("@")) {
      throw new Error("Invalid email address");
    }

    // Optional browser name
    const browserName =
      (await question("Enter browser name (Optional): ")).trim() || null;

    // Check if user already exists
    const existingUser = await dbGet("SELECT * FROM users WHERE email = ?", [
      email,
    ]);

    if (existingUser) {
      console.log("\n⚠️  User with this email already exists!");
      const updateChoice = await question(
        "Do you want to generate a new token for this user? (y/n): ",
      );

      if (updateChoice.toLowerCase() !== "y") {
        console.log("Operation cancelled.");
        return;
      }
    }

    // Generate JWT token
    const payload = {
      id: existingUser ? existingUser.id : null, // Will be updated after user creation for new users
      name,
      email,
    };

    const token = jwt.sign(payload, JWT_SECRET, {
      expiresIn: "365d", // 1 year expiration
    });

    if (existingUser) {
      // Update existing user's token and name
      await dbRun(
        "UPDATE users SET token = ?, name = ?, browser_name = ? WHERE id = ?",
        [token, name, browserName, existingUser.id],
      );

      console.log(`\n✅ User updated with new token`);
    } else {
      // Insert new user
      await dbRun(
        "INSERT INTO users (name, email, token, browser_name) VALUES (?, ?, ?, ?)",
        [name, email, token, browserName],
      );

      // Get the newly inserted user ID
      const newUser = await dbGet("SELECT last_insert_rowid() as id");
      const userId = newUser.id;

      // Update token with correct user ID
      const updatedPayload = {
        id: userId,
        name,
        email,
      };

      const updatedToken = jwt.sign(updatedPayload, JWT_SECRET, {
        expiresIn: "365d", // 1 year expiration
      });

      // Update the token in database
      await dbRun("UPDATE users SET token = ? WHERE id = ?", [
        updatedToken,
        userId,
      ]);

      console.log(`\n✅ User created successfully with ID: ${userId}`);

      // Use the updated token for output
      console.log("\n🔑 Generated JWT Token:");
      console.log("=".repeat(50));
      console.log(updatedToken);
      console.log("=".repeat(50));

      console.log("\n🔧 Use this token in your requests:");
      console.log("=".repeat(50));
      console.log(`Authorization: Bearer ${updatedToken}`);
      console.log("=".repeat(50));
    }
  } catch (error) {
    console.error("\n❌ Error:", error.message);
  } finally {
    db.close();
    rl.close();
  }
}

createUser();
