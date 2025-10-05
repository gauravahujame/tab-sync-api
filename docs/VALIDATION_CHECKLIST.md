# Validation Checklist - Script Updates

## Pre-Flight Check

Before testing, ensure you have:
- [x] Node.js 24+ installed
- [x] All dependencies installed (`npm install`)
- [x] `.env` file configured (or using defaults)

## Test Scenarios

### 1. Clean Database Startup (Fresh Install)

**Steps:**
```bash
# Clean everything
npm run db:clean

# Start dev server
npm run dev
```

**Expected Results:**
- ✅ Console shows: "Starting database initialization..."
- ✅ Console shows: "Database file does not exist. Creating new database..."
- ✅ Console shows: "NO USERS FOUND" box
- ✅ Console shows: "✅ DEFAULT USER CREATED" with credentials
- ✅ Console displays JWT token (truncated)
- ✅ Console shows: "Database initialization complete."
- ✅ Then Express server starts: "Server is running in development mode on port 3000"

**Critical:**
- User credentials appear BEFORE "Server is running" message
- browser_name is set to "default-browser"
- JWT token is visible

---

### 2. Existing Database Startup

**Steps:**
```bash
# With existing database
npm run dev
```

**Expected Results:**
- ✅ Console shows: "Database file exists. Checking for users..."
- ✅ Console shows: "Database initialized with X existing user(s)"
- ✅ No user creation box appears
- ✅ Express server starts normally

---

### 3. User Creation Script

**Steps:**
```bash
npm run user:create
```

**Expected Results:**
- ✅ Prompts: "Enter your name:"
- ✅ Prompts: "Enter your email:"
- ✅ Prompts: "Enter browser name:" (or shows existing browser_name)
- ✅ Creates user successfully
- ✅ Shows generated JWT token

**Test Cases:**
- New user creation
- Updating existing user (regenerate token)
- Browser name defaults to existing value on update

---

### 4. User Listing Script

**Steps:**
```bash
npm run user:list
```

**Expected Results:**
- ✅ Table header includes "Browser Name" column
- ✅ All users display with their browser names
- ✅ Token section shows: "User ID: X (Name) - Browser: browser_name"
- ✅ Displays full JWT tokens for each user

**Verify:**
- browser_name column is properly aligned
- No "undefined" or "null" values for browser_name

---

### 5. Token Generation Script

**Steps:**
```bash
npm run token:generate -- my-chrome-browser 123 test@example.com "Test User"
```

**Expected Results:**
- ✅ Generates JWT token successfully
- ✅ Token payload includes browserName
- ✅ Displays token details with browser name

**Test Different Inputs:**
```bash
# Minimal (browser name only)
npm run token:generate -- firefox

# Full details
npm run token:generate -- brave 456 user@test.com "Full Name"
```

---

### 6. Database Reset

**Steps:**
```bash
npm run db:reset
```

**Expected Results:**
- ✅ Removes existing database file
- ✅ Runs init-db.ts script
- ✅ Creates new default user
- ✅ Shows user credentials

---

### 7. Production Build

**Steps:**
```bash
npm run build
npm start
```

**Expected Results:**
- ✅ Same startup initialization as dev mode
- ✅ Database check runs before server starts
- ✅ Default user created if none exists
- ✅ Server starts successfully

---

### 8. Docker Development

**Steps:**
```bash
docker compose -f docker-compose.dev.yml up --build
```

**Expected Results:**
- ✅ Container builds successfully
- ✅ Startup initialization runs
- ✅ User creation visible in logs
- ✅ Server starts and is accessible

**Container Commands:**
```bash
# Create user inside container
docker compose -f docker-compose.dev.yml exec app npm run user:create

# List users
docker compose -f docker-compose.dev.yml exec app npm run user:list
```

---

### 9. Docker Production

**Steps:**
```bash
docker compose up --build -d
docker compose logs -f
```

**Expected Results:**
- ✅ Production build completes
- ✅ Startup initialization visible in logs
- ✅ Server starts successfully
- ✅ Health check responds

---

## Field Validation

### browser_name Field Checks

**Database Schema:**
```sql
-- Should be present in users table
browser_name TEXT NOT NULL DEFAULT 'unknown'
```

**Verify:**
```bash
sqlite3 data/tabs.db "PRAGMA table_info(users);"
```

**Expected Output:**
Should include line: `| browser_name | TEXT | 1 | 'unknown' |`

---

## Common Issues & Fixes

### Issue: "users table does not exist"
**Fix:** Database schema is created by `src/db.ts` on import. This is normal on first run.

### Issue: No console output for user creation
**Fix:** Ensure `initializeStartup()` is called BEFORE `app.listen()` in `src/index.ts`

### Issue: Express reserves terminal before user creation
**Fix:** Verified - startup runs BEFORE server.listen(), so this should not happen

### Issue: browser_name is null
**Fix:** Database migration in `src/db.ts` backfills null values to 'unknown'

---

## Performance Checks

- [ ] Startup time is reasonable (< 1 second for initialization)
- [ ] No hanging database connections
- [ ] Graceful shutdown works correctly
- [ ] No memory leaks from database connections

---

## Security Validation

- [ ] JWT tokens include user ID, email, name, browserName
- [ ] Default user credentials are clearly visible on creation
- [ ] No passwords stored in plain text (N/A for current schema)
- [ ] Database file permissions are appropriate

---

## Success Criteria

All tests pass with:
- ✅ Proper browser_name support across all scripts
- ✅ Automatic database initialization on all startup modes
- ✅ User credentials visible BEFORE Express server starts
- ✅ No "undefined" or "null" browser names
- ✅ Scripts work in both local and Docker environments
- ✅ Clean error messages when issues occur

---

## Report Issues

If any test fails:
1. Note which test scenario failed
2. Capture console output
3. Check database state: `npm run user:list`
4. Verify file exists: `ls -la data/tabs.db`
5. Check logs: `cat data/logs/combined.log`
