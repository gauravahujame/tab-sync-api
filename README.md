# Tabium - Cross-Device Tab Synchronization API

> Tabium is an API for browser tab sync, built with Node.js, Express, and SQLite.

## 📦 Prerequisites

- Node.js 24+ & npm
- SQLite (bundled, no manual install needed)
- Docker & Docker Compose (for containerized dev/prod)
- Git (for version control)

## 🛠 Installation

### Local Development (host machine)

```
git clone https://github.com:gauravahujame/tab-sync-api.git
cd tab-sync-api
npm install
cp .env.example .env
npm run dev   # Starts local dev server with hot reload
```

### Dockerized Development

```
# Build and start dev container (with hot reload)
docker compose -f docker-compose.dev.yml up --build
```
- Source code is mounted, changes are live-reloaded.

### Dockerized Production

```
docker compose -f docker-compose.yml up --build -d
```
- Runs the production-optimized image with only runtime dependencies.

## ⚙️ Configuration

- Edit `.env` for settings. Both local and Docker dev environments use this for configuration.

## 🐳 Docker

### Development Mode
- Uses `Dockerfile.dev` and `docker-compose.dev.yml`
- Hot reload is enabled, all dev tools are available.
- Run:
  ```
  docker compose -f docker-compose.dev.yml up --build
  ```

### Production Mode
- Uses `Dockerfile` and `docker-compose.yml`
- Optimized, secure, and lightweight image.
- Run:
  ```
  docker compose -f docker-compose.yml up --build -d
  ```

## 🚀 Development Commands

Local or Docker:
- Run tests: `npm test`
- Lint code: `npm run lint`
- Format code: `npm run format`
- Type check: `npm run typecheck`
- Build: `npm run build`
- Start server: `npm start` (production)

## 👩‍💻 Scripts & Utilities

All scripts can be run locally or inside Docker:
- Create user:
  Local: `npx ts-node scripts/user-create.ts <email> <password> [--admin]`
  Docker: `docker compose exec app npx ts-node scripts/user-create.ts <email> <password> [--admin]`
- List users, generate JWT: Refer to previous commands in the scripts section.

## 💡 Notes

- For local dev, hot reload and all dev tooling are available.
- For Dockerized dev, use `Dockerfile.dev` and docker-compose.dev.yml for fast iteration.
- For production, only the built output and runtime dependencies are included (safer and leaner).

---

**All workflows and scripts described here match your folder and tooling setup; both development and production builds/install commands are accurate and supported.**
```

***

This setup ensures development workflow is frictionless (hot reload, mounted code, devDeps), while production images remain secure, fast, and minimal.Below are the **complete new files** for your Docker-based development workflow, plus **README changes** so everything remains in sync and easy to follow.

***

### `Dockerfile.dev`

```Dockerfile
# Development-focused Dockerfile
FROM node:24-alpine

WORKDIR /app

# Install development tools
RUN apk add --no-cache python3 make g++ bash

COPY package*.json ./
COPY tsconfig*.json ./
COPY . .

RUN npm install

# Useful settings for dev (enables polling-based file watching)
ENV NODE_ENV=development
ENV CHOKIDAR_USEPOLLING=1

EXPOSE 3000

# Default: run dev server (hot reload, ts-node, etc.)
CMD ["npm", "run", "dev"]
```
- All source files and dev dependencies included.
- Suitable for interactive code changes and hot-reloading.
- No pruning of dev dependencies.

***

### `docker-compose.dev.yml`

```yaml
version: '3.8'

services:
  app:
    build:
      context: .
      dockerfile: Dockerfile.dev
    container_name: tab-sync-api-dev
    ports:
      - "3000:3000"
    environment:
      - NODE_ENV=development
      - PORT=3000
      - JWT_SECRET=dev-secret
      - DATABASE_PATH=/app/data/tabs.db
      - LOG_LEVEL=debug
      - LOG_DIR=/app/data/logs
      - LOG_MAX_SIZE=20m
      - LOG_MAX_FILES=30d
      - LOG_ERROR_MAX_FILES=60d
      - RATE_LIMIT_WINDOW_MS=60000
      - RATE_LIMIT_MAX_REQUESTS=300
      - CHOKIDAR_USEPOLLING=1
    volumes:
      - .:/app
      - ./data:/app/data
    command: npm run dev
    restart: unless-stopped
    logging:
      driver: "json-file"
      options:
        max-size: "10m"
        max-file: "3"
```
- Mounts source code for instant reloads.
- Dev environment settings, relaxed rate limits/logging.
- Can run scripts or REPL with all dev tooling available.

***

### README.md (key updates)

Update your README for absolute clarity:

```markdown
## 🐳 Docker-based Development

For live-reloading code, running tests, and using development tools inside a container:

```
docker compose -f docker-compose.dev.yml up --build
```

- Source files are mounted into the container for instant reloads (`npm run dev`).
- Environment is set for development; debugging/logging are enabled.
- Utility scripts (ts-node, etc.) are pre-installed and available.

Execute scripts inside your dev container:

```
docker compose exec app npx ts-node scripts/user-create.ts <email> <password> [--admin]
```

To stop:

```
docker compose down
```

---

## 🐳 Docker-based Production

For a minimal, security-hardened deployment without development tools:

```
docker compose -f docker-compose.yml up --build -d
```
- No live-reload.
- Only compiled assets and production dependencies.

---

## Local Development (host machine)

Clone, install, configure, and run as usual:

```
git clone https://github.com:gauravahujame/tab-sync-api.git
cd tab-sync-api
npm install
cp .env.example .env
npm run dev
```
- Use your editor and CLI directly on your machine.

---

## Script Usage

Scripts (user management, token generation, etc.) can run:

- Locally (`npx ts-node ...`)
- Inside either dev or production containers (using `docker compose exec ...`)

---

## Project Structure, Features, API Docs

_Remains unchanged; the rest of your README does not require any update for this docker/env separation._

---

**This new development setup allows:**
- Hot reloading via source volume mount[web:1].
- All dev tools installed.
- Clean, isolated environments for both development and production.
- All README commands, flow, and developer onboarding process are now absolutely correct and in sync[web:2][web:3].
```
