# PostgreSQL Migration Guide

This document describes how to migrate from Supabase to local PostgreSQL for the Reading Companion application.

## Overview

The Reading Companion application has been updated to support both Supabase (cloud) and PostgreSQL (self-hosted) as database providers. This allows organizations to:

- **Reduce costs** by eliminating Supabase subscription fees
- **Improve data sovereignty** by hosting data on-premises
- **Eliminate cloud dependencies** for fully self-hosted deployment
- **Maintain compatibility** with existing Supabase installations

## Architecture

The migration introduces a **database abstraction layer** that provides a unified interface for both database providers:

```
┌─────────────────────────────────────────────────────┐
│           Application Code (Actions/API)            │
└─────────────────────────────────────────────────────┘
                         │
                         ▼
┌─────────────────────────────────────────────────────┐
│          Database Abstraction Layer                  │
│     (web/src/lib/database/factory.ts)               │
└─────────────────────────────────────────────────────┘
                         │
            ┌────────────┴────────────┐
            ▼                         ▼
┌───────────────────────┐  ┌──────────────────────┐
│  Supabase Client      │  │  PostgreSQL Client   │
│  (Existing)           │  │  (New)               │
└───────────────────────┘  └──────────────────────┘
            │                         │
            ▼                         ▼
┌───────────────────────┐  ┌──────────────────────┐
│  Supabase Cloud       │  │  Local PostgreSQL    │
└───────────────────────┘  └──────────────────────┘
```

## Features

### ✅ Phase 1: Database Layer (Current)
- [x] PostgreSQL Docker container with automatic initialization
- [x] Database abstraction layer with Supabase-compatible API
- [x] Query builder that mimics Supabase's interface
- [x] Environment-based provider selection (`DB_PROVIDER`)
- [x] Connection pooling for PostgreSQL
- [x] Comprehensive type definitions

### ⏳ Phase 2: Application Migration (TODO)
- [ ] Update all database calls to use abstraction layer
- [ ] Application-level RLS middleware
- [ ] Migration script to import data from Supabase
- [ ] Integration tests for PostgreSQL mode

### 🔮 Phase 3: Authentication (Future)
- [ ] Replace Supabase Auth with NextAuth.js
- [ ] OAuth provider configuration (Google, GitHub)
- [ ] Session management
- [ ] Password reset flows

## Installation

### 1. Install Dependencies

```bash
cd web
npm install pg@^8.13.1
npm install --save-dev @types/pg@^8.11.10
```

### 2. Configure Environment

Add the following to your `.env` file:

```env
# Database Provider: "supabase" or "postgres"
DB_PROVIDER=postgres

# PostgreSQL Configuration (when DB_PROVIDER=postgres)
POSTGRES_HOST=postgres
POSTGRES_PORT=5432
POSTGRES_DB=reading_buddy
POSTGRES_USER=postgres
POSTGRES_PASSWORD=your-secure-password
POSTGRES_SSL=false
```

### 3. Start PostgreSQL with Docker Compose

```bash
# Start all services including PostgreSQL
docker-compose up -d

# Check PostgreSQL is running
docker-compose logs postgres

# The database will be automatically initialized with database-setup.sql
```

### 4. Verify Connection

Test the PostgreSQL connection:

```bash
# Connect to PostgreSQL
docker exec -it reading-buddy-postgres psql -U postgres -d reading_buddy

# Check tables
\dt

# Exit
\q
```

## Database Provider Selection

The application selects the database provider based on the `DB_PROVIDER` environment variable:

| Provider   | Use Case                                      | Auth Provider |
|------------|-----------------------------------------------|---------------|
| `supabase` | Cloud-hosted (default)                        | Supabase Auth |
| `postgres` | Self-hosted PostgreSQL                        | Supabase Auth |

**Note:** Phase 1 uses Supabase Auth for both providers. Phase 3 will add NextAuth.js support for fully self-hosted auth.

## Migration Path

### Option A: New Installation (Recommended)

For new installations, simply set `DB_PROVIDER=postgres` and start fresh with local PostgreSQL.

```bash
# 1. Configure environment
cp .env.example .env
# Edit .env and set DB_PROVIDER=postgres

# 2. Start services
docker-compose up -d

# 3. Access application
# The database will be automatically initialized
```

### Option B: Migrate from Supabase

For existing Supabase installations, follow these steps:

#### 1. Export Data from Supabase

```bash
# Install Supabase CLI
npm install -g supabase

# Login to Supabase
supabase login

# Export data
supabase db dump --data-only > supabase-data.sql
```

#### 2. Set Up Local PostgreSQL

```bash
# Update .env to use postgres provider
DB_PROVIDER=postgres

# Start PostgreSQL container
docker-compose up -d postgres

# Wait for initialization to complete
docker-compose logs -f postgres
```

#### 3. Import Data

```bash
# Import data into local PostgreSQL
docker exec -i reading-buddy-postgres psql -U postgres -d reading_buddy < supabase-data.sql
```

#### 4. Update Application

```bash
# Stop application
docker-compose stop reading-buddy

# Update environment
# Ensure DB_PROVIDER=postgres in .env

# Start application
docker-compose up -d reading-buddy
```

