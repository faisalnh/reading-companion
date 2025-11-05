# Composing Reading Buddy Stack in Dockge

This guide walks you through creating and deploying the Reading Buddy stack using Dockge's web interface.

## Method 1: Using Dockge Web Interface (Recommended)

### Step 1: Access Dockge
1. Open your browser
2. Navigate to: `http://your-server-ip:5001`
3. Log in with your Dockge credentials

### Step 2: Create New Stack

1. Click the **"+ Compose"** button in the top right
2. In the dialog, enter:
   - **Name**: `reading-buddy`
   - This will create the stack at `/opt/stacks/reading-buddy`
3. Click **"OK"**

### Step 3: Add Docker Compose Configuration

You'll see an editor. **Copy and paste this entire docker-compose.yml**:

```yaml
version: '3.8'

services:
  # PostgreSQL Database
  # Stores all application data including users, books, and reading progress
  db:
    image: postgres:16-alpine
    container_name: reading-buddy-db
    restart: unless-stopped
    environment:
      POSTGRES_USER: ${POSTGRES_USER:-postgres}
      POSTGRES_PASSWORD: ${POSTGRES_PASSWORD:-postgres}
      POSTGRES_DB: ${POSTGRES_DB:-reading_buddy}
    ports:
      - "${DB_PORT:-5432}:5432"
    volumes:
      - postgres_data:/var/lib/postgresql/data
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U ${POSTGRES_USER:-postgres}"]
      interval: 10s
      timeout: 5s
      retries: 5
    networks:
      - reading-buddy-network
    labels:
      - "com.dockge.description=PostgreSQL database for Reading Buddy"
      - "com.dockge.icon=database"

  # Next.js Application
  # Main web application server with SSR and API routes
  app:
    build:
      context: .
      dockerfile: Dockerfile
    container_name: reading-buddy-app
    restart: unless-stopped
    depends_on:
      db:
        condition: service_healthy
    environment:
      # Database
      DATABASE_URL: ${DATABASE_URL:-postgresql://postgres:postgres@db:5432/reading_buddy}

      # NextAuth
      NEXTAUTH_URL: ${NEXTAUTH_URL:-http://localhost:3000}
      NEXTAUTH_SECRET: ${NEXTAUTH_SECRET}

      # OAuth Providers
      GOOGLE_CLIENT_ID: ${GOOGLE_CLIENT_ID}
      GOOGLE_CLIENT_SECRET: ${GOOGLE_CLIENT_SECRET}

      # AI Integration
      GEMINI_API_KEY: ${GEMINI_API_KEY}

      # Application
      NODE_ENV: ${NODE_ENV:-production}
      PORT: ${PORT:-3000}
    ports:
      - "${APP_PORT:-3000}:3000"
    networks:
      - reading-buddy-network
    volumes:
      # Persist uploaded files
      - app_uploads:/app/public/books
      - app_covers:/app/public/covers
      - app_badges:/app/public/badges
    labels:
      - "com.dockge.description=Reading Buddy Next.js Application"
      - "com.dockge.icon=book"

networks:
  reading-buddy-network:
    driver: bridge

volumes:
  postgres_data:
    driver: local
  app_uploads:
    driver: local
  app_covers:
    driver: local
  app_badges:
    driver: local
```

Click **"Save"** (Ctrl+S or the save icon)

### Step 4: Upload Application Files

You need to upload your application source code to the stack directory:

**Option A: Using Terminal (SSH)**
```bash
# On your server, navigate to the stack directory
cd /opt/stacks/reading-buddy

# Clone or copy your repository
git clone https://github.com/yourusername/reading-buddy.git .

# Or if you have files locally, use SCP:
# scp -r /path/to/reading-buddy/* user@server:/opt/stacks/reading-buddy/
```

**Option B: Using Dockge's Terminal**
1. Click on your stack name
2. Click the **"Terminal"** button
3. Run:
```bash
git clone https://github.com/yourusername/reading-buddy.git /tmp/app
mv /tmp/app/* .
mv /tmp/app/.* . 2>/dev/null
rm -rf /tmp/app
```

### Step 5: Configure Environment Variables

1. In your stack view, click the **"Edit Stack"** button
2. Look for the **"Env"** or **"Environment"** section
3. Paste these environment variables:

```env
# Database Configuration
POSTGRES_USER=postgres
POSTGRES_PASSWORD=CHANGE_THIS_SECURE_PASSWORD
POSTGRES_DB=reading_buddy
DATABASE_URL=postgresql://postgres:CHANGE_THIS_SECURE_PASSWORD@db:5432/reading_buddy

# Port Configuration (optional, defaults shown)
APP_PORT=3000
DB_PORT=5432

# NextAuth Configuration - REQUIRED
NEXTAUTH_SECRET=PASTE_YOUR_GENERATED_SECRET_HERE
NEXTAUTH_URL=http://your-server-ip:3000

# Google OAuth - OPTIONAL
GOOGLE_CLIENT_ID=your-google-client-id-if-you-have-one
GOOGLE_CLIENT_SECRET=your-google-client-secret-if-you-have-one

# Gemini API - REQUIRED for AI features
GEMINI_API_KEY=your-gemini-api-key-here

# Application Settings
NODE_ENV=production
PORT=3000
```

