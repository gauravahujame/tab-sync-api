# syntax=docker/dockerfile:1

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

# Production stage
FROM node:24-alpine AS production

# Install runtime dependencies only (sqlite-libs needed for sqlite3)
RUN apk add --no-cache tini sqlite-libs && \
    addgroup -S app && \
    adduser -S app -G app -h /home/app && \
    mkdir -p /home/app /app/data/logs /tmp && \
    chown -R app:app /home/app /app && \
    chmod 1777 /tmp

WORKDIR /app

# Copy production dependencies (with built sqlite3)
COPY --from=prod-deps --chown=app:app /app/node_modules ./node_modules

# Copy built application
COPY --from=build --chown=app:app /app/dist ./dist
COPY --from=build --chown=app:app /app/package.json ./

# Copy entrypoint
COPY --chown=app:app docker-entrypoint.sh /usr/local/bin/
RUN chmod +x /usr/local/bin/docker-entrypoint.sh

# Set environment
ENV NODE_ENV=production \
    NODE_OPTIONS="--max-old-space-size=512" \
    HOME="/home/app"

EXPOSE 3000

# Switch to non-root user
USER app

# Set the entrypoint
ENTRYPOINT ["/sbin/tini", "--", "/usr/local/bin/docker-entrypoint.sh"]
CMD ["node", "dist/src/index.js"]
