.PHONY: help build up down restart logs clean migrate create-admin

help: ## Show this help message
	@echo 'Usage: make [target]'
	@echo ''
	@echo 'Available targets:'
	@awk 'BEGIN {FS = ":.*?## "} /^[a-zA-Z_-]+:.*?## / {printf "  %-15s %s\n", $$1, $$2}' $(MAKEFILE_LIST)

build: ## Build all Docker images
	docker-compose build

up: ## Start all services
	docker-compose up -d
	@echo "Services starting..."
	@echo "Frontend: http://localhost:5173"
	@echo "Backend: http://localhost:8000"
	@echo "API Docs: http://localhost:8000/docs"

down: ## Stop all services
	docker-compose down

restart: down up ## Restart all services

logs: ## Show logs from all services
	docker-compose logs -f

logs-backend: ## Show backend logs
	docker-compose logs -f backend

logs-frontend: ## Show frontend logs
	docker-compose logs -f frontend

clean: ## Remove all containers, volumes, and images
	docker-compose down -v
	docker system prune -f

migrate: ## Run database migrations
	docker-compose exec backend alembic upgrade head

migrate-create: ## Create a new migration
	@read -p "Enter migration message: " msg; \
	docker-compose exec backend alembic revision --autogenerate -m "$$msg"

create-admin: ## Create admin user
	docker-compose exec backend python create_admin.py

create-demo-test: ## Create demo test with all question types
	docker-compose exec backend python create_demo_test.py

create-demo-student: ## Create demo student with assigned tests
	docker-compose exec backend python create_demo_student.py

test-all-types: ## Create comprehensive test with all 11 question types
	docker-compose exec backend python create_test_all_types.py

assign-test: ## Assign test to all students (usage: make assign-test TEST_ID=1)
	docker-compose exec backend python assign_test_to_students.py $(TEST_ID)

setup-full-test: ## Create test with all types and assign to all students (one command)
	docker-compose exec backend python setup_full_test.py

shell-backend: ## Open backend shell
	docker-compose exec backend /bin/bash

shell-db: ## Open PostgreSQL shell
	docker-compose exec postgres psql -U postgres -d testing_platform

install-frontend: ## Install frontend dependencies
	cd frontend && npm install

install-backend: ## Install backend dependencies
	cd backend && pip install -r requirements.txt

dev-frontend: ## Run frontend in dev mode
	cd frontend && npm run dev

dev-backend: ## Run backend in dev mode
	cd backend && uvicorn app.main:app --reload

