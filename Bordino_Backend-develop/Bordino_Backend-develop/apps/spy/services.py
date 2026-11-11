from django.core.cache import cache
from django.db.models.signals import post_delete, post_save
from django.dispatch import receiver

from apps.spy.models import SpyCategory, SpySettings, SpyWord

# The most words the app is sent (a bank larger than this is served in its order: topic, difficulty, text).
MAX_WORDS = 5000
CACHE_KEY = "spy:config:v1"
CACHE_SECONDS = 60


def _build() -> dict:
    s = SpySettings.current()
    if not s.enabled:
        # (switched off: nothing to play, nothing to build)
        return {"enabled": False, "categories": [], "words": []}
    categories = list(SpyCategory.objects.filter(is_active=True).order_by("order", "name"))
    ids = {c.pk: c.slug for c in categories}
    words = SpyWord.objects.filter(is_active=True, category__in=categories).order_by("category__order", "difficulty", "text")
    if not s.adults_allowed:
        words = words.filter(age__lt=18)
    out = [
        {"id": f"w-{w.pk}", "text": w.text, "related": w.related, "category": ids[w.category_id], "difficulty": w.difficulty, "age": w.age}
        for w in words.only("pk", "text", "related", "category_id", "difficulty", "age")[:MAX_WORDS]
    ]
    used = {w["category"] for w in out}
    return {
        "enabled": True,
        # (a topic without a word is not offered: the game would have nothing to draw)
        "categories": [{"id": c.slug, "label": c.name, "icon": c.icon} for c in categories if c.slug in used],
        "words": out,
    }


def config_payload() -> dict:
    """Built once a minute at most, and again at once after any change in the admin."""
    try:
        cached = cache.get(CACHE_KEY)
    except Exception:  # pylint: disable=broad-except
        cached = None
    if cached is not None:
        return cached
    payload = _build()
    try:
        cache.set(CACHE_KEY, payload, CACHE_SECONDS)
    except Exception:  # pylint: disable=broad-except
        pass
    return payload


@receiver(post_save, sender=SpySettings)
@receiver(post_delete, sender=SpySettings)
@receiver(post_save, sender=SpyCategory)
@receiver(post_delete, sender=SpyCategory)
@receiver(post_save, sender=SpyWord)
@receiver(post_delete, sender=SpyWord)
def _changed(**_kwargs):
    from django.db import transaction  # pylint: disable=import-outside-toplevel

    def clear():
        try:
            cache.delete(CACHE_KEY)
        except Exception:  # pylint: disable=broad-except
            pass

    clear()
    # …and again once the change is committed: a request reading between the save and its commit would
    # otherwise cache the old bank for a minute.
    transaction.on_commit(clear)
