import os
from typing import Any

from django.core.cache import cache
from django.db import models


class SystemConfigurationManager(models.Manager):
    CACHE_KEY_PREFIX = "system_config:"
    GENERATION_PREFIX = "system_config_gen:"
    CACHE_TIMEOUT = 3600

    # Each key's cached value lives under its current generation, and every change moves the
    # generation on. A read that fetched the old value from the database just before a change, and
    # caches it just after, writes it under the old generation, which nobody reads any more (deleting
    # the key alone let such a late fill bring the old value back for an hour).
    def _generation(self, key: str) -> int:
        try:
            return int(cache.get(f"{self.GENERATION_PREFIX}{key}") or 0)
        except Exception:
            return 0

    def _cache_key(self, key: str, generation: int | None = None) -> str:
        gen = self._generation(key) if generation is None else generation
        return f"{self.CACHE_KEY_PREFIX}{key}:{gen}"

    def _get_from_cache(self, key: str, generation: int) -> Any | None:
        try:
            return cache.get(self._cache_key(key, generation))
        except Exception:
            return None

    def _set_cache(self, key: str, value: Any, generation: int) -> Any:
        try:
            cache.set(self._cache_key(key, generation), value, timeout=self.CACHE_TIMEOUT)
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
        generation = self._generation(key)  # (read BEFORE the database: a fill is filed under it)
        val = self._get_from_cache(key, generation)
        if val is not None:
            return val
        val = self._get_from_db(key)
        if val is not None:
            return self._set_cache(key, val, generation)
        val = os.environ.get(key)
        if val is not None and str(val).strip():
            return self._set_cache(key, self._cast_env(val, default), generation)
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
        gen_key = f"{self.GENERATION_PREFIX}{key}"
        try:
            old = self._cache_key(key)
            # (no expiry: a generation that vanished would start again at 0 and could meet a late fill)
            cache.add(gen_key, 0, timeout=None)
            cache.incr(gen_key)
            cache.delete(old)
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
