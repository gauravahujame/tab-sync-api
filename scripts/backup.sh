#!/bin/bash
# =============================================================================
# Tab-Sync-API Database Backup Script
# =============================================================================
# Usage: ./scripts/backup.sh [options]
# =============================================================================

set -e

# Configuration
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="$(dirname "$SCRIPT_DIR")"
DATA_DIR="${PROJECT_DIR}/data"
BACKUP_DIR="${DATA_DIR}/backups"
DB_FILE="${DATA_DIR}/tabs.db"
RETENTION_COUNT="${BACKUP_RETENTION:-10}"

# Colors
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m'

info() { echo -e "${GREEN}[INFO]${NC} $1"; }
warn() { echo -e "${YELLOW}[WARN]${NC} $1"; }
error() { echo -e "${RED}[ERROR]${NC} $1"; exit 1; }

# Show help
show_help() {
    cat << EOF
Tab-Sync-API Database Backup

Usage: $(basename "$0") [options]

Options:
  -o, --output <dir>    Custom backup directory (default: ./data/backups)
  -r, --retention <n>   Number of backups to keep (default: 10)
  -n, --no-compress     Don't compress the backup
  --list                List existing backups
  --clean               Remove old backups beyond retention
  -h, --help            Show this help

Examples:
  $(basename "$0")                     # Create compressed backup
  $(basename "$0") --retention 5       # Keep only 5 backups
  $(basename "$0") --list              # List all backups
EOF
}

# Create backup
create_backup() {
    local compress=true

    while [[ $# -gt 0 ]]; do
        case $1 in
            -o|--output) BACKUP_DIR="$2"; shift ;;
            -r|--retention) RETENTION_COUNT="$2"; shift ;;
            -n|--no-compress) compress=false ;;
            --list) list_backups; exit 0 ;;
            --clean) clean_backups; exit 0 ;;
            -h|--help) show_help; exit 0 ;;
            *) warn "Unknown option: $1" ;;
        esac
        shift
    done

    # Ensure backup directory exists
    mkdir -p "$BACKUP_DIR"

    # Check database exists
    if [ ! -f "$DB_FILE" ]; then
        error "Database not found: $DB_FILE"
    fi

    # Create backup filename with timestamp
    local timestamp=$(date +%Y%m%d_%H%M%S)
    local backup_name="tabs_${timestamp}.db"
    local backup_path="${BACKUP_DIR}/${backup_name}"

    info "Creating backup of $DB_FILE..."

    # Use SQLite backup command for consistent backup
    if command -v sqlite3 &> /dev/null; then
        sqlite3 "$DB_FILE" ".backup '${backup_path}'"
    else
        # Fallback to file copy
        cp "$DB_FILE" "$backup_path"
    fi

    # Compress if requested
    if [ "$compress" = true ]; then
        info "Compressing backup..."
        gzip "$backup_path"
        backup_path="${backup_path}.gz"
    fi

    # Show result
    local size=$(ls -lh "$backup_path" | awk '{print $5}')
    info "Backup created: $backup_path ($size)"

    # Clean old backups
    clean_backups
}

# List existing backups
list_backups() {
    info "Available backups in $BACKUP_DIR:"
    echo ""

    if [ -d "$BACKUP_DIR" ] && ls "$BACKUP_DIR"/*.gz 2>/dev/null | head -1 > /dev/null; then
        ls -lht "$BACKUP_DIR"/*.gz 2>/dev/null | while read -r line; do
            echo "  $line"
        done
        echo ""
        local count=$(ls -1 "$BACKUP_DIR"/*.gz 2>/dev/null | wc -l | tr -d ' ')
        info "Total: $count backup(s)"
    else
        echo "  No backups found."
    fi
}

# Clean old backups
clean_backups() {
    if [ ! -d "$BACKUP_DIR" ]; then
        return
    fi

    local count=$(ls -1 "$BACKUP_DIR"/*.gz 2>/dev/null | wc -l | tr -d ' ')

    if [ "$count" -gt "$RETENTION_COUNT" ]; then
        local to_delete=$((count - RETENTION_COUNT))
        info "Removing $to_delete old backup(s) (keeping $RETENTION_COUNT)..."

        ls -t "$BACKUP_DIR"/*.gz 2>/dev/null | tail -n "$to_delete" | while read -r file; do
            rm -f "$file"
            echo "  Removed: $(basename "$file")"
        done
    fi
}

# Run
create_backup "$@"
