from django.conf import settings
from django.core.cache import cache

# A 4-digit code has 10,000 values. Each code allows a few wrong tries; each phone a few more a
# day, and only so many codes an hour. That keeps a guess at about 1 in 700 per phone per day
# (and caps the SMS bill), where before a script could try every value inside the code's 60 s.
TRIES_PER_CODE = 5
WRONG_PER_DAY = 15
SENDS_PER_HOUR = 8

DAY = 24 * 60 * 60
HOUR = 60 * 60


class OtpAttempts:
    """Per-phone counters in the cache, beside the OTP itself (same key prefix)."""

    def __init__(self, phone_number: str):
        base = f"{settings.CACHE_KEY_PREFIX}{phone_number}"
        self.code_key = f"{base}:tries"
        self.day_key = f"{base}:wrong_day"
        self.send_key = f"{base}:sends"

    @staticmethod
    def _bump(key, ttl) -> int:
        # add() starts the window; incr() keeps its expiry.
        cache.add(key, 0, timeout=ttl)
        try:
            return cache.incr(key)
        except ValueError:  # expired between the two calls
            cache.set(key, 1, timeout=ttl)
            return 1

    def new_code(self):
        """A fresh code gets fresh tries (the daily count stays)."""
        cache.delete(self.code_key)

    def reserve(self):
        """Count this try BEFORE the code is compared, so requests sent all at once cannot all
        compare before any is counted (each INCR is atomic: only the first N get a number in the
        limit). Returns None when the try may go on, else which limit it hit: "day" or "code".
        A right code gives its daily count back (`right_code`)."""
        on_day = self._bump(self.day_key, DAY)
        on_code = self._bump(self.code_key, settings.OTP_TTL)
        if on_day > WRONG_PER_DAY:
            return "day"
        if on_code > TRIES_PER_CODE:
            return "code"
        return None

    def right_code(self):
        try:
            cache.decr(self.day_key)
        except ValueError:  # window expired meanwhile
            pass

    def allow_send(self) -> bool:
        """Counts this send; False once the hourly limit is reached."""
        return self._bump(self.send_key, HOUR) <= SENDS_PER_HOUR
