import fs from 'fs';
import jwt from 'jsonwebtoken';
import path from 'path';
import { config } from '../config.js';

export async function initializeStartup(): Promise<void> {
  try {
    console.log('📊 Starting database initialization...');

    // Ensure database directory exists
    const dbDir = path.dirname(config.database.sqlitePath);
    if (!fs.existsSync(dbDir)) {
      fs.mkdirSync(dbDir, { recursive: true });
      console.log(`✅ Created database directory: ${dbDir}`);
    }

    // Dynamically import db INSIDE the function to avoid circular dependency
    console.log('⏳ Importing database module...');
    const { getDb, schemaReady } = await import('../db.js');

    // Wait for schema to be ready
    console.log('⏳ Waiting for schema to be ready...');
    await schemaReady;
    console.log('✅ Schema is ready!');

    // Get the database adapter
    const db = getDb();

    try {
      const userCountRow = await db.get<{ count: number }>('SELECT COUNT(*) as count FROM users');
      const userCount = userCountRow?.count ?? 0;

      if (userCount === 0) {
        console.log('╔══════════════════════════════════════════════════╗');
        console.log('║               NO USERS FOUND                     ║');
        console.log('╠══════════════════════════════════════════════════╣');
        console.log('║  Auto-generating default user...                 ║');

        const name = 'Admin User';
        const email = 'admin@tabsync.local';
        const browserName = 'default-browser';

        const payload = { id: null, name, email, browserName };
        const token = jwt.sign(payload, config.jwtSecret, {
          expiresIn: '365d',
        });

        // Use dialect-aware current timestamp
        const dialect = db.getDialect();
        const timestampExpr = dialect === 'sqlite' ? "datetime('now')" : 'NOW()';

        await db.run(
          `INSERT INTO users (email, name, token, browser_name, created_at)
           VALUES (?, ?, ?, ?, ${timestampExpr})`,
          [email, name, token, browserName],
        );

        // Get last insert ID (dialect-specific)
        let userId: number;
        if (dialect === 'sqlite') {
          const newUser = await db.get<{ id: number }>('SELECT last_insert_rowid() as id');
          userId = newUser!.id;
        } else {
          const newUser = await db.get<{ id: number }>('SELECT id FROM users WHERE email = ?', [
            email,
          ]);
          userId = newUser!.id;
        }

        const updatedPayload = { id: userId, name, email, browserName };
        const updatedToken = jwt.sign(updatedPayload, config.jwtSecret, {
          expiresIn: '365d',
        });

        await db.run(`UPDATE users SET token = ? WHERE id = ?`, [updatedToken, userId]);

        console.warn('║  ✅ DEFAULT USER CREATED:                        ');
        console.log(`║  ID:       ${userId}                             `);
        console.log(`║  Email:    ${email}                              `);
        console.log(`║  Name:     ${name}                               `);
        console.log(`║  Browser:  ${browserName}                        `);
        console.log('║  🔑 JWT TOKEN:                                   ');
        console.log(`║  ${updatedToken.substring(0, 40)}...`);
        console.log('╠══════════════════════════════════════════════════╣');
        console.log('║  IMPORTANT: Use this token for authentication    ║');
        console.log('║  Add to Authorization header: Bearer <token>     ║');
        console.log('╚══════════════════════════════════════════════════╝');
      } else {
        const existingUsers = await db.all<{
          id: number;
          email: string;
          browser_name: string;
        }>('SELECT id, email, browser_name FROM users LIMIT 5');
        console.log(`✅ Found ${userCount} existing user(s)`);
        existingUsers.forEach(user => {
          console.log(
            `   User -> ID: ${user.id}, Email: ${user.email}, Browser: ${user.browser_name}`,
          );
        });
      }
    } catch (error: any) {
      if (error.message?.includes('no such table')) {
        console.log('ℹ️  Users table will be created by db module.');
      } else {
        throw error;
      }
    }

    console.log('✅ Database initialization complete.');
  } catch (error) {
    console.error('❌ Error during startup initialization:', error);
    throw error;
  }
}
