/**
 * Database Abstraction Layer - Type Definitions
 * 
 * This module provides type-safe interfaces for database operations
 * that work with both Supabase and direct PostgreSQL connections.
 */

export type DatabaseProvider = 'supabase' | 'postgres';

/**
 * Generic query result type
 */
export interface QueryResult<T = any> {
  data: T[] | null;
  error: DatabaseError | null;
  count?: number | null;
}

/**
 * Single row result type
 */
export interface SingleResult<T = any> {
  data: T | null;
  error: DatabaseError | null;
}

/**
 * Database error type
 */
export interface DatabaseError {
  message: string;
  code?: string;
  details?: string;
  hint?: string;
}

/**
 * Query builder interface - mimics Supabase's query builder API
 */
export interface QueryBuilder<T = any> {
  select(columns?: string): QueryBuilder<T>;
  insert(data: Partial<T> | Partial<T>[]): QueryBuilder<T>;
  update(data: Partial<T>): QueryBuilder<T>;
  delete(): QueryBuilder<T>;
  upsert(data: Partial<T> | Partial<T>[]): QueryBuilder<T>;
  
  // Filters
  eq(column: string, value: any): QueryBuilder<T>;
  neq(column: string, value: any): QueryBuilder<T>;
  gt(column: string, value: any): QueryBuilder<T>;
  gte(column: string, value: any): QueryBuilder<T>;
  lt(column: string, value: any): QueryBuilder<T>;
  lte(column: string, value: any): QueryBuilder<T>;
  like(column: string, pattern: string): QueryBuilder<T>;
  ilike(column: string, pattern: string): QueryBuilder<T>;
  is(column: string, value: any): QueryBuilder<T>;
  in(column: string, values: any[]): QueryBuilder<T>;
  contains(column: string, value: any): QueryBuilder<T>;
  
  // Modifiers
  order(column: string, options?: { ascending?: boolean; nullsFirst?: boolean }): QueryBuilder<T>;
  limit(count: number): QueryBuilder<T>;
  range(from: number, to: number): QueryBuilder<T>;
  single(): QueryBuilder<T>;
  maybeSingle(): QueryBuilder<T>;
  
  // Execution
  then(onfulfilled?: (result: QueryResult<T>) => any, onrejected?: (error: any) => any): Promise<any>;
}

/**
 * RPC (Remote Procedure Call) builder for database functions
 */
export interface RPCBuilder<T = any> {
  rpc(functionName: string, params?: Record<string, any>): Promise<QueryResult<T>>;
}

/**
 * Database client interface
 */
export interface DatabaseClient {
  from<T = any>(table: string): QueryBuilder<T>;
  rpc<T = any>(functionName: string, params?: Record<string, any>): Promise<QueryResult<T>>;
  
  // Auth interface (delegates to Supabase Auth for now)
  auth: {
    getUser(): Promise<{ data: { user: any } | null; error: DatabaseError | null }>;
    getSession(): Promise<{ data: { session: any } | null; error: DatabaseError | null }>;
    signOut(): Promise<{ error: DatabaseError | null }>;
  };
}

/**
 * Filter operation types
 */
export type FilterOperator =
  | 'eq'
  | 'neq'
  | 'gt'
  | 'gte'
  | 'lt'
  | 'lte'
  | 'like'
  | 'ilike'
  | 'is'
  | 'in'
  | 'contains';

/**
 * Filter definition
 */
export interface Filter {
  column: string;
  operator: FilterOperator;
  value: any;
}

/**
 * Query definition
 */
export interface QueryDefinition {
  table: string;
  operation: 'select' | 'insert' | 'update' | 'delete' | 'upsert';
  columns?: string;
  data?: any;
  filters: Filter[];
  order?: { column: string; ascending: boolean; nullsFirst?: boolean };
  limit?: number;
  range?: { from: number; to: number };
  single?: boolean;
  maybeSingle?: boolean;
}
