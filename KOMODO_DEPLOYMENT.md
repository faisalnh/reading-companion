# Komodo Deployment Guide - Self-Hosted Reading Buddy

This guide covers deploying the self-hosted version of Reading Buddy on Proxmox with Komodo.

## Prerequisites

- Proxmox server with Docker installed
- Komodo installed and configured
- Domain name pointed to your server
- Reverse proxy (Nginx/Traefik) for HTTPS
- MinIO already running (or include in stack)

## Step 1: Prepare Configuration Files

### 1.1 Copy Environment File

```bash
cd /path/to/reading-companion
cp .env.selfhosted.example .env
```

### 1.2 Generate Secrets

```bash
# Generate PostgreSQL password
openssl rand -base64 32

# Generate NextAuth secret
openssl rand -base64 32
```

### 1.3 Edit `.env` File

Fill in all required values:
- `POSTGRES_PASSWORD` - Generated above
- `NEXTAUTH_SECRET` - Generated above
- `NEXTAUTH_URL` - Your public domain (e.g., https://reading-buddy.yourdomain.com)
- `GOOGLE_CLIENT_ID` - From Google Cloud Console
- `GOOGLE_CLIENT_SECRET` - From Google Cloud Console
- `MINIO_*` - Your existing MinIO credentials
- `SMTP_*` - Your email provider credentials

## Step 2: Create Komodo Stack

### 2.1 In Komodo Web UI

1. Navigate to **Stacks** → **Create Stack**
2. Fill in stack details:
   - **Name:** `reading-buddy-selfhosted`
   - **Description:** Self-hosted Reading Buddy with PostgreSQL and NextAuth

### 2.2 Upload Docker Compose File

**Option A: Upload File**
- Click "Upload Compose File"
- Select `docker-compose.selfhosted.yml`

**Option B: Paste Content**
- Copy contents of `docker-compose.selfhosted.yml`
- Paste into the compose editor

### 2.3 Configure Environment Variables

In Komodo stack settings, add all environment variables from `.env`:

```
POSTGRES_PASSWORD=<your-generated-password>
DATABASE_URL=postgresql://reading_buddy_app:<password>@pgbouncer:5432/reading_buddy
NEXTAUTH_URL=https://reading-buddy.yourdomain.com
NEXTAUTH_SECRET=<your-generated-secret>
GOOGLE_CLIENT_ID=<your-google-client-id>
GOOGLE_CLIENT_SECRET=<your-google-client-secret>
REDIS_URL=redis://redis:6379
MINIO_ENDPOINT=minio.yourdomain.com
MINIO_PORT=443
MINIO_USE_SSL=true
MINIO_ACCESS_KEY=<your-minio-key>
MINIO_SECRET_KEY=<your-minio-secret>
MINIO_BUCKET_NAME=reading-buddy
AI_PROVIDER=local
RAG_API_URL=http://172.16.0.65:8000
DIFFUSER_API_URL=http://172.16.0.165:8000
NEXT_PUBLIC_RAG_API_URL=http://172.16.0.65:8000
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=<your-email>
SMTP_PASSWORD=<your-app-password>
SMTP_FROM=noreply@yourdomain.com
NEXT_PUBLIC_APP_URL=https://reading-buddy.yourdomain.com
NODE_ENV=production
PORT=3000
BACKUP_RETENTION_DAYS=30
```

### 2.4 Configure Volumes

Komodo will automatically create Docker volumes. For persistent storage on your Proxmox server:

**Option: Use Bind Mounts**

Edit the stack to use bind mounts instead of volumes:

```yaml
volumes:
  postgres_data:
    driver: local
    driver_opts:
      type: none
      device: /mnt/storage/reading-buddy/postgres
      o: bind

  redis_data:
    driver: local
    driver_opts:
      type: none
      device: /mnt/storage/reading-buddy/redis
      o: bind
```

Create directories first:
```bash
mkdir -p /mnt/storage/reading-buddy/{postgres,redis,backups}
```

## Step 3: Configure Google OAuth

### 3.1 Google Cloud Console

1. Go to https://console.cloud.google.com/apis/credentials
2. Select your project (or create new one)
3. Click **Create Credentials** → **OAuth 2.0 Client ID**
4. Application type: **Web application**
5. Add authorized redirect URIs:
   ```
   https://reading-buddy.yourdomain.com/api/auth/callback/google
   ```
6. Save and copy Client ID and Client Secret to `.env`

### 3.2 Restrict Domain (Optional)

To restrict to @millennia21.id like current setup:
1. In Google Cloud Console → **OAuth consent screen**
2. Select "Internal" (if Google Workspace)
3. Or implement domain restriction in NextAuth config (see migration plan)

## Step 4: Set Up Reverse Proxy

### Using Nginx Proxy Manager (Recommended with Komodo)

1. In NPM, create new Proxy Host:
   - **Domain Names:** reading-buddy.yourdomain.com
   - **Scheme:** http
   - **Forward Hostname/IP:** reading-buddy-web (container name)
   - **Forward Port:** 3000
   - **Websockets Support:** ✓ Enabled

2. SSL Tab:
   - **SSL Certificate:** Request new Let's Encrypt certificate
   - **Force SSL:** ✓ Enabled
   - **HTTP/2 Support:** ✓ Enabled
   - **HSTS Enabled:** ✓ Enabled

3. Advanced (optional rate limiting):
   ```nginx
   # Rate limiting
   limit_req_zone $binary_remote_addr zone=readingbuddy:10m rate=10r/s;
   limit_req zone=readingbuddy burst=20 nodelay;

   # Security headers
   add_header X-Frame-Options "SAMEORIGIN" always;
   add_header X-Content-Type-Options "nosniff" always;
   add_header X-XSS-Protection "1; mode=block" always;
   ```

### Using Traefik

If using Traefik, add labels to web service in docker-compose:

```yaml
web:
  labels:
    - "traefik.enable=true"
    - "traefik.http.routers.reading-buddy.rule=Host(`reading-buddy.yourdomain.com`)"
    - "traefik.http.routers.reading-buddy.entrypoints=websecure"
    - "traefik.http.routers.reading-buddy.tls.certresolver=letsencrypt"
    - "traefik.http.services.reading-buddy.loadbalancer.server.port=3000"
```

## Step 5: Database Setup

### 5.1 Create Modified Schema File

Before deploying, create `database-setup-selfhosted.sql` based on migration plan Phase 1.2.

Key changes from `database-setup.sql`:
1. Remove Supabase `auth.users` references
2. Add NextAuth tables (accounts, sessions, verification_tokens)
3. Update profiles table with email, password_hash, etc.
4. Remove RLS policies (handle in app layer)

**You'll need to create this file as part of the migration implementation.**

### 5.2 Alternative: Manual Schema Setup

If you want to set up the database manually:

1. Start only PostgreSQL:
   ```bash
   docker compose -f docker-compose.selfhosted.yml up -d postgres
   ```

2. Connect to database:
   ```bash
   docker exec -it reading-buddy-postgres psql -U reading_buddy_app -d reading_buddy
   ```

3. Run schema creation SQL manually

## Step 6: Deploy Stack

### 6.1 Deploy via Komodo

1. Save the stack configuration
2. Click **Deploy Stack**
3. Monitor deployment logs in Komodo

### 6.2 Or Deploy via Command Line

```bash
cd /path/to/reading-companion
docker compose -f docker-compose.selfhosted.yml up -d
```

### 6.3 Verify Services

Check all services are running:
```bash
docker compose -f docker-compose.selfhosted.yml ps
```

Expected output:
```
NAME                         STATUS              PORTS
reading-buddy-postgres       Up (healthy)        5432
reading-buddy-pgbouncer      Up (healthy)        6432
reading-buddy-redis          Up (healthy)        6379
reading-buddy-web            Up (healthy)        3000
reading-buddy-backup         Up                  -
```

### 6.4 Check Logs

```bash
# All services
docker compose -f docker-compose.selfhosted.yml logs -f

# Specific service
docker compose -f docker-compose.selfhosted.yml logs -f web
docker compose -f docker-compose.selfhosted.yml logs -f postgres
```

## Step 7: Initial Testing

### 7.1 Health Check

```bash
curl https://reading-buddy.yourdomain.com/api/health
```

Expected response:
```json
{"status": "ok"}
```

### 7.2 Test Database Connection

```bash
docker exec -it reading-buddy-postgres psql -U reading_buddy_app -d reading_buddy -c "SELECT version();"
```

### 7.3 Test PgBouncer

```bash
docker exec -it reading-buddy-pgbouncer psql -h localhost -U reading_buddy_app -d reading_buddy -c "SELECT 1;"
```

### 7.4 Test Redis

```bash
docker exec -it reading-buddy-redis redis-cli ping
# Expected: PONG
```

## Step 8: Data Migration (From Supabase)

**⚠️ Only after migration implementation is complete**

### 8.1 Export from Supabase

```bash
# Export data from Supabase
pg_dump -h db.<your-project>.supabase.co \
  -U postgres \
  -d postgres \
  --data-only \
  --inserts \
  -t profiles -t books -t classes -t quizzes \
  > supabase_data.sql
```

### 8.2 Transform Data

You'll need to create a transformation script that:
1. Maps Supabase `auth.users` to `profiles` table
2. Creates NextAuth `accounts` entries for OAuth users
3. Sets placeholder passwords for email/password users
4. Preserves all relationships and foreign keys

### 8.3 Import to Self-Hosted

```bash
# Copy to container
docker cp supabase_data_transformed.sql reading-buddy-postgres:/tmp/

# Import
docker exec -it reading-buddy-postgres psql \
  -U reading_buddy_app \
  -d reading_buddy \
  -f /tmp/supabase_data_transformed.sql
```

## Step 9: Backup Configuration

### 9.1 Verify Backup Service

Backups run automatically at 2 AM daily. To test:

```bash
# Trigger manual backup
docker exec reading-buddy-backup /backup.sh
```

### 9.2 List Backups

```bash
# On host
ls -lh postgres-backups/

# In container
docker exec reading-buddy-backup ls -lh /backups/
```

### 9.3 Test Restore

```bash
# Restore from specific backup
docker exec -it reading-buddy-backup /restore.sh /backups/reading_buddy_20250314_020000.sql.gz
```

### 9.4 Off-Site Backup

Set up off-site backup to protect against server failure:

**Option A: Rsync to Remote Server**
```bash
# Add to crontab on Proxmox host
0 3 * * * rsync -avz /path/to/postgres-backups/ backup-server:/backups/reading-buddy/
```

**Option B: Rclone to Cloud Storage**
```bash
# Install rclone
curl https://rclone.org/install.sh | sudo bash

# Configure (interactive)
rclone config

# Add to crontab
0 3 * * * rclone sync /path/to/postgres-backups/ remote:reading-buddy-backups/
```

## Step 10: Monitoring

### 10.1 Using Komodo Built-in Monitoring

Komodo provides:
- Container status monitoring
- Resource usage graphs
- Log viewing
- Restart on failure

### 10.2 Health Check Endpoints

Add monitoring for:
- `https://reading-buddy.yourdomain.com/api/health` - Application health
- PostgreSQL connection count
- PgBouncer pool status
- Redis memory usage

### 10.3 External Monitoring (Optional)

**Uptime Kuma** (recommended, integrates with Komodo):
```bash
# Add to your Komodo stack or run separately
docker run -d --name uptime-kuma \
  -p 3001:3001 \
  -v uptime-kuma:/app/data \
  louislam/uptime-kuma:1
```

Configure monitors for:
- HTTPS check: https://reading-buddy.yourdomain.com
- PostgreSQL TCP check: port 5432
- Redis TCP check: port 6379

## Troubleshooting

### Web App Won't Start

```bash
# Check logs
docker compose -f docker-compose.selfhosted.yml logs web

# Common issues:
# 1. Database not ready - wait for healthy status
# 2. Environment variables missing - check .env
# 3. Build issues - rebuild: docker compose build --no-cache web
```

### Database Connection Issues

```bash
# Test direct connection
docker exec -it reading-buddy-postgres psql -U reading_buddy_app -d reading_buddy

# Test via PgBouncer
docker exec -it reading-buddy-web psql $DATABASE_URL -c "SELECT 1;"

# Check PgBouncer stats
docker exec -it reading-buddy-pgbouncer psql -h localhost -p 5432 -U reading_buddy_app pgbouncer -c "SHOW POOLS;"
```

### OAuth Not Working

1. Check Google Cloud Console redirect URIs
2. Verify `GOOGLE_CLIENT_ID` and `GOOGLE_CLIENT_SECRET` in .env
3. Ensure `NEXTAUTH_URL` matches your domain exactly
4. Check browser console for CORS errors
5. Verify HTTPS is working

### Email Not Sending

```bash
# Test SMTP connection
docker exec -it reading-buddy-web node -e "
const nodemailer = require('nodemailer');
const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST,
  port: process.env.SMTP_PORT,
  auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASSWORD }
});
transporter.verify().then(console.log).catch(console.error);
"
```

### High Memory Usage

```bash
# Check container stats
docker stats reading-buddy-postgres reading-buddy-web

# Adjust PostgreSQL shared_buffers if needed
# Edit docker-compose.selfhosted.yml postgres command section
```

## Performance Tuning

### PostgreSQL

Adjust based on your Proxmox VM resources in `docker-compose.selfhosted.yml`:

```yaml
# For 4GB RAM VM:
shared_buffers=1GB
effective_cache_size=3GB
maintenance_work_mem=256MB
work_mem=32MB

# For 8GB RAM VM:
shared_buffers=2GB
effective_cache_size=6GB
maintenance_work_mem=512MB
work_mem=64MB
```

### PgBouncer

Adjust pool sizes based on concurrent users:

```yaml
# For 50 concurrent users:
DEFAULT_POOL_SIZE: 25
MAX_CLIENT_CONN: 200

# For 200 concurrent users:
DEFAULT_POOL_SIZE: 75
MAX_CLIENT_CONN: 500
```

### Redis

Adjust memory limit:

```yaml
# For cache-heavy workload:
--maxmemory 512mb

# For light usage:
--maxmemory 128mb
```

## Upgrading

### Application Updates

```bash
# Pull latest code
git pull origin main

# Rebuild and restart
docker compose -f docker-compose.selfhosted.yml build web
docker compose -f docker-compose.selfhosted.yml up -d web
```

### Database Schema Updates

```bash
# Create migration script
# Run migration
docker exec -it reading-buddy-postgres psql -U reading_buddy_app -d reading_buddy -f /path/to/migration.sql
```

### PostgreSQL Version Upgrade

```bash
# 1. Backup first!
docker exec reading-buddy-backup /backup.sh

# 2. Stop stack
docker compose -f docker-compose.selfhosted.yml down

# 3. Update image version in docker-compose.selfhosted.yml
#    image: postgres:15-alpine -> postgres:16-alpine

# 4. Restart
docker compose -f docker-compose.selfhosted.yml up -d

# 5. Run pg_upgrade if needed (major version change)
```

## Security Checklist

- [ ] Strong passwords for all services (use `openssl rand -base64 32`)
- [ ] HTTPS enabled with valid certificate
- [ ] Firewall rules configured (only expose 80/443)
- [ ] Database not exposed to public internet
- [ ] Regular backups tested and verified
- [ ] Off-site backup configured
- [ ] Security headers configured in reverse proxy
- [ ] Rate limiting enabled
- [ ] Environment variables secured (not committed to git)
- [ ] Keep Docker images updated
- [ ] Monitor security advisories for dependencies

## Maintenance Tasks

### Daily (Automated)
- [ ] Database backup at 2 AM

### Weekly
- [ ] Review application logs for errors
- [ ] Check disk usage
- [ ] Verify backups are running

### Monthly
- [ ] Test backup restoration
- [ ] Update Docker images
- [ ] Review security advisories
- [ ] Check resource usage trends

### Quarterly
- [ ] Audit user accounts
- [ ] Review access logs
- [ ] Update SSL certificates (if not automated)

## Support & Resources

- **Migration Plan:** See `MIGRATION_PLAN.md` for detailed migration strategy
- **Komodo Docs:** https://komodo.app/docs
- **NextAuth Docs:** https://authjs.dev/
- **PostgreSQL Docs:** https://www.postgresql.org/docs/
- **Docker Compose Docs:** https://docs.docker.com/compose/

---

**Last Updated:** 2025-12-14
**For:** Self-Hosted Reading Buddy Migration
