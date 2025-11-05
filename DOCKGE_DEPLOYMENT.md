# Reading Buddy - Dockge Deployment Guide

This guide will help you deploy Reading Buddy using Dockge, a modern Docker Compose stack manager.

## Prerequisites

### Server Requirements
- **OS**: Ubuntu 22.04+ / Debian Bullseye+ / CentOS / Fedora / ArchLinux
- **Docker**: Version 20 or higher
- **Architecture**: amd64 (x86_64), arm64, or armv7
- **RAM**: Minimum 2GB (4GB recommended)
- **Disk**: At least 10GB free space

### Required Software
1. Docker and Docker Compose
2. Git (for cloning the repository)

## Part 1: Install Dockge

### Step 1: Install Docker (if not already installed)

```bash
# Update package list
sudo apt update

# Install Docker
curl -fsSL https://get.docker.com -o get-docker.sh
sudo sh get-docker.sh

# Add your user to docker group (optional, to run docker without sudo)
sudo usermod -aG docker $USER

# Log out and back in for group changes to take effect
```

### Step 2: Install Dockge

```bash
# Create directories for Dockge
sudo mkdir -p /opt/dockge /opt/stacks

# Navigate to Dockge directory
cd /opt/dockge

# Download the Dockge compose file
sudo curl -fsSL https://raw.githubusercontent.com/louislam/dockge/master/compose.yaml -o compose.yaml

# Start Dockge
sudo docker compose up -d
```

### Step 3: Access Dockge

1. Open your browser and navigate to: `http://your-server-ip:5001`
2. Create your admin account on first launch
3. You're now ready to deploy stacks!

## Part 2: Deploy Reading Buddy

### Option A: Deploy via Dockge Web Interface (Recommended)

1. **Access Dockge**: Open `http://your-server-ip:5001`

2. **Create New Stack**:
   - Click "Compose" → "New Stack"
   - Name your stack: `reading-buddy`

3. **Upload Project Files**:
   - You can either:
     - Clone the repository to `/opt/stacks/reading-buddy/`
     - Or upload files manually through Dockge's file manager

4. **Configure Environment Variables**:
   - In Dockge, click on the stack's "Environment" tab
   - Copy contents from `.env.example` and fill in your values:

   ```env
   # Database Configuration
   POSTGRES_USER=postgres
   POSTGRES_PASSWORD=your-secure-database-password
   POSTGRES_DB=reading_buddy
   DATABASE_URL=postgresql://postgres:your-secure-database-password@db:5432/reading_buddy

   # NextAuth Configuration
   NEXTAUTH_SECRET=your-generated-secret-here
   NEXTAUTH_URL=https://your-domain.com

   # Google OAuth (Optional)
   GOOGLE_CLIENT_ID=your-google-client-id
   GOOGLE_CLIENT_SECRET=your-google-client-secret

   # Gemini API
   GEMINI_API_KEY=your-gemini-api-key

   # Application Settings
   NODE_ENV=production
   PORT=3000
   APP_PORT=3000
   DB_PORT=5432
   ```

   **Important**: Generate a secure NEXTAUTH_SECRET:
   ```bash
   openssl rand -base64 32
   ```

5. **Start the Stack**:
   - Click "Start" button in Dockge
   - Monitor the logs to ensure services start correctly
   - Database initialization will happen automatically on first run

### Option B: Deploy via Command Line

```bash
# Navigate to stacks directory
cd /opt/stacks

# Clone the repository
git clone https://github.com/yourusername/reading-buddy.git
cd reading-buddy

# Create .env file from example
cp .env.example .env

# Edit .env with your values
nano .env

# Start the stack
docker compose up -d

# View logs
docker compose logs -f
```

## Part 3: Configure Domain and SSL (Production)

### Using Nginx Reverse Proxy

1. **Install Nginx**:
```bash
sudo apt install nginx certbot python3-certbot-nginx -y
```

2. **Create Nginx Configuration**:
```bash
sudo nano /etc/nginx/sites-available/reading-buddy
```

Add this configuration:
```nginx
server {
    listen 80;
    server_name your-domain.com;

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

3. **Enable the site**:
```bash
sudo ln -s /etc/nginx/sites-available/reading-buddy /etc/nginx/sites-enabled/
sudo nginx -t
sudo systemctl reload nginx
```

4. **Get SSL Certificate**:
```bash
sudo certbot --nginx -d your-domain.com
```

5. **Update NEXTAUTH_URL**:
   - In Dockge, edit your stack's environment variables
   - Change `NEXTAUTH_URL` to `https://your-domain.com`
   - Restart the stack

## Managing Your Deployment

### Viewing Logs
- In Dockge: Click on your stack → "Logs" tab
- Via CLI: `cd /opt/stacks/reading-buddy && docker compose logs -f`

### Updating the Application

1. **Via Dockge**:
   - Navigate to your stack
   - Click "Pull" to get latest code (if using git)
   - Click "Rebuild" to rebuild containers
   - Click "Restart"

2. **Via CLI**:
   ```bash
   cd /opt/stacks/reading-buddy
   git pull
   docker compose build --no-cache
   docker compose up -d
   ```

### Stopping the Application
- In Dockge: Click "Stop" button
- Via CLI: `docker compose down`

### Backing Up Data

```bash
# Backup database
docker exec reading-buddy-db pg_dump -U postgres reading_buddy > backup_$(date +%Y%m%d).sql

# Backup uploaded files
tar -czf uploads_backup_$(date +%Y%m%d).tar.gz /var/lib/docker/volumes/reading-buddy_app_uploads
```

## Troubleshooting

### Database Connection Issues
```bash
# Check if database is running
docker compose ps

# View database logs
docker compose logs db

# Test database connection
docker exec -it reading-buddy-db psql -U postgres -d reading_buddy
```

### Application Won't Start
```bash
# Check application logs
docker compose logs app

# Rebuild without cache
docker compose build --no-cache app
docker compose up -d
```

### Port Already in Use
```bash
# Check what's using the port
sudo lsof -i :3000

# Change port in .env file
APP_PORT=3001
```

### Reset Everything (Fresh Start)
```bash
# WARNING: This will delete all data!
cd /opt/stacks/reading-buddy
docker compose down -v
docker compose up -d
```

## Security Best Practices

1. **Strong Passwords**: Use strong, unique passwords for database and NEXTAUTH_SECRET
2. **Firewall**: Configure UFW or iptables to only expose necessary ports
3. **SSL**: Always use HTTPS in production
4. **Regular Updates**: Keep Docker, Dockge, and your application updated
5. **Backups**: Set up automated database backups
6. **Environment Variables**: Never commit `.env` file to version control

## Monitoring

### Health Checks
```bash
# Check container health
docker compose ps

# Check database health
docker exec reading-buddy-db pg_isready -U postgres
```

### Resource Usage
```bash
# View container resource usage
docker stats
```

## Support

If you encounter issues:
1. Check the logs in Dockge
2. Review this documentation
3. Check the main README.md for application-specific issues
4. Open an issue on the GitHub repository

## Additional Resources

- [Dockge Documentation](https://github.com/louislam/dockge)
- [Docker Documentation](https://docs.docker.com/)
- [Next.js Deployment](https://nextjs.org/docs/deployment)
- [Prisma Production Best Practices](https://www.prisma.io/docs/guides/deployment/deployment-guides)
