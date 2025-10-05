# Script Updates - Database Initialization & Browser Name Support

## Summary

All scripts now properly respect the `browser_name` field in the user database. The server automatically initializes the database and creates a default user on startup, ensuring console output is visible before Express takes over.

## Changes Made

### 1. **scripts/init-db.ts**
- **Updated**: Now uses actual database schema (removed password/role fields)
- **Added**: `browser_name` field support (defaults to "default-browser")
- **Changed**: Uses JWT tokens instead of API keys
- **Improved**: Auto-generates user with proper token containing user ID
- **Output**: Clear console output with user credentials and JWT token

### 2. **scripts/user-list.ts**
- **Added**: `browser_name` column to user list display
- **Improved**: Shows browser name in token section
- **Enhanced**: Better formatting for wider display (90 chars)

### 3. **scripts/user-create.ts**
- **Unchanged**: Already properly handles `browser_name` field
- **Verified**: Respects browser_name in user creation and token generation

### 4. **scripts/generate-token.ts**
- **Unchanged**: Already includes `browserName` in JWT payload
- **Verified**: Properly generates tokens with browser identification

### 5. **src/utils/startup.ts** (NEW)
- **Created**: Automated startup initialization module
- **Features**:
  - Checks database existence before server starts
  - Auto-creates database directory if missing
  - Verifies user existence
  - Auto-generates default user with browser_name if none found
  - Outputs credentials BEFORE Express server starts listening
  - Uses proper TypeScript types for database operations
- **Integration**: Called from `src/index.ts` before server.listen()

### 6. **src/index.ts**
- **Added**: Import of `initializeStartup` function
- **Changed**: Server start wrapped in async function
- **Flow**: 
  1. Run `initializeStartup()` (database check + user creation)
  2. Then start Express server
  3. Ensures terminal output visibility
- **Error Handling**: Proper error handling with process exit on failure

### 7. **package.json**
- **Added Scripts**:
  - `token:generate`: Generate JWT tokens from CLI
  - `db:clean`: Remove all database and log files
  - `setup`: Full setup (install + init database)
- **Organization**: Better grouping of database and user management scripts

### 8. **README.md**
- **Added Section**: "Automated Database Initialization"
- **Documented**: All available scripts with descriptions
- **Clarified**: Browser name support across all scripts
- **Improved**: Docker usage examples

## Startup Flow

### All Modes (dev, prod, Docker)

```
1. Application starts
   ↓
2. initializeStartup() runs
   ↓
3. Check database file exists
   ↓
4. Create database directory if needed
   ↓
5. Check for existing users
   ↓
6. If no users found:
   - Auto-generate default user
   - Set browser_name = "default-browser"
   - Generate JWT token with user ID
   - Log credentials to console
   ↓
7. Close database connection
   ↓
8. Express server starts listening
   ↓
9. Server ready for requests
```

## Browser Name Field

All scripts now properly handle the `browser_name` field:

- **Database Schema**: `browser_name TEXT NOT NULL DEFAULT 'unknown'`
- **User Creation**: Prompts for browser name (with default if updating)
- **Token Generation**: Includes `browserName` in JWT payload
- **User Listing**: Displays browser name in table view
- **Database Init**: Sets to "default-browser" for auto-generated users

## New Developer Commands

```bash
# Setup new environment
npm run setup

# Create user interactively (includes browser_name)
npm run user:create

# List all users with browser names
npm run user:list

# Generate token for specific browser
npm run token:generate -- chrome 123 user@example.com "User Name"

# Clean database and logs
npm run db:clean

# Reset database
npm run db:reset
```

## Docker Integration

All scripts work seamlessly in Docker containers:

```bash
# Development
docker compose -f docker-compose.dev.yml exec app npm run user:create

# Production  
docker compose exec app npm run user:list
```

## Breaking Changes

None. All changes are backward compatible with existing database schemas through migration logic in `src/db.ts`.

## Testing Recommendations

1. **Clean Start**: `npm run db:clean && npm run dev`
   - Should auto-create database and default user
   - Credentials should appear in console before "Server is running"

2. **Existing Database**: `npm run dev` with existing database
   - Should skip user creation
   - Should log "Database initialized with X existing user(s)"

3. **User Creation**: `npm run user:create`
   - Should prompt for browser name
   - Should respect existing browser name on updates

4. **User Listing**: `npm run user:list`
   - Should display browser_name column
   - Should show browser in token section

## Future Improvements

- [ ] Add browser_name validation (enum of known browsers)
- [ ] Support multiple browsers per user
- [ ] Browser-specific sync preferences
- [ ] Browser usage analytics
