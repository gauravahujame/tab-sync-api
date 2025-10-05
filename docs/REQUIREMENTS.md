# Requirements

## Chrome Extension CORS Support

**Description**: Fix CORS policy issues when the API is called from Chrome extensions.

**Priority**: High

**Status**: Completed

**Details**:
- Chrome extensions have special origin format (`chrome-extension://`) that requires explicit CORS handling
- The previous CORS configuration with `origin: "*"` and `credentials: true` was invalid
- Helmet middleware needed configuration to allow cross-origin resource requests

**Implementation**:
- Added dynamic origin validation that automatically allows all browser extension origins (Chrome and Firefox)
- Configured Helmet middleware to support cross-origin requests
- Added `ALLOWED_ORIGINS` environment variable for production configuration
- Development mode automatically allows localhost and local IP addresses (10.x, 172.16.x, 192.168.x, 100.64.x)

**Test Cases**:
- Verify API calls from Firefox extension work correctly
- Verify Postman/curl requests (no origin) work without issues
- Verify localhost origins work in development mode
- Verify custom origins can be configured via `ALLOWED_ORIGINS` environment variable
- Verify unauthorized origins are properly rejected in production mode

## Mandatory Browser Name for Users

**Description**: Ensure every user and issued token is associated with a non-empty browser name and enforce the requirement across database schema and tooling.

**Priority**: High

**Status**: Completed

**Details**:
- `users.browser_name` column is now `TEXT NOT NULL` with `unknown` default for migrations/backfill
- `scripts/user-create.ts` prompts until a browser name is provided (supports existing users)
- `scripts/generate-token.ts` requires browser name CLI argument and embeds it in JWT payload
- Test utilities and token helpers require explicit `browserName`
- Existing users without a browser name are backfilled to `unknown`

**Implementation**:
- Updated `src/db.ts` schema creation to add and backfill `browser_name`
- Added runtime guard to alter existing tables via `PRAGMA table_info`
- Updated CLI scripts to require browser name input and include it in JWT payloads
- Updated test utilities (`createTestUser`, `generateTestToken`, `createTestClient`) and integration tests

**Test Cases**:
- Verify new user creation fails if browser name is omitted
- Verify existing user update prompts for browser name and persists value
- Verify `generate-token` script exits when browser name argument is missing
- Verify JWT tokens emitted by CLI scripts contain `browserName` claim
- Verify database users always have non-null `browser_name`
- Verify tests using helpers provide `browserName`
