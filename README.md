# Tabium - Cross-Device Tab Synchronization API

> A self-hosted API for browser tab synchronization, built with Node.js, Express, and SQLite.

## 🚀 Quick Start

### Option 1: Docker (Recommended)

```bash
# Clone repository
git clone https://github.com/gauravahujame/tab-sync-api.git
cd tab-sync-api

# Create environment file
cp .env.example .env
# Edit .env and set JWT_SECRET (required)

# Start production server
docker compose up -d

# View logs
docker compose logs -f
```

The API is now running at `http://localhost:3000`

### Option 2: Local Development

```bash
# Prerequisites: Node.js 24+, pnpm
git clone https://github.com/gauravahujame/tab-sync-api.git
cd tab-sync-api

pnpm install
cp .env.example .env
pnpm run dev
```

---

## 📦 Prerequisites

| Requirement | Version | Notes |
|-------------|---------|-------|
| Node.js | 24+ | For local development |
| pnpm | 10.22+ | Package manager |
| Docker | 24+ | For containerized deployment |
| Docker Compose | v2+ | Included with Docker Desktop |

---

## 🐳 Docker Deployment

### Development Mode

Hot-reloading with all development tools:

```bash
# Start development environment
make dev
# or
docker compose -f docker-compose.dev.yml up --build

# With debugger (port 9229)
make dev-debug
```

### Production Mode

Optimized, secure, minimal image:

```bash
# Basic production deployment
make prod
# or
docker compose up -d --build

# With nginx reverse proxy
docker compose --profile proxy up -d --build
```

### Management Commands

```bash
# Using Makefile
make help          # Show all commands
make logs          # View logs
make status        # Container health status
make shell         # Shell into container
make backup        # Backup database
make stop          # Stop containers
make clean         # Remove containers and volumes

# Using docker.sh script
./scripts/docker.sh start --prod      # Start production
./scripts/docker.sh start --dev       # Start development
./scripts/docker.sh logs              # Follow logs
./scripts/docker.sh backup            # Backup database
./scripts/docker.sh restore <file>    # Restore from backup
```

---

## ⚙️ Configuration

### Environment Variables

Create `.env` from the example:

```bash
cp .env.example .env
```

| Variable | Default | Description |
|----------|---------|-------------|
| `JWT_SECRET` | - | **Required**. Generate: `openssl rand -base64 32` |
| `PORT` | `3000` | Server port (internal) |
| `HOST_PORT` | `3000` | External port mapping |
| `NODE_ENV` | `development` | `development`, `production`, `test` |
| `DOMAIN` | - | Trusted proxy domain |
| `DB_TYPE` | `sqlite` | Database: `sqlite` or `postgres` |
| `DATABASE_PATH` | `./data/tabs.db` | SQLite database path |
| `LOG_LEVEL` | `info` | `error`, `warn`, `info`, `debug` |
| `RATE_LIMIT_MAX_REQUESTS` | `60` | Requests per minute |
| `TZ` | `UTC` | Timezone |
| `CPU_LIMIT` | `1.0` | Docker CPU limit |
| `MEMORY_LIMIT` | `512M` | Docker memory limit |

### PostgreSQL Configuration (Optional)

Set `DB_TYPE=postgres` and configure:

```env
DB_HOST=postgres
DB_PORT=5432
DB_USERNAME=tabsync
DB_PASSWORD=your-secure-password
DB_NAME=tabsync
```

---

## 🔒 Reverse Proxy Setup

### Using Built-in Nginx

```bash
# Start with nginx profile
docker compose --profile proxy up -d

# Place SSL certificates in nginx/certs/
# - cert.pem (certificate)
# - key.pem (private key)
```

### Using Traefik (External)

```yaml
# docker-compose.override.yml
services:
  app:
    labels:
      - "traefik.enable=true"
      - "traefik.http.routers.tabsync.rule=Host(`api.example.com`)"
      - "traefik.http.routers.tabsync.tls.certresolver=letsencrypt"
```

