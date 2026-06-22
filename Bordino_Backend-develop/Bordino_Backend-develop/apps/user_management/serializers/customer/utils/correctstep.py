from django.utils.translation import gettext_lazy as _
from rest_framework import serializers
from rest_framework.serializers import SerializerMetaclass

from apps.users.models.customer import Customer


class BaseStepSerializerMixin(metaclass=SerializerMetaclass):
    def validate(self, data):
        user = self.context["request"].user
        if not user.is_customer:
            raise serializers.ValidationError(_("Invalid step. start with step 1"))

        current_step = user.customer.registration_step

        if current_step == Customer.Step.INTEREST_SELECTION:
            raise serializers.ValidationError(
                _("Registration already completed. Current step: {registration_step}").format(
                    registration_step=current_step
                )
            )

        return data
