# Tabium - Cross-Device Tab Synchronization API

> **Tabium** is a robust, scalable API service that enables seamless synchronization of browser tabs across multiple devices. Built with Node.js, Express, and SQLite, it provides secure, real-time tab management with enterprise-grade features like JWT authentication, rate limiting, and comprehensive logging.

## 🚀 Features

- **Cross-Device Sync**: Keep your browsing session in sync across all your devices
- **Secure Authentication**: JWT-based authentication with role-based access control
- **Rate Limiting**: Protect your API from abuse with configurable rate limits
- **Comprehensive Logging**: Built-in logging with rotation and multiple log levels
- **Docker Ready**: Containerized for easy deployment and scaling
- **Health Monitoring**: Built-in health check endpoints
- **User Management**: Complete user administration capabilities
- **RESTful API**: Intuitive, well-documented endpoints

## 📦 Prerequisites

- Node.js 18+ & npm/yarn
- SQLite (included, no separate installation needed)
- Docker & Docker Compose (for containerized deployment)
- Git (for version control)

## 🛠 Installation

### Local Development

```bash
# Clone the repository
git clone https://github.com:gauravahujame/tab-sync-api.git
cd tab-sync-api

# Install dependencies
npm install

# Configure environment
cp .env.example .env
# Edit .env with your configuration

# Start development server
npm run dev
```

### Docker Deployment

```bash
# Build and start containers
docker compose up --build -d

# View logs
docker compose logs -f
```

## ⚙️ Configuration

Configure the application using environment variables in `.env`:

```env
# Server Configuration
PORT=3000
NODE_ENV=development

# Authentication
JWT_SECRET=your-secure-jwt-secret
JWT_EXPIRES_IN=7d

# Database
DATABASE_PATH=/app/data/tabs.db

# Logging
LOG_LEVEL=info
LOG_DIR=/app/data/logs
LOG_MAX_SIZE=20m
LOG_MAX_FILES=30d

# Rate Limiting
RATE_LIMIT_WINDOW_MS=60000  # 1 minute
RATE_LIMIT_MAX_REQUESTS=100  # Max requests per window
```

## 📡 API Endpoints

### Authentication
- `POST /api/v1/auth/register` - Register a new user
- `POST /api/v1/auth/login` - Login and get JWT token
- `GET /api/v1/auth/me` - Get current user profile

### Tabs
- `GET /api/v1/tabs` - Get all synced tabs
- `POST /api/v1/tabs` - Add/Update a tab
- `DELETE /api/v1/tabs/:id` - Remove a tab
- `PUT /api/v1/tabs/:id` - Update tab properties

### Users (Admin)
- `GET /api/v1/users` - List all users (Admin only)
- `GET /api/v1/users/:id` - Get user details
- `PUT /api/v1/users/:id` - Update user
- `DELETE /api/v1/users/:id` - Delete user

## 🔒 Rate Limiting

Tabium implements rate limiting to prevent abuse:
- **Default**: 100 requests per minute per IP
- **Authentication endpoints**: 10 requests per minute
- **Admin endpoints**: 30 requests per minute

Configure in `.env`:
```env
RATE_LIMIT_WINDOW_MS=60000
RATE_LIMIT_MAX_REQUESTS=100
```

## 📝 Logging

Comprehensive logging with Winston:
- Multiple log levels (error, warn, info, debug)
- Automatic log rotation
- Separate error logs
- Console and file output

Log files are stored in `./data/logs` by default.

## 🐳 Docker

### Development
```bash
docker compose -f docker-compose.dev.yml up --build
```

### Production
```bash
docker compose -f docker-compose.prod.yml up --build -d
```

### Utility Scripts
```bash
# Create admin user
docker compose exec app npx ts-node scripts/user-create.ts admin@example.com password --admin

# Generate JWT token
docker compose exec app npx ts-node scripts/generate-token.ts user@example.com password

# List users
docker compose exec app npx ts-node scripts/user-list.ts
```

## 🚀 Development

### Project Structure
```
src/
├── config/         # Configuration files
├── controllers/    # Route controllers
├── middleware/     # Custom middleware
├── models/         # Database models
├── routes/         # API routes
├── services/       # Business logic
├── utils/          # Helper functions
└── app.ts          # Express app setup
```

### Development Commands
```bash
# Run tests
npm test

# Lint code
npm run lint

# Build for production
npm run build

# Start production server
npm start
```

## 📄 License

MIT © [Your Name]

## Prerequisites

- Node.js 18+
- npm or yarn
- Docker (optional)
- SQLite

## Installation

### Local Development

1. Clone the repository:
   ```bash
   git clone https://github.com:gauravahujame/tab-sync-api.git
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

### Docker Setup

1. Build and start the container:
   ```bash
   docker compose up --build -d
   ```

2. Check container logs:
   ```bash
   docker compose logs -f
   ```

3. Stop the container:
   ```bash
   docker compose down
   ```

## Environment Variables

Create a `.env` file based on the example:
```bash
cp .env.example .env
```

Key environment variables:
- `PORT`: Port to run the server (default: 3000)
- `JWT_SECRET`: Secret for JWT token generation
- `DATABASE_PATH`: Path to SQLite database file (default: /app/data/tabs.db)
- `LOG_LEVEL`: Logging level (default: info)
- `LOG_DIR`: Directory for log files (default: /app/data/logs)

## Available Scripts

### User Management

1. **Create a new user**:
   ```bash
   # Local
   npx ts-node scripts/user-create.ts <email> <password> [--admin]

   # Docker
   docker compose exec tab-sync-api npx ts-node scripts/user-create.ts <email> <password> [--admin]
   ```

2. **Generate JWT token**:
   ```bash
   # Local
   npx ts-node scripts/generate-token.ts <email> <password>

   # Docker
   docker compose exec tab-sync-api npx ts-node scripts/generate-token.ts <email> <password>
   ```

3. **List all users**:
   ```bash
   # Local
   npx ts-node scripts/user-list.ts

   # Docker
   docker compose exec tab-sync-api npx ts-node scripts/user-list.ts
   ```

## API Documentation

Once the server is running, you can access:
- API Documentation: `http://localhost:3000/api-docs` (if using Swagger/OpenAPI)
- Health Check: `http://localhost:3000/api/v1/health`

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
