from django.core.exceptions import ValidationError
from rest_framework import serializers

from apps.django_helper.drf.serializers import BaseModelSerializer
from apps.user_management.services.customer.profile import CustomerProfileService
from apps.users.models import Customer


class CustomerProfileImageSerializer(BaseModelSerializer):
    image = serializers.ImageField(
        write_only=True,
        required=True,
        help_text="Upload a profile image (max 5MB, supported formats: JPG, PNG, etc.)",
        style={"base_template": "file.html", "input_type": "file"},
    )
    image_url = serializers.SerializerMethodField(read_only=True)

    class Meta:
        model = Customer
        fields = ("image", "image_url")

    def __init__(self, *args, **kwargs):
        super().__init__(*args, **kwargs)
        self.profile_service = CustomerProfileService()

    def get_image_url(self, obj):
        if obj.image and obj.image.file:
            return self.context["request"].build_absolute_uri(obj.image.file.url)
        return None

    def validate_image(self, value):
        """
        Validate that the uploaded file is an image
        """
        if not value.content_type.startswith("image/"):
            raise ValidationError("File must be an image")

        # Check file size (e.g., max 5MB)
        if value.size > 5 * 1024 * 1024:  # 5MB in bytes
            raise ValidationError("Image size must be less than 5MB")

        return value

    def update(self, instance, validated_data):
        return self.profile_service.update_profile_image(
            customer=instance, image_file=validated_data["image"]
        )
