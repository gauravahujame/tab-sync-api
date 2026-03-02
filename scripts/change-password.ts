import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import sqlite3 from 'sqlite3';
import { promisify } from 'util';
import bcrypt from 'bcryptjs';

// Load environment variables from .env file
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.resolve(__dirname, '../.env') });

// Get database path
const DB_PATH = process.env.DATABASE_PATH || './data/tabs.db';

// Connect to the database
const db = new sqlite3.Database(DB_PATH, err => {
  if (err) {
    console.error('Failed to connect to database:', err.message);
    process.exit(1);
  }
});

// Promisify database operations
const dbGet = promisify(db.get).bind(db) as <T>(sql: string, params: any[]) => Promise<T>;
const dbRun = promisify(db.run).bind(db) as (sql: string, params: any[]) => Promise<void>;

async function changePassword() {
  const args = process.argv.slice(2);

  if (args.length !== 2) {
    console.log('Usage: pnpm run util:change-password <email> <new-password>');
    process.exit(1);
  }

  const [email, newPassword] = args;

  if (newPassword.length < 6) {
    console.error('Password must be at least 6 characters long.');
    process.exit(1);
  }

  try {
    const user = await dbGet<{ id: number; email: string }>('SELECT id, email FROM users WHERE email = ?', [email]);

    if (!user) {
      console.error(`User with email ${email} not found.`);
      process.exit(1);
    }

    const salt = await bcrypt.genSalt(10);
    const passwordHash = await bcrypt.hash(newPassword, salt);

    await dbRun('UPDATE users SET password_hash = ? WHERE id = ?', [passwordHash, user.id]);

    console.log(`Password for user ${email} updated successfully!`);
  } catch (error: any) {
    console.error('\n❌ Error:', error.message);
  } finally {
    db.close();
  }
}

changePassword();
