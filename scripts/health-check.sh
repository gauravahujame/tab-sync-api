#!/bin/sh
# Health check script for Tab-Sync-API
# Used by Docker HEALTHCHECK and external monitoring
set -e

# Configuration
HOST="${HEALTH_CHECK_HOST:-localhost}"
PORT="${PORT:-3000}"
ENDPOINT="${HEALTH_CHECK_ENDPOINT:-/api/v1/health}"
TIMEOUT="${HEALTH_CHECK_TIMEOUT:-5}"

# Perform health check
response=$(curl -sf --max-time "$TIMEOUT" "http://${HOST}:${PORT}${ENDPOINT}" 2>/dev/null)

# Check if response contains "ok" status
if echo "$response" | grep -q '"status":"ok"'; then
    exit 0
else
    echo "Health check failed: $response" >&2
    exit 1
fi