**IMPORTANT: Replace these values:**

1. **Generate NEXTAUTH_SECRET** (run on your server or local machine):
   ```bash
   openssl rand -base64 32
   ```
   Copy the output and paste it as `NEXTAUTH_SECRET`

2. **Set POSTGRES_PASSWORD** to a secure password

3. **Update DATABASE_URL** with the same password

4. **Set NEXTAUTH_URL** to your actual URL:
   - Development: `http://your-server-ip:3000`
   - Production: `https://your-domain.com`

5. **Add GEMINI_API_KEY** (get from https://makersuite.google.com/app/apikey)

Click **"Save"**

### Step 6: Verify Files Are Present

Before starting, make sure all files are in place:

1. Click the **"Terminal"** button in your stack
2. Run:
```bash
ls -la
```

You should see:
- `docker-compose.yml` ✓
- `Dockerfile` ✓
- `package.json` ✓
- `prisma/` directory ✓
- Other application files ✓

If files are missing, repeat Step 4.

### Step 7: Build and Start the Stack

1. Click the **"Start"** button (▶ play icon)
2. Dockge will:
   - Pull the PostgreSQL image
   - Build your Next.js application (this takes 5-10 minutes)
   - Start both containers
3. Watch the logs for any errors

### Step 8: Monitor Deployment

1. Click the **"Logs"** tab to view real-time logs
2. Look for these success messages:
   ```
   reading-buddy-db    | PostgreSQL init process complete
   reading-buddy-app   | ✅ Database initialization complete!
   reading-buddy-app   | Ready on http://0.0.0.0:3000
   ```

### Step 9: Access Your Application

Open your browser and navigate to:
- `http://your-server-ip:3000`

You should see the Reading Buddy login page!

---

## Method 2: Using Terminal/CLI

If you prefer the command line:

```bash
# Navigate to stacks directory
cd /opt/stacks

# Create stack directory
mkdir reading-buddy
cd reading-buddy

# Create docker-compose.yml
nano docker-compose.yml
# Paste the docker-compose content from above

# Create .env file
nano .env
# Paste the environment variables from above

# Clone/copy your application files
git clone https://github.com/yourusername/reading-buddy.git .

# Start the stack
docker compose up -d

# View logs
docker compose logs -f
```

The stack will now appear in Dockge automatically!

---

## Troubleshooting

### Build fails with "No such file or directory"
- **Problem**: Application files are not in `/opt/stacks/reading-buddy/`
- **Solution**: Make sure you completed Step 4 correctly

### "NEXTAUTH_SECRET is required"
- **Problem**: Environment variable not set
- **Solution**: Go back to Step 5 and add the variable

### Port 3000 already in use
- **Solution**: Change `APP_PORT=8080` in environment variables

### Database connection failed
```bash
# Check if database is running
docker compose ps

# View database logs
docker compose logs db

# Restart database
docker compose restart db
```

### Container keeps restarting
```bash
# View logs to see the error
docker compose logs app

# Common fixes:
# 1. Check all required env vars are set
# 2. Ensure Dockerfile exists
# 3. Check database is healthy
```

### Need to start fresh
```bash
cd /opt/stacks/reading-buddy
docker compose down -v  # WARNING: Deletes all data!
docker compose up -d
```

---

## Post-Deployment Checklist

- [ ] Application accessible at `http://your-server-ip:3000`
- [ ] Can create an account and log in
- [ ] Database persists data after restart (`docker compose restart`)
- [ ] All environment variables are set correctly
- [ ] NEXTAUTH_SECRET is strong and secure
- [ ] POSTGRES_PASSWORD is strong and secure

---

## Next Steps

### For Production Deployment:

1. **Set up a domain name** pointing to your server
2. **Configure SSL/HTTPS** (see DOCKGE_DEPLOYMENT.md)
3. **Update NEXTAUTH_URL** to your HTTPS domain
4. **Set up automated backups**
5. **Configure Google OAuth** (optional)
6. **Set up monitoring**

### For Development:

You're all set! Start building features and testing.

---

## Useful Dockge Features

### Update the Stack
1. Pull latest code: Terminal → `git pull`
2. Click **"Restart"** button
3. Or for full rebuild: Click **"Down"** → **"Start"**

### View Resource Usage
- Click on stack name
- View CPU/Memory stats in real-time

### Execute Commands
- Click **"Terminal"** button
- Run any command inside the app container

### Backup Data
```bash
# In terminal
docker exec reading-buddy-db pg_dump -U postgres reading_buddy > backup.sql
```

### Scale Services
- Not needed for this stack (single instance)
- But Dockge supports it through compose file editing

---

## Need Help?

- **Dockge Issues**: https://github.com/louislam/dockge/issues
- **Application Issues**: Check README.md and DOCKGE_DEPLOYMENT.md
- **Docker Issues**: `docker compose logs [service-name]`
