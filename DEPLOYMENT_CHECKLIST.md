# Reading Buddy - Dockge Deployment Checklist

Use this checklist to ensure a smooth deployment of Reading Buddy with Dockge.

## Pre-Deployment

### Server Setup
- [ ] Dockge is installed and accessible at `http://your-server-ip:5001`
- [ ] Docker and Docker Compose are installed
- [ ] Server has at least 2GB RAM (4GB recommended)
- [ ] Server has at least 10GB free disk space
- [ ] Firewall allows access to ports 3000 and 5001

### Preparation
- [ ] You have a Gemini API key (get from https://makersuite.google.com/app/apikey)
- [ ] (Optional) Google OAuth credentials prepared
- [ ] (Production) Domain name configured and pointing to server
- [ ] (Production) SSL certificate plan (Let's Encrypt, Cloudflare, etc.)

---

## Deployment Steps

### 1. Create Stack in Dockge
- [ ] Logged into Dockge UI (`http://your-server-ip:5001`)
- [ ] Clicked "+ Compose" button
- [ ] Named stack: `reading-buddy`
- [ ] Stack created successfully

### 2. Upload Application Files
- [ ] Navigated to `/opt/stacks/reading-buddy` on server
- [ ] Cloned repository or uploaded files
- [ ] Verified files present:
  - [ ] `Dockerfile`
  - [ ] `package.json`
  - [ ] `docker-compose.yml`
  - [ ] `prisma/` directory
  - [ ] `public/` directory
  - [ ] All source files

### 3. Configure Docker Compose
- [ ] Copied docker-compose.yml content into Dockge editor
- [ ] Saved the compose file
- [ ] Compose file shows no syntax errors

### 4. Set Environment Variables
- [ ] Generated NEXTAUTH_SECRET using: `openssl rand -base64 32`
- [ ] Created strong POSTGRES_PASSWORD
- [ ] Updated DATABASE_URL with correct password
- [ ] Set NEXTAUTH_URL to correct URL
- [ ] Added GEMINI_API_KEY
- [ ] Set NODE_ENV=production
- [ ] (Optional) Added Google OAuth credentials
- [ ] Saved environment variables in Dockge

### 5. Build and Deploy
- [ ] Clicked "Start" button in Dockge
- [ ] Database container started successfully
- [ ] Application build completed (5-10 minutes)
- [ ] Application container started successfully
- [ ] No errors in logs

---

## Post-Deployment Verification

### Basic Functionality
- [ ] Application accessible at `http://your-server-ip:3000`
- [ ] Homepage loads correctly
- [ ] Can navigate to login page
- [ ] Can create a new account
- [ ] Can log in with created account
- [ ] Dashboard loads after login

### Database
- [ ] Database container is healthy: `docker compose ps`
- [ ] Can connect to database: `docker exec -it reading-buddy-db psql -U postgres -d reading_buddy`
- [ ] Tables were created automatically
- [ ] Data persists after container restart

### Logs Check
- [ ] No error messages in app logs
- [ ] No error messages in database logs
- [ ] Successful database initialization message shown
- [ ] "Ready on http://0.0.0.0:3000" message shown

### Data Persistence
- [ ] Create a test user account
- [ ] Restart stack: `docker compose restart`
- [ ] Test user still exists and can log in
- [ ] Uploaded files persist in volumes

---

## Production Checklist (Additional)

### Security
- [ ] Changed POSTGRES_PASSWORD from default
- [ ] NEXTAUTH_SECRET is strong and unique
- [ ] Environment variables are secure
- [ ] `.env` file is NOT committed to git
- [ ] Firewall configured (UFW/iptables)
- [ ] Only necessary ports exposed (3000, 443)

### SSL/HTTPS Setup
- [ ] Domain name configured
- [ ] DNS A record pointing to server IP
- [ ] Nginx reverse proxy installed
- [ ] SSL certificate obtained (Let's Encrypt)
- [ ] HTTPS working correctly
- [ ] HTTP redirects to HTTPS
- [ ] Updated NEXTAUTH_URL to HTTPS URL
- [ ] Restarted stack after URL change

### Backups
- [ ] Database backup script created
- [ ] Automated backup scheduled (cron job)
- [ ] Backup location configured
- [ ] Tested database restore process
- [ ] Volume backups configured

### Monitoring
- [ ] Can view logs in Dockge
- [ ] Can view resource usage in Dockge
- [ ] Uptime monitoring configured (optional)
- [ ] Log aggregation setup (optional)

### Google OAuth (If Using)
- [ ] Authorized redirect URIs configured in Google Console
- [ ] Added: `http://your-domain.com/api/auth/callback/google`
- [ ] Tested Google Sign-in flow
- [ ] Users can sign in with Google

---

## Troubleshooting Verification

### If Issues Occur
- [ ] Reviewed logs in Dockge
- [ ] Checked all environment variables are set
- [ ] Verified all files are present in `/opt/stacks/reading-buddy`
- [ ] Confirmed ports are not already in use
- [ ] Checked firewall rules
- [ ] Verified database is healthy
- [ ] Reviewed DOCKGE_COMPOSE_GUIDE.md troubleshooting section

---

## Maintenance Setup

### Regular Tasks
- [ ] Documented update procedure
- [ ] Tested application update process
- [ ] Database backup schedule confirmed
- [ ] Log rotation configured
- [ ] Monitoring alerts set up (if applicable)

### Documentation
- [ ] Saved environment variables in secure location
- [ ] Documented any custom configurations
- [ ] Team members have access to documentation
- [ ] Disaster recovery plan documented

---

## Final Sign-off

- [ ] Application is running smoothly
- [ ] All features tested and working
- [ ] Performance is acceptable
- [ ] Security best practices followed
- [ ] Backups are configured
- [ ] Monitoring is in place
- [ ] Documentation is complete

**Deployment Date:** _______________

**Deployed By:** _______________

**Application URL:** _______________

**Notes:**
_____________________________________________________________
_____________________________________________________________
_____________________________________________________________

---

## Quick Commands Reference

```bash
# View logs
cd /opt/stacks/reading-buddy
docker compose logs -f

# Restart application
docker compose restart app

# Restart everything
docker compose restart

# Stop stack
docker compose down

# Update application
git pull
docker compose build --no-cache
docker compose up -d

# Database backup
docker exec reading-buddy-db pg_dump -U postgres reading_buddy > backup_$(date +%Y%m%d).sql

# View running containers
docker compose ps

# Check container health
docker compose ps
docker exec reading-buddy-db pg_isready -U postgres
```

---

## Support Resources

- **Deployment Guide**: `DOCKGE_COMPOSE_GUIDE.md`
- **Full Documentation**: `DOCKGE_DEPLOYMENT.md`
- **Quick Start**: `QUICK_START_DOCKGE.md`
- **Application README**: `README.md`
- **Dockge Docs**: https://github.com/louislam/dockge

---

✅ **Checklist Complete!** Your Reading Buddy application is now successfully deployed with Dockge.
