# Migration Plan: Self-Hosted Setup with PostgreSQL and NextAuth

## Executive Summary

This plan outlines the migration from **Supabase (managed auth + database)** to a **fully self-hosted solution** using:
- **NextAuth v5 (Auth.js)** for authentication
- **Self-hosted PostgreSQL** for database
- **Existing MinIO** for storage (already self-hosted)

**Current State:**
- Supabase Auth (email/password + Google OAuth)
- Supabase PostgreSQL (20+ tables, RLS policies)
- MinIO object storage (self-hosted)
- Next.js 16 with App Router

**Target State:**
- NextAuth v5 with Credentials + Google providers
- Self-hosted PostgreSQL with application-level authorization
- MinIO object storage (unchanged)
- Next.js 16 with App Router

---

## Phase 1: Database Migration

### 1.1 Set Up Self-Hosted PostgreSQL

**Tasks:**
- [ ] Install PostgreSQL 15+ on your infrastructure
- [ ] Configure PostgreSQL for production:
  - Enable SSL/TLS
  - Set up connection pooling (PgBouncer recommended)
  - Configure backup strategy (pg_dump + WAL archiving)
  - Tune performance settings (shared_buffers, work_mem, etc.)
- [ ] Create database and user:
  ```sql
  CREATE DATABASE reading_buddy;
  CREATE USER reading_buddy_app WITH PASSWORD 'secure_password';
  GRANT ALL PRIVILEGES ON DATABASE reading_buddy TO reading_buddy_app;
  ```

**Estimated Complexity:** Medium
**Risk Level:** Low (separate from production)

### 1.2 Migrate Database Schema

**Tasks:**
- [ ] Review existing schema in `database-setup.sql`
- [ ] Create modified schema without Supabase-specific features:
  - Remove `auth.users` references
  - Replace Supabase auth triggers
  - Remove RLS policies (move to app layer)
  - Add NextAuth required tables
- [ ] Add NextAuth tables:
  ```sql
  CREATE TABLE accounts (
    id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
    type VARCHAR(255) NOT NULL,
    provider VARCHAR(255) NOT NULL,
    provider_account_id VARCHAR(255) NOT NULL,
    refresh_token TEXT,
    access_token TEXT,
    expires_at BIGINT,
    token_type VARCHAR(255),
    scope VARCHAR(255),
    id_token TEXT,
    session_state VARCHAR(255),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(provider, provider_account_id)
  );

  CREATE TABLE sessions (
    id SERIAL PRIMARY KEY,
    session_token VARCHAR(255) NOT NULL UNIQUE,
    user_id INTEGER NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
    expires TIMESTAMP WITH TIME ZONE NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE verification_tokens (
    identifier VARCHAR(255) NOT NULL,
    token VARCHAR(255) NOT NULL UNIQUE,
    expires TIMESTAMP WITH TIME ZONE NOT NULL,
    PRIMARY KEY (identifier, token)
  );
  ```
- [ ] Update `profiles` table schema:
  - Add `email` column (VARCHAR(255) UNIQUE NOT NULL)
  - Add `email_verified` column (TIMESTAMP)
  - Add `password_hash` column (VARCHAR(255), nullable for OAuth users)
  - Add `image` column (TEXT, for OAuth profile pictures)
  - Ensure `id` is compatible with NextAuth (INTEGER or UUID)

**Estimated Complexity:** High
**Risk Level:** Medium (schema changes require careful migration)

### 1.3 Data Migration Strategy

**Option A: Downtime Migration (Recommended for initial setup)**
- [ ] Set maintenance mode
- [ ] Export data from Supabase:
  ```bash
  pg_dump -h db.supabase.co -U postgres -d postgres \
    --data-only --inserts \
    -t profiles -t books -t classes -t quizzes \
    > supabase_data.sql
  ```
- [ ] Transform data to match new schema:
  - Migrate `auth.users.email` → `profiles.email`
  - Generate placeholder passwords (force password reset)
  - Map user IDs between systems
- [ ] Import to self-hosted PostgreSQL
- [ ] Verify data integrity
- [ ] Update DNS/environment variables
- [ ] Test authentication flow
- [ ] Disable maintenance mode

