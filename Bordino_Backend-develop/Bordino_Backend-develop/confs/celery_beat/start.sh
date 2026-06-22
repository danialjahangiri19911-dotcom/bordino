#!/bin/bash

set -o errexit
set -o nounset

rm -f './celerybeat.pid'

python -m celery -A apps.tasks beat -l info --scheduler django_celery_beat.schedulers:DatabaseScheduler
