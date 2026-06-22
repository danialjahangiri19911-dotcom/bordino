#!/bin/sh

echo "--> Waiting for db to be ready"
./confs/postgres_scripts/wait-for-it.sh

# Apply database migrations
echo "--> Applying database migrations"
python manage.py makemigrations
python manage.py migrate

echo "--> Collecting static files"
python manage.py collectstatic --noinput

# Start server
echo "--> Starting web process"
exec python -m gunicorn main_app.asgi:application \
  --worker-class uvicorn.workers.UvicornWorker \
  --workers 4 \
  --bind 0.0.0.0:8000 \
  --timeout 120 \
  --reload \
  --log-level debug \
  --capture-output