# Docker Documentation

Detailed documentation for Docker-based deployment of Tab-Sync-API.

## Architecture Overview

```
┌──────────────────────────────────────────────────────────────┐
│                        Host Machine                          │
├──────────────────────────────────────────────────────────────┤
│  ┌─────────────────┐    ┌─────────────────────────────────┐  │
│  │   nginx:443     │───▶│      tab-sync-api:3000          │  │
│  │  (TLS Termn.)   │    │                                 │  │
│  └─────────────────┘    │  ┌───────────┐  ┌───────────┐   │  │
│          │              │  │  Express  │  │  SQLite   │   │  │
│          │              │  │  Server   │  │  Database │   │  │
│          │              │  └───────────┘  └───────────┘   │  │
│          │              └─────────────────────────────────┘  │
│          │                           │                       │
│          │                           ▼                       │
│          │              ┌─────────────────────────────────┐  │
│          │              │      Docker Volume: data        │  │
│          │              │  - tabs.db (database)           │  │
│          │              │  - logs/ (application logs)     │  │
│          │              │  - backups/ (db backups)        │  │
│          │              └─────────────────────────────────┘  │
│          ▼                                                   │
│  ┌─────────────────┐                                         │
│  │ Internet/Clients│                                         │
│  └─────────────────┘                                         │
└──────────────────────────────────────────────────────────────┘
```

## Images

### Production Image (`Dockerfile`)

Multi-stage build for minimal, secure production image:

| Stage | Base Image | Purpose |
|-------|------------|---------|
| `base` | `node:24-alpine` | Build dependencies |
| `prod-deps` | `base` | Production node_modules |
| `build` | `base` | TypeScript compilation |
| `production` | `node:24-alpine` | Final runtime image |

**Features:**
- ~150MB final image size
- Non-root user (`app:app`)
- Read-only root filesystem
- Health check built-in
- Tini init for signal handling

### Development Image (`Dockerfile.dev`)

Single-stage image with all development tools:

- Hot reload enabled
- Debug port exposed (9229)
- Source mount for live editing
- Git, curl, and dev tools included

## Volume Management

### Named Volumes

| Volume | Container Path | Purpose |
|--------|---------------|---------|
| `tab-sync-data` | `/app/data` | SQLite DB, logs, backups |
| `pnpm-store` | `/pnpm/store` | Package cache (dev only) |
| `nginx-logs` | `/var/log/nginx` | Nginx access/error logs |

### Bind Mounts (Development)

```yaml
volumes:
  - .:/app                # Source code
  - ./data:/app/data      # Persistent data
```

### Data Directory Structure

```
./data/
├── tabs.db           # SQLite database
├── logs/
│   ├── combined.log  # All logs
│   └── error.log     # Error logs only
└── backups/
    └── tabs_20240124_120000.db.gz
```

## Network Configuration

### Default Network

All services communicate via `tab-sync-network` bridge network:

```yaml
networks:
  tab-sync-network:
    driver: bridge
```

### Port Mappings

| Service | Container Port | Host Port | Variable |
|---------|---------------|-----------|----------|
| app | 3000 | 3000 | `HOST_PORT` |
| app (debug) | 9229 | 9229 | - |
| nginx | 80 | 80 | `NGINX_HTTP_PORT` |
| nginx | 443 | 443 | `NGINX_HTTPS_PORT` |

## Resource Limits

Production containers have resource limits:

```yaml
deploy:
  resources:
    limits:
      cpus: "1.0"       # Max 1 CPU
      memory: 512M      # Max 512MB RAM
    reservations:
      cpus: "0.25"      # Guaranteed 0.25 CPU
      memory: 128M      # Guaranteed 128MB RAM
```

Configure via environment:
```env
CPU_LIMIT=2.0
MEMORY_LIMIT=1G
```

## Health Checks

### Application Health Check

```yaml
healthcheck:
  test: ["/usr/local/bin/health-check.sh"]
  interval: 30s      # Check every 30s
  timeout: 10s       # Fail after 10s
  retries: 3         # 3 failures = unhealthy
  start_period: 30s  # Grace period on start
```

### Checking Health Status

```bash
# Docker status
docker inspect --format='{{.State.Health.Status}}' tab-sync-api

# Detailed health log
docker inspect --format='{{json .State.Health}}' tab-sync-api | jq

# Manual health check
curl -s http://localhost:3000/api/v1/health
```

## Logging

### Application Logs

Structured JSON logging via Winston:

```bash
# View logs
docker compose logs -f app

# Filter errors
docker compose logs app 2>&1 | grep ERROR
```

### Log Files in Container

```bash
# Access log files
docker compose exec app cat /app/data/logs/combined.log
docker compose exec app cat /app/data/logs/error.log
```

### Docker Logging Driver

```yaml
logging:
  driver: json-file
  options:
    max-size: "10m"    # Max 10MB per file
    max-file: "5"      # Keep 5 files
    compress: "true"   # Compress rotated logs
```

## Monitoring

### Container Metrics

```bash
# Resource usage
docker stats tab-sync-api

# Container info
docker inspect tab-sync-api
```

### Integration with Prometheus

Add to `docker-compose.override.yml`:

```yaml
services:
  app:
    labels:
      - "prometheus.scrape=true"
      - "prometheus.port=3000"
      - "prometheus.path=/metrics"
```

## Backup & Restore

### Automated Backup

```bash
# Create backup
./scripts/backup.sh

# List backups
./scripts/backup.sh --list

# Restore
./scripts/docker.sh restore ./data/backups/tabs_20240124.db.gz
```

### Manual Backup

```bash
# Copy database file
docker compose exec app cat /app/data/tabs.db > backup.db

# Or use sqlite backup command
sqlite3 ./data/tabs.db ".backup backup.db"
```

## Upgrading

### Standard Upgrade

```bash
# Pull latest code
git pull

# Rebuild and restart
docker compose up -d --build
```

### Zero-Downtime Upgrade

```bash
# Build new image
docker compose build

# Recreate container (brief downtime)
docker compose up -d --force-recreate
```

## Troubleshooting

### Container Debugging

```bash
# Shell into running container
docker compose exec app sh

# Start container with shell (bypass entrypoint)
docker run -it --entrypoint sh tab-sync-api:latest

# View container filesystem
docker compose exec app ls -la /app
```

### Common Issues

| Issue | Solution |
|-------|----------|
| Permission denied on data/ | `sudo chown -R 1000:1000 ./data` |
| Port already in use | Change `HOST_PORT` in .env |
| Build fails on M1/ARM | Add `--platform linux/amd64` |
| Database locked | Stop all containers, then restart |

### Rebuilding from Scratch

```bash
# Nuclear option - clean everything
docker compose down -v
docker system prune -af
docker compose up -d --build
```
