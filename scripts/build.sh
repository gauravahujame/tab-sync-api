#!/bin/bash

# Enable BuildKit for faster builds
export DOCKER_BUILDKIT=1
export COMPOSE_DOCKER_CLI_BUILD=1

# Color codes for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Function to print colored output
print_info() {
    echo -e "${BLUE}ℹ${NC} $1"
}

print_success() {
    echo -e "${GREEN}✓${NC} $1"
}

print_warning() {
    echo -e "${YELLOW}⚠${NC} $1"
}

print_error() {
    echo -e "${RED}✗${NC} $1"
}

# Function to show usage
show_usage() {
    cat << EOF
Usage: $(basename "$0") [COMMAND] [OPTIONS]

COMMANDS:
    prod, production    Build production Docker image
    dev, development    Build development Docker image
    clean               Clean up Docker images and cache
    help                Show this help message

OPTIONS:
    --no-cache          Build without using cache
    --progress=plain    Show plain build progress (default: auto)
    --pull              Always pull base images

EXAMPLES:
    $(basename "$0")                    # Build production image
    $(basename "$0") prod               # Build production image
    $(basename "$0") dev                # Build development image
    $(basename "$0") prod --no-cache    # Build production without cache
    $(basename "$0") clean              # Clean Docker resources

EOF
}

# Function to build production image
build_production() {
    print_info "Building production Docker image..."

    # Suppress cache import warnings
    if docker compose build --progress=auto "$@" 2>&1 | grep -v "importing cache manifest"; then
        print_success "Production image built successfully!"
        echo ""
        print_info "Image details:"
        docker images | head -1
        docker images | grep tab-sync-api | grep -v dev
        return 0
    else
        print_error "Production build failed!"
        return 1
    fi
}

# Function to build development image
build_development() {
    print_info "Building development Docker image..."

    # Suppress cache import warnings
    if docker compose -f docker-compose.dev.yml build --progress=auto "$@" 2>&1 | grep -v "importing cache manifest"; then
        print_success "Development image built successfully!"
        echo ""
        print_info "Image details:"
        docker images | head -1
        docker images | grep tab-sync-api-dev
        return 0
    else
        print_error "Development build failed!"
        return 1
    fi
}

# Function to clean up Docker resources
clean_docker() {
    print_warning "Cleaning up Docker resources..."
    echo ""

    print_info "Stopping and removing containers..."
    docker compose down -v 2>/dev/null || true
    docker compose -f docker-compose.dev.yml down -v 2>/dev/null || true

    print_info "Removing tab-sync images..."
    docker images | grep tab-sync | awk '{print $3}' | xargs -r docker rmi -f 2>/dev/null || true

    print_info "Pruning unused Docker resources..."
    docker system prune -f

    echo ""
    print_info "Docker disk usage:"
    docker system df

    print_success "Cleanup complete!"
}

# Function to check if Docker is running
check_docker() {
    if ! docker info >/dev/null 2>&1; then
        print_error "Docker is not running. Please start Docker first."
        exit 1
    fi
}

# Function to create data directory
ensure_data_dir() {
    if [ ! -d "./data" ]; then
        print_info "Creating data directory..."
        mkdir -p ./data/logs
        print_success "Data directory created"
    fi
}

# Main script logic
main() {
    # Check if Docker is running
    check_docker

    # Ensure data directory exists
    ensure_data_dir

    # Default command
    COMMAND="${1:-prod}"
    shift 2>/dev/null || true

    case "$COMMAND" in
        prod|production)
            build_production "$@"
            ;;
        dev|development)
            build_development "$@"
            ;;
        clean)
            clean_docker
            ;;
        help|-h|--help)
            show_usage
            exit 0
            ;;
        *)
            print_error "Unknown command: $COMMAND"
            echo ""
            show_usage
            exit 1
            ;;
    esac
}

# Run main function
main "$@"
