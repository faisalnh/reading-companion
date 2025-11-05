# Quick Start with Dockge

A condensed guide to get Reading Buddy running with Dockge in minutes.

## Installation (One-Time Setup)

### 1. Install Dockge on your server

```bash
sudo mkdir -p /opt/dockge /opt/stacks
cd /opt/dockge
sudo curl -fsSL https://raw.githubusercontent.com/louislam/dockge/master/compose.yaml -o compose.yaml
sudo docker compose up -d
```

Access Dockge at: `http://your-server-ip:5001`

## Deployment Steps

### 2. Prepare Your Application

```bash
cd /opt/stacks
git clone https://github.com/yourusername/reading-buddy.git
cd reading-buddy
```

### 3. Configure Environment

```bash
cp .env.example .env
nano .env
```

**Required variables to change:**
```env
POSTGRES_PASSWORD=your-secure-password-here
NEXTAUTH_SECRET=your-secret-here  # Generate with: openssl rand -base64 32
NEXTAUTH_URL=https://your-domain.com
GEMINI_API_KEY=your-api-key-here
```

### 4. Deploy via Dockge UI

1. Open `http://your-server-ip:5001`
2. Your stack should appear automatically
3. Click "Start"
4. Wait for containers to build and start
5. Access your app at `http://your-server-ip:3000`

## Quick Commands

```bash
# View logs
cd /opt/stacks/reading-buddy
docker compose logs -f

# Restart application
docker compose restart app

# Update application
git pull
docker compose build --no-cache
docker compose up -d

# Stop everything
docker compose down

# Fresh start (deletes data!)
docker compose down -v && docker compose up -d
```

## Production Checklist

- [ ] Set strong `POSTGRES_PASSWORD`
- [ ] Generate secure `NEXTAUTH_SECRET`
- [ ] Configure domain and SSL (see full guide)
- [ ] Update `NEXTAUTH_URL` to your domain
- [ ] Set up Google OAuth (optional)
- [ ] Configure backups
- [ ] Test the application

## Common Issues

**Port 3000 already in use?**
```bash
# Change port in .env
APP_PORT=8080
```

**Database connection failed?**
```bash
# Check database is running
docker compose ps
docker compose logs db
```

**Need to reset database?**
```bash
docker compose down -v
docker compose up -d
```

## Next Steps

For detailed instructions, SSL setup, domain configuration, and troubleshooting, see:
- Full guide: [DOCKGE_DEPLOYMENT.md](./DOCKGE_DEPLOYMENT.md)
- Application docs: [README.md](./README.md)
