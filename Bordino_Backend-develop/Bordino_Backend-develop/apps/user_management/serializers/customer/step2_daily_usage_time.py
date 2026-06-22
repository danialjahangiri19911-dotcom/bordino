from django.utils.translation import gettext as _
from rest_framework import serializers

from apps.django_helper.drf.serializers import BaseModelSerializer
from apps.user_management.serializers.customer.utils.correctstep import BaseStepSerializerMixin
from apps.user_management.services.customer.customer_update import CustomerUpdateService
from apps.users.models.customer import Customer
from apps.users.models.dailyusage import DailyUsage


class StepDailyUsageTimeSerializer(
    BaseStepSerializerMixin,
    BaseModelSerializer,
):
    # TODO: Refactor and improve the structure of this serializer for better performance and maintainability.
    target_step = Customer.Step.DAILY_USAGE_TIME

    def __init__(self, *args, **kwargs):
        super().__init__(*args, **kwargs)
        self.customer_update_service = CustomerUpdateService()

    daily_usage_minutes = serializers.SlugRelatedField(
        queryset=DailyUsage.objects.all(),
        slug_field="usage_duration_per_day",
        error_messages={
            "does_not_exist": _("The usage provided does not exist."),
        },
    )
    registration_step = serializers.CharField(read_only=True)

    class Meta:
        model = Customer
        fields = (
            "daily_usage_minutes",
            "registration_step",
        )

    def update(self, instance, validated_data):
        customer = self.customer_update_service.update_step_daily_usage_time(
            self.customer_update_service.StepDailyUsageTimeDTO(
                instance, validated_data["daily_usage_minutes"]
            )
        )

        return customer