**Option B: Zero-Downtime Migration (Advanced)**
- [ ] Set up database replication (Supabase → Self-hosted)
- [ ] Run dual-write mode (write to both databases)
- [ ] Gradually migrate users (feature flag)
- [ ] Switch traffic to new system
- [ ] Decommission Supabase

**Recommended:** Option A for simplicity

**Estimated Complexity:** High
**Risk Level:** High (data loss risk, requires thorough testing)

---

## Phase 2: Authentication Migration

### 2.1 Install and Configure NextAuth

**Tasks:**
- [ ] Install NextAuth v5:
  ```bash
  npm install next-auth@beta
  npm install @auth/pg-adapter
  npm install bcryptjs
  npm install @types/bcryptjs --save-dev
  ```
- [ ] Create NextAuth configuration file `src/lib/auth/config.ts`:
  - Configure PostgreSQL adapter
  - Set up Credentials provider (email/password)
  - Set up Google OAuth provider
  - Configure session strategy (JWT vs database sessions)
  - Set up callbacks (jwt, session)
  - Configure pages (login, signup, error)
- [ ] Create auth route handler `src/app/api/auth/[...nextauth]/route.ts`
- [ ] Set up middleware for protected routes `src/middleware.ts`

**Estimated Complexity:** Medium
**Risk Level:** Medium (authentication is critical)

### 2.2 Implement Authentication Features

**Tasks:**
- [ ] **Email/Password Authentication:**
  - Create signup API route with bcrypt password hashing
  - Implement email verification flow
  - Add password reset functionality
  - Add rate limiting (already have Upstash Redis)

- [ ] **Google OAuth:**
  - Configure Google OAuth credentials
  - Restrict to @millennia21.id domain (current behavior)
  - Handle OAuth callback with profile creation

- [ ] **Session Management:**
  - Decide: Database sessions vs JWT sessions
  - Recommended: Database sessions for better security
  - Implement session refresh logic
  - Configure session expiration

- [ ] **Helper Functions:**
  - Create `getServerSession()` wrapper
  - Create `requireAuth()` middleware
  - Update `requireRole()` to use NextAuth session
  - Create `useSession()` client hook wrapper

**Estimated Complexity:** High
**Risk Level:** High (security-critical component)

### 2.3 Update Auth UI Components

**Tasks:**
- [ ] Update `LoginForm.tsx`:
  - Replace Supabase client with NextAuth `signIn()`
  - Handle credentials sign-in
  - Handle Google OAuth sign-in

- [ ] Update `SignupForm.tsx`:
  - Create API route for user registration
  - Hash passwords with bcrypt (12 rounds)
  - Send verification email

- [ ] Update `ForgotPasswordForm.tsx`:
  - Create password reset token generation
  - Send reset email

- [ ] Update `ResetPasswordForm.tsx`:
  - Verify reset token
  - Update password with new hash

- [ ] Update `SupabaseProvider.tsx`:
  - Replace with `SessionProvider` from NextAuth
  - Rename to `AuthProvider.tsx`

**Estimated Complexity:** Medium
**Risk Level:** Medium (user-facing changes)

---

## Phase 3: Application Code Migration

### 3.1 Replace Supabase Client Calls

**Tasks:**
- [ ] Audit all files using Supabase auth:
  ```bash
  # Find all Supabase auth usage
  grep -r "supabase.auth" web/src/
  grep -r "createClient" web/src/
  grep -r "getUser()" web/src/
  ```

- [ ] Replace auth checks:
  - `supabase.auth.getUser()` → `getServerSession()`
  - `supabase.auth.signIn()` → `signIn()` from NextAuth
  - `supabase.auth.signOut()` → `signOut()` from NextAuth
  - `supabase.auth.onAuthStateChange()` → NextAuth session hooks

- [ ] Update server-side auth:
  - Dashboard layout authentication check
  - API route authentication
  - Server actions authentication
  - Role-based access control

**Estimated Complexity:** High
**Risk Level:** High (affects all protected features)

### 3.2 Replace Database Access

**Tasks:**
- [ ] Install PostgreSQL client:
  ```bash
  npm install pg
  npm install @types/pg --save-dev
  ```

