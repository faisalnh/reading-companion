# Docker Build Cache Issue - Fix Guide

## Problem
Docker is caching an old version of the code from GitHub when building, causing TypeScript errors even though the fixes are committed and pushed.

## Solution: Clear Docker Build Cache

### Option 1: Clear Cache in Dockge (Recommended)

1. **In Dockge UI:**
   - Stop the `reading-buddy` stack
   - Click "Delete" to remove the stack completely
   - Delete the old image: `docker rmi reading-buddy:latest`
   - Create the stack again with the same compose.yaml
   - Deploy (this will fetch fresh code from GitHub)

### Option 2: Clear Cache via SSH

SSH into your Proxmox server and run:

```bash
# Stop and remove the container
docker compose -f /opt/stacks/reading-buddy/compose.yaml down

# Remove the old image
docker rmi reading-buddy:latest

# Clear ALL Docker build cache (this is safe)
docker builder prune -af

# Rebuild without cache
cd /opt/stacks/reading-buddy
docker compose -f compose.yaml build --no-cache --pull

# Start the container
docker compose -f compose.yaml up -d
```

### Option 3: Force Git to Fetch Latest

The issue might be Docker's git cache. Force Docker to ignore git cache:

```bash
# SSH into Proxmox
ssh root@your-proxmox-ip

# Clear Docker's git cache
docker builder prune -af --filter type=source.git

# Rebuild
cd /opt/stacks/reading-buddy
docker compose build --no-cache --pull
docker compose up -d
```

## Verification

After rebuilding, check the logs to ensure the build succeeds:

```bash
docker logs reading-buddy
```

You should see:
```
✓ Compiled successfully
Server listening on http://0.0.0.0:3000
```

## Why This Happens

Docker caches git repositories when building from a Git URL. Even though you've pushed new code to GitHub, Docker might use its cached version of the repository. Using `--no-cache` and `--pull` forces Docker to:
1. Fetch fresh code from GitHub
2. Ignore all cached layers
3. Rebuild everything from scratch

## Current Commit

Latest commit that should be built:
```
0a22cce - Fix all Supabase relationship array handling issues
```

Verify this commit is being used by checking the GitHub repository:
https://github.com/faisalnh/reading-companion/tree/Hybrid

## If Issue Persists

If clearing cache doesn't work, the repository might have stale content on GitHub. Force push:

```bash
# On your local machine
cd /Users/faisalnurhidayat/reading-buddy
git push origin Hybrid --force
```

Then rebuild in Dockge with cache cleared.
