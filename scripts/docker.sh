#!/bin/bash
# =============================================================================
# Tab-Sync-API Docker Management Script
# =============================================================================
# Usage: ./scripts/docker.sh [command] [options]
# =============================================================================

set -e

# Script directory
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="$(dirname "$SCRIPT_DIR")"

# Change to project directory
cd "$PROJECT_DIR"

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

# Print functions
info() { echo -e "${BLUE}ℹ${NC} $1"; }
success() { echo -e "${GREEN}✓${NC} $1"; }
warn() { echo -e "${YELLOW}⚠${NC} $1"; }
error() { echo -e "${RED}✗${NC} $1"; }

# Load environment
load_env() {
    if [ -f .env ]; then
        export $(grep -v '^#' .env | xargs)
    fi
}

# Show help
show_help() {
    cat << EOF
Tab-Sync-API Docker Management

Usage: $(basename "$0") <command> [options]

Commands:
  start [--dev|--prod]     Start containers (default: prod)
  stop                     Stop all containers
  restart                  Restart containers
  logs [service]           Show logs (follow mode)
  status                   Show container status and health
  shell [service]          Open shell in container
  build [--dev|--prod]     Build images
  clean                    Remove containers and volumes
  prune                    Clean up unused Docker resources
  backup                   Backup database
  restore <file>           Restore database from backup
  update                   Pull latest changes and restart

Options:
  --dev                    Use development configuration
  --prod                   Use production configuration (default)
  --proxy                  Include nginx reverse proxy
  --no-build               Don't rebuild images
  -h, --help               Show this help

Examples:
  $(basename "$0") start --dev          # Start development environment
  $(basename "$0") start --prod --proxy # Start production with nginx
  $(basename "$0") logs app             # Follow app logs
  $(basename "$0") shell                # Shell into app container
  $(basename "$0") backup               # Backup database
EOF
}

# Get compose command based on mode
get_compose_cmd() {
    local mode="${1:-prod}"
    local proxy="${2:-false}"

    if [ "$mode" = "dev" ]; then
        echo "docker compose -f docker-compose.dev.yml"
    else
        if [ "$proxy" = "true" ]; then
            echo "docker compose --profile proxy"
        else
            echo "docker compose"
        fi
    fi
}

# Check Docker is running
check_docker() {
    if ! docker info > /dev/null 2>&1; then
        error "Docker is not running. Please start Docker first."
        exit 1
    fi
}

# Ensure data directory exists
ensure_data_dir() {
    mkdir -p ./data/logs ./data/backups
}

# Start containers
cmd_start() {
    local mode="prod"
    local proxy=false
    local build=true

    while [[ $# -gt 0 ]]; do
        case $1 in
            --dev) mode="dev" ;;
            --prod) mode="prod" ;;
            --proxy) proxy=true ;;
            --no-build) build=false ;;
            *) warn "Unknown option: $1" ;;
        esac
        shift
    done

    check_docker
    ensure_data_dir
    load_env

    local compose_cmd=$(get_compose_cmd "$mode" "$proxy")

    info "Starting Tab-Sync-API ($mode mode)..."

    if [ "$build" = true ]; then
        $compose_cmd up -d --build
    else
        $compose_cmd up -d
    fi

    success "Containers started!"
    echo ""
    cmd_status
}

# Stop containers
cmd_stop() {
    info "Stopping containers..."
    docker compose down 2>/dev/null || true
    docker compose -f docker-compose.dev.yml down 2>/dev/null || true
    success "Containers stopped."
}

# Restart containers
cmd_restart() {
    cmd_stop
    cmd_start "$@"
}

# Show logs
cmd_logs() {
    local service="${1:-}"
    local compose_cmd="docker compose"

    # Check which compose file is active
    if docker compose ps --quiet 2>/dev/null | grep -q .; then
        compose_cmd="docker compose"
    elif docker compose -f docker-compose.dev.yml ps --quiet 2>/dev/null | grep -q .; then
        compose_cmd="docker compose -f docker-compose.dev.yml"
    else
        warn "No containers running. Starting with production config..."
        compose_cmd="docker compose"
    fi

    if [ -n "$service" ]; then
        $compose_cmd logs -f "$service"
    else
        $compose_cmd logs -f
    fi
}

# Show status
cmd_status() {
    info "Container Status:"
    echo ""

    # Show running containers
    docker ps --filter "name=tab-sync" --format "table {{.Names}}\t{{.Status}}\t{{.Ports}}"

    echo ""

    # Check health
    for container in $(docker ps --filter "name=tab-sync" --format "{{.Names}}"); do
        health=$(docker inspect --format='{{.State.Health.Status}}' "$container" 2>/dev/null || echo "N/A")
        echo -e "  $container: ${health}"
    done
}

