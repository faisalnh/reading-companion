#!/bin/bash
set -e

echo "🚀 Starting Reading Buddy..."

# Run database initialization if DATABASE_URL is set
if [ -n "$DATABASE_URL" ]; then
  echo "🗄️  Initializing database..."
  bash /app/scripts/init-db.sh
else
  echo "⚠️  DATABASE_URL not set, skipping database initialization"
fi

# Start the Next.js server
echo "▶️  Starting server..."
exec node server.js