- [ ] Create database client wrapper `src/lib/db/client.ts`:
  - Connection pooling configuration
  - Query helpers
  - Transaction support
  - Error handling

- [ ] Replace all Supabase database queries:
  - `supabase.from('table')` → Direct PostgreSQL queries or ORM
  - Update all CRUD operations
  - Update all joins and complex queries

- [ ] **Consider ORM (Optional but Recommended):**
  - **Drizzle ORM** (lightweight, type-safe):
    ```bash
    npm install drizzle-orm drizzle-kit
    ```
  - **Prisma** (full-featured, migrations):
    ```bash
    npm install prisma @prisma/client
    ```
  - Pros: Type safety, migrations, easier query building
  - Cons: Additional abstraction layer, learning curve

**Estimated Complexity:** Very High
**Risk Level:** High (core data access layer)

### 3.3 Handle Row-Level Security (RLS) Migration

**Current State:** Supabase RLS policies enforce data access

**Options:**

**Option A: Application-Level Authorization (Recommended)**
- [ ] Remove all RLS policies from database
- [ ] Implement authorization checks in application code:
  - Check user role before queries
  - Filter data based on user permissions
  - Use query builders with automatic filtering
- [ ] Create authorization middleware/helpers
- [ ] Add comprehensive tests for authorization logic

**Option B: Keep Database-Level Policies**
- [ ] Convert RLS policies to PostgreSQL policies
- [ ] Use `SET LOCAL` to set user context:
  ```sql
  SET LOCAL app.user_id = '123';
  SET LOCAL app.user_role = 'STUDENT';
  ```
- [ ] Maintain policies in database

**Recommendation:** Option A for better performance and easier debugging

**Estimated Complexity:** High
**Risk Level:** High (security-critical)

---

## Phase 4: Environment & Infrastructure

### 4.1 Update Environment Variables

**Tasks:**
- [ ] Remove Supabase variables:
  ```diff
  - NEXT_PUBLIC_SUPABASE_URL=
  - NEXT_PUBLIC_SUPABASE_ANON_KEY=
  - SUPABASE_SERVICE_ROLE_KEY=
  ```

- [ ] Add NextAuth variables:
  ```env
  # NextAuth
  NEXTAUTH_URL=https://your-domain.com
  NEXTAUTH_SECRET=generate-with-openssl-rand-base64-32

  # Database
  DATABASE_URL=postgresql://reading_buddy_app:password@localhost:5432/reading_buddy

  # Google OAuth (existing Google Cloud Console project)
  GOOGLE_CLIENT_ID=your-google-client-id
  GOOGLE_CLIENT_SECRET=your-google-client-secret

  # Email (for verification/password reset)
  SMTP_HOST=smtp.gmail.com
  SMTP_PORT=587
  SMTP_USER=your-email@gmail.com
  SMTP_PASSWORD=your-app-password
  SMTP_FROM=noreply@your-domain.com
  ```

- [ ] Update `.env.example` with new variables
- [ ] Update production environment variables
- [ ] Update CI/CD pipeline environment variables

**Estimated Complexity:** Low
**Risk Level:** Medium (misconfiguration can break app)

### 4.2 Update Docker Configuration

**Tasks:**
- [ ] Add PostgreSQL to `docker-compose.yml` (if using Docker):
  ```yaml
  services:
    postgres:
      image: postgres:15-alpine
      environment:
        POSTGRES_DB: reading_buddy
        POSTGRES_USER: reading_buddy_app
        POSTGRES_PASSWORD: ${POSTGRES_PASSWORD}
      volumes:
        - postgres_data:/var/lib/postgresql/data
        - ./database-setup.sql:/docker-entrypoint-initdb.d/init.sql
      ports:
        - "5432:5432"
      restart: unless-stopped

    pgbouncer:
      image: edoburu/pgbouncer:latest
      environment:
        DATABASE_URL: postgres://reading_buddy_app:${POSTGRES_PASSWORD}@postgres:5432/reading_buddy
        POOL_MODE: transaction
        MAX_CLIENT_CONN: 100
        DEFAULT_POOL_SIZE: 20
      ports:
        - "6432:5432"
      depends_on:
        - postgres

  volumes:
    postgres_data:
  ```

