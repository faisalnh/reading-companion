# Quick Deployment Checklist

## Pre-Deployment

- [ ] Local database backup created: `local-postgres-backup.sql`
- [ ] Generated DB_PASSWORD: `openssl rand -base64 32`
- [ ] Generated NEXTAUTH_SECRET: `openssl rand -base64 32`
- [ ] Code committed and pushed to `local-db` branch

## Komodo Server Setup

- [ ] SSH into Komodo server
- [ ] Create network: `docker network create reading-buddy-staging-network`

## PostgreSQL Stack Deployment

- [ ] Create stack: `reading-buddy-postgres-staging`
- [ ] Upload `docker-compose.yml`
- [ ] Upload 7 SQL files to `init-scripts/` directory
- [ ] Set environment variable: `DB_PASSWORD`
- [ ] Deploy stack
- [ ] Verify: `docker exec reading-buddy-postgres-staging psql -U reading_buddy -c '\dt'`

## Database Import

- [ ] Upload `local-postgres-backup.sql` to `/tmp/` on server
- [ ] Copy to container: `docker cp /tmp/local-postgres-backup.sql reading-buddy-postgres-staging:/tmp/`
- [ ] Import: `docker exec reading-buddy-postgres-staging psql -U reading_buddy -d reading_buddy -f /tmp/local-postgres-backup.sql`
- [ ] Verify data: Check profiles, books, quizzes counts

## Application Stack Update

- [ ] Update `reading-companion-staging` docker-compose.yml
- [ ] Remove 3 Supabase env vars
- [ ] Add 6 PostgreSQL env vars (DB_HOST, DB_PORT, DB_NAME, DB_USER, DB_PASSWORD, DATABASE_URL)
- [ ] Add 2 NextAuth env vars (NEXTAUTH_SECRET, NEXTAUTH_URL)
- [ ] Change network to `external: true`
- [ ] Redeploy stack

## Git Workflow

- [ ] Merge `local-db` to `staging` branch
- [ ] Push to GitHub
- [ ] Watch CI/CD pipeline run
- [ ] Verify build succeeds without Supabase

## Post-Deployment Testing

- [ ] Site accessible: https://staging-reads.mws.web.id
- [ ] Can login with existing account
- [ ] Books page loads
- [ ] Can generate quiz
- [ ] Can submit quiz
- [ ] Check logs for errors

## Monitoring (First 24 Hours)

- [ ] Application logs clean
- [ ] PostgreSQL logs clean
- [ ] No connection errors
- [ ] Performance acceptable

---

## Key Commands Reference

```bash
# Check PostgreSQL
docker exec reading-buddy-postgres-staging psql -U reading_buddy -c '\dt'

# Check logs
docker logs reading-buddy-staging -f --tail 100
docker logs reading-buddy-postgres-staging -f --tail 100

# Verify network
docker network inspect reading-buddy-staging-network

# Generate passwords
openssl rand -base64 32

# Import backup
docker cp /tmp/local-postgres-backup.sql reading-buddy-postgres-staging:/tmp/
docker exec reading-buddy-postgres-staging psql -U reading_buddy -d reading_buddy -f /tmp/local-postgres-backup.sql
```

---

## Files to Upload to Komodo

### PostgreSQL Stack Root:
- `docker-compose.yml`

### PostgreSQL Stack `init-scripts/`:
- `01-extensions.sql`
- `02-nextauth-schema.sql`
- `03-app-schema.sql`
- `04-functions.sql`
- `05-triggers.sql`
- `06-rls-policies.sql`
- `07-seed-data.sql`

### Database Backup:
- `local-postgres-backup.sql` → Upload to `/tmp/` on server

---

## Passwords Needed

1. **DB_PASSWORD**: Used in both PostgreSQL and Application stacks (same password)
2. **NEXTAUTH_SECRET**: Used in Application stack only

Store these securely!

---

**Estimated Time:** 30-60 minutes
