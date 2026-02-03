# syntax=docker/dockerfile:1

# =============================================================================
# Tab-Sync-API Production Dockerfile
# Multi-stage build for secure, minimal production image
# =============================================================================

# Build stage - Base configuration
FROM node:24-alpine AS base

# Install build dependencies for native modules
RUN apk add --no-cache \
    python3 \
    make \
    g++ \
    sqlite

# Enable Corepack and pre-activate pnpm
ENV PNPM_HOME="/pnpm"
ENV PATH="$PNPM_HOME:$PATH"
RUN corepack enable && \
    corepack prepare pnpm@10.22.0 --activate

# Production dependencies stage
FROM base AS prod-deps
WORKDIR /app

# Copy pnpm-workspace.yaml to allow building sqlite3
COPY pnpm-workspace.yaml ./
COPY pnpm-lock.yaml ./

RUN --mount=type=cache,id=pnpm,target=/pnpm/store \
    pnpm fetch --prod

COPY package.json ./

RUN --mount=type=cache,id=pnpm,target=/pnpm/store \
    pnpm install --offline --prod --frozen-lockfile

# Build stage
FROM base AS build
WORKDIR /app

# Copy pnpm-workspace.yaml to allow building sqlite3
COPY pnpm-workspace.yaml ./
COPY pnpm-lock.yaml ./

RUN --mount=type=cache,id=pnpm,target=/pnpm/store \
    pnpm fetch

COPY package.json tsconfig*.json ./

RUN --mount=type=cache,id=pnpm,target=/pnpm/store \
    pnpm install --offline --frozen-lockfile

# Copy all source files including scripts
COPY src ./src
COPY scripts ./scripts

# Build everything
RUN pnpm run build

# =============================================================================
# Production stage - Minimal secure runtime image
# =============================================================================
FROM node:24-alpine AS production

# OCI Image Labels
# https://github.com/opencontainers/image-spec/blob/main/annotations.md
LABEL org.opencontainers.image.title="Tab-Sync-API" \
      org.opencontainers.image.description="Cross-device browser tab synchronization API" \
      org.opencontainers.image.version="1.0.0" \
      org.opencontainers.image.vendor="Gaurav Ahuja" \
      org.opencontainers.image.licenses="ISC" \
      org.opencontainers.image.source="https://github.com/gauravahujame/tab-sync-api" \
      org.opencontainers.image.documentation="https://github.com/gauravahujame/tab-sync-api#readme"

# Install runtime dependencies only
# - tini: proper init for signal handling
# - sqlite-libs: SQLite runtime (if using SQLite)
# - curl: for health checks
RUN apk add --no-cache tini sqlite-libs curl && \
    # Create non-root user and required directories
    addgroup -S app && \
    adduser -S app -G app -h /home/app && \
    mkdir -p /home/app /app/data/logs /data/logs /tmp && \
    chown -R app:app /home/app /app /data && \
    chmod 1777 /tmp

WORKDIR /app

# Copy production dependencies (with built sqlite3)
COPY --from=prod-deps --chown=app:app /app/node_modules ./node_modules

# Copy built application
COPY --from=build --chown=app:app /app/dist ./dist
COPY --from=build --chown=app:app /app/package.json ./

# Copy entrypoint and health check scripts
COPY --chown=app:app docker-entrypoint.sh /usr/local/bin/
COPY --chown=app:app scripts/health-check.sh /usr/local/bin/
RUN chmod +x /usr/local/bin/docker-entrypoint.sh /usr/local/bin/health-check.sh

# Set environment
ENV NODE_ENV=production \
    NODE_OPTIONS="--max-old-space-size=512" \
    HOME="/home/app" \
    # Timezone - override with TZ env var
    TZ=UTC \
    # Language settings
    LANG=C.UTF-8 \
    LC_ALL=C.UTF-8

# Document exposed port
EXPOSE 3000

# Health check - verify API is responding
HEALTHCHECK --interval=30s --timeout=10s --start-period=30s --retries=3 \
    CMD /usr/local/bin/health-check.sh || exit 1

# Signal for graceful shutdown
STOPSIGNAL SIGTERM

# Switch to non-root user
USER app

# Set the entrypoint with tini for proper signal handling
ENTRYPOINT ["/sbin/tini", "--", "/usr/local/bin/docker-entrypoint.sh"]
CMD ["node", "dist/src/index.js"]
