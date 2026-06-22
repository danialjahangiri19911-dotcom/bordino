from django.utils.translation import gettext as _
from rest_framework import serializers

from apps.django_helper.drf.serializers import BaseModelSerializer
from apps.user_management.serializers.customer.utils.correctstep import BaseStepSerializerMixin
from apps.user_management.services.customer.customer_update import CustomerUpdateService
from apps.users.models.category import Category
from apps.users.models.customer import Customer


class StepInterestSelectionSerializer(
    BaseStepSerializerMixin,
    BaseModelSerializer,
):
    # TODO: Refactor and improve the structure of this serializer for better performance and maintainability.
    target_step = Customer.Step.INTEREST_SELECTION

    def __init__(self, *args, **kwargs):
        super().__init__(*args, **kwargs)
        self.customer_update_service = CustomerUpdateService()
        self.fields["favorite_categories"].choices = Category.objects.values_list("name", flat=True)

    registration_step = serializers.CharField(read_only=True)

    favorite_categories = serializers.MultipleChoiceField(
        choices=[],
        write_only=True,
        required=False,
        help_text=_("Select multiple categories."),
    )

    class Meta:
        model = Customer
        fields = (
            "favorite_categories",
            "registration_step",
        )

    def update(self, instance, validated_data):
        favorite_categories = validated_data.get("favorite_categories", [])
        customer = self.customer_update_service.update_step_interest_selection(
            self.customer_update_service.StepInterestSelectionDTO(
                customer=instance, favorite_categories=favorite_categories
            )
        )

        if customer is None:
            raise serializers.ValidationError(
                _("Failed to update interest selection. Please try again.")
            )

        return customer

    def to_representation(self, instance):
        representation = super().to_representation(instance)
        representation["favorite_categories"] = list(
            instance.favorite_categories.values_list("name", flat=True)
        )
        return representation