#### 5. Verify Migration

1. Check that all users can log in
2. Verify books are displaying correctly
3. Test quiz generation and submission
4. Check student progress tracking
5. Verify teacher/librarian/admin functions

### Option C: Parallel Running (Testing)

Run both Supabase and PostgreSQL simultaneously for testing:

```bash
# Production: Keep using Supabase
DB_PROVIDER=supabase

# Development/Staging: Test with PostgreSQL
DB_PROVIDER=postgres
```

## API Compatibility

The PostgreSQL client mimics Supabase's query builder API:

### Select Queries

```typescript
// Supabase
const { data, error } = await supabase
  .from('books')
  .select('*')
  .eq('published', true)
  .order('title', { ascending: true })
  .limit(10);

// PostgreSQL (same API!)
const { data, error } = await db
  .from('books')
  .select('*')
  .eq('published', true)
  .order('title', { ascending: true })
  .limit(10);
```

### Insert Queries

```typescript
// Supabase
const { data, error } = await supabase
  .from('books')
  .insert({ title: 'New Book', author: 'Author' });

// PostgreSQL (same API!)
const { data, error } = await db
  .from('books')
  .insert({ title: 'New Book', author: 'Author' });
```

### Update Queries

```typescript
// Supabase
const { data, error } = await supabase
  .from('books')
  .update({ published: true })
  .eq('id', bookId);

// PostgreSQL (same API!)
const { data, error } = await db
  .from('books')
  .update({ published: true })
  .eq('id', bookId);
```

### RPC Calls

```typescript
// Supabase
const { data, error } = await supabase
  .rpc('increment_pages_read', { p_student_id: studentId, p_pages: 10 });

// PostgreSQL (same API!)
const { data, error } = await db
  .rpc('increment_pages_read', { p_student_id: studentId, p_pages: 10 });
```

## Code Changes Required

### 1. Update Import Statements

**Before:**
```typescript
import { createSupabaseServerClient } from '@/lib/supabase/server';

const supabase = await createSupabaseServerClient();
const { data, error } = await supabase.from('books').select('*');
```

**After:**
```typescript
import { createServerDatabaseClient } from '@/lib/database/factory';

const db = await createServerDatabaseClient();
const { data, error } = await db.from('books').select('*');
```

### 2. Update Client-Side Code

**Before:**
```typescript
import { createSupabaseBrowserClient } from '@/lib/supabase/client';

const supabase = createSupabaseBrowserClient();
const { data, error } = await supabase.from('books').select('*');
```

**After:**
```typescript
import { createBrowserDatabaseClient } from '@/lib/database/factory';

const db = createBrowserDatabaseClient();
const { data, error } = await db.from('books').select('*');
```

### 3. Update Admin Operations

**Before:**
```typescript
import { getSupabaseAdminClient } from '@/lib/supabase/admin';

const supabaseAdmin = getSupabaseAdminClient();
const { data, error } = await supabaseAdmin.from('profiles').select('*');
```

**After:**
```typescript
import { createAdminDatabaseClient } from '@/lib/database/factory';

const db = createAdminDatabaseClient();
const { data, error } = await db.from('profiles').select('*');
```

## Row Level Security (RLS)

### Supabase Approach
Supabase uses PostgreSQL's built-in Row Level Security (RLS) policies enforced at the database level.

### PostgreSQL Approach
With direct PostgreSQL access, RLS must be implemented at the application level:

#### Option 1: Database RLS (Recommended)
Keep using PostgreSQL's native RLS policies. This requires:
- Setting `app.user_id` session variable before each query
- Policies check `current_setting('app.user_id')`

#### Option 2: Application-Level RLS
Implement RLS checks in application middleware:
- Check user permissions before queries
- Filter results based on user role
- Add automatic WHERE clauses for security

**Example Application-Level RLS:**

```typescript
// Middleware automatically adds filters based on user role
class RLSMiddleware {
  async applyRLS(query: QueryBuilder, table: string, userId: string, role: string) {
    if (table === 'student_books' && role === 'STUDENT') {
      // Students can only see their own progress
      query.eq('student_id', userId);
    }
    
    if (table === 'classes' && role === 'TEACHER') {
      // Teachers can only see their own classes
      query.eq('teacher_id', userId);
    }
    
    return query;
  }
}
```

## Authentication

### Current State (Phase 1-2)
- Both providers use **Supabase Auth**
- Users log in through Supabase regardless of database provider
- Auth tokens are validated against Supabase

### Future State (Phase 3)
- Replace Supabase Auth with **NextAuth.js**
- Support multiple OAuth providers (Google, GitHub, Microsoft)
- Credential provider for email/password
- Sessions stored in PostgreSQL

## Performance Considerations

### Connection Pooling
PostgreSQL client uses connection pooling with these defaults:
- Max connections: 20
- Idle timeout: 30 seconds
- Connection timeout: 2 seconds

Adjust in `web/src/lib/database/postgres-client.ts`:

```typescript
const pool = new Pool({
  max: 20,  // Maximum number of clients
  idleTimeoutMillis: 30000,  // Close idle clients after 30s
  connectionTimeoutMillis: 2000,  // Fail fast if can't connect
});
```

