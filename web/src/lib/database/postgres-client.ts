/**
 * PostgreSQL Database Client
 * 
 * Direct PostgreSQL client that mimics Supabase's query builder API
 * for seamless migration from Supabase to self-hosted PostgreSQL.
 */

import { Pool, PoolClient, QueryResult as PgQueryResult } from 'pg';
import type {
  DatabaseClient,
  QueryBuilder,
  QueryResult,
  SingleResult,
  DatabaseError,
  QueryDefinition,
  Filter,
} from './types';

let pool: Pool | null = null;

/**
 * Initialize PostgreSQL connection pool
 */
function getPool(): Pool {
  if (!pool) {
    const config = {
      host: process.env.POSTGRES_HOST || 'localhost',
      port: parseInt(process.env.POSTGRES_PORT || '5432'),
      database: process.env.POSTGRES_DB || 'reading_buddy',
      user: process.env.POSTGRES_USER || 'postgres',
      password: process.env.POSTGRES_PASSWORD,
      ssl: process.env.POSTGRES_SSL === 'true' ? { rejectUnauthorized: false } : false,
      max: 20,
      idleTimeoutMillis: 30000,
      connectionTimeoutMillis: 2000,
    };

    pool = new Pool(config);

    pool.on('error', (err) => {
      console.error('Unexpected error on idle PostgreSQL client', err);
    });
  }

  return pool;
}

/**
 * PostgreSQL Query Builder
 * Mimics Supabase's query builder API
 */
class PostgresQueryBuilder<T = any> implements QueryBuilder<T> {
  private query: QueryDefinition;
  private userId: string | null = null;

  constructor(table: string, userId: string | null = null) {
    this.query = {
      table,
      operation: 'select',
      filters: [],
    };
    this.userId = userId;
  }

  select(columns: string = '*'): QueryBuilder<T> {
    this.query.operation = 'select';
    this.query.columns = columns;
    return this;
  }

  insert(data: Partial<T> | Partial<T>[]): QueryBuilder<T> {
    this.query.operation = 'insert';
    this.query.data = data;
    return this;
  }

  update(data: Partial<T>): QueryBuilder<T> {
    this.query.operation = 'update';
    this.query.data = data;
    return this;
  }

  delete(): QueryBuilder<T> {
    this.query.operation = 'delete';
    return this;
  }

  upsert(data: Partial<T> | Partial<T>[]): QueryBuilder<T> {
    this.query.operation = 'upsert';
    this.query.data = data;
    return this;
  }

  eq(column: string, value: any): QueryBuilder<T> {
    this.query.filters.push({ column, operator: 'eq', value });
    return this;
  }

  neq(column: string, value: any): QueryBuilder<T> {
    this.query.filters.push({ column, operator: 'neq', value });
    return this;
  }

  gt(column: string, value: any): QueryBuilder<T> {
    this.query.filters.push({ column, operator: 'gt', value });
    return this;
  }

  gte(column: string, value: any): QueryBuilder<T> {
    this.query.filters.push({ column, operator: 'gte', value });
    return this;
  }

  lt(column: string, value: any): QueryBuilder<T> {
    this.query.filters.push({ column, operator: 'lt', value });
    return this;
  }

  lte(column: string, value: any): QueryBuilder<T> {
    this.query.filters.push({ column, operator: 'lte', value });
    return this;
  }

  like(column: string, pattern: string): QueryBuilder<T> {
    this.query.filters.push({ column, operator: 'like', value: pattern });
    return this;
  }

  ilike(column: string, pattern: string): QueryBuilder<T> {
    this.query.filters.push({ column, operator: 'ilike', value: pattern });
    return this;
  }

  is(column: string, value: any): QueryBuilder<T> {
    this.query.filters.push({ column, operator: 'is', value });
    return this;
  }

  in(column: string, values: any[]): QueryBuilder<T> {
    this.query.filters.push({ column, operator: 'in', value: values });
    return this;
  }

  contains(column: string, value: any): QueryBuilder<T> {
    this.query.filters.push({ column, operator: 'contains', value });
    return this;
  }

  order(column: string, options?: { ascending?: boolean; nullsFirst?: boolean }): QueryBuilder<T> {
    this.query.order = {
      column,
      ascending: options?.ascending ?? true,
      nullsFirst: options?.nullsFirst,
    };
    return this;
  }

  limit(count: number): QueryBuilder<T> {
    this.query.limit = count;
    return this;
  }

  range(from: number, to: number): QueryBuilder<T> {
    this.query.range = { from, to };
    return this;
  }

  single(): QueryBuilder<T> {
    this.query.single = true;
    return this;
  }

  maybeSingle(): QueryBuilder<T> {
    this.query.maybeSingle = true;
    return this;
  }

