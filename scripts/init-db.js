#!/usr/bin/env node

/**
 * Database Initialization Script
 * This script runs once during deployment to set up the database
 */

import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

const log = (message) => console.log(`[DB Init] ${message}`);
const error = (message) => console.error(`[DB Init ERROR] ${message}`);

async function initDatabase() {
  try {
    log('Starting database initialization...');

    // Check if database is already initialized
    log('Checking database connection...');
    try {
      const { stdout } = await execAsync('npx prisma db execute --stdin <<< "SELECT 1;"');
      log('Database connection successful');
    } catch (err) {
      error('Cannot connect to database. Please check DATABASE_URL');
      throw err;
    }

    // Push Prisma schema to database
    log('Pushing Prisma schema to database...');
    const { stdout: pushOutput } = await execAsync('npx prisma db push --accept-data-loss --skip-generate');
    log(pushOutput);
    log('✅ Database schema created successfully');

    // Check if database has data
    log('Checking if database needs seeding...');
    const { stdout: userCount } = await execAsync(
      'npx prisma db execute --stdin <<< "SELECT COUNT(*) FROM \\"User\\";"'
    );

    const hasData = !userCount.includes('0');

    if (hasData) {
      log('Database already has data. Skipping seed.');
      log('✅ Database initialization complete (already seeded)');
      return;
    }

    // Seed the database
    log('Seeding database with initial data...');
    const { stdout: seedOutput } = await execAsync('npm run db:seed');
    log(seedOutput);
    log('✅ Database seeded successfully');

    log('🎉 Database initialization completed successfully!');
  } catch (err) {
    error('Failed to initialize database:');
    error(err.message);
    if (err.stdout) log('stdout: ' + err.stdout);
    if (err.stderr) error('stderr: ' + err.stderr);
    process.exit(1);
  }
}

// Only run if this is the main module
if (import.meta.url === `file://${process.argv[1]}`) {
  initDatabase();
}

export default initDatabase;
