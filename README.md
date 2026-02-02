# Tabium API - Cross-Device Tab Synchronization

> A self-hosted API for synchronizing browser tabs across devices, built with Node.js, Express, and SQLite.

## Quick Start

### Docker (Recommended)

```bash
# Clone repository
git clone https://github.com/gauravahujame/tab-sync-api.git
cd tab-sync-api

# Create environment file
cp .env.production.example .env

# Generate a secure JWT secret
openssl rand -base64 32
# Add the output to JWT_SECRET in .env

# Start the server
docker compose up -d
```

The API is now running at `http://localhost:3000`

### Local Development

For contributors who want to run from source:

```bash
# Prerequisites: Node.js 24+, pnpm
git clone https://github.com/gauravahujame/tab-sync-api.git
cd tab-sync-api

pnpm install
cp .env.example .env
pnpm run dev
```

---

## Configuration

### Environment Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `JWT_SECRET` | - | **Required**. Auth secret. Generate: `openssl rand -base64 32` |
| `PORT` | `3000` | Internal server port |
| `API_PORT` | `3000` | External Docker port mapping |
| `NODE_ENV` | `production` | Environment mode |
| `DOMAIN` | - | Trusted proxy domain (for reverse proxy setups) |
| `DB_TYPE` | `sqlite` | Database: `sqlite` or `postgres` |
| `DATABASE_PATH` | `/app/data/tabs.db` | SQLite database path |
| `LOG_LEVEL` | `info` | `error`, `warn`, `info`, `debug` |
| `RATE_LIMIT_MAX_REQUESTS` | `60` | Requests per minute limit |
| `TZ` | `UTC` | Timezone |

### PostgreSQL (Optional)

Set `DB_TYPE=postgres` and configure:

```env
DB_HOST=postgres
DB_PORT=5432
DB_USERNAME=tabsync
DB_PASSWORD=your-secure-password
DB_NAME=tabsync
```

---

## Deployment Options

### Direct Access

Access the API directly without a reverse proxy:

```bash
docker compose up -d
# API available at http://YOUR_IP:3000
```

To use a custom port:

```env
API_PORT=8080
```

### Behind a Reverse Proxy

The container binds to `0.0.0.0`, making it accessible to external reverse proxies.

**With Traefik:**

```yaml
# docker-compose.override.yml
services:
  app:
    labels:
      - "traefik.enable=true"
      - "traefik.http.routers.tabium.rule=Host(`api.example.com`)"
      - "traefik.http.routers.tabium.tls.certresolver=letsencrypt"
```

**With Caddy:**

```
# Caddyfile
api.example.com {
    reverse_proxy localhost:3000
}
```

### Built-in Nginx Proxy

Use the included nginx configuration:

```bash
# Place SSL certs in ./nginx/certs/ (cert.pem, key.pem)
docker compose --profile proxy up -d
```

---

## Development

### Available Scripts

```bash
# Development
pnpm run dev              # Start with hot reload
pnpm run dev:debug        # Start with debugger (port 9229)

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
```

### Docker Development

```bash
# Start development environment with hot reload
docker compose -f docker-compose.dev.yml up --build

# With debugger
docker compose -f docker-compose.dev.yml --profile debug up
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

---

## API Endpoints

| Endpoint | Method | Auth | Description |
|----------|--------|------|-------------|
| `/api/v1/health` | GET | No | Health check |
| `/api/v1/auth/login` | POST | No | User login |
| `/api/v1/sync` | GET | Yes | Get sync snapshot |
| `/api/v1/sync` | POST | Yes | Upload sync snapshot |
| `/api/v1/sessions` | GET | Yes | Get sessions |

---

## Project Structure

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
├── nginx/                # Nginx configuration (optional)
├── data/                 # Persistent data (gitignored)
├── docker-compose.yml    # Production compose
├── docker-compose.dev.yml# Development compose
└── Dockerfile            # Production image
```

---

## Troubleshooting

### Container won't start

```bash
docker compose logs app
docker compose build --no-cache
```

### Health check failing

```bash
docker inspect --format='{{json .State.Health}}' tabium-api | jq
curl http://localhost:3000/api/v1/health
```

### Database issues

```bash
# Reset database
rm -f data/tabs.db
docker compose restart
```

---

## License

ISC © [Gaurav Ahuja](https://github.com/gauravahujame)
