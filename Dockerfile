# Build stage
FROM node:24-alpine AS production

# Set the working directory
WORKDIR /app

# Copy package files and configs
COPY package*.json ./
COPY tsconfig*.json ./

# Install all dependencies (including devDependencies)
RUN npm ci

# Copy the rest of the application
COPY . .

# Build the application
RUN npm run build

# Remove devDependencies
RUN npm prune --production

# Production stage
FROM node:24-alpine

# Install tini for better signal handling
RUN apk add --no-cache tini

# Set the working directory
WORKDIR /app

# Copy package files
COPY package*.json ./

# Install production dependencies only
RUN npm ci --only=production

# Copy built application from builder
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/scripts ./scripts
COPY --from=builder /app/tsconfig*.json ./

# Copy and set up entrypoint
COPY docker-entrypoint.sh /usr/local/bin/
RUN chmod +x /usr/local/bin/docker-entrypoint.sh

# Create app directories and set proper permissions
RUN mkdir -p /app/data/logs && \
    addgroup -S app && adduser -S app -G app && \
    chown -R app:app /app

# Set environment variables
ENV NODE_ENV=production

# Expose the port the app runs on
EXPOSE 3000

# Switch to non-root user
USER app

# Set the entrypoint and command
ENTRYPOINT ["/sbin/tini", "--", "/usr/local/bin/docker-entrypoint.sh"]
CMD ["node", "dist/index.js"]