### Using Caddy (External)

```
# Caddyfile
api.example.com {
    reverse_proxy localhost:3000
}
```

---

## 👩‍💻 Development

### Available Scripts

```bash
# Development
pnpm run dev              # Start with hot reload
pnpm run dev:debug        # Start with debugger

# Testing
pnpm test                 # Run all tests
pnpm run test:unit        # Unit tests only
pnpm run test:integration # Integration tests only
pnpm run test:coverage    # With coverage report

# Code Quality
pnpm run lint             # Run ESLint
pnpm run lint:fix         # Auto-fix issues
pnpm run format           # Format with Prettier

# Build
pnpm run build            # TypeScript compilation
pnpm run clean            # Remove build artifacts
```

### User Management

```bash
# Create user
pnpm run user:create

# List users
pnpm run user:list

# Generate access token
pnpm run token:generate -- <browser-name>

# In Docker
docker compose exec app pnpm run user:create
```

### Database

```bash
pnpm run db:init          # Initialize database
pnpm run db:reset         # Reset database (destroys data)
pnpm run db:clean         # Remove database files
```

---

## 📁 Project Structure

```
tab-sync-api/
├── src/                  # Source code
│   ├── config.ts         # Configuration
│   ├── db/               # Database layer
│   ├── middlewares/      # Express middlewares
│   ├── routes/           # API routes
│   ├── services/         # Business logic
│   └── utils/            # Utilities
├── scripts/              # Automation scripts
│   ├── docker.sh         # Docker management
│   ├── backup.sh         # Database backup
│   └── health-check.sh   # Health check script
├── nginx/                # Nginx configuration
│   ├── nginx.conf        # Main config
│   └── Dockerfile        # Nginx image
├── data/                 # Persistent data (gitignored)
│   ├── tabs.db           # SQLite database
│   ├── logs/             # Application logs
│   └── backups/          # Database backups
├── docker-compose.yml    # Production compose
├── docker-compose.dev.yml# Development compose
├── Dockerfile            # Production image
├── Dockerfile.dev        # Development image
└── Makefile              # Developer shortcuts
```

---

## 🔧 Troubleshooting

### Container won't start

```bash
# Check logs
docker compose logs app

# Verify image builds
docker compose build --no-cache

# Verify permissions
ls -la ./data
```

### Health check failing

```bash
# Check health status
docker inspect --format='{{json .State.Health}}' tab-sync-api | jq

# Test health endpoint manually
curl http://localhost:3000/api/v1/health
```

### Database issues

```bash
# Reset database
make db-reset

# Or manually
rm -f data/tabs.db
docker compose restart
```

### Permission issues in container

```bash
# Ensure data directory is writable
sudo chown -R 1000:1000 ./data
```

---

## 🛡️ Security

- **Non-root user**: Containers run as unprivileged user
- **Read-only filesystem**: Root filesystem is read-only
- **No new privileges**: Prevents privilege escalation
- **Resource limits**: CPU and memory limits enforced
- **Health checks**: Automatic container health monitoring
- **Minimal image**: Only runtime dependencies included

---

## 📝 API Endpoints

| Endpoint | Method | Auth | Description |
|----------|--------|------|-------------|
| `/api/v1/health` | GET | No | Health check |
| `/api/v1/auth/login` | POST | No | User login |
| `/api/v1/tabs` | GET | Yes | Get all tabs |
| `/api/v1/tabs` | POST | Yes | Create/update tabs |
| `/api/v1/sync` | GET | Yes | Get sync snapshot |
| `/api/v1/sync` | POST | Yes | Upload sync snapshot |
| `/api/v1/sessions` | GET | Yes | Get sessions |

See [API Documentation](./docs/api.md) for full details.

---

## 📜 License

ISC © [Gaurav Ahuja](https://github.com/gauravahujame)
