#!/bin/sh
set -e

# Create data directory if it doesn't exist
mkdir -p /app/data

# Run database initialization
if [ "$NODE_ENV" != "test" ]; then
  echo "Initializing database..."
  pnpm run db:init
fi

# Run the main container command

exec "$@"
