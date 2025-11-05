#!/bin/bash
set -e

echo "🗄️  Starting database initialization..."

# Check if DATABASE_URL is set
if [ -z "$DATABASE_URL" ]; then
  echo "❌ ERROR: DATABASE_URL environment variable is not set"
  exit 1
fi

echo "✅ Database URL is configured"

# Generate Prisma Client
echo "📦 Generating Prisma Client..."
npx prisma generate

# Push database schema (creates tables if they don't exist)
echo "🔄 Pushing database schema..."
npx prisma db push --accept-data-loss --skip-generate

# Check if database has any users (to determine if we need to seed)
echo "🔍 Checking if database needs seeding..."
USER_COUNT=$(npx prisma db execute --stdin <<< 'SELECT COUNT(*) as count FROM "User";' | grep -oP '\d+' | head -1 || echo "0")

if [ "$USER_COUNT" -gt "0" ]; then
  echo "ℹ️  Database already has $USER_COUNT users. Skipping seed."
else
  echo "🌱 Database is empty. Running seed script..."
  npm run db:seed
  echo "✅ Database seeded successfully"
fi

echo "🎉 Database initialization complete!"
