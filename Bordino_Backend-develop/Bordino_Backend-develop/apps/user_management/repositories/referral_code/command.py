import logging

from django.conf import settings
from django.core.cache import cache


class ReferralCodeCommandRepository:
    @staticmethod
    def save(phone_number, referral_code, ttl=settings.OTP_TTL * 2):
        try:
            if not phone_number:
                raise ValueError("Phone number is required.")
            if not referral_code:
                raise ValueError("Referral code is required.")
        except ValueError:
            return False

        try:
            cache_key = f"{settings.CACHE_KEY_PREFIX}referral_{phone_number}"
            cache.set(cache_key, referral_code, timeout=ttl)
            logging.info("Referral code saved successfully for phone number: %s", phone_number)
            return True
        except Exception:
            return False

    @staticmethod
    def get(phone_number):
        try:
            cache_key = f"{settings.CACHE_KEY_PREFIX}referral_{phone_number}"
            referral_code = cache.get(cache_key)
            return referral_code
        except Exception:
            return None

    @staticmethod
    def delete(phone_number):
        try:
            cache_key = f"{settings.CACHE_KEY_PREFIX}referral_{phone_number}"
            cache.delete(cache_key)
            logging.info("Referral code deleted successfully for phone number: %s", phone_number)
        except Exception as e:
            logging.error(
                "Unexpected error while deleting referral code for key %s: %s",
                cache_key,
                e,
            )