# Shell into container
cmd_shell() {
    local service="${1:-app}"
    local container="tab-sync-api"

    if [ "$service" = "dev" ]; then
        container="tab-sync-api-dev"
    elif [ "$service" = "nginx" ]; then
        container="tab-sync-nginx"
    fi

    info "Opening shell in $container..."
    docker exec -it "$container" sh
}

# Build images
cmd_build() {
    local mode="prod"

    while [[ $# -gt 0 ]]; do
        case $1 in
            --dev) mode="dev" ;;
            --prod) mode="prod" ;;
            *) warn "Unknown option: $1" ;;
        esac
        shift
    done

    check_docker

    local compose_cmd=$(get_compose_cmd "$mode")

    info "Building images ($mode)..."
    $compose_cmd build
    success "Build complete!"
}

# Clean up
cmd_clean() {
    warn "This will remove all containers and volumes!"
    read -p "Are you sure? (y/N) " -n 1 -r
    echo

    if [[ $REPLY =~ ^[Yy]$ ]]; then
        info "Cleaning up..."
        docker compose down -v 2>/dev/null || true
        docker compose -f docker-compose.dev.yml down -v 2>/dev/null || true
        success "Cleanup complete."
    else
        info "Cancelled."
    fi
}

# Prune unused resources
cmd_prune() {
    warn "This will remove unused Docker resources!"
    read -p "Are you sure? (y/N) " -n 1 -r
    echo

    if [[ $REPLY =~ ^[Yy]$ ]]; then
        info "Pruning Docker resources..."
        docker system prune -f
        docker volume prune -f
        success "Prune complete."
        echo ""
        docker system df
    else
        info "Cancelled."
    fi
}

# Backup database
cmd_backup() {
    ensure_data_dir

    local timestamp=$(date +%Y%m%d_%H%M%S)
    local backup_file="./data/backups/tabs_${timestamp}.db"

    if [ -f "./data/tabs.db" ]; then
        info "Creating backup..."
        cp "./data/tabs.db" "$backup_file"
        gzip "$backup_file"
        success "Backup created: ${backup_file}.gz"

        # Show backup size
        ls -lh "${backup_file}.gz"

        # Clean old backups (keep last 10)
        info "Cleaning old backups (keeping last 10)..."
        ls -t ./data/backups/*.gz 2>/dev/null | tail -n +11 | xargs -r rm -f
    else
        error "Database file not found: ./data/tabs.db"
        exit 1
    fi
}

# Restore database
cmd_restore() {
    local backup_file="$1"

    if [ -z "$backup_file" ]; then
        error "Usage: $(basename "$0") restore <backup-file>"
        echo ""
        info "Available backups:"
        ls -lt ./data/backups/*.gz 2>/dev/null || echo "  No backups found."
        exit 1
    fi

    if [ ! -f "$backup_file" ]; then
        error "Backup file not found: $backup_file"
        exit 1
    fi

    warn "This will replace the current database!"
    read -p "Are you sure? (y/N) " -n 1 -r
    echo

    if [[ $REPLY =~ ^[Yy]$ ]]; then
        info "Restoring from $backup_file..."

        # Stop containers first
        cmd_stop

        # Restore
        if [[ "$backup_file" == *.gz ]]; then
            gunzip -c "$backup_file" > ./data/tabs.db
        else
            cp "$backup_file" ./data/tabs.db
        fi

        success "Database restored!"
        info "Start containers with: $(basename "$0") start"
    else
        info "Cancelled."
    fi
}

# Update (git pull and restart)
cmd_update() {
    info "Pulling latest changes..."
    git pull

    info "Rebuilding and restarting..."
    cmd_restart --prod
}

# Main entry point
main() {
    local command="${1:-help}"
    shift 2>/dev/null || true

    case "$command" in
        start)   cmd_start "$@" ;;
        stop)    cmd_stop ;;
        restart) cmd_restart "$@" ;;
        logs)    cmd_logs "$@" ;;
        status)  cmd_status ;;
        shell)   cmd_shell "$@" ;;
        build)   cmd_build "$@" ;;
        clean)   cmd_clean ;;
        prune)   cmd_prune ;;
        backup)  cmd_backup ;;
        restore) cmd_restore "$@" ;;
        update)  cmd_update ;;
        help|-h|--help) show_help ;;
        *)
            error "Unknown command: $command"
            echo ""
            show_help
            exit 1
            ;;
    esac
}

main "$@"
