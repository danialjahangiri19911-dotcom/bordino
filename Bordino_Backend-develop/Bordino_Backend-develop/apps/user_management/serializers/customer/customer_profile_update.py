import datetime

from django.core.exceptions import ValidationError as DjangoValidationError
from django.db import IntegrityError, transaction
from django.utils.translation import gettext_lazy as _
from rest_framework import serializers

from apps.django_helper.drf.serializers import BaseModelSerializer
from apps.user_management.repositories.user.command import UserCommandRepository
from apps.user_management.serializers.user.utils.user_username_dup import (
    UsernameDuplicateSerializerMixin,
)
from apps.users.models.customer import Customer


class CustomerProfileUpdateSerializer(UsernameDuplicateSerializerMixin, BaseModelSerializer):
    """«اطلاعات شخصی»: the player edits their name, birthdate and gender at any time.

    Unlike the onboarding step (customer/step/profile-setup), this never moves registration_step
    and works after onboarding is complete; it awards nothing.
    """

    username = serializers.CharField(min_length=3, max_length=20, required=False)
    gender = serializers.ChoiceField(
        choices=[Customer.Gender.MALE, Customer.Gender.FEMALE], required=False
    )

    class Meta:
        model = Customer
        fields = ("username", "birthdate", "gender")

    def validate_birthdate(self, value):
        if value is None:
            return value
        today = datetime.date.today()
        if value > today or value < datetime.date(1900, 1, 1):
            raise serializers.ValidationError(_("Enter a valid birthdate."))
        return value

    def update(self, instance, validated_data):
        username = validated_data.pop("username", None)
        try:
            with transaction.atomic():
                customer = Customer.objects.select_for_update(no_key=True).get(pk=instance.pk)
                for field, value in validated_data.items():
                    setattr(customer, field, value)
                if validated_data:
                    customer.save()
                if username is not None and username != customer.user.username:
                    UserCommandRepository.change_username(customer.user, username)
        except IntegrityError as exc:
            # Someone took the name between the check above and this save.
            raise serializers.ValidationError(
                {"username": [_("A user with that username already exists.")]}
            ) from exc
        except DjangoValidationError as exc:
            raise serializers.ValidationError(
                getattr(exc, "message_dict", None) or {"non_field_errors": exc.messages}
            ) from exc
        return customer
