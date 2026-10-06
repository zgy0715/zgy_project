.PHONY: help dev dev-frontend dev-agent dev-gateway build build-vector up down logs test test-frontend test-agent test-gateway test-vector lint typecheck setup clean

# Prefer the project virtualenv for agent-runtime targets. The path is relative to
# agent-runtime/ because every recipe below cd's into that directory first.
# Without this, `make test` silently uses the system interpreter, which usually
# does not have the agent-runtime dependencies installed.
AGENT_PY := $(shell if [ -x agent-runtime/.venv/bin/python ]; then echo .venv/bin/python; elif [ -x agent-runtime/.venv/Scripts/python.exe ]; then echo .venv/Scripts/python.exe; else echo python; fi)

# ========================
# DeepAgent - Development & Deployment Commands
# ========================

help: ## Show this help message
	@echo "DeepAgent - Available Commands:"
	@echo ""
	@grep -E '^[a-zA-Z_-]+:.*?## .*$$' $(MAKEFILE_LIST) | sort | awk 'BEGIN {FS = ":.*?## "}; {printf "  \033[36m%-20s\033[0m %s\n", $$1, $$2}'

# ========================
# Development (Local)
# ========================

dev: ## Start all services locally (requires Docker for databases)
	docker compose up -d postgres redis rabbitmq
	@echo "Waiting for databases to be ready..."
	@sleep 5
	@echo "Starting services... Run each in a separate terminal:"
	@echo "  make dev-frontend"
	@echo "  make dev-agent"
	@echo "  make dev-gateway"

dev-frontend: ## Start frontend dev server (http://localhost:3001)
	cd frontend && npm run dev

dev-agent: ## Start agent runtime dev server (uses agent-runtime/.venv if present)
	cd agent-runtime && $(AGENT_PY) -m uvicorn app.main:app --reload --port 8000

dev-gateway: ## Start API gateway dev server
	cd api-gateway && mvn spring-boot:run -Dspring-boot.run.profiles=dev

# ========================
# Native vector engine (C++ / pybind11)
# ========================

build-vector: ## Build the vector engine native extension
	cd vector-engine && cmake -B build -DCMAKE_BUILD_TYPE=Release -DVECTOR_ENGINE_BUILD_TESTS=ON
	cd vector-engine && cmake --build build -j

# ========================
# Docker
# ========================

up: ## Start all services with Docker Compose
	docker compose up -d
	@echo "Services starting... Check status with: make logs"

down: ## Stop all Docker services
	docker compose down

logs: ## Tail Docker service logs
	docker compose logs -f

build: ## Build all Docker images
	docker compose build

# ========================
# Testing
# ========================

test: ## Run all tests (stops at the first failing suite)
	@echo "Running frontend type check..."
	cd frontend && npm run type-check
	@echo "Running frontend tests..."
	cd frontend && npm test
	@echo "Running agent-runtime tests..."
	cd agent-runtime && $(AGENT_PY) -m pytest tests/ -q
	@echo "Running vector engine tests..."
	@if [ -d vector-engine/build ]; then cd vector-engine && ctest --test-dir build --output-on-failure; else echo "  vector-engine not built - run 'make build-vector' first (skipped)"; fi
	@echo "Running API gateway tests..."
	cd api-gateway && mvn test

test-frontend: ## Run frontend type check and tests
	cd frontend && npm run type-check && npm test

test-agent: ## Run agent-runtime tests only
	cd agent-runtime && $(AGENT_PY) -m pytest tests/ -v

test-gateway: ## Run API gateway tests only
	cd api-gateway && mvn test

test-vector: ## Run vector engine tests only (run make build-vector first)
	cd vector-engine && ctest --test-dir build --output-on-failure

# ========================
# Code Quality
# ========================

lint: ## Run linters on all services
	@echo "Linting frontend..."
	cd frontend && npm run lint
	@echo "Linting agent-runtime..."
	cd agent-runtime && $(AGENT_PY) -m ruff check app/

typecheck: ## Run TypeScript type checking
	cd frontend && npm run type-check

# ========================
# Setup
# ========================

setup: ## Initial project setup (install dependencies)
	@echo "Setting up frontend..."
	cd frontend && npm install
	@echo "Setting up agent-runtime..."
	cd agent-runtime && python -m venv .venv && { [ -x .venv/bin/python ] && VENV_PY=.venv/bin/python || VENV_PY=.venv/Scripts/python; } && "$$VENV_PY" -m pip install --upgrade pip && "$$VENV_PY" -m pip install -r requirements.txt ruff
	@echo "Building vector engine (optional, enables native embeddings)..."
	cd vector-engine && cmake -B build -DCMAKE_BUILD_TYPE=Release || echo "cmake not found - skipping native vector engine"
	@echo "Setting up API gateway..."
	cd api-gateway && mvn dependency:resolve
	@echo "Copying environment files..."
	@test -f .env || cp .env.example .env
	@test -f frontend/.env.local || cp frontend/.env.local.example frontend/.env.local
	@test -f agent-runtime/.env || cp agent-runtime/.env.example agent-runtime/.env
	@echo "Setup complete! Run 'make dev' to start."

# ========================
# Cleanup
# ========================

clean: ## Remove build artifacts and caches
	cd frontend && rm -rf .next node_modules/.cache
	cd agent-runtime && rm -rf __pycache__ .pytest_cache .ruff_cache
	cd vector-engine && rm -rf build
	cd api-gateway && mvn clean
