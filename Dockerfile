# Builder stage
FROM node:24-alpine AS builder
WORKDIR /app

# Copy dependency files and install ALL dependencies (including dev)
COPY package*.json ./
RUN npm ci

# Copy TS source and config, then compile
COPY tsconfig.json ./
COPY src/ ./src
RUN npm run build

# Production stage
FROM node:24-alpine AS production
WORKDIR /app

# Install only production dependencies, including module-alias
COPY package*.json ./
RUN apk add --no-cache python3 make g++
RUN npm ci --only=production

# Copy compiled app from builder stage
COPY --from=builder /app/dist ./dist

# Expose your app port (e.g. 3000)
EXPOSE 3000

# Start your app
CMD ["node", "dist/index.js"]
