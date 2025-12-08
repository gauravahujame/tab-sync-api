#!/bin/sh
set -e

# Create data directory if it doesn't exist
mkdir -p /app/data/logs

# Run database initialization only in production/dev (not in test)
if [ "$NODE_ENV" != "test" ]; then
    echo "Initializing database..."

    # Use compiled JavaScript directly - no tsx/pnpm needed
    if [ -f "dist/scripts/init-db.js" ]; then
        node dist/scripts/init-db.js
    else
        echo "ERROR: dist/scripts/init-db.js not found!"
        echo "Available files:"
        ls -la dist/ || echo "dist directory not found"
        exit 1
    fi
fi

# Print startup message
echo "Starting Tab Sync API in $NODE_ENV mode..."

# Run the main container command
exec "$@"
