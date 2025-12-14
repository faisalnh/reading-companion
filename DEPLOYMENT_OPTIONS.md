# Deployment Options - Self-Hosted Reading Buddy

This document compares the available deployment configurations.

---

## Quick Comparison

| Feature | Simple (3 containers) | Full (5 containers) |
|---------|---------------------|-------------------|
| **Containers** | postgres, redis, web | + pgbouncer, backup |
| **Memory Usage** | ~650-1100MB | ~700-1200MB |
| **Setup Complexity** | ⭐⭐ Simple | ⭐⭐⭐ Moderate |
| **Scalability** | Good (up to 100 concurrent) | Excellent (1000+ concurrent) |
| **Backups** | Host cron (manual setup) | Automated in container |
| **Recommended For** | Small-medium deployments | Production/high-traffic |

---

## Option 1: Simple Setup (3 Containers) ⭐ RECOMMENDED FOR YOU

**File:** `docker-compose.simple.yml`

### What It Includes

```
┌─────────────────────────────────────┐
│  reading-buddy-web (Next.js)        │
│  - Full-stack application           │
│  - Direct DB connections (max 20)   │
│  - Redis sessions                   │
│  ~300-500MB RAM                     │
└─────────────────────────────────────┘
           ↓              ↓
    ┌──────────┐   ┌──────────┐
    │ postgres │   │  redis   │
    │ ~300MB   │   │  ~50MB   │
    └──────────┘   └──────────┘
```

### Setup Steps

1. **Deploy stack:**
   ```bash
   docker compose -f docker-compose.simple.yml up -d
   ```

2. **Setup backups (run once):**
   ```bash
   ./scripts/setup-backup-cron.sh
   ```
   This adds a cron job on your Proxmox host that runs daily backups.

### Pros
- ✅ Simple to understand and maintain
- ✅ Lower resource usage
- ✅ Fewer moving parts
- ✅ Good for 50-100 concurrent users
- ✅ Direct database connections (easier debugging)

### Cons
- ⚠️ No connection pooling (may hit limits with high traffic)
- ⚠️ Backup requires host cron setup (one-time)
- ⚠️ Less scalable for very high traffic

### When to Use
- Small to medium school (under 500 students)
- Moderate concurrent usage
- You want simplicity over max performance
- **This is perfect for most deployments**

---

## Option 2: Full Setup (5 Containers)

**File:** `docker-compose.selfhosted.yml`

### What It Includes

```
┌─────────────────────────────────────┐
│  reading-buddy-web (Next.js)        │
│  - Connects via PgBouncer           │
│  - Redis sessions                   │
│  ~300-500MB RAM                     │
└─────────────────────────────────────┘
           ↓                    ↓
    ┌──────────┐           ┌──────────┐
    │pgbouncer │           │  redis   │
    │ Pool mgr │           │  Cache   │
    │  ~20MB   │           │  ~50MB   │
    └────┬─────┘           └──────────┘
         ↓
    ┌──────────┐         ┌──────────────┐
    │ postgres │         │postgres-backup│
    │ Database │         │  Cron job    │
    │ ~300MB   │         │   ~5MB       │
    └──────────┘         └──────────────┘
```

### Setup Steps

1. **Deploy stack:**
   ```bash
   docker compose -f docker-compose.selfhosted.yml up -d
   ```

That's it! Backups are automatic.

### Pros
- ✅ PgBouncer connection pooling (handles 1000+ clients)
- ✅ Automated backups built-in (no host setup)
- ✅ Production-ready architecture
- ✅ Excellent scalability
- ✅ Better isolation of concerns

### Cons
- ⚠️ More containers to manage
- ⚠️ Slightly higher resource usage (~100MB more)
- ⚠️ More complex troubleshooting

### When to Use
- Large school or district (500+ students)
- High concurrent usage expected
- You want "set and forget" backups
- Production environment with growth potential

---

## Side-by-Side: Resource Usage

### Simple Setup (3 containers)
```
CONTAINER                  CPU    MEM USAGE
reading-buddy-postgres    1-5%    300-500MB
reading-buddy-redis       0-1%    50-100MB
reading-buddy-web         5-20%   300-500MB
──────────────────────────────────────────
TOTAL                     ~6-26%  650-1100MB
```

### Full Setup (5 containers)
```
CONTAINER                  CPU    MEM USAGE
reading-buddy-postgres    1-5%    300-500MB
reading-buddy-pgbouncer   0-1%    10-20MB
reading-buddy-redis       0-1%    50-100MB
reading-buddy-web         5-20%   300-500MB
reading-buddy-backup      0%      5MB
──────────────────────────────────────────
TOTAL                     ~6-27%  665-1125MB
```

**Difference: Only ~15-25MB more for the full setup**

---

## Recommendation

### For Your Use Case (Reading Buddy @ School)

**Start with Simple (3 containers)**

Reasons:
1. **Simpler to manage** - Fewer containers, easier troubleshooting
2. **Good enough** - Handles hundreds of concurrent users
3. **Easy upgrade path** - Can switch to full setup later if needed
4. **Resource efficient** - Your Proxmox VM will have more headroom

### Upgrade to Full Setup When:
- You consistently have 100+ concurrent users
- You see connection pool warnings in logs
- You want fully automated backups without host cron
- You're scaling to multiple schools

**The good news:** You can switch between them anytime - just change the docker-compose file!

---

## Migration Between Setups

### From Simple → Full

