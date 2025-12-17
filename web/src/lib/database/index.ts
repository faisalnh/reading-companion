/**
 * Database Module - Main Entry Point
 * 
 * Provides database abstraction layer for Reading Companion.
 * Supports both Supabase (cloud) and PostgreSQL (self-hosted).
 */

export * from './types';
export * from './factory';
export * from './postgres-client';
export * from './supabase-wrapper';

// Re-export factory functions as default exports
export {
  createServerDatabaseClient,
  createBrowserDatabaseClient,
  createAdminDatabaseClient,
  getDatabaseProvider,
} from './factory';