- [ ] Update app service to depend on PostgreSQL
- [ ] Add health checks for database connectivity

**Estimated Complexity:** Low
**Risk Level:** Low

### 4.3 Set Up Email Service

**Tasks:**
- [ ] Choose email provider:
  - **Self-hosted:** Postfix/Sendmail
  - **Cloud SMTP:** Gmail, SendGrid, AWS SES, Resend
  - **Recommended:** Resend (developer-friendly, good free tier)

- [ ] Configure email templates:
  - Email verification template
  - Password reset template
  - Welcome email (optional)

- [ ] Create email utility functions:
  - Send verification email
  - Send password reset email
  - Email rate limiting

**Estimated Complexity:** Medium
**Risk Level:** Low (non-critical for MVP)

---

## Phase 5: Testing & Validation

### 5.1 Unit Tests

**Tasks:**
- [ ] Test authentication functions:
  - Password hashing/verification
  - Token generation/validation
  - Session management

- [ ] Test authorization functions:
  - Role-based access control
  - Permission checks

- [ ] Test database queries:
  - CRUD operations
  - Complex joins
  - Data integrity

**Estimated Complexity:** Medium
**Risk Level:** Low (improves quality)

### 5.2 Integration Tests

**Tasks:**
- [ ] Test authentication flows:
  - Email/password signup → verification → login
  - Google OAuth login
  - Password reset flow
  - Session expiration/refresh

- [ ] Test authorization:
  - Student access restrictions
  - Teacher classroom management
  - Librarian book management
  - Admin privileges

- [ ] Test data access:
  - Users can only see their own data
  - Teachers can see their students
  - Proper data isolation

**Estimated Complexity:** High
**Risk Level:** Low (catches issues before production)

### 5.3 End-to-End Tests

**Tasks:**
- [ ] Update Playwright tests:
  - Update auth test fixtures
  - Update test user creation
  - Update session mocking

- [ ] Test critical user journeys:
  - Student: Signup → Browse books → Read book → Take quiz
  - Teacher: Login → Create class → Assign book → View progress
  - Librarian: Login → Upload book → Create quiz
  - Admin: Login → Manage users

**Estimated Complexity:** Medium
**Risk Level:** Low (validates entire system)

### 5.4 Performance Testing

**Tasks:**
- [ ] Benchmark database queries:
  - Identify slow queries
  - Add missing indexes
  - Optimize N+1 queries

- [ ] Load testing:
  - Simulate concurrent users
  - Test database connection pool
  - Test session management under load

- [ ] Monitor resource usage:
  - PostgreSQL memory/CPU
  - Connection pool saturation
  - API response times

**Estimated Complexity:** Medium
**Risk Level:** Low (ensures scalability)

---

## Phase 6: Deployment & Monitoring

### 6.1 Staged Rollout

**Tasks:**
- [ ] Deploy to staging environment:
  - Full data migration dry run
  - Complete smoke tests
  - Invite beta testers

- [ ] Monitor for issues:
  - Authentication errors
  - Authorization failures
  - Database errors
  - Performance degradation

- [ ] Fix issues found in staging
- [ ] Document migration runbook

**Estimated Complexity:** Medium
**Risk Level:** Medium (final validation before production)

### 6.2 Production Deployment

**Tasks:**
- [ ] **Pre-deployment:**
  - [ ] Backup Supabase database
  - [ ] Backup MinIO objects
  - [ ] Document rollback procedure
  - [ ] Prepare maintenance page

- [ ] **Deployment:**
  - [ ] Enable maintenance mode
  - [ ] Run database migration scripts
  - [ ] Update environment variables
  - [ ] Deploy new application code
  - [ ] Verify health checks
  - [ ] Smoke test critical flows
  - [ ] Disable maintenance mode

- [ ] **Post-deployment:**
  - [ ] Monitor error logs
  - [ ] Monitor user feedback
  - [ ] Be ready for quick rollback
  - [ ] Send notification to users about password reset (if needed)

**Estimated Complexity:** High
**Risk Level:** High (production impact)

### 6.3 Monitoring & Observability

