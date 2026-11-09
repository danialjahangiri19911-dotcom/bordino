"""Counts the server's errors (5xx answers) per hour in the cache, for the admin app's maintenance
page. Never stops or slows a request: a cache that is down only means no count."""

from datetime import timedelta

from django.core.cache import cache
from django.utils import timezone

KEEP = 26 * 3600


def _key(hour: str) -> str:
    return f"ops:5xx:{hour}"


def _hour(dt) -> str:
    return dt.strftime("%Y%m%d%H")


class ErrorCountMiddleware:
    def __init__(self, get_response):
        self.get_response = get_response

    def __call__(self, request):
        response = self.get_response(request)
        if getattr(response, "status_code", 200) >= 500:
            try:
                key = _key(_hour(timezone.now()))
                cache.add(key, 0, KEEP)
                cache.incr(key)
            except Exception:  # pylint: disable=broad-except
                pass
        return response


def errors_last_24h() -> int:
    now = timezone.now()
    keys = [_key(_hour(now - timedelta(hours=h))) for h in range(24)]
    try:
        return sum(int(v or 0) for v in cache.get_many(keys).values())
    except Exception:  # pylint: disable=broad-except
        return 0
