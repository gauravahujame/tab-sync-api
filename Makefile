# =============================================================================
# Tab-Sync-API Makefile
# =============================================================================
# Quick commands for development and deployment
# Run `make help` to see all available commands
# =============================================================================

.PHONY: help dev prod build logs shell status stop clean test lint backup

# Default target
.DEFAULT_GOAL := help

# Colors for help output
BLUE := \033[0;34m
GREEN := \033[0;32m
YELLOW := \033[1;33m
NC := \033[0m

# =============================================================================
# Help
# =============================================================================

help: ## Show this help message
	@echo ""
	@echo "$(BLUE)Tab-Sync-API$(NC) - Available Commands"
	@echo ""
	@echo "$(GREEN)Development:$(NC)"
	@grep -E '^[a-zA-Z_-]+:.*?## .*$$' $(MAKEFILE_LIST) | grep -E '(dev|test|lint|shell)' | awk 'BEGIN {FS = ":.*?## "}; {printf "  $(YELLOW)%-15s$(NC) %s\n", $$1, $$2}'
	@echo ""
	@echo "$(GREEN)Production:$(NC)"
	@grep -E '^[a-zA-Z_-]+:.*?## .*$$' $(MAKEFILE_LIST) | grep -E '(prod|build|deploy|backup)' | awk 'BEGIN {FS = ":.*?## "}; {printf "  $(YELLOW)%-15s$(NC) %s\n", $$1, $$2}'
	@echo ""
	@echo "$(GREEN)Management:$(NC)"
	@grep -E '^[a-zA-Z_-]+:.*?## .*$$' $(MAKEFILE_LIST) | grep -E '(logs|status|stop|clean|prune)' | awk 'BEGIN {FS = ":.*?## "}; {printf "  $(YELLOW)%-15s$(NC) %s\n", $$1, $$2}'
	@echo ""

# =============================================================================
# Development
# =============================================================================

dev: ## Start development environment with hot reload
	@docker compose -f docker-compose.dev.yml up --build

dev-detached: ## Start development environment in background
	@docker compose -f docker-compose.dev.yml up --build -d
	@echo "Development server started. Use 'make logs-dev' to view logs."

dev-debug: ## Start development with Node.js debugger enabled
	@docker compose -f docker-compose.dev.yml --profile debug up --build

test: ## Run tests locally
	@pnpm test

test-docker: ## Run tests in Docker container
	@docker compose -f docker-compose.dev.yml exec app pnpm test

lint: ## Run linter
	@pnpm run lint

format: ## Format code
	@pnpm run format

# =============================================================================
# Production
# =============================================================================

prod: ## Start production environment
	@docker compose up -d --build
	@echo "Production server started at http://localhost:$${HOST_PORT:-3000}"

prod-proxy: ## Start production with nginx reverse proxy
	@docker compose --profile proxy up -d --build
	@echo "Production server started with nginx proxy"

build: ## Build Docker images
	@bash scripts/build.sh prod

build-dev: ## Build development Docker image
	@bash scripts/build.sh dev

build-clean: ## Clean build (no cache)
	@docker compose build --no-cache

deploy: prod ## Alias for prod

# =============================================================================
# Management
# =============================================================================

logs: ## View logs (follow mode)
	@bash scripts/docker.sh logs

logs-dev: ## View development logs
	@docker compose -f docker-compose.dev.yml logs -f

status: ## Show container status
	@bash scripts/docker.sh status

shell: ## Open shell in app container
	@bash scripts/docker.sh shell

shell-dev: ## Open shell in dev container
	@docker compose -f docker-compose.dev.yml exec app sh

stop: ## Stop all containers
	@bash scripts/docker.sh stop

restart: ## Restart containers
	@bash scripts/docker.sh restart

clean: ## Stop and remove containers and volumes
	@bash scripts/docker.sh clean

prune: ## Remove unused Docker resources
	@bash scripts/docker.sh prune

# =============================================================================
# Database
# =============================================================================

backup: ## Backup database
	@bash scripts/backup.sh

backup-list: ## List available backups
	@bash scripts/backup.sh --list

restore: ## Restore database (interactive)
	@bash scripts/docker.sh restore

db-init: ## Initialize database
	@pnpm run db:init

db-reset: ## Reset database (WARNING: deletes all data)
	@pnpm run db:reset

# =============================================================================
# Setup
# =============================================================================

install: ## Install dependencies
	@pnpm install

setup: ## Full setup (install + db init)
	@pnpm run setup

env: ## Create .env from example
	@cp -n .env.example .env || echo ".env already exists"
	@echo "Created .env file. Please edit it with your settings."

# =============================================================================
# CI/CD
# =============================================================================

ci-test: ## Run tests for CI
	@NODE_ENV=test pnpm test -- --ci --coverage --reporters=default --reporters=jest-junit

ci-lint: ## Run linter for CI
	@pnpm run lint
	@pnpm run format:check

ci-build: ## Build for CI
	@pnpm run build