**Tasks:**
- [ ] Set up application monitoring:
  - Error tracking (Sentry, LogRocket, etc.)
  - Performance monitoring (Vercel Analytics, New Relic, etc.)
  - Custom metrics (login success rate, query performance)

- [ ] Set up database monitoring:
  - Query performance (pg_stat_statements)
  - Connection pool metrics
  - Disk usage alerts
  - Backup verification

- [ ] Set up alerts:
  - High error rates
  - Failed login attempts spike
  - Database connection failures
  - Slow query alerts

**Estimated Complexity:** Medium
**Risk Level:** Low (improves reliability)

---

## Phase 7: Cleanup & Optimization

### 7.1 Remove Supabase Dependencies

**Tasks:**
- [ ] Remove Supabase packages:
  ```bash
  npm uninstall @supabase/supabase-js @supabase/ssr
  ```
- [ ] Remove unused Supabase files:
  - `src/lib/supabase/client.ts`
  - `src/lib/supabase/server.ts`
  - `src/lib/supabase/admin.ts`
  - `src/components/providers/SupabaseProvider.tsx`
- [ ] Remove Supabase references from docs
- [ ] Archive old migration scripts

**Estimated Complexity:** Low
**Risk Level:** Low

### 7.2 Documentation

**Tasks:**
- [ ] Update README.md:
  - New setup instructions
  - Database setup guide
  - Environment variables

- [ ] Create admin documentation:
  - Database backup/restore procedures
  - User management
  - Troubleshooting guide

- [ ] Create developer documentation:
  - Authentication patterns
  - Database access patterns
  - Authorization helpers
  - Testing strategies

**Estimated Complexity:** Low
**Risk Level:** Low (but critical for maintainability)

---

## Risk Assessment & Mitigation

### High-Risk Areas

| Risk | Impact | Probability | Mitigation |
|------|--------|-------------|------------|
| Data loss during migration | Critical | Low | Multiple backups, dry runs, verification scripts |
| Authentication bypass | Critical | Low | Security audit, penetration testing |
| Authorization failures | Critical | Medium | Comprehensive tests, security review |
| Extended downtime | High | Medium | Thorough testing, rollback plan |
| Performance degradation | High | Medium | Load testing, query optimization |
| Email delivery issues | Medium | Medium | Use reliable provider, monitor delivery |

### Rollback Strategy

**If issues occur during deployment:**
1. Enable maintenance mode
2. Revert application code to previous version
3. Restore Supabase environment variables
4. Verify Supabase connection
5. Disable maintenance mode
6. Post-mortem analysis

**Data rollback:**
- Keep Supabase instance running for 30 days after migration
- Verify ability to restore from Supabase backup
- Document data inconsistencies

---

## Timeline Estimates

### Conservative Estimate (Recommended)
- **Phase 1 (Database):** 2-3 weeks
- **Phase 2 (Auth):** 2-3 weeks
- **Phase 3 (App Code):** 3-4 weeks
- **Phase 4 (Infrastructure):** 1 week
- **Phase 5 (Testing):** 2-3 weeks
- **Phase 6 (Deployment):** 1 week
- **Phase 7 (Cleanup):** 1 week

**Total:** 12-17 weeks (3-4 months)

### Aggressive Estimate
- **Total:** 6-8 weeks (with dedicated full-time development)

**Note:** Estimates assume:
- Experienced developer with Next.js/PostgreSQL knowledge
- No major blockers or scope changes
- Existing infrastructure for hosting PostgreSQL

---

## Key Decision Points

### Decision 1: Session Strategy
- **Database Sessions (Recommended):**
  - ✅ Better security (can invalidate sessions server-side)
  - ✅ Accurate concurrent user tracking
  - ❌ Database query on every request
  - ❌ Requires session cleanup job

- **JWT Sessions:**
  - ✅ No database query per request
  - ✅ Stateless, easier to scale
  - ❌ Cannot invalidate sessions until expiry
  - ❌ Token size concerns with large payloads

**Recommendation:** Database sessions (already have PostgreSQL connection pooling)

### Decision 2: ORM vs Raw SQL
- **ORM (Drizzle or Prisma):**
  - ✅ Type safety
  - ✅ Migration management
  - ✅ Easier query building
  - ❌ Learning curve
  - ❌ Some performance overhead

