# yourapp/services.py
from dataclasses import dataclass
from datetime import datetime, timezone

from django.conf import settings
from django.core.cache import cache

from rest_framework_simplejwt.tokens import AccessToken, RefreshToken, TokenError


class LogoutService:
    """
    Encapsulates logout logic:
      - Blacklist the refresh token
      - Revoke the access token by adding it to a blacklist
    """

    @staticmethod
    def blacklist_refresh(refresh_token: str) -> None:
        """
        Blacklist a SimpleJWT refresh token.
        Raises TokenError on failure.
        """
        RefreshToken(refresh_token).blacklist()

    @staticmethod
    def get_access_ttl(raw_access_token: str) -> int:
        """
        Parse the raw access token and compute its remaining TTL in seconds.
        Returns 0 if invalid or expired.
        """
        try:
            at = AccessToken(raw_access_token)
            exp = at.get("exp")
            now = datetime.now(timezone.utc).timestamp()
            return max(int(exp - now), 0)
        except TokenError:
            return 0

    @dataclass
    class RevokeAccessJtiDTO:
        auth_header: str

    @staticmethod
    def revoke_access_jti(dto: RevokeAccessJtiDTO) -> None:
        """
        Extract JTI from access token and cache it for its remaining TTL,
        marking it as revoked.
        """
        try:
            parts = dto.auth_header.split()
            if len(parts) == 2 and parts[0].lower() == "bearer":
                raw_access = parts[1]
                at = AccessToken(raw_access)
                jti = at.get("jti")
                ttl = LogoutService.get_access_ttl(raw_access)

                if jti and ttl:
                    # Store the token in Redis with its remaining TTL
                    cache_key = f"bl_access_{jti}"
                    cache.set(cache_key, True, timeout=ttl)

                    # Also store the token in the blacklist for the configured lifetime
                    blacklist_key = f"bl_access_blacklist_{jti}"
                    cache.set(
                        blacklist_key,
                        True,
                        timeout=settings.SIMPLE_JWT["ACCESS_TOKEN_LIFETIME"].total_seconds(),
                    )
        except TokenError:
            pass

    @staticmethod
    def is_access_token_revoked(jti: str) -> bool:
        """
        Check if an access token is revoked.
        """
        return bool(cache.get(f"bl_access_{jti}") or cache.get(f"bl_access_blacklist_{jti}"))
