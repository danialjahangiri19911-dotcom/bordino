from django.utils.translation import gettext as _
from rest_framework import serializers

from apps.django_helper.drf.serializers import BaseModelSerializer
from apps.user_management.serializers.customer.utils.correctstep import BaseStepSerializerMixin
from apps.user_management.services.customer.customer_update import CustomerUpdateService
from apps.users.models.customer import Customer
from apps.users.models.signup_reason import SignupReason


class StepUsageGoalSerializer(
    BaseStepSerializerMixin,
    BaseModelSerializer,
):
    # TODO: Refactor and improve the structure of this serializer for better performance and maintainability.
    target_step = Customer.Step.USAGE_GOAL

    def __init__(self, *args, **kwargs):
        super().__init__(*args, **kwargs)
        self.customer_update_service = CustomerUpdateService()
        self.fields["signup_reasons"].choices = SignupReason.objects.values_list(
            "reason", flat=True
        )

    registration_step = serializers.CharField(read_only=True)
    signup_reasons = serializers.MultipleChoiceField(
        choices=[],
        write_only=True,
        required=False,
        help_text=_("Select multiple signup reasons."),
    )

    class Meta:
        model = Customer
        fields = (
            "signup_reasons",
            "registration_step",
        )

    def update(self, instance, validated_data):
        customer = self.customer_update_service.update_step_usage_goal(
            self.customer_update_service.StepUsageGoalDTO(
                instance, validated_data["signup_reasons"]
            )
        )

        return customer

    def to_representation(self, instance):
        representation = super().to_representation(instance)
        representation["signup_reasons"] = list(
            instance.signup_reasons.values_list("reason", flat=True)
        )
        return representation
