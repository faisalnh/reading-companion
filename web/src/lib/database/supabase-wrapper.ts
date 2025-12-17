/**
 * Supabase Client Wrapper
 * 
 * Wraps the existing Supabase client to match our DatabaseClient interface.
 * This allows seamless switching between Supabase and PostgreSQL.
 */

import type { SupabaseClient } from '@supabase/supabase-js';
import type { DatabaseClient, QueryBuilder, QueryResult, DatabaseError } from './types';

/**
 * Wrap Supabase's QueryBuilder to match our interface
 * Supabase's query builder already matches our interface, so we mostly pass through
 */
class SupabaseQueryBuilderWrapper<T = any> implements QueryBuilder<T> {
  constructor(private supabaseBuilder: any) {}

  select(columns?: string): QueryBuilder<T> {
    return new SupabaseQueryBuilderWrapper(this.supabaseBuilder.select(columns));
  }

  insert(data: Partial<T> | Partial<T>[]): QueryBuilder<T> {
    return new SupabaseQueryBuilderWrapper(this.supabaseBuilder.insert(data));
  }

  update(data: Partial<T>): QueryBuilder<T> {
    return new SupabaseQueryBuilderWrapper(this.supabaseBuilder.update(data));
  }

  delete(): QueryBuilder<T> {
    return new SupabaseQueryBuilderWrapper(this.supabaseBuilder.delete());
  }

  upsert(data: Partial<T> | Partial<T>[]): QueryBuilder<T> {
    return new SupabaseQueryBuilderWrapper(this.supabaseBuilder.upsert(data));
  }

  eq(column: string, value: any): QueryBuilder<T> {
    return new SupabaseQueryBuilderWrapper(this.supabaseBuilder.eq(column, value));
  }

  neq(column: string, value: any): QueryBuilder<T> {
    return new SupabaseQueryBuilderWrapper(this.supabaseBuilder.neq(column, value));
  }

  gt(column: string, value: any): QueryBuilder<T> {
    return new SupabaseQueryBuilderWrapper(this.supabaseBuilder.gt(column, value));
  }

  gte(column: string, value: any): QueryBuilder<T> {
    return new SupabaseQueryBuilderWrapper(this.supabaseBuilder.gte(column, value));
  }

  lt(column: string, value: any): QueryBuilder<T> {
    return new SupabaseQueryBuilderWrapper(this.supabaseBuilder.lt(column, value));
  }

  lte(column: string, value: any): QueryBuilder<T> {
    return new SupabaseQueryBuilderWrapper(this.supabaseBuilder.lte(column, value));
  }

  like(column: string, pattern: string): QueryBuilder<T> {
    return new SupabaseQueryBuilderWrapper(this.supabaseBuilder.like(column, pattern));
  }

  ilike(column: string, pattern: string): QueryBuilder<T> {
    return new SupabaseQueryBuilderWrapper(this.supabaseBuilder.ilike(column, pattern));
  }

  is(column: string, value: any): QueryBuilder<T> {
    return new SupabaseQueryBuilderWrapper(this.supabaseBuilder.is(column, value));
  }

  in(column: string, values: any[]): QueryBuilder<T> {
    return new SupabaseQueryBuilderWrapper(this.supabaseBuilder.in(column, values));
  }

  contains(column: string, value: any): QueryBuilder<T> {
    return new SupabaseQueryBuilderWrapper(this.supabaseBuilder.contains(column, value));
  }

  order(column: string, options?: { ascending?: boolean; nullsFirst?: boolean }): QueryBuilder<T> {
    return new SupabaseQueryBuilderWrapper(this.supabaseBuilder.order(column, options));
  }

  limit(count: number): QueryBuilder<T> {
    return new SupabaseQueryBuilderWrapper(this.supabaseBuilder.limit(count));
  }

  range(from: number, to: number): QueryBuilder<T> {
    return new SupabaseQueryBuilderWrapper(this.supabaseBuilder.range(from, to));
  }

  single(): QueryBuilder<T> {
    return new SupabaseQueryBuilderWrapper(this.supabaseBuilder.single());
  }

  maybeSingle(): QueryBuilder<T> {
    return new SupabaseQueryBuilderWrapper(this.supabaseBuilder.maybeSingle());
  }

  then(onfulfilled?: (result: QueryResult<T>) => any, onrejected?: (error: any) => any): Promise<any> {
    return this.supabaseBuilder.then(onfulfilled, onrejected);
  }
}

/**
 * Wrap Supabase client to match our DatabaseClient interface
 */
export class SupabaseClientWrapper implements DatabaseClient {
  constructor(private supabase: SupabaseClient) {}

  from<T = any>(table: string): QueryBuilder<T> {
    return new SupabaseQueryBuilderWrapper<T>(this.supabase.from(table));
  }

  async rpc<T = any>(functionName: string, params?: Record<string, any>): Promise<QueryResult<T>> {
    return this.supabase.rpc(functionName, params) as Promise<QueryResult<T>>;
  }

  get auth() {
    return this.supabase.auth;
  }
}

/**
 * Create a wrapped Supabase client
 */
export function wrapSupabaseClient(supabase: SupabaseClient): DatabaseClient {
  return new SupabaseClientWrapper(supabase);
}
