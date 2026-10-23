import os
import uuid
from io import BytesIO

from django.core.exceptions import ValidationError
from PIL import Image, ImageOps, UnidentifiedImageError

# An avatar is shown at most ~128 px: keep 512 (sharp on 3× screens) and refuse absurd sources.
AVATAR_MAX_SIDE = 512
MAX_SOURCE_PIXELS = 25_000_000


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
        try:
            img = Image.open(image_file)
            # Size is known from the header, before any pixel is decoded: refuse decompression
            # bombs and 20000×1 "images" (WebP is limited to 16383 px per side) up front.
            if img.width * img.height > MAX_SOURCE_PIXELS:
                raise ValidationError("Image dimensions are too large")
            img.load()
            # Phone photos carry their rotation in EXIF: apply it, or the saved avatar is sideways.
            img = ImageOps.exif_transpose(img)
            img.thumbnail((AVATAR_MAX_SIDE, AVATAR_MAX_SIDE))

            # Convert to RGB if necessary (for PNG with transparency)
            if img.mode in ("RGBA", "LA", "P"):
                img = img.convert("RGBA")
                background = Image.new("RGB", img.size, (255, 255, 255))
                background.paste(img, mask=img.split()[-1])
                img = background
            elif img.mode != "RGB":
                img = img.convert("RGB")

            webp_io = BytesIO()
            img.save(webp_io, "WEBP", quality=quality)
            webp_io.seek(0)
            return webp_io
        except ValidationError:
            raise
        except (UnidentifiedImageError, OSError, ValueError, Image.DecompressionBombError) as exc:
            # Not a usable image: a 400 for the player, not a 500.
            raise ValidationError("The file is not a valid image") from exc

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
