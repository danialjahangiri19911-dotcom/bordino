import logging

from django.core.exceptions import ValidationError as DjangoValidationError
from django.db import transaction
from rest_framework.exceptions import ValidationError as DRFValidationError

from rest_framework_simplejwt.tokens import RefreshToken

from apps.users.models.user import User


class UserCommandRepository:
    @staticmethod
    def create(user: User, password=None):
        try:
            with transaction.atomic():
                if password:
                    user.set_password(password)
                else:
                    user.set_unusable_password()

                user.full_clean()
                user.save()
        except DjangoValidationError as e:
            raise DRFValidationError(e.message_dict) from e
        return user

    @staticmethod
    def issue_token(user: User):
        try:
            refresh = RefreshToken.for_user(user)
            access_token = str(refresh.access_token)
            return {
                "access_token": access_token,
                "refresh_token": str(refresh),
            }
        except Exception as e:  # pylint: disable=broad-except
            logging.error("Error while issuing token: %s", e)
            return None
        # TODO: Handle and raise an appropriate exception here when needed.

    @staticmethod
    def change_username(user: User, username: str):
        with transaction.atomic():
            user.username = username
            user.full_clean()
            # Only the name: a copy loaded before an admin disabled the account (or changed its
            # password or roles) must not write the old values back.
            user.save(update_fields=["username"])
