# Reading Buddy - Docker Deployment Guide

This guide covers deploying Reading Buddy to your Proxmox server using Dockge as the Docker stack manager.

## Prerequisites

- Proxmox server with Docker and Dockge installed
- MinIO instance running and accessible
- Supabase project set up with the database schema
- Domain/subdomain pointing to your Proxmox server (optional, for reverse proxy)

## Deployment Steps

### Method 1: Automated Deployment (Recommended)

#### 1. Prepare Environment Variables

Create a `.env.production` file in the project root:

```bash
cp .env.production.example .env.production
```

Edit `.env.production` and fill in your actual values:

```env
# Supabase Configuration
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbGc...
SUPABASE_SERVICE_ROLE_KEY=eyJhbGc...

# MinIO Configuration
MINIO_ENDPOINT=storage.yourschool.com
MINIO_PORT=443
MINIO_USE_SSL=true
MINIO_ACCESS_KEY=your-access-key
MINIO_SECRET_KEY=your-secret-key
MINIO_BUCKET_NAME=reading-buddy

# Google AI
GEMINI_API_KEY=AIzaSy...
```

#### 2. Run the Deployment Script

The `deploy.sh` script will automatically transfer all files to your Proxmox server:

```bash
# Set your Proxmox server details
export PROXMOX_USER=root
export PROXMOX_HOST=192.168.1.100

# Run the deployment script
./deploy.sh
```

The script will:
- Transfer all project files to `/opt/stacks/reading-buddy` on your Proxmox server
- Copy your environment variables
- Exclude unnecessary files (node_modules, .git, etc.)

#### 3. Deploy in Dockge

1. Open Dockge in your browser
2. Click "Create Stack" or "Add Stack"  
3. **Name**: `reading-buddy`
4. **Path**: `/opt/stacks/reading-buddy`
5. Copy the contents of `compose.production.yaml` into the editor
6. Click "Deploy"

### Method 2: Manual Deployment

#### Option A: Using Dockge UI with Local Files

1. Manually copy all files to your Proxmox server:
   ```bash
   # On your local machine
   scp -r . root@your-proxmox-ip:/opt/stacks/reading-buddy/
   ```

2. Open Dockge in your browser
3. Click "Create Stack" or "Add Stack"
4. Name your stack: `reading-buddy`
5. Copy the contents of `compose.production.yaml` into the editor
6. Go to the "Environment Variables" section
6. Paste the contents of your `.env.production` file
7. Click "Deploy" or "Start"

#### Option B: Using Git Repository in Dockge

1. Push this repository to GitHub/GitLab
2. In Dockge, create a new stack from Git repository
3. Enter your repository URL
4. Select branch (e.g., `main` or `Hybrid`)
5. Add environment variables in the Dockge UI
6. Deploy

### 3. First Build

The first build will take 5-10 minutes as it:
- Downloads the Node.js Alpine base image
- Installs native dependencies (Cairo, Pango for canvas/PDF rendering)
- Installs npm packages
- Builds the Next.js application

Subsequent builds will be faster due to Docker layer caching.

### 4. Verify Deployment

Once deployed, check:

```bash
# Check container status
docker ps | grep reading-buddy

# Check logs
docker logs reading-buddy

# Check health
curl http://localhost:3000
```

### 5. Set Up Reverse Proxy (Recommended)

Since you already have a reverse proxy for MinIO, add a new configuration for Reading Buddy.

**Nginx Example:**

```nginx
server {
    listen 80;
    server_name reading.yourschool.com;
    
    # Redirect to HTTPS
    return 301 https://$server_name$request_uri;
}

server {
    listen 443 ssl http2;
    server_name reading.yourschool.com;
    
    ssl_certificate /path/to/cert.pem;
    ssl_certificate_key /path/to/key.pem;
    
    location / {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
```

**Traefik Example (if using Traefik):**

Add labels to `compose.yaml`:

```yaml
labels:
  - "traefik.enable=true"
  - "traefik.http.routers.reading-buddy.rule=Host(`reading.yourschool.com`)"
  - "traefik.http.routers.reading-buddy.entrypoints=websecure"
  - "traefik.http.routers.reading-buddy.tls.certresolver=letsencrypt"
  - "traefik.http.services.reading-buddy.loadbalancer.server.port=3000"
```

