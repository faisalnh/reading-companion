#!/bin/sh
# PostgreSQL Backup Script for Reading Buddy
# Runs daily via cron, keeps backups for configured retention period

set -e

# Configuration
BACKUP_DIR="/backups"
RETENTION_DAYS="${BACKUP_RETENTION_DAYS:-30}"
TIMESTAMP=$(date +"%Y%m%d_%H%M%S")
BACKUP_FILE="${BACKUP_DIR}/reading_buddy_${TIMESTAMP}.sql.gz"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

echo "========================================"
echo "Reading Buddy Database Backup"
echo "Started at: $(date)"
echo "========================================"

# Create backup directory if it doesn't exist
mkdir -p "${BACKUP_DIR}"

# Perform backup
echo "${GREEN}Creating backup...${NC}"
if pg_dump -h postgres -U "${POSTGRES_USER}" -d "${POSTGRES_DB}" | gzip > "${BACKUP_FILE}"; then
    BACKUP_SIZE=$(du -h "${BACKUP_FILE}" | cut -f1)
    echo "${GREEN}✓ Backup created successfully: ${BACKUP_FILE} (${BACKUP_SIZE})${NC}"
else
    echo "${RED}✗ Backup failed!${NC}"
    exit 1
fi

# Verify backup integrity
echo "${YELLOW}Verifying backup integrity...${NC}"
if gunzip -t "${BACKUP_FILE}"; then
    echo "${GREEN}✓ Backup integrity verified${NC}"
else
    echo "${RED}✗ Backup verification failed!${NC}"
    exit 1
fi

# Clean up old backups
echo "${YELLOW}Cleaning up old backups (retention: ${RETENTION_DAYS} days)...${NC}"
DELETED_COUNT=$(find "${BACKUP_DIR}" -name "reading_buddy_*.sql.gz" -type f -mtime +${RETENTION_DAYS} -delete -print | wc -l)
echo "${GREEN}✓ Deleted ${DELETED_COUNT} old backup(s)${NC}"

# List current backups
CURRENT_BACKUPS=$(find "${BACKUP_DIR}" -name "reading_buddy_*.sql.gz" -type f | wc -l)
TOTAL_SIZE=$(du -sh "${BACKUP_DIR}" | cut -f1)
echo "${GREEN}Current backups: ${CURRENT_BACKUPS} files (${TOTAL_SIZE})${NC}"

echo "========================================"
echo "Backup completed at: $(date)"
echo "========================================"
