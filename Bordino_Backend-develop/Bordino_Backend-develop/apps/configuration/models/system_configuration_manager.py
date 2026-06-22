import os
from typing import Any

from django.core.cache import cache
from django.db import models


class SystemConfigurationManager(models.Manager):
    CACHE_KEY_PREFIX = "system_config:"
    CACHE_TIMEOUT = 3600

    def _cache_key(self, key: str) -> str:
        return f"{self.CACHE_KEY_PREFIX}{key}"

    def _get_from_cache(self, key: str) -> Any | None:
        try:
            return cache.get(self._cache_key(key))
        except Exception:
            return None

    def _set_cache(self, key: str, value: Any) -> Any:
        try:
            cache.set(self._cache_key(key), value, timeout=self.CACHE_TIMEOUT)
        except Exception:
            pass
        return value

    def _get_from_db(self, key: str) -> Any | None:
        try:
            obj = self.filter(key=key).first()
            if not obj:
                return None
            raw = obj.value or obj.default_value
            if raw is None or not str(raw).strip():
                return None
            return obj.get_typed_value(raw)
        except Exception:
            return None

    def _cast_env(self, val: str, default: Any) -> Any:
        if not val or not str(val).strip():
            return default
        val = str(val).strip()
        if isinstance(default, bool):
            return val.lower() in ("true", "1", "yes", "on")
        if isinstance(default, int):
            try:
                return int(val)
            except ValueError:
                return default
        if isinstance(default, float):
            try:
                return float(val)
            except ValueError:
                return default
        return val

    def get(self, key: str, default: Any = None) -> Any:
        """Config: Redis cache → DB → env → default."""
        val = self._get_from_cache(key)
        if val is not None:
            return val
        val = self._get_from_db(key)
        if val is not None:
            return self._set_cache(key, val)
        val = os.environ.get(key)
        if val is not None and str(val).strip():
            return self._set_cache(key, self._cast_env(val, default))
        return default

    def invalidate(
        self,
        key: str | None = None,
        *,
        instance: "SystemConfiguration | None" = None,
    ) -> None:
        if instance is not None:
            key = getattr(instance, "key", None)
        if not key:
            return
        try:
            cache.delete(self._cache_key(key))
        except Exception:
            pass

    def invalidate_all(self) -> None:
        try:
            if hasattr(cache, "delete_pattern"):
                cache.delete_pattern(f"{self.CACHE_KEY_PREFIX}*")
            else:
                for k in getattr(cache, "keys", lambda p: [])(f"{self.CACHE_KEY_PREFIX}*"):
                    cache.delete(k)
        except Exception:
            pass
