# 🚀 Coolify Deployment Guide

## Database Setup Complete! ✅

Your application is now configured with automatic database initialization. Follow these steps to deploy:

---

## 📋 Step-by-Step Deployment

### Step 1: Update Environment Variables in Coolify

Go to your application in Coolify → **Configuration** → **Environment Variables**

Make sure you have these variables set (update the DATABASE_URL):

```env
DATABASE_URL=postgres://postgres:TVsaU4eUkB0lwJ1prr3BJyiWcmoodTrM5RL1PC9CbWd2bTKXut3vSOA8bJBZ5u19@aokw4g08cs8co4coc84sccg8:5432/postgres?schema=public

GEMINI_API_KEY=AIzaSyD16Pe7bh-QQDYaAgmGRKClcAZ6bWf-Ep4

GOOGLE_CLIENT_ID=427708699736-6uoegd2c9oh02581ff9db0ckgcge1kk7.apps.googleusercontent.com
GOOGLE_CLIENT_SECRET=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

NEXTAUTH_SECRET=sOWbmReb20X76uKz9SPUSU3Sl1SNvCMGGW/xe94+ZH0=
NEXTAUTH_URL=https://reads.mws.web.id

NIXPACKS_NODE_VERSION=20
NODE_ENV=production
```

**IMPORTANT**: Notice `?schema=public` was added to DATABASE_URL. Make sure to update this!

---

### Step 2: Push Your Code

```bash
git push origin main
```

---

### Step 3: Deploy in Coolify

1. Go to your **reading-buddy** application in Coolify
2. Click **"Deploy"** button
3. Wait for the build to complete

**What happens during deployment:**

1. ✅ Code is pulled from Git
2. ✅ Dependencies are installed
3. ✅ Next.js application is built
4. ✅ **Database is automatically initialized** (new!)
   - Prisma schema is pushed to database
   - Database is seeded with initial data (if empty)
5. ✅ Application starts

---

### Step 4: Verify Deployment

After deployment completes:

1. **Check Deployment Logs** in Coolify:
   - Look for: `🗄️ Starting database initialization...`
   - Should see: `🎉 Database initialization complete!`

2. **Access Your Application**:
   - Open: https://reads.mws.web.id
   - You should see the sign-in page

3. **Test Sign-In**:
   - Click "Sign in with Google"
   - First-time users will automatically get a STUDENT role

---

## 👥 Default Test Accounts

After seeding, you'll have these test accounts:

### Admin Account
- **Email**: admin@readingbuddy.com
- **Name**: Principal Johnson
- **Role**: ADMIN

### Librarian Account
- **Email**: librarian@readingbuddy.com
- **Name**: Ms. Roberts
- **Role**: LIBRARIAN

### Teacher Accounts
- **Email**: teacher1@readingbuddy.com
- **Name**: Mr. Smith
- **Role**: TEACHER

- **Email**: teacher2@readingbuddy.com
- **Name**: Ms. Davis
- **Role**: TEACHER

### Student Accounts
- **Email**: student1@readingbuddy.com
- **Name**: Alice Johnson
- **Role**: STUDENT

- **Email**: student2@readingbuddy.com
- **Name**: Bob Smith
- **Role**: STUDENT

- **Email**: student3@readingbuddy.com
- **Name**: Charlie Brown
- **Role**: STUDENT

**Note**: These are Google OAuth emails. To test with these accounts, you need to sign in with the actual Google accounts, OR manually update the database to use a different auth provider for testing.

---

## 🔧 Manual Database Operations

If you need to manually run database operations:

### Option 1: Using Coolify Terminal

1. Go to your application in Coolify
2. Click **"Terminal"** tab
3. Run commands:

```bash
# Generate Prisma client
npm run db:generate

# Push schema to database
npm run db:push

# Seed database
npm run db:seed

# Or run the full initialization script
npm run db:init
```

### Option 2: Using Local Connection

Connect to your PostgreSQL database from local:

```bash
# Export the connection string
export DATABASE_URL="postgres://postgres:TVsaU4eUkB0lwJ1prr3BJyiWcmoodTrM5RL1PC9CbWd2bTKXut3vSOA8bJBZ5u19@aokw4g08cs8co4coc84sccg8:5432/postgres?schema=public"

# Run Prisma commands
npx prisma db push
npx prisma db seed

# Or open Prisma Studio to view/edit data
npx prisma studio
```

---

## 🐛 Troubleshooting

### Database Connection Issues

If you see connection errors:

1. **Check DATABASE_URL format**:
   - Must include `?schema=public`
   - Host must be accessible from your app container

2. **Verify PostgreSQL is running**:
   - In Coolify, check your PostgreSQL database status
   - Should show as "Running"

3. **Check logs**:
   - Look at build logs in Coolify
   - Check for database connection errors

### Database Already Initialized

The script is **idempotent** (safe to run multiple times):
- If tables exist, it won't recreate them
- If data exists, it won't re-seed
- You can safely redeploy without losing data

### Force Re-seed Database

If you want to reset and re-seed:

1. Access PostgreSQL terminal in Coolify
2. Drop all tables:
   ```sql
   DROP SCHEMA public CASCADE;
   CREATE SCHEMA public;
   ```
3. Redeploy your application

---

## 📊 Database Management

### View Database with Prisma Studio

From your local machine:

```bash
# Set DATABASE_URL
export DATABASE_URL="postgres://postgres:TVsaU4eUkB0lwJ1prr3BJyiWcmoodTrM5RL1PC9CbWd2bTKXut3vSOA8bJBZ5u19@aokw4g08cs8co4coc84sccg8:5432/postgres?schema=public"

# Run Prisma Studio
npx prisma studio
```

This will open a browser interface to view and edit your database.

---

## ✅ Next Steps

1. **Push the code**: `git push origin main`
2. **Update DATABASE_URL** in Coolify (add `?schema=public`)
3. **Click Deploy** in Coolify
4. **Wait for deployment** (watch logs)
5. **Access your app**: https://reads.mws.web.id
6. **Sign in with Google** to create your first user

---

## 🎉 Success Indicators

You'll know everything worked when:

- ✅ Build completes without errors
- ✅ You see "Database initialization complete!" in logs
- ✅ Sign-in page loads at https://reads.mws.web.id
- ✅ Google OAuth works (creates new user)
- ✅ Dashboard loads after sign-in

---

## 📞 Need Help?

If you encounter issues:

1. Check Coolify deployment logs
2. Verify all environment variables are set correctly
3. Ensure DATABASE_URL includes `?schema=public`
4. Check PostgreSQL database is running in Coolify

Good luck with your deployment! 🚀
