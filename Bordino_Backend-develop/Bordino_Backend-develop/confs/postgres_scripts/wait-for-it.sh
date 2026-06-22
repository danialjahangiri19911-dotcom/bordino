#!/bin/bash

set -euo pipefail

if ! command -v pg_isready >/dev/null 2>&1; then
  echo "pg_isready not found. Ensure postgresql-client is installed in the image." >&2
  exit 1
fi

DB_HOST=${DB_HOST}
DB_PORT=${DB_PORT}

until pg_isready -q -h "$DB_HOST" -p "$DB_PORT"; do
  >&2 echo "Waiting for PostgreSQL at ${DB_HOST}:${DB_PORT}..."
  sleep 1
done
>&2 echo 'PostgreSQL is available'

exec "$@"