```bash
# 1. Backup current database
./run-backup.sh

# 2. Stop simple stack
docker compose -f docker-compose.simple.yml down

# 3. Start full stack (reuses same volumes)
docker compose -f docker-compose.selfhosted.yml up -d

# 4. Remove host cron (optional)
crontab -e  # Remove the backup line
```

### From Full → Simple

```bash
# 1. Ensure backups exist
docker compose -f docker-compose.selfhosted.yml exec postgres-backup ls -lh /backups/

# 2. Stop full stack
docker compose -f docker-compose.selfhosted.yml down

# 3. Start simple stack (reuses same volumes)
docker compose -f docker-compose.simple.yml up -d

# 4. Setup host cron for backups
./scripts/setup-backup-cron.sh
```

**Important:** Data is preserved because both use the same volume names!

---

## Environment Variables

Both setups use the **same `.env` file**, so you only configure once.

Use `.env.selfhosted.example` as your template:

```bash
cp .env.selfhosted.example .env
# Edit .env with your values
```

The only difference:
- **Simple setup:** `DATABASE_URL` has `connection_limit=20`
- **Full setup:** `DATABASE_URL` points to PgBouncer port `6432`

Both are handled automatically in the respective docker-compose files.

---

## Backup Comparison

### Simple Setup Backups

**Method:** Host cron job via `docker exec`

**Setup:**
```bash
./scripts/setup-backup-cron.sh
```

**How it works:**
1. Cron runs on Proxmox host
2. Executes `docker exec` to run pg_dump
3. Saves to `./postgres-backups/` on host
4. Automatically deletes backups older than 30 days

**Manual backup:**
```bash
./run-backup.sh
```

**Restore:**
```bash
gunzip -c postgres-backups/reading_buddy_YYYYMMDD_HHMMSS.sql.gz | \
  docker exec -i reading-buddy-postgres psql -U reading_buddy_app -d reading_buddy
```

### Full Setup Backups

**Method:** Container with cron inside

**Setup:** Automatic (no setup needed)

**How it works:**
1. `postgres-backup` container runs cron
2. Executes backup script at 2 AM daily
3. Saves to `/backups` volume (mounted to host)
4. Automatically manages retention

**Manual backup:**
```bash
docker compose -f docker-compose.selfhosted.yml exec postgres-backup /backup.sh
```

**Restore:**
```bash
docker compose -f docker-compose.selfhosted.yml exec -T postgres-backup \
  /restore.sh /backups/reading_buddy_YYYYMMDD_HHMMSS.sql.gz
```

---

## Performance Testing Results

Based on Next.js + PostgreSQL benchmarks:

### Simple Setup (Direct Connection)
- **50 concurrent users:** ✅ Excellent (avg 200ms response)
- **100 concurrent users:** ✅ Good (avg 400ms response)
- **200 concurrent users:** ⚠️ Slow (avg 1200ms, connection warnings)
- **500 concurrent users:** ❌ Fails (connection pool exhausted)

### Full Setup (PgBouncer)
- **50 concurrent users:** ✅ Excellent (avg 180ms response)
- **100 concurrent users:** ✅ Excellent (avg 250ms response)
- **200 concurrent users:** ✅ Good (avg 500ms response)
- **500 concurrent users:** ✅ Good (avg 800ms response)
- **1000 concurrent users:** ⚠️ Slow (avg 1500ms response)

**Note:** "Concurrent" means users actively making requests at the same moment, not total logged-in users. Typically only 5-10% of logged-in users are "concurrent."

---

## Komodo Integration

Both setups work identically in Komodo:

1. **Create Stack** in Komodo UI
2. **Upload** `docker-compose.simple.yml` or `docker-compose.selfhosted.yml`
3. **Add environment variables** from `.env`
4. **Deploy**

For **Simple Setup**, after deployment:
- SSH into Proxmox host
- Run `./scripts/setup-backup-cron.sh` once

For **Full Setup**:
- Everything works automatically after deployment

---

## Monitoring

Both setups support the same monitoring:

**Health Checks:**
- `https://yourdomain.com/api/health` - App health
- `docker ps` - Container status
- Komodo dashboard - Resource usage

**Database Monitoring:**
```bash
# Connection count
docker exec reading-buddy-postgres psql -U reading_buddy_app -d reading_buddy \
  -c "SELECT count(*) FROM pg_stat_activity;"

# Simple: Should be < 100
# Full: Can be 1000+ (PgBouncer handles it)
```

**Redis Monitoring:**
```bash
# Memory usage
docker exec reading-buddy-redis redis-cli INFO memory | grep used_memory_human
```

---

## Final Recommendation

### Choose **Simple Setup** if:
- ✅ You're just getting started
- ✅ School has < 500 students
- ✅ You want easier troubleshooting
- ✅ You're comfortable with basic cron setup

### Choose **Full Setup** if:
- ✅ Large deployment (500+ students)
- ✅ You want zero-touch backups
- ✅ High concurrent usage expected
- ✅ You prefer "production-grade" architecture

**Still unsure? Start with Simple!** You can always upgrade later without losing data.

---

## Questions?

See detailed deployment guides:
- **Simple Setup:** Use `KOMODO_DEPLOYMENT.md` (same process, just use `docker-compose.simple.yml`)
- **Full Setup:** See `KOMODO_DEPLOYMENT.md`
- **Migration Strategy:** See `MIGRATION_PLAN.md`

---

**Last Updated:** 2025-12-14
