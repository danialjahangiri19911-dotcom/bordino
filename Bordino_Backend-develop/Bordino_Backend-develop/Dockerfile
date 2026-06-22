# Multi-stage build for optimized Django application
FROM python:3.13.10-slim AS base

# Prevent Python from writing pyc files and buffering stdout/stderr
ENV PYTHONUNBUFFERED=1 \
    PYTHONDONTWRITEBYTECODE=1 \
    PIP_NO_CACHE_DIR=1 \
    PIP_DISABLE_PIP_VERSION_CHECK=1

# Install system dependencies in a single layer
RUN apt-get update && apt-get install -y --no-install-recommends \
    gettext \
    curl \
    postgresql-client \
    && rm -rf /var/lib/apt/lists/* \
    && apt-get clean

# Install Poetry with pinned version for reproducibility
RUN pip install --no-cache-dir poetry==1.8.5

# Poetry configuration for container optimization
ENV POETRY_NO_INTERACTION=1 \
    POETRY_VIRTUALENVS_IN_PROJECT=true \
    POETRY_VIRTUALENVS_CREATE=true \
    POETRY_CACHE_DIR=/tmp/poetry_cache

WORKDIR /opt/venv-build

# ============================================
# Builder stage: Install dependencies
# ============================================
FROM base AS builder

ARG ENVIRONMENT=dev

# Copy only dependency files for optimal layer caching
COPY pyproject.toml poetry.lock ./

# Install dependencies based on environment
RUN --mount=type=cache,target=/tmp/poetry_cache \
    if [ "$ENVIRONMENT" = "prod" ]; then \
        poetry install --only main --no-root --no-interaction --no-ansi; \
    else \
        poetry install --no-root --no-interaction --no-ansi; \
    fi

# ============================================
# Final stage: Runtime image
# ============================================
FROM base AS runtime

# Environment variable for the environment (prod or dev)
ARG ENVIRONMENT=dev

COPY --from=builder /opt/venv-build/.venv /opt/venv

ENV PATH="/opt/venv/bin:$PATH"

WORKDIR /app

# Copy application code
COPY . .

# Make scripts executable
RUN chmod +x run \
    confs/postgres_scripts/wait-for-it.sh \
    confs/web_entrypoint.sh \
    confs/web_entrypoint_dev.sh \
    confs/celery_beat/start.sh

# Create non-root user for security
RUN groupadd -r django && useradd -r -g django django \
    && mkdir -p /app/static /app/media \
    && chown -R django:django /app /opt/venv

USER django
