import uuid

from django.db import models
from django.db.models import Model


class AbstractIDOnlyModel(Model):
    id = models.UUIDField(primary_key=True, editable=False, default=uuid.uuid4)

    class Meta:
        abstract = True
