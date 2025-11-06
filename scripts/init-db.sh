#!/bin/bash
set -e

echo "🗄️  Starting database initialization..."

# Check if DATABASE_URL is set
if [ -z "$DATABASE_URL" ]; then
  echo "⚠️  DATABASE_URL environment variable is not set. Skipping database initialization."
  exit 0
fi

echo "✅ Database URL is configured"

# Generate Prisma Client
echo "📦 Generating Prisma Client..."
npx prisma generate --schema prisma/schema.prisma

# Push database schema (creates tables if they don't exist)
echo "🔄 Pushing database schema..."
npx prisma db push --schema prisma/schema.prisma --accept-data-loss --skip-generate

# Check if database has any users (to determine if we need to seed)
echo "🔍 Checking if database needs seeding..."
USER_COUNT=$(node --input-type=module <<'NODE'
import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();
const count = await prisma.user.count();
await prisma.$disconnect();
console.log(count);
NODE
)
USER_COUNT=${USER_COUNT:-0}

if [ "$USER_COUNT" -gt "0" ]; then
  echo "ℹ️  Database already has $USER_COUNT users. Skipping seed."
else
  echo "🌱 Database is empty. Running seed script..."
  node prisma/seed.js
  echo "✅ Database seeded successfully"
fi

echo "🎉 Database initialization complete!"
