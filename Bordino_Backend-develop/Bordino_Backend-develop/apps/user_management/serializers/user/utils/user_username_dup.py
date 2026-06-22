import logging
import re

from django.contrib.auth import get_user_model
from django.utils.translation import gettext_lazy as _
from rest_framework import serializers
from rest_framework.serializers import SerializerMetaclass

from apps.user_management.repositories.user.query import UserQueryRepository

User = get_user_model()


class UsernameDuplicateSerializerMixin(metaclass=SerializerMetaclass):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, **kwargs)
        self.user_query_repository = UserQueryRepository()

    username = serializers.CharField()

    class Meta:
        fields = ("username",)

    def validate_username(self, value):
        if not re.match(r"^[a-zA-Z0-9@.+_-]+$", value):
            raise serializers.ValidationError(
                _("Username can only contain English letters, numbers, and @/./+/-/_ characters.")
            )

        user = self.context["request"].user

        try:
            users_found = self.user_query_repository.filter_by_username(value)
            if users_found.first().id != user.id:
                raise serializers.ValidationError(_("A user with that username already exists."))
        except User.DoesNotExist:
            pass
        except ValueError as e:
            logging.error("Multiple users found with username %s : %s", value, e)

        return value
