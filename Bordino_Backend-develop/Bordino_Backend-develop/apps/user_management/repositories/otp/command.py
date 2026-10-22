import json
import logging
import secrets

from django.conf import settings
from django.core.cache import cache

import redis.exceptions

from apps.user_management.repositories.otp.query import OtpQueryRepository
from apps.user_management.services.otp.attempts import OtpAttempts

_CLAIM_SCRIPT = """
if redis.call('GET', KEYS[1]) == ARGV[1] then
    return redis.call('DEL', KEYS[1])
end
return 0
"""


def _redis():
    """The raw Redis connection behind the cache, or None when the cache is not Redis."""
    try:
        from django_redis import get_redis_connection  # pylint: disable=import-outside-toplevel

        return get_redis_connection("default")
    except Exception:  # pylint: disable=broad-except
        return None


class OTPCommandRepository:
    @staticmethod
    def create(phone_number, otp, ttl=settings.OTP_TTL):
        """
        Save OTP with metadata to Redis.
        Args:
            phone_number (str): Phone number to associate with OTP.
            otp (str): The generated OTP.
            ttl (int): Time-to-live for the OTP in seconds.
        """

        try:
            if not phone_number:
                raise ValueError("Phone number is required.")
            if not otp:
                raise ValueError("OTP is required.")
        except ValueError as e:
            logging.error("Validation Error: %s", e)
            return False

        try:
            cache_key = f"{settings.CACHE_KEY_PREFIX}{phone_number}"

            data = {
                "otp": otp,
                "is_used": False,
                # Makes every code's stored value unique, so `claim` can tell this code from a
                # later one with the same digits.
                "gen": secrets.token_hex(8),
            }
            cache.set(cache_key, json.dumps(data), timeout=ttl)
            OtpAttempts(phone_number).new_code()
            logging.info("OTP saved successfully for phone number: %s", phone_number)
            return True

        except redis.exceptions.ConnectionError as e:
            logging.error(
                "Redis connection error while setting cache for key %s: %s",
                cache_key,
                e,
            )
            return False
        except redis.exceptions.TimeoutError as e:
            logging.error("Redis timeout error while setting cache for key %s: %s", cache_key, e)
            return False
        except Exception as e:  # pylint: disable=broad-exception-caught
            logging.error("Unexpected error while setting cache for key %s: %s", cache_key, e)
            return False
        # TODO: Handle and raise an appropriate exception here when needed.

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

    @staticmethod
    def mark_otp_as_used(phone_number):
        """
        Mark the OTP as used by updating the `is_used` flag in Redis.
        This will NOT modify the TTL of the OTP.
        Args:
            phone_number (str): Phone number associated with the OTP.
        """
        try:
            otp_data = OtpQueryRepository.get_otp(phone_number)
            if otp_data:
                otp_data["is_used"] = True
                cache_key = f"{settings.CACHE_KEY_PREFIX}{phone_number}"

                ttl = cache.ttl(cache_key)
                cache.set(cache_key, json.dumps(otp_data), timeout=ttl)
                logging.info("OTP marked as used for phone number: %s", phone_number)
        except Exception as e:  # pylint: disable=broad-exception-caught
            logging.error(
                "Unexpected error while marking OTP as used for phone number %s: %s",
                phone_number,
                e,
            )
        # TODO: Handle and raise an appropriate exception here when needed.

    @staticmethod
    def read_for_claim(phone_number):
        """The OTP data, plus a token for `claim`: the stored value exactly as read."""
        cache_key = f"{settings.CACHE_KEY_PREFIX}{phone_number}"
        client = _redis()
        if client is None:  # not Redis (tests: LocMemCache)
            raw = cache.get(cache_key)
            return (json.loads(raw) if raw else None), raw
        stored = client.get(cache.make_key(cache_key))
        if stored is None:
            return None, None
        return json.loads(cache.client.decode(stored)), stored

    @staticmethod
    def claim(phone_number, token) -> bool:
        """Delete the OTP if its stored value is still `token`, in one Redis step. True for
        exactly one caller per code; a code sent after the read is left alone."""
        if token is None:
            return False
        cache_key = f"{settings.CACHE_KEY_PREFIX}{phone_number}"
        client = _redis()
        if client is None:  # LocMemCache in tests: one process, no real concurrency
            return cache.get(cache_key) == token and bool(cache.delete(cache_key))
        return bool(client.eval(_CLAIM_SCRIPT, 1, cache.make_key(cache_key), token))

    @staticmethod
    def delete_otp(phone_number):
        """
        Delete the OTP from Redis.
        Args:
            phone_number (str): Phone number associated with the OTP.
        """
        try:
            cache_key = f"{settings.CACHE_KEY_PREFIX}{phone_number}"
            cache.delete(cache_key)
            logging.info("OTP deleted successfully for phone number: %s", phone_number)
        except Exception as e:  # pylint: disable=broad-exception-caught
            logging.error("Unexpected error while deleting cache for key %s: %s", cache_key, e)
        # TODO: Handle and raise an appropriate exception here when needed.
