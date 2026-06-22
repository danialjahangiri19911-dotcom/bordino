from rest_framework import serializers

from apps.django_helper.drf.serializers import BaseModelSerializer
from apps.users.models.customer import Customer


class CustomerProfileSerializer(BaseModelSerializer):
    daily_usage_minutes = serializers.SlugRelatedField(
        read_only=True, slug_field="usage_duration_per_day"
    )
    signup_reasons = serializers.SlugRelatedField(many=True, read_only=True, slug_field="reason")
    favorite_categories = serializers.SlugRelatedField(many=True, read_only=True, slug_field="name")
    username = serializers.CharField(source="user.username", read_only=True)
    phone_number = serializers.CharField(source="user.phone_number", read_only=True)
    image_url = serializers.SerializerMethodField(read_only=True)
    consecutive_active_days = serializers.CharField(read_only=True)
    max_consecutive_days = serializers.CharField(read_only=True)
    referral_code = serializers.CharField(read_only=True)
    referral_count = serializers.IntegerField(read_only=True)

    class Meta:
        model = Customer
        fields = (
            "username",
            "phone_number",
            "gender",
            "birthdate",
            "registration_step",
            "consecutive_active_days",
            "max_consecutive_days",
            "last_active_date",
            "daily_usage_minutes",
            "signup_reasons",
            "favorite_categories",
            "image_url",
            "referral_code",
            "referral_count",
        )

    def get_image_url(self, obj):
        if obj.image and obj.image.file:
            return self.context["request"].build_absolute_uri(obj.image.file.url)
        return None

    def to_representation(self, instance):
        representation = super().to_representation(instance)

        if not hasattr(instance, "_prefetched_objects_cache"):
            instance = Customer.objects.prefetch_related(
                "signup_reasons", "favorite_categories"
            ).get(pk=instance.pk)
            representation = super().to_representation(instance)
        return representation
