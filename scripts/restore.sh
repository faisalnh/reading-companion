#!/bin/sh
# PostgreSQL Restore Script for Reading Buddy
# Usage: ./restore.sh <backup_file>

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Check if backup file is provided
if [ -z "$1" ]; then
    echo "${RED}Error: No backup file specified${NC}"
    echo "Usage: $0 <backup_file>"
    echo ""
    echo "Available backups:"
    ls -lh /backups/reading_buddy_*.sql.gz 2>/dev/null || echo "  No backups found"
    exit 1
fi

BACKUP_FILE="$1"

# Check if file exists
if [ ! -f "${BACKUP_FILE}" ]; then
    echo "${RED}Error: Backup file not found: ${BACKUP_FILE}${NC}"
    exit 1
fi

echo "========================================"
echo "Reading Buddy Database Restore"
echo "========================================"
echo "${YELLOW}WARNING: This will REPLACE the current database!${NC}"
echo "Backup file: ${BACKUP_FILE}"
echo ""
echo "Press Ctrl+C to cancel, or Enter to continue..."
read

# Verify backup integrity
echo "${YELLOW}Verifying backup integrity...${NC}"
if gunzip -t "${BACKUP_FILE}"; then
    echo "${GREEN}✓ Backup integrity verified${NC}"
else
    echo "${RED}✗ Backup verification failed!${NC}"
    exit 1
fi

# Drop existing database and recreate
echo "${YELLOW}Dropping existing database...${NC}"
psql -h postgres -U postgres -c "SELECT pg_terminate_backend(pid) FROM pg_stat_activity WHERE datname = '${POSTGRES_DB}';" || true
psql -h postgres -U postgres -c "DROP DATABASE IF EXISTS ${POSTGRES_DB};"
psql -h postgres -U postgres -c "CREATE DATABASE ${POSTGRES_DB};"
echo "${GREEN}✓ Database recreated${NC}"

# Restore from backup
echo "${YELLOW}Restoring from backup...${NC}"
if gunzip -c "${BACKUP_FILE}" | psql -h postgres -U "${POSTGRES_USER}" -d "${POSTGRES_DB}"; then
    echo "${GREEN}✓ Restore completed successfully${NC}"
else
    echo "${RED}✗ Restore failed!${NC}"
    exit 1
fi

# Verify restore
echo "${YELLOW}Verifying restore...${NC}"
TABLE_COUNT=$(psql -h postgres -U "${POSTGRES_USER}" -d "${POSTGRES_DB}" -t -c "SELECT COUNT(*) FROM information_schema.tables WHERE table_schema = 'public';")
echo "${GREEN}✓ Restored ${TABLE_COUNT} tables${NC}"

echo "========================================"
echo "Restore completed at: $(date)"
echo "========================================"
