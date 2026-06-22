#!/bin/sh

echo "--> Waiting for db to be ready"
./confs/postgres_scripts/wait-for-it.sh

# Start server
echo "--> Starting web process"
python manage.py runserver 0.0.0.0:8000
