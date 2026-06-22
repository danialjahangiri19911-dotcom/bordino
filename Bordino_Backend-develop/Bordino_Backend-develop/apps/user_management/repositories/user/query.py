from django.contrib.auth import get_user_model
from django.db.models import Q

User = get_user_model()


class UserQueryRepository:
    @staticmethod
    def all():
        return User.objects.all()

    @classmethod
    def all_except_inactive_ones(cls):
        return cls.all().filter(Q(is_active=True) | Q(is_active=False, invited_by__isnull=False))

    @classmethod
    def filter_by_username(cls, username):
        users = cls.all().filter(username=username)
        count = users.count()
        if count > 1:
            raise ValueError(f"Multiple users found with username: {username}")
        if count == 0:
            raise User.DoesNotExist(f"No user found with username: {username}")
        return users

    @classmethod
    def filter_by_phone_number(cls, phone_number):
        users = cls.all().filter(**{User.USERNAME_FIELD: phone_number})
        count = users.count()
        if count > 1:
            raise ValueError(f"Multiple users found with phone number: {phone_number}")
        if count == 0:
            raise User.DoesNotExist(f"No user found with phone number: {phone_number}")
        return users

    @classmethod
    def filter_by_username_or_phone_number(cls, username_or_phone_number):
        try:
            return cls.filter_by_phone_number(username_or_phone_number)
        except ValueError as exc:
            # Handle multiple users for phone number
            raise exc
        except User.DoesNotExist:
            # If no user found by phone number, proceed to username
            pass

        # Then, try to find the user by username
        try:
            return cls.filter_by_username(username_or_phone_number)
        except ValueError as exc:
            # Handle multiple users for username
            raise exc
        except User.DoesNotExist as exc:
            # If no user is found by username either, raise an exception
            raise User.DoesNotExist(
                f"No user found with username or phone number: {username_or_phone_number}"
            ) from exc
        # TODO: Handle and raise an appropriate exception here when needed.
