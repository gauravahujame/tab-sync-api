# Builder stage
FROM node:24-alpine AS builder

# Set the working directory
WORKDIR /app

# Install build dependencies
RUN apk add --no-cache python3 make g++

# Copy package files
COPY package*.json ./
COPY tsconfig*.json ./

# Install all dependencies (including devDependencies)
RUN npm ci --include=dev

# Copy the rest of the application
COPY . .

# Build the application
RUN npm run build

# Remove devDependencies
RUN npm prune --production

# Production stage
FROM node:24-alpine

# Install runtime dependencies
RUN apk add --no-cache tini

WORKDIR /app

# Set NODE_ENV to production
ENV NODE_ENV=production

# Create app directories
RUN mkdir -p /app/data/logs && \
    chown -R node:node /app

# Switch to non-root user
USER node

# Copy package files
COPY --chown=node:node package*.json ./

# Install only production dependencies
RUN npm ci --only=production

# Copy the built files from the builder stage
COPY --from=builder /app/dist ./dist

# Copy TypeScript source files for scripts
COPY --from=builder /app/scripts ./scripts
COPY --from=builder /app/tsconfig*.json ./

# Install TypeScript and ts-node for running scripts
RUN npm install -g typescript ts-node

# Create data directory for SQLite
RUN mkdir -p /app/data

# Expose the port the app runs on
EXPOSE 3000

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=5s --retries=3 \
  CMD wget --no-verbose --tries=1 --spider http://localhost:3000/api/v1/health || exit 1

# Use tini as the init process
ENTRYPOINT ["/sbin/tini", "--"]

# Command to run the application
CMD ["node", "dist/index.js"]