  /**
   * Build SQL query from query definition
   */
  private buildSQL(): { sql: string; values: any[] } {
    const values: any[] = [];
    let sql = '';
    let valueIndex = 1;

    switch (this.query.operation) {
      case 'select': {
        sql = `SELECT ${this.query.columns || '*'} FROM ${this.query.table}`;
        
        // Add WHERE clause
        if (this.query.filters.length > 0) {
          const whereClauses: string[] = [];
          for (const filter of this.query.filters) {
            const clause = this.buildFilterClause(filter, valueIndex, values);
            whereClauses.push(clause.sql);
            valueIndex = clause.valueIndex;
          }
          sql += ` WHERE ${whereClauses.join(' AND ')}`;
        }

        // Add ORDER BY
        if (this.query.order) {
          sql += ` ORDER BY ${this.query.order.column} ${this.query.order.ascending ? 'ASC' : 'DESC'}`;
          if (this.query.order.nullsFirst !== undefined) {
            sql += this.query.order.nullsFirst ? ' NULLS FIRST' : ' NULLS LAST';
          }
        }

        // Add LIMIT
        if (this.query.limit) {
          sql += ` LIMIT $${valueIndex}`;
          values.push(this.query.limit);
          valueIndex++;
        }

        // Add OFFSET (from range)
        if (this.query.range) {
          sql += ` LIMIT $${valueIndex} OFFSET $${valueIndex + 1}`;
          values.push(this.query.range.to - this.query.range.from + 1);
          values.push(this.query.range.from);
          valueIndex += 2;
        }

        break;
      }

      case 'insert': {
        const data = Array.isArray(this.query.data) ? this.query.data : [this.query.data];
        const keys = Object.keys(data[0]);
        const valuePlaceholders = data.map((_, rowIndex) => {
          const row = keys.map((_, colIndex) => {
            return `$${valueIndex + rowIndex * keys.length + colIndex}`;
          });
          return `(${row.join(', ')})`;
        });

        data.forEach((row) => {
          keys.forEach((key) => {
            values.push(row[key]);
          });
        });

        sql = `INSERT INTO ${this.query.table} (${keys.join(', ')}) VALUES ${valuePlaceholders.join(', ')} RETURNING *`;
        break;
      }

      case 'update': {
        const keys = Object.keys(this.query.data);
        const setClauses = keys.map((key) => {
          values.push(this.query.data[key]);
          return `${key} = $${valueIndex++}`;
        });

        sql = `UPDATE ${this.query.table} SET ${setClauses.join(', ')}`;

        // Add WHERE clause
        if (this.query.filters.length > 0) {
          const whereClauses: string[] = [];
          for (const filter of this.query.filters) {
            const clause = this.buildFilterClause(filter, valueIndex, values);
            whereClauses.push(clause.sql);
            valueIndex = clause.valueIndex;
          }
          sql += ` WHERE ${whereClauses.join(' AND ')}`;
        }

        sql += ' RETURNING *';
        break;
      }

      case 'delete': {
        sql = `DELETE FROM ${this.query.table}`;

        // Add WHERE clause
        if (this.query.filters.length > 0) {
          const whereClauses: string[] = [];
          for (const filter of this.query.filters) {
            const clause = this.buildFilterClause(filter, valueIndex, values);
            whereClauses.push(clause.sql);
            valueIndex = clause.valueIndex;
          }
          sql += ` WHERE ${whereClauses.join(' AND ')}`;
        }

        sql += ' RETURNING *';
        break;
      }

      case 'upsert': {
        // PostgreSQL UPSERT using ON CONFLICT
        const data = Array.isArray(this.query.data) ? this.query.data : [this.query.data];
        const keys = Object.keys(data[0]);
        const valuePlaceholders = data.map((_, rowIndex) => {
          const row = keys.map((_, colIndex) => {
            return `$${valueIndex + rowIndex * keys.length + colIndex}`;
          });
          return `(${row.join(', ')})`;
        });

        data.forEach((row) => {
          keys.forEach((key) => {
            values.push(row[key]);
          });
        });

        // Assume primary key or unique constraint exists
        const updateClauses = keys.map((key) => `${key} = EXCLUDED.${key}`);
        sql = `INSERT INTO ${this.query.table} (${keys.join(', ')}) VALUES ${valuePlaceholders.join(', ')} ON CONFLICT DO UPDATE SET ${updateClauses.join(', ')} RETURNING *`;
        break;
      }
    }

    return { sql, values };
  }

