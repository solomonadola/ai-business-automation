#!/bin/sh
set -e

echo "Running database migrations..."
node dist/adapters/database/migrate.js

echo "Starting application server..."
exec "$@"