### Query Optimization
- All queries are logged for debugging (disable in production)
- Indexes from `database-setup.sql` are automatically created
- Use `.select('specific, columns')` instead of `.select('*')`
- Consider pagination for large result sets

## Troubleshooting

### Cannot Connect to PostgreSQL

**Error:** `ECONNREFUSED` or `Connection timeout`

**Solution:**
```bash
# Check PostgreSQL is running
docker-compose ps postgres

# Check logs
docker-compose logs postgres

# Verify connection from host
docker exec reading-buddy-postgres pg_isready

# Check network
docker network inspect reading-buddy-network
```

### Database Not Initialized

**Error:** Tables don't exist

**Solution:**
```bash
# Manually run initialization script
docker exec -i reading-buddy-postgres psql -U postgres -d reading_buddy < database-setup.sql
```

### Permission Denied

**Error:** `permission denied for table`

**Solution:**
```bash
# Check user has correct permissions
docker exec -it reading-buddy-postgres psql -U postgres -d reading_buddy

# Grant permissions
GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA public TO postgres;
GRANT ALL PRIVILEGES ON ALL SEQUENCES IN SCHEMA public TO postgres;
```

### Auth Errors with PostgreSQL

**Error:** `Auth not implemented for PostgreSQL client`

**Note:** This is expected in Phase 1-2. Auth still goes through Supabase Auth.

**Workaround:** Ensure `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY` are set.

## Monitoring

### PostgreSQL Statistics

```sql
-- Active connections
SELECT count(*) FROM pg_stat_activity;

-- Slow queries
SELECT * FROM pg_stat_statements 
ORDER BY mean_exec_time DESC 
LIMIT 10;

-- Database size
SELECT pg_size_pretty(pg_database_size('reading_buddy'));

-- Table sizes
SELECT schemaname, tablename, pg_size_pretty(pg_total_relation_size(schemaname||'.'||tablename))
FROM pg_tables
WHERE schemaname = 'public'
ORDER BY pg_total_relation_size(schemaname||'.'||tablename) DESC;
```

### Application Logs

Enable debug logging:

```env
# In .env
NODE_ENV=development
```

PostgreSQL queries will be logged to console:
```
[PostgreSQL Query] SELECT * FROM books WHERE id = $1 [123]
[PostgreSQL RPC] SELECT * FROM increment_pages_read($1, $2) [uuid, 10]
```

## Backup and Recovery

### Automated Backups

Add to docker-compose.yml:

```yaml
services:
  postgres-backup:
    image: postgres:16-alpine
    environment:
      POSTGRES_HOST: postgres
      POSTGRES_DB: reading_buddy
      POSTGRES_USER: postgres
      POSTGRES_PASSWORD: ${POSTGRES_PASSWORD}
    volumes:
      - ./backups:/backups
    command: >
      sh -c "
        while true; do
          pg_dump -h postgres -U postgres reading_buddy > /backups/backup-$(date +%Y%m%d-%H%M%S).sql
          sleep 86400
        done
      "
    depends_on:
      - postgres
```

### Manual Backup

```bash
# Backup
docker exec reading-buddy-postgres pg_dump -U postgres reading_buddy > backup.sql

# Restore
docker exec -i reading-buddy-postgres psql -U postgres -d reading_buddy < backup.sql
```

## Security Best Practices

1. **Change Default Password**
   ```env
   POSTGRES_PASSWORD=use-a-strong-random-password
   ```

2. **Enable SSL in Production**
   ```env
   POSTGRES_SSL=true
   ```

3. **Restrict Network Access**
   - Don't expose port 5432 to the internet
   - Use Docker networks for internal communication
   - Consider VPN for remote access

4. **Regular Updates**
   ```bash
   docker-compose pull postgres
   docker-compose up -d postgres
   ```

5. **Audit Logging**
   Enable PostgreSQL audit logging in production

## Roadmap

### v1.7.0 - Database Layer (Current)
- ✅ PostgreSQL container and initialization
- ✅ Database abstraction layer
- ✅ Query builder compatible with Supabase
- ⏳ Update all application code
- ⏳ Application-level RLS middleware
- ⏳ Migration tooling

### v1.8.0 - Authentication
- ⏳ NextAuth.js integration
- ⏳ OAuth providers (Google, GitHub, Microsoft)
- ⏳ Credential provider (email/password)
- ⏳ Session management
- ⏳ Migration script for user accounts

### v2.0.0 - Full Self-Hosted
- ⏳ Remove all Supabase dependencies
- ⏳ Complete documentation
- ⏳ Deployment guides
- ⏳ Monitoring and alerting
- ⏳ Backup automation

## Support

For issues with PostgreSQL migration:

- Check the [Troubleshooting](#troubleshooting) section
- Review [GitHub Issues](https://github.com/faisalnh/reading-companion/issues)
- See [Project Roadmap](Project-Roadmap.md) for future plans

---

**Version:** 1.7.0-alpha  
**Last Updated:** December 17, 2024  
**Status:** Phase 1 - Foundation Complete
