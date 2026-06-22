import os

from celery import Celery

# this code copied from manage.py
# set the default Django settings module for the 'celery' app.
os.environ.setdefault("DJANGO_SETTINGS_MODULE", "main_app.settings")
os.environ.setdefault("CELERY_SETTINGS_MODULE", "confs.celery_config.celery_config")

# you can change the name here
app = Celery("app")

app.config_from_envvar("CELERY_SETTINGS_MODULE")

app.autodiscover_tasks()
