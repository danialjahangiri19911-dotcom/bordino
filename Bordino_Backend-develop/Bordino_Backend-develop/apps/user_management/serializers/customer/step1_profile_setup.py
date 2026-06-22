from rest_framework import serializers

from apps.django_helper.drf.serializers import BaseModelSerializer
from apps.user_management.serializers.customer.utils.correctstep import BaseStepSerializerMixin
from apps.user_management.serializers.user.utils.user_username_dup import (
    UsernameDuplicateSerializerMixin,
)
from apps.user_management.services.customer.customer_registration import CustomerRegistrationService
from apps.user_management.services.customer.customer_update import CustomerUpdateService
from apps.users.models.customer import Customer


class StepProfileSetupSerializer(
    UsernameDuplicateSerializerMixin,
    BaseStepSerializerMixin,
    BaseModelSerializer,
):
    # TODO: Refactor and improve the structure of this serializer for better performance and maintainability.
    def __init__(self, *args, **kwargs):
        super().__init__(*args, **kwargs)
        self.customer_registration_service = CustomerRegistrationService()
        self.customer_update_service = CustomerUpdateService()

    registration_step = serializers.CharField(read_only=True)

    class Meta:
        model = Customer
        fields = (
            "birthdate",
            "gender",
            "registration_step",
            *UsernameDuplicateSerializerMixin.Meta.fields,
        )

    def update(self, instance, validated_data):
        customer = self.customer_update_service.update_step_profile_setup(
            self.customer_update_service.StepProfileSetupDTO(
                instance,
                validated_data["username"],
                validated_data["birthdate"],
                validated_data["gender"],
            )
        )

        return customer

    def to_representation(self, instance):
        return {
            "birthdate": instance.birthdate,
            "gender": instance.gender,
            "registration_step": instance.registration_step,
            "username": instance.user.username,
        }