  /**
   * Build filter clause for WHERE conditions
   */
  private buildFilterClause(
    filter: Filter,
    valueIndex: number,
    values: any[]
  ): { sql: string; valueIndex: number } {
    let sql = '';

    switch (filter.operator) {
      case 'eq':
        sql = `${filter.column} = $${valueIndex}`;
        values.push(filter.value);
        valueIndex++;
        break;
      case 'neq':
        sql = `${filter.column} != $${valueIndex}`;
        values.push(filter.value);
        valueIndex++;
        break;
      case 'gt':
        sql = `${filter.column} > $${valueIndex}`;
        values.push(filter.value);
        valueIndex++;
        break;
      case 'gte':
        sql = `${filter.column} >= $${valueIndex}`;
        values.push(filter.value);
        valueIndex++;
        break;
      case 'lt':
        sql = `${filter.column} < $${valueIndex}`;
        values.push(filter.value);
        valueIndex++;
        break;
      case 'lte':
        sql = `${filter.column} <= $${valueIndex}`;
        values.push(filter.value);
        valueIndex++;
        break;
      case 'like':
        sql = `${filter.column} LIKE $${valueIndex}`;
        values.push(filter.value);
        valueIndex++;
        break;
      case 'ilike':
        sql = `${filter.column} ILIKE $${valueIndex}`;
        values.push(filter.value);
        valueIndex++;
        break;
      case 'is':
        sql = `${filter.column} IS ${filter.value === null ? 'NULL' : `$${valueIndex}`}`;
        if (filter.value !== null) {
          values.push(filter.value);
          valueIndex++;
        }
        break;
      case 'in':
        const placeholders = filter.value.map((_: any, i: number) => `$${valueIndex + i}`);
        sql = `${filter.column} IN (${placeholders.join(', ')})`;
        values.push(...filter.value);
        valueIndex += filter.value.length;
        break;
      case 'contains':
        sql = `${filter.column} @> $${valueIndex}`;
        values.push(JSON.stringify(filter.value));
        valueIndex++;
        break;
    }

    return { sql, valueIndex };
  }

  /**
   * Execute the query and return results
   */
  async then(
    onfulfilled?: (result: QueryResult<T>) => any,
    onrejected?: (error: any) => any
  ): Promise<any> {
    try {
      const { sql, values } = this.buildSQL();
      
      console.log('[PostgreSQL Query]', sql, values);

      const pool = getPool();
      const result: PgQueryResult = await pool.query(sql, values);

      let data: T[] | T | null = null;
      
      if (this.query.single) {
        data = result.rows[0] || null;
        if (!data) {
          throw new Error('No rows returned for single() query');
        }
      } else if (this.query.maybeSingle) {
        data = result.rows[0] || null;
      } else {
        data = result.rows;
      }

      const queryResult: QueryResult<T> | SingleResult<T> = this.query.single || this.query.maybeSingle
        ? { data: data as T | null, error: null }
        : { data: data as T[] | null, error: null, count: result.rowCount || 0 };

      return onfulfilled ? onfulfilled(queryResult as QueryResult<T>) : queryResult;
    } catch (err: any) {
      const error: DatabaseError = {
        message: err.message || 'Database query failed',
        code: err.code,
        details: err.detail,
        hint: err.hint,
      };

      console.error('[PostgreSQL Error]', error);

      const queryResult: QueryResult<T> | SingleResult<T> = this.query.single || this.query.maybeSingle
        ? { data: null, error }
        : { data: null, error, count: null };

      return onrejected ? onrejected(error) : queryResult;
    }
  }
}

/**
 * PostgreSQL Database Client
 * Implements the DatabaseClient interface
 */
export class PostgresClient implements DatabaseClient {
  private userId: string | null = null;

  constructor(userId: string | null = null) {
    this.userId = userId;
  }

  from<T = any>(table: string): QueryBuilder<T> {
    return new PostgresQueryBuilder<T>(table, this.userId);
  }

  async rpc<T = any>(functionName: string, params?: Record<string, any>): Promise<QueryResult<T>> {
    try {
      const pool = getPool();
      
      // Build function call
      const paramKeys = params ? Object.keys(params) : [];
      const paramPlaceholders = paramKeys.map((_, i) => `$${i + 1}`);
      const sql = `SELECT * FROM ${functionName}(${paramPlaceholders.join(', ')})`;
      const values = paramKeys.map((key) => params![key]);

      console.log('[PostgreSQL RPC]', sql, values);

      const result: PgQueryResult = await pool.query(sql, values);

      return {
        data: result.rows,
        error: null,
        count: result.rowCount || 0,
      };
    } catch (err: any) {
      const error: DatabaseError = {
        message: err.message || 'RPC call failed',
        code: err.code,
        details: err.detail,
        hint: err.hint,
      };

      console.error('[PostgreSQL RPC Error]', error);

      return {
        data: null,
        error,
        count: null,
      };
    }
  }

  // Auth is delegated to Supabase Auth for now
  // This will be replaced with NextAuth.js in Phase 2 of the migration
  auth = {
    async getUser() {
      throw new Error('Auth not implemented for PostgreSQL client. Use Supabase Auth or implement NextAuth.js');
    },
    async getSession() {
      throw new Error('Auth not implemented for PostgreSQL client. Use Supabase Auth or implement NextAuth.js');
    },
    async signOut() {
      throw new Error('Auth not implemented for PostgreSQL client. Use Supabase Auth or implement NextAuth.js');
    },
  };
}

/**
 * Create a PostgreSQL client instance
 */
export function createPostgresClient(userId: string | null = null): DatabaseClient {
  return new PostgresClient(userId);
}

/**
 * Close the connection pool (for cleanup)
 */
export async function closePool(): Promise<void> {
  if (pool) {
    await pool.end();
    pool = null;
  }
}
