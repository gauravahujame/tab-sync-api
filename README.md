# Tab Sync API

A RESTful API for synchronizing browser tabs across devices with user authentication and rate limiting.

## Features

- User authentication with JWT
- Tab synchronization across devices
- Rate limiting for API endpoints
- Comprehensive logging with rotation
- Containerized with Docker
- Health check endpoint

## Prerequisites

- Node.js 18+
- npm or yarn
- Docker (optional)
- SQLite

## Installation

1. Clone the repository:
   ```bash
   git clone https://github.com/yourusername/tab-sync-api.git
   cd tab-sync-api
   ```

2. Install dependencies:
   ```bash
   npm install
   ```

3. Copy the example environment file and update the values:
   ```bash
   cp .env.example .env
   ```

4. Start the development server:
   ```bash
   npm run dev
   ```

## Scripts

The following utility scripts are available in the container:

1. **Create a new user**:
   ```bash
   docker-compose exec tab-sync-api npx ts-node scripts/user-create.ts <email> <password> [--admin]
   ```
   Example:
   ```bash
   docker-compose exec tab-sync-api npx ts-node scripts/user-create.ts user@example.com mypassword --admin
   ```

2. **Generate JWT token for a user**:
   ```bash
   docker-compose exec tab-sync-api npx ts-node scripts/generate-token.ts <email> <password>
   ```
   Example:
   ```bash
   docker-compose exec tab-sync-api npx ts-node scripts/generate-token.ts user@example.com mypassword
   ```

3. **List all users**:
   ```bash
   docker-compose exec tab-sync-api npx ts-node scripts/user-list.ts
   ```

## Logging

The application uses Winston for logging with the following configuration:

- **Log Levels**: error, warn, info, http, verbose, debug, silly
- **Log Directory**: `./data/logs`
- **Log Rotation**:
  - General logs: Rotated daily, kept for 30 days, max 20MB per file
  - Error logs: Rotated daily, kept for 60 days, max 20MB per file
  - Exceptions and rejections: Logged to separate files

### Environment Variables for Logging

- `LOG_LEVEL`: Logging level (default: 'info')
- `LOG_DIR`: Directory to store log files (default: './data/logs')
- `LOG_MAX_SIZE`: Maximum size of log files before rotation (default: '20m')
- `LOG_MAX_FILES`: How long to keep log files (default: '30d')
- `LOG_ERROR_MAX_FILES`: How long to keep error log files (default: '60d')

## API Documentation

### Health Check

```
GET /api/v1/health
```

### Authentication

```
POST /api/v1/auth/register
POST /api/v1/auth/login
```

### Tabs

```
GET    /api/v1/tabs
POST   /api/v1/tabs
DELETE /api/v1/tabs/:id
POST   /api/v1/tabs/batch
```

## Docker

### Build and Run with Docker

```bash
docker-compose up --build
```

### View Logs

```bash
docker-compose logs -f
```

## Development

### Linting

```bash
npm run lint
```

### Formatting

```bash
npm run format
```

### Type Checking

```bash
npm run typecheck
```

## License

ISC