- **Raw SQL:**
  - ✅ Full control
  - ✅ Maximum performance
  - ❌ No type safety
  - ❌ Manual migration management
  - ❌ More boilerplate

**Recommendation:** Drizzle ORM (lightweight, type-safe, good for migration from Supabase)

### Decision 3: Authorization Layer
- **Application-level (Recommended):**
  - ✅ Easier debugging
  - ✅ Better performance
  - ✅ More flexible
  - ❌ Requires discipline

- **Database-level:**
  - ✅ Defense in depth
  - ✅ Centralized policies
  - ❌ Performance overhead
  - ❌ Harder to debug

**Recommendation:** Application-level with comprehensive testing

### Decision 4: Email Provider
- **Self-hosted (Postfix):**
  - ✅ Full control
  - ❌ Deliverability issues
  - ❌ Spam management
  - ❌ Maintenance overhead

- **Cloud SMTP (Resend, SendGrid):**
  - ✅ Better deliverability
  - ✅ Analytics
  - ✅ No maintenance
  - ❌ Monthly cost
  - ❌ External dependency

**Recommendation:** Resend (free tier: 3,000 emails/month, $20/month for 50,000)

---

## Success Criteria

- [ ] All existing users can log in successfully
- [ ] All user data migrated correctly (0% data loss)
- [ ] Authentication flows work (email/password, Google OAuth)
- [ ] Authorization working (role-based access control)
- [ ] All features functional (reading, quizzes, badges, etc.)
- [ ] Performance comparable or better than Supabase
- [ ] Zero critical security vulnerabilities
- [ ] Database backups automated and tested
- [ ] Monitoring and alerts configured
- [ ] Documentation complete and accurate

---

## Post-Migration Optimization Opportunities

Once stable, consider:
- [ ] Implement Redis caching for frequently accessed data
- [ ] Add full-text search with PostgreSQL or Elasticsearch
- [ ] Optimize images with CDN
- [ ] Implement rate limiting at nginx/reverse proxy level
- [ ] Set up read replicas for analytics queries
- [ ] Implement database sharding (if scale requires)
- [ ] Add multi-factor authentication (2FA)
- [ ] Implement passwordless authentication (magic links)

---

## Resources & References

**NextAuth v5 Documentation:**
- https://authjs.dev/
- https://authjs.dev/getting-started/installation
- https://authjs.dev/getting-started/adapters/pg

**PostgreSQL:**
- https://www.postgresql.org/docs/15/
- https://wiki.postgresql.org/wiki/Tuning_Your_PostgreSQL_Server

**Database Adapters:**
- Drizzle: https://orm.drizzle.team/
- Prisma: https://www.prisma.io/

**Email Providers:**
- Resend: https://resend.com/
- SendGrid: https://sendgrid.com/

**Migration Guides:**
- Supabase to self-hosted: https://supabase.com/docs/guides/self-hosting
- NextAuth migration: https://authjs.dev/guides/upgrade-to-v5

---

## Questions & Clarifications Needed

Before proceeding, please clarify:

1. **Hosting Environment:**
   - Where will PostgreSQL be hosted? (VPS, cloud VM, managed service?)
   - Do you have infrastructure for Docker/containers?
   - What's the expected scale (concurrent users, database size)?

2. **Timeline:**
   - What's your target completion date?
   - Can you accept downtime for migration? (How much?)
   - Do you need zero-downtime migration?

3. **Email:**
   - Preference for email provider?
   - Budget for email service?
   - Current email sending volume?

4. **Authentication:**
   - Keep Google OAuth restricted to @millennia21.id?
   - Need other OAuth providers (Microsoft, etc.)?
   - Require 2FA/MFA?

5. **Database:**
   - Preference for ORM vs raw SQL?
   - Need point-in-time recovery for database?
   - Expected data growth rate?

6. **Migration:**
   - Need to preserve exact user IDs?
   - Force all users to reset passwords, or migrate password hashes?
   - Keep audit trail of migration process?

---

**Next Steps:**
1. Review this plan and provide feedback
2. Answer clarification questions
3. Set up development/staging environment
4. Begin Phase 1: Database setup and schema migration

