from django.core.exceptions import ValidationError
from django.db import IntegrityError, transaction

from apps.dowr.models import DowrCard, DowrCategory, DowrGame, DowrSettings
from apps.users.models.customer import Customer

LOG_KEEP = 600  # answers kept per game (a 10-round, 12-player game with swaps stays well within)


def config_payload() -> dict:
    s = DowrSettings.current()
    categories = list(DowrCategory.objects.filter(is_active=True).order_by("order", "name"))
    ids = {c.pk: c.slug for c in categories}
    cards = [
        {"id": f"{ids[c.category_id]}-{c.pk}", "category": ids[c.category_id], "difficulty": c.difficulty, "text": c.text, "forbidden": c.forbidden_list()}
        for c in DowrCard.objects.filter(is_active=True, category__in=categories).order_by("category__order", "difficulty", "text")
    ]
    # A topic without a card is not offered (the game would have nothing to draw).
    used = {c["category"] for c in cards}
    return {
        "enabled": s.enabled,
        "limits": {"bomb_allowed": s.bomb_allowed, "max_rounds": s.max_rounds, "max_seconds": s.max_seconds},
        "categories": [{"id": c.slug, "label": c.name, "icon": c.icon} for c in categories if c.slug in used],
        "cards": cards,
    }


def save_game(customer: Customer, data: dict) -> tuple[DowrGame, bool]:
    """Records a finished game once per request id (a resend is the same game)."""
    existing = DowrGame.objects.filter(customer=customer, request_id=data["request_id"]).first()
    if existing:
        return existing, False
    teams = data["teams"]
    top = min((t["rank"] for t in teams), default=1)
    winners = "، ".join(t["name"] for t in teams if t["rank"] == top)[:200]
    try:
        with transaction.atomic():
            game = DowrGame.objects.create(
                customer=customer,
                request_id=data["request_id"],
                mode=data["mode"],
                rounds=data["rounds"],
                seconds=data["seconds"],
                team_count=len(teams),
                bomb=data.get("bomb") or {},
                winners=winners,
                teams=teams,
                log=data.get("log", [])[:LOG_KEEP],
            )
    except (IntegrityError, ValidationError):
        # The same game sent twice at once: the model's full_clean (or the unique constraint) refuses
        # the second, which answers with the first. Anything else is a real error.
        existing = DowrGame.objects.filter(customer=customer, request_id=data["request_id"]).first()
        if existing is None:
            raise
        return existing, False
    return game, True


def summary(game: DowrGame) -> dict:
    return {
        "id": str(game.pk),
        "played_at": game.create_time.isoformat(),
        "mode": game.mode,
        "rounds": game.rounds,
        "seconds": game.seconds,
        "winners": game.winners,
        "teams": [{"name": t.get("name"), "score": t.get("score"), "rank": t.get("rank")} for t in game.teams],
    }


def history(customer: Customer, limit: int = 20) -> dict:
    games = DowrGame.objects.filter(customer=customer).order_by("-create_time")[:limit]
    return {"games": [summary(g) for g in games], "total": DowrGame.objects.filter(customer=customer).count()}
