# Komodo Deployment Package - PostgreSQL Migration

This directory contains everything needed to deploy Reading Buddy with PostgreSQL on your Komodo server.

## 📁 Contents

```
komodo-deployment/
├── README.md                          # This file
├── DEPLOYMENT_INSTRUCTIONS.md         # Complete step-by-step guide
├── QUICK_CHECKLIST.md                 # Quick reference checklist
└── postgres-init-scripts/             # SQL files for PostgreSQL initialization
    ├── 01-extensions.sql
    ├── 02-nextauth-schema.sql
    ├── 03-app-schema.sql
    ├── 04-functions.sql
    ├── 05-triggers.sql
    ├── 06-rls-policies.sql
    └── 07-seed-data.sql
```

## 🚀 Quick Start

1. **Read first:** `DEPLOYMENT_INSTRUCTIONS.md` - Complete deployment guide
2. **Use this:** `QUICK_CHECKLIST.md` - Step-by-step checklist during deployment
3. **Upload these:** `postgres-init-scripts/*.sql` - To Komodo stack init-scripts directory

## 📋 Prerequisites

Before starting deployment:

- [ ] **Database backup ready**: `local-postgres-backup.sql` (created with pg_dump)
- [ ] **Passwords generated**: Run `openssl rand -base64 32` twice (DB_PASSWORD, NEXTAUTH_SECRET)
- [ ] **Code merged**: `local-db` branch ready to merge to `staging`
- [ ] **Komodo access**: SSH or UI access to Komodo server
- [ ] **GitHub secrets updated**: Remove Supabase secrets, add PostgreSQL secrets

## 🎯 Deployment Overview

### Stack 1: PostgreSQL Database
**Name:** `reading-buddy-postgres-staging`

- PostgreSQL 16 container
- Persistent data volume
- Health checks enabled
- Init scripts auto-run on first start
- Connected to shared network

### Stack 2: Application (Updated)
**Name:** `reading-companion-staging` (existing)

- Next.js application
- Connects to PostgreSQL stack
- Uses NextAuth for authentication
- MinIO for file storage
- Local AI provider

## 📊 Architecture

```
┌─────────────────────────────────────────┐
│   Komodo Server                         │
│                                         │
│  ┌────────────────────────────────┐    │
│  │ reading-buddy-staging-network  │    │
│  │                                 │    │
│  │  ┌──────────────────────┐      │    │
│  │  │ PostgreSQL Container │      │    │
│  │  │ :5432 (internal)     │      │    │
│  │  │ :5433 (external)     │      │    │
│  │  └──────────────────────┘      │    │
│  │           ▲                     │    │
│  │           │ DB Connection       │    │
│  │           │                     │    │
│  │  ┌──────────────────────┐      │    │
│  │  │ Application Container│      │    │
│  │  │ :3000 → :3001        │      │    │
│  │  └──────────────────────┘      │    │
│  └────────────────────────────────┘    │
│                 │                       │
│                 │ HTTPS                 │
└─────────────────┼───────────────────────┘
                  │
                  ▼
    https://staging-reads.mws.web.id
```

## ⚙️ Configuration Changes

### Removed (Supabase):
- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_ROLE_KEY`

### Added (PostgreSQL + NextAuth):
- `DB_HOST=reading-buddy-postgres-staging`
- `DB_PORT=5432`
- `DB_NAME=reading_buddy`
- `DB_USER=reading_buddy`
- `DB_PASSWORD=<your-password>`
- `DATABASE_URL=postgresql://...`
- `NEXTAUTH_SECRET=<your-secret>`
- `NEXTAUTH_URL=https://staging-reads.mws.web.id`

## 🛠️ Deployment Steps (Summary)

1. **Create Docker network** - Connect PostgreSQL and Application
2. **Deploy PostgreSQL stack** - Database container with init scripts
3. **Import database backup** - Restore data from local PostgreSQL
4. **Update Application stack** - Point to new PostgreSQL container
5. **Merge to staging branch** - Trigger CI/CD pipeline
6. **Monitor deployment** - Verify health and functionality

## ✅ Success Criteria

- ✅ PostgreSQL container running and healthy
- ✅ Application container running and healthy  
- ✅ Site accessible at https://staging-reads.mws.web.id
- ✅ Users can login with existing credentials
- ✅ All features working (books, quizzes, progress tracking)
- ✅ No errors in logs for 24 hours
- ✅ CI/CD pipeline passes without Supabase

## 🔄 Rollback Plan

If deployment fails:

1. **Revert code**: Git revert staging branch → Auto-deploy previous version
2. **Restore database**: Drop and restore from backup file
3. **Temporary fix**: Re-add Supabase env vars temporarily

## 📞 Support

- **Deployment Guide**: See `DEPLOYMENT_INSTRUCTIONS.md`
- **Quick Reference**: See `QUICK_CHECKLIST.md`
- **Original Plan**: See `../.claude/plans/lively-sprouting-eich.md`

## 📝 Notes

- **Time Required**: 30-60 minutes for complete deployment
- **Downtime**: ~2-5 minutes during application stack restart
- **Data Safety**: Local backup file is source of truth
- **Monitoring**: Watch logs for first 24 hours after deployment

---

**Ready to deploy?** Start with `DEPLOYMENT_INSTRUCTIONS.md`
