#!/bin/sh
# =============================================================================
# Tab-Sync-API Docker Entrypoint
# =============================================================================
# This script runs before the main application starts
# - Creates required directories
# - Initializes the database
# - Handles graceful startup
# =============================================================================

set -e

# Create data directories if they don't exist
# We support both /app/data (legacy/dev) and /data (production volume)
mkdir -p /app/data/logs /app/data/backups
if [ -d "/data" ]; then
    mkdir -p /data/logs /data/backups
    chown app:app /data/logs /data/backups 2>/dev/null || true
fi

# Run database initialization only in production/dev (not in test)
if [ "$NODE_ENV" != "test" ]; then
    echo "🗄️  Initializing database..."

    # Use compiled JavaScript directly - no tsx/pnpm needed
    if [ -f "dist/scripts/init-db.js" ]; then
        node dist/scripts/init-db.js
        echo "✅ Database initialized successfully"
    else
        echo "⚠️  Warning: dist/scripts/init-db.js not found"
        echo "   If this is the first run, the database will be created on startup."
        # List what's available for debugging
        if [ -d "dist" ]; then
            echo "   Available in dist/:"
            ls -la dist/ 2>/dev/null || echo "   (empty)"
        fi
    fi
fi

# Print startup banner
echo ""
echo "=================================================="
echo "  Tab-Sync-API Container"
echo "=================================================="
echo "  Environment: $NODE_ENV"
echo "  Port: ${PORT:-3000}"
echo "  Log Level: ${LOG_LEVEL:-info}"
echo "  Database: ${DATABASE_PATH:-/data/tabs.db}"
echo "=================================================="
echo ""

# Run the main container command (passed as arguments)
exec "$@"
