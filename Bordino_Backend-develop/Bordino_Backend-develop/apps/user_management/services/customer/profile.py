import os

from django.core.exceptions import ValidationError
from django.core.files.base import ContentFile

from apps.user_management.services.image.image_processor import ImageProcessorService
from apps.users.models import Customer, File


class CustomerProfileService:
    def __init__(self):
        self.image_processor = ImageProcessorService()

    def validate_image(self, image_file):
        """
        Validate that the uploaded file is an image

        Args:
            image_file: The uploaded image file

        Raises:
            ValidationError: If the file is not valid
        """
        if not image_file.content_type.startswith("image/"):
            raise ValidationError("File must be an image")

        # Check file size (e.g., max 5MB)
        if image_file.size > 5 * 1024 * 1024:  # 5MB in bytes
            raise ValidationError("Image size must be less than 5MB")

    def _delete_old_image(self, customer: Customer):
        """
        Delete the old image file and its database record

        Args:
            customer: Customer instance
        """
        if customer.image:
            # Delete the file from storage
            if customer.image.file and os.path.isfile(customer.image.file.path):
                os.remove(customer.image.file.path)
            # Delete the database record
            customer.image.delete()

    def update_profile_image(self, customer: Customer, image_file) -> Customer:
        """
        Update customer's profile image

        Args:
            customer: Customer instance
            image_file: The uploaded image file

        Returns:
            Customer: Updated customer instance

        Raises:
            ValidationError: If the image is not valid
        """
        # Validate the image
        self.validate_image(image_file)

        # Delete old image if exists
        self._delete_old_image(customer)

        # Convert to WebP
        webp_io = self.image_processor.convert_to_webp(image_file)

        # Generate WebP filename
        webp_filename = self.image_processor.get_webp_filename(image_file.name)

        # Create a new File instance with the WebP image
        file_instance = File.objects.create(
            file=ContentFile(webp_io.getvalue(), name=webp_filename)
        )

        # Update the customer's image
        customer.image = file_instance
        customer.save()

        return customer
