/**
 * Database Factory
 * 
 * Creates the appropriate database client based on DB_PROVIDER environment variable.
 * Provides a unified interface for both Supabase and PostgreSQL.
 */

import type { DatabaseClient, DatabaseProvider } from './types';

/**
 * Get the database provider from environment
 */
export function getDatabaseProvider(): DatabaseProvider {
  const provider = process.env.DB_PROVIDER || 'supabase';
  
  if (provider !== 'supabase' && provider !== 'postgres') {
    console.warn(`Invalid DB_PROVIDER: ${provider}. Falling back to 'supabase'`);
    return 'supabase';
  }
  
  return provider as DatabaseProvider;
}

/**
 * Create a database client based on the configured provider
 */
export async function createDatabaseClient(userId: string | null = null): Promise<DatabaseClient> {
  const provider = getDatabaseProvider();
  
  console.log(`[Database Factory] Creating ${provider} client`);
  
  if (provider === 'postgres') {
    const { createPostgresClient } = await import('./postgres-client');
    return createPostgresClient(userId);
  } else {
    // Import Supabase client - we'll create a wrapper for it
    const { createSupabaseClient } = await import('./supabase-client');
    return createSupabaseClient();
  }
}

/**
 * Create a server-side database client
 * This is the main entry point for server-side database operations
 */
export async function createServerDatabaseClient(): Promise<DatabaseClient> {
  const provider = getDatabaseProvider();
  
  if (provider === 'postgres') {
    const { createPostgresClient } = await import('./postgres-client');
    return createPostgresClient();
  } else {
    // Use existing Supabase server client
    const { createSupabaseServerClient } = await import('../supabase/server');
    return await createSupabaseServerClient() as DatabaseClient;
  }
}

/**
 * Create a browser-side database client
 * This is the main entry point for client-side database operations
 */
export function createBrowserDatabaseClient(): DatabaseClient {
  const provider = getDatabaseProvider();
  
  if (provider === 'postgres') {
    throw new Error('PostgreSQL client cannot be used in the browser. Use Supabase or implement an API layer.');
  } else {
    // Use existing Supabase browser client
    const { createSupabaseBrowserClient } = require('../supabase/client');
    return createSupabaseBrowserClient() as DatabaseClient;
  }
}

/**
 * Create an admin database client with elevated privileges
 */
export function createAdminDatabaseClient(): DatabaseClient {
  const provider = getDatabaseProvider();
  
  if (provider === 'postgres') {
    const { createPostgresClient } = require('./postgres-client');
    // For PostgreSQL, admin client is the same as regular client
    // since we're using application-level permissions
    return createPostgresClient();
  } else {
    // Use existing Supabase admin client
    const { getSupabaseAdminClient } = require('../supabase/admin');
    return getSupabaseAdminClient() as DatabaseClient;
  }
}
