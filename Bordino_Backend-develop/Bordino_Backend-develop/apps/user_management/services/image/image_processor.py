import os
import uuid
from io import BytesIO

from PIL import Image


class ImageProcessorService:
    @staticmethod
    def convert_to_webp(image_file, quality=80):
        """
        Convert an image to WebP format

        Args:
            image_file: The uploaded image file
            quality: WebP quality (0-100)

        Returns:
            BytesIO: The converted image in WebP format
        """
        # Open the image
        img = Image.open(image_file)

        # Convert to RGB if necessary (for PNG with transparency)
        if img.mode in ("RGBA", "LA"):
            background = Image.new("RGB", img.size, (255, 255, 255))
            background.paste(img, mask=img.split()[-1])
            img = background

        # Create BytesIO object
        webp_io = BytesIO()

        # Save as WebP
        img.save(webp_io, "WEBP", quality=quality)
        webp_io.seek(0)

        return webp_io

    @staticmethod
    def get_webp_filename(original_filename):
        """
        Generate a unique WebP filename

        Args:
            original_filename: The original filename

        Returns:
            str: A unique WebP filename
        """
        # Get the base name without extension
        base_name = os.path.splitext(original_filename)[0]

        # Generate a unique identifier
        unique_id = str(uuid.uuid4())

        # Create the new filename
        return f"profile_images/{base_name}_{unique_id}.webp"
