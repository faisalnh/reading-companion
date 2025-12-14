#!/bin/bash
# Setup automated backups for Reading Buddy PostgreSQL
# Run this once on your Proxmox host to set up daily backups via cron

set -e

# Configuration
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="$(dirname "$SCRIPT_DIR")"
BACKUP_DIR="${PROJECT_DIR}/postgres-backups"

# Colors
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

echo "========================================"
echo "Reading Buddy Backup Setup"
echo "========================================"

# Create backup directory
mkdir -p "$BACKUP_DIR"
echo -e "${GREEN}✓ Backup directory created: ${BACKUP_DIR}${NC}"

# Create backup script wrapper
cat > "${PROJECT_DIR}/run-backup.sh" << 'EOF'
#!/bin/bash
# Wrapper script to run backup from host via docker exec

CONTAINER_NAME="reading-buddy-postgres"
TIMESTAMP=$(date +"%Y%m%d_%H%M%S")
BACKUP_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)/postgres-backups"
BACKUP_FILE="${BACKUP_DIR}/reading_buddy_${TIMESTAMP}.sql.gz"
RETENTION_DAYS="${BACKUP_RETENTION_DAYS:-30}"

# Check if container is running
if ! docker ps --format '{{.Names}}' | grep -q "^${CONTAINER_NAME}$"; then
    echo "ERROR: Container ${CONTAINER_NAME} is not running"
    exit 1
fi

# Create backup
echo "Creating backup..."
docker exec -e PGPASSWORD="${POSTGRES_PASSWORD}" "${CONTAINER_NAME}" \
    pg_dump -U reading_buddy_app -d reading_buddy | gzip > "${BACKUP_FILE}"

# Verify backup
if gunzip -t "${BACKUP_FILE}" 2>/dev/null; then
    BACKUP_SIZE=$(du -h "${BACKUP_FILE}" | cut -f1)
    echo "✓ Backup created: ${BACKUP_FILE} (${BACKUP_SIZE})"
else
    echo "✗ Backup verification failed!"
    exit 1
fi

# Clean up old backups
DELETED=$(find "${BACKUP_DIR}" -name "reading_buddy_*.sql.gz" -type f -mtime +${RETENTION_DAYS} -delete -print | wc -l)
echo "✓ Deleted ${DELETED} old backup(s)"

# Summary
TOTAL_BACKUPS=$(find "${BACKUP_DIR}" -name "reading_buddy_*.sql.gz" -type f | wc -l)
TOTAL_SIZE=$(du -sh "${BACKUP_DIR}" | cut -f1)
echo "Current backups: ${TOTAL_BACKUPS} files (${TOTAL_SIZE})"
EOF

chmod +x "${PROJECT_DIR}/run-backup.sh"
echo -e "${GREEN}✓ Backup wrapper script created${NC}"

# Add to crontab
CRON_JOB="0 2 * * * cd ${PROJECT_DIR} && ./run-backup.sh >> ${BACKUP_DIR}/backup.log 2>&1"

# Check if cron job already exists
if crontab -l 2>/dev/null | grep -q "run-backup.sh"; then
    echo -e "${YELLOW}⚠ Cron job already exists${NC}"
else
    (crontab -l 2>/dev/null; echo "$CRON_JOB") | crontab -
    echo -e "${GREEN}✓ Cron job added (daily at 2 AM)${NC}"
fi

# Test backup immediately
echo ""
echo "Testing backup now..."
"${PROJECT_DIR}/run-backup.sh"

echo ""
echo "========================================"
echo -e "${GREEN}Setup complete!${NC}"
echo "========================================"
echo "Backups will run daily at 2 AM"
echo "Backup directory: ${BACKUP_DIR}"
echo "Retention: ${BACKUP_RETENTION_DAYS:-30} days"
echo ""
echo "To restore a backup:"
echo "  docker exec -i reading-buddy-postgres psql -U reading_buddy_app -d reading_buddy < backup.sql"
