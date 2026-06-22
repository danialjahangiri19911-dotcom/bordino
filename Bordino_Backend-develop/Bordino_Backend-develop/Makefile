POETRY := poetry

.PHONY: all clean test help fix format lint typecheck pylint

all: lint ## Run linting (default target)

clean: ## Clean Python cache files
	@find . -type d -name "__pycache__" -o -name "*.egg-info" | xargs rm -rf 2>/dev/null || true
	@find . -type f -name "*.pyc" -o -name "*.pyo" | xargs rm -f 2>/dev/null || true

test: ## Run tests
	$(POETRY) run python manage.py test

help:
	@grep -E '^[a-zA-Z_-]+:.*?## .*$$' $(MAKEFILE_LIST) | sort | awk 'BEGIN {FS = ":.*?## "}; {printf "  \033[36m%-20s\033[0m %s\n", $$1, $$2}'

fix: ## Auto-fix lint issues
	$(POETRY) run ruff format apps main_app
	$(POETRY) run isort apps main_app
	$(POETRY) run ruff check apps/ main_app/ --fix --unsafe-fixes

format: ## Format code
	$(POETRY) run ruff format apps main_app
	$(POETRY) run isort apps main_app

lint: ## Check code formatting and linting
	$(POETRY) run ruff format --check apps main_app
	$(POETRY) run isort --check apps main_app
	$(POETRY) run ruff check apps/ main_app/

typecheck: ## Run mypy type checking
	$(POETRY) run mypy apps/ main_app/

pylint: ## Run pylint
	$(POETRY) run pylint apps/ main_app/ --disable=unknown-option-value,missing-module-docstring,missing-class-docstring,missing-function-docstring,import-error,fixme,duplicate-code,too-few-public-methods --max-line-length=120
