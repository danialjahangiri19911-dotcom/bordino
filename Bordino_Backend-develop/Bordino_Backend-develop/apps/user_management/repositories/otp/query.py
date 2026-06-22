import json
import logging

from django.conf import settings
from django.core.cache import cache


class OtpQueryRepository:
    @staticmethod
    def get_otp(phone_number):
        """
        Retrieve OTP and metadata from Redis.
        Args:
            phone_number (str): Phone number associated with the OTP.
        Returns:
            dict: OTP data if it exists, otherwise None.
        """
        try:
            cache_key = f"{settings.CACHE_KEY_PREFIX}{phone_number}"
            data = cache.get(cache_key)
            if data:
                return json.loads(data)
            return None
        except Exception as e:  # pylint: disable=broad-exception-caught
            logging.error("Unexpected error while getting cache for key %s: %s", cache_key, e)
            return None
        # TODO: Handle and raise an appropriate exception here when needed.
