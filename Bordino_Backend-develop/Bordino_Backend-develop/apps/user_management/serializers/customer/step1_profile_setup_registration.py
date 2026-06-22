from django.utils.translation import gettext as _
from rest_framework import serializers

from apps.django_helper.drf.serializers import BaseModelSerializer
from apps.user_management.serializers.user.utils.user_username_dup import (
    UsernameDuplicateSerializerMixin,
)
from apps.user_management.services.customer.customer_registration import CustomerRegistrationService
from apps.user_management.services.customer.customer_update import CustomerUpdateService
from apps.users.models.customer import Customer


class StepProfileSetupRegistrationSerializer(
    UsernameDuplicateSerializerMixin,
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

    def validate(self, data):
        user = self.context["request"].user
        method = self.context["request"].method
        if not user.is_customer and method == "POST":
            raise serializers.ValidationError(_("Customer does not exist. Please register first."))
        return data

    def create(self, validated_data):
        user = self.context["request"].user
        try:
            customer = user.customer
        except Customer.DoesNotExist:
            raise serializers.ValidationError(_("Customer does not exist. Please register first."))

        customer = self.customer_update_service.update_step_profile_setup(
            self.customer_update_service.StepProfileSetupDTO(
                customer=customer,
                username=validated_data["username"],
                birthdate=validated_data["birthdate"],
                gender=validated_data["gender"],
            )
        )

        if not customer:
            raise serializers.ValidationError(_("Failed to update customer profile."))

        return customer

    def to_representation(self, instance):
        if not instance:
            message = _("Failed to create a customer. Please try again later.")

        message = _("The customer account has been created successfully.")

        return {"current_step": instance.registration_step, "detail": message}
