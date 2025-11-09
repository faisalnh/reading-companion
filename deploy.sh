#!/bin/bash
# Reading Buddy Deployment Script for Proxmox/Dockge
# This script helps you deploy the application to your Proxmox server

set -e

echo "========================================"
echo "Reading Buddy Deployment Helper"
echo "========================================"
echo ""

# Configuration
PROXMOX_USER="${PROXMOX_USER:-root}"
PROXMOX_HOST="${PROXMOX_HOST:-your-proxmox-ip}"
DEPLOY_PATH="${DEPLOY_PATH:-/opt/stacks/reading-buddy}"

# Check if SSH is configured
echo "1. Checking SSH connection to Proxmox..."
if ssh -o BatchMode=yes -o ConnectTimeout=5 "$PROXMOX_USER@$PROXMOX_HOST" exit 2>/dev/null; then
    echo "✓ SSH connection successful"
else
    echo "✗ Cannot connect to Proxmox server"
    echo ""
    echo "Please configure SSH access first:"
    echo "  ssh-copy-id $PROXMOX_USER@$PROXMOX_HOST"
    echo ""
    echo "Or set environment variables:"
    echo "  export PROXMOX_USER=your-username"
    echo "  export PROXMOX_HOST=your-proxmox-ip"
    exit 1
fi

# Create remote directory
echo ""
echo "2. Creating deployment directory on Proxmox..."
ssh "$PROXMOX_USER@$PROXMOX_HOST" "mkdir -p $DEPLOY_PATH"
echo "✓ Directory created: $DEPLOY_PATH"

# Sync files to Proxmox
echo ""
echo "3. Syncing files to Proxmox..."
rsync -avz --progress \
    --exclude 'node_modules' \
    --exclude '.next' \
    --exclude '.git' \
    --exclude '*.log' \
    --exclude '.DS_Store' \
    --exclude 'web/node_modules' \
    --exclude 'web/.next' \
    ./ "$PROXMOX_USER@$PROXMOX_HOST:$DEPLOY_PATH/"
echo "✓ Files synced"

# Copy environment file if it exists
if [ -f .env.production ]; then
    echo ""
    echo "4. Copying environment variables..."
    scp .env.production "$PROXMOX_USER@$PROXMOX_HOST:$DEPLOY_PATH/.env"
    echo "✓ Environment variables copied"
else
    echo ""
    echo "4. ⚠ Warning: .env.production not found"
    echo "   Please create it on the server at: $DEPLOY_PATH/.env"
fi

# Display next steps
echo ""
echo "========================================"
echo "✓ Deployment files transferred!"
echo "========================================"
echo ""
echo "Next steps:"
echo ""
echo "1. SSH into your Proxmox server:"
echo "   ssh $PROXMOX_USER@$PROXMOX_HOST"
echo ""
echo "2. Navigate to the deployment directory:"
echo "   cd $DEPLOY_PATH"
echo ""
echo "3. Create/edit environment file if needed:"
echo "   nano .env"
echo ""
echo "4. In Dockge, create a new stack:"
echo "   - Name: reading-buddy"
echo "   - Path: $DEPLOY_PATH"
echo "   - Copy contents from compose.production.yaml"
echo ""
echo "5. Or build manually with:"
echo "   docker compose -f compose.production.yaml build"
echo "   docker compose -f compose.production.yaml up -d"
echo ""
echo "========================================"
