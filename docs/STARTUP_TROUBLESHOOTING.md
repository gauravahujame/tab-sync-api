# Startup Troubleshooting Guide

## Quick Fix

**Your .env file has inline comments which can cause parsing issues.** Update it to:

```bash
PORT=3000
DATABASE_PATH=./data/tabs.db
JWT_SECRET=HelloWorld@123
RATE_LIMIT_WINDOW_MS=60000
RATE_LIMIT_MAX_REQUESTS=60
```

Remove the `# 1 minute` and `# 60 requests per minute` inline comments!

## Expected Startup Output

When you run `pnpm run db:clean && pnpm run dev`, you should see:

```
> tab-sync-api@1.0.0 db:clean
> rm -rf data/tabs.db data/logs

> tab-sync-api@1.0.0 dev
> NODE_ENV=development tsx watch src/index.ts

[dotenv@17.2.2] injecting env (5) from .env
🚀 Starting Tab Sync API server...
🔌 Connecting to database...
✅ Database connected successfully
📋 Creating database tables...
✅ All tables created, schema is ready!
📊 Starting database initialization...
✅ Created database directory: ./data
📁 Database file does not exist. Creating new database...
⏳ Importing database module...
⏳ Waiting for schema to be ready...
✅ Schema is ready!
2025-10-05 XX:XX:XX warn: ╔══════════════════════════════════════════════════╗
2025-10-05 XX:XX:XX warn: ║               NO USERS FOUND                     ║
2025-10-05 XX:XX:XX warn: ╠══════════════════════════════════════════════════╣
2025-10-05 XX:XX:XX warn: ║  Auto-generating default user...                 ║
2025-10-05 XX:XX:XX warn: ║                                                  
2025-10-05 XX:XX:XX warn: ║  ✅ DEFAULT USER CREATED:                        
2025-10-05 XX:XX:XX warn: ║  ID:       1                             
2025-10-05 XX:XX:XX warn: ║  Email:    admin@tabsync.local                              
2025-10-05 XX:XX:XX warn: ║  Name:     Admin User                               
2025-10-05 XX:XX:XX warn: ║  Browser:  default-browser                        
2025-10-05 XX:XX:XX warn: ║                                                  
2025-10-05 XX:XX:XX warn: ║  🔑 JWT TOKEN:                                   
2025-10-05 XX:XX:XX warn: ║  eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
2025-10-05 XX:XX:XX warn: ║                                                  
2025-10-05 XX:XX:XX warn: ╠══════════════════════════════════════════════════╣
2025-10-05 XX:XX:XX warn: ║  IMPORTANT: Use this token for authentication    ║
2025-10-05 XX:XX:XX warn: ║  Add to Authorization header: Bearer <token>     ║
2025-10-05 XX:XX:XX warn: ╚══════════════════════════════════════════════════╝
2025-10-05 XX:XX:XX info: Database initialization complete.
2025-10-05 XX:XX:XX info: Server is running in development mode on 0.0.0.0:3000
2025-10-05 XX:XX:XX info: Accessible locally at http://localhost:3000
2025-10-05 XX:XX:XX info: Log level: info
2025-10-05 XX:XX:XX info: Logs directory: /Users/gaurav/workspace/tab-sync-api/data/logs
```

## Debugging Steps

If the server hangs, check which console.log message you see last:

1. **Hangs at "Connecting to database..."**
   - Check DATABASE_PATH in .env
   - Ensure data directory is writable
   - Run: `mkdir -p data && ls -la data`

2. **Hangs at "Creating database tables..."**
   - SQLite3 might be having issues
   - Check: `npm list sqlite3`
   - Reinstall: `pnpm install --force`

3. **Hangs at "Waiting for schema to be ready..."**
   - The callback chain in db.ts isn't completing
   - Check for errors in `data/logs/error-*.log`

4. **No output at all**
   - TypeScript compilation error
   - Run: `pnpm run typecheck`
   - Check: `pnpm run build`

## Common Issues

### Issue: Inline comments in .env

**Symptom:** Environment variables not parsed correctly

**Fix:** Remove inline comments:
```bash
# Wrong
RATE_LIMIT_WINDOW_MS=60000  # 1 minute

# Correct
RATE_LIMIT_WINDOW_MS=60000
```

### Issue: Missing data directory

**Symptom:** "ENOENT: no such file or directory"

**Fix:**
```bash
mkdir -p data
pnpm run dev
```

### Issue: Port already in use

**Symptom:** "EADDRINUSE: address already in use"

**Fix:**
```bash
# Find process on port 3000
lsof -ti:3000

# Kill it
kill -9 $(lsof -ti:3000)

# Or change PORT in .env
PORT=3001
```

### Issue: SQLite3 native binding error

**Symptom:** "Error: Cannot find module '...sqlite3.node'"

**Fix:**
```bash
# Rebuild native modules
pnpm rebuild sqlite3

# Or reinstall
rm -rf node_modules pnpm-lock.yaml
pnpm install
```

## Production Mode

For production, run:

```bash
pnpm run build
pnpm start
```

Expected output:
```
> tab-sync-api@1.0.0 prestart
> npm run build

> tab-sync-api@1.0.0 build
> tsc --project tsconfig.build.json

> tab-sync-api@1.0.0 start
> node dist/index.js

🚀 Starting Tab Sync API server...
[Same initialization logs as dev mode]
```

## Docker Mode

### Development with hot reload:

```bash
docker compose -f docker-compose.dev.yml up --build
```

### Production:

```bash
docker compose up --build -d
docker compose logs -f
```

## Health Check

Once the server is running, test it:

```bash
# Health check
curl http://localhost:3000/api/v1/health

# Should return: {"status":"ok"}
```

## Logs Location

- **Console:** Real-time output
- **Files:** `./data/logs/`
  - `application-YYYY-MM-DD.log` - All logs
  - `error-YYYY-MM-DD.log` - Errors only
  - `exceptions-YYYY-MM-DD.log` - Uncaught exceptions
  - `rejections-YYYY-MM-DD.log` - Unhandled promise rejections

## Quick Reset

If everything is broken:

```bash
# Nuclear option - clean and restart
pnpm run db:clean
rm -rf node_modules pnpm-lock.yaml
pnpm install
pnpm run dev
```

## Getting Help

1. Check logs in `./data/logs/`
2. Run `pnpm run typecheck` for TS errors
3. Enable debug logging: `LOG_LEVEL=debug` in .env
4. Check this guide for common issues
