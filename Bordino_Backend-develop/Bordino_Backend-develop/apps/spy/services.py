from apps.spy.models import SpyCategory, SpySettings, SpyWord


def config_payload() -> dict:
    s = SpySettings.current()
    categories = list(SpyCategory.objects.filter(is_active=True).order_by("order", "name"))
    ids = {c.pk: c.slug for c in categories}
    words = SpyWord.objects.filter(is_active=True, category__in=categories).order_by("category__order", "difficulty", "text")
    if not s.adults_allowed:
        words = words.filter(age__lt=18)
    out = [
        {"id": f"w-{w.pk}", "text": w.text, "related": w.related, "category": ids[w.category_id], "difficulty": w.difficulty, "age": w.age}
        for w in words
    ]
    used = {w["category"] for w in out}
    return {
        "enabled": s.enabled,
        # (a topic without a word is not offered: the game would have nothing to draw)
        "categories": [{"id": c.slug, "label": c.name, "icon": c.icon} for c in categories if c.slug in used],
        "words": out,
    }