## Running Background Jobs

The PDF rendering worker (`npm run render:book-images`) needs to run separately. You have two options:

### Option 1: Run Inside the Container

```bash
# Enter the container
docker exec -it reading-buddy sh

# Run the rendering job
cd web && npm run render:book-images

# Or for a specific book
cd web && npm run render:book-images -- --bookId=123
```

### Option 2: Set Up a Cron Job (Recommended)

Create a cron script on your host:

```bash
#!/bin/bash
# /usr/local/bin/reading-buddy-render.sh

docker exec reading-buddy sh -c "cd web && npm run render:book-images"
```

Make it executable:

```bash
chmod +x /usr/local/bin/reading-buddy-render.sh
```

Add to crontab:

```bash
# Run every hour
0 * * * * /usr/local/bin/reading-buddy-render.sh >> /var/log/reading-buddy-render.log 2>&1
```

### Option 3: Add a Worker Container (Advanced)

Modify `compose.yaml` to add a worker service:

```yaml
services:
  reading-buddy-web:
    # ... existing config ...
  
  reading-buddy-worker:
    image: reading-buddy:latest
    container_name: reading-buddy-worker
    restart: unless-stopped
    environment:
      # Same environment variables as web service
    command: sh -c "while true; do cd web && npm run render:book-images && sleep 3600; done"
    networks:
      - reading-buddy-network
```

## Updating the Application

### Method 1: Using Dockge UI

1. Pull latest code changes
2. In Dockge, click on your stack
3. Click "Rebuild" or "Recreate"
4. Dockge will rebuild and restart the container

### Method 2: Manual Update

```bash
# Pull latest changes
git pull origin main

# Rebuild and restart
docker compose down
docker compose up -d --build
```

## Troubleshooting

### Container Won't Start

```bash
# Check logs
docker logs reading-buddy

# Check if port 3000 is already in use
lsof -i :3000

# Verify environment variables
docker exec reading-buddy env
```

### Native Module Errors (canvas, pdf2pic)

The Dockerfile includes all necessary dependencies. If you still have issues:

```bash
# Rebuild without cache
docker compose build --no-cache
```

### Out of Memory During Build

If building fails due to memory limits:

```bash
# Increase Docker memory limit
# Or build on a machine with more RAM and push the image
docker save reading-buddy:latest | gzip > reading-buddy.tar.gz
# Transfer to Proxmox
docker load < reading-buddy.tar.gz
```

### Performance Issues

Adjust resource limits in `compose.yaml`:

```yaml
deploy:
  resources:
    limits:
      cpus: '4'
      memory: 4G
    reservations:
      cpus: '2'
      memory: 2G
```

## Monitoring

### View Logs

```bash
# Real-time logs
docker logs -f reading-buddy

# Last 100 lines
docker logs --tail 100 reading-buddy
```

### Container Stats

```bash
docker stats reading-buddy
```

### Health Check

The compose file includes a health check. View status:

```bash
docker inspect reading-buddy | grep -A 10 Health
```

## Backup and Restore

### Backup

Your data is stored in:
- Supabase (PostgreSQL) - use Supabase's backup features
- MinIO - use MinIO's backup tools or filesystem snapshots

### Backup Docker Image

```bash
docker save reading-buddy:latest | gzip > reading-buddy-backup-$(date +%Y%m%d).tar.gz
```

## Security Recommendations

1. **Environment Variables**: Never commit `.env.production` to Git
2. **Firewall**: Restrict port 3000 to localhost if using reverse proxy
3. **Updates**: Regularly update dependencies with `npm update`
4. **SSL**: Always use HTTPS in production (via reverse proxy)
5. **Resource Limits**: Set appropriate CPU and memory limits

## Production Checklist

- [ ] Environment variables configured correctly
- [ ] MinIO is accessible from the container
- [ ] Supabase connection works
- [ ] Reverse proxy set up with SSL
- [ ] Health checks passing
- [ ] PDF rendering worker scheduled
- [ ] Logs are being monitored
- [ ] Backups configured
- [ ] Resource limits set appropriately
- [ ] Domain/subdomain pointing to server

## Support

For issues specific to:
- Next.js: Check `/app/web/.next/server` for build errors
- Docker: Review `docker logs`
- Dockge: Check Dockge logs in its web UI
