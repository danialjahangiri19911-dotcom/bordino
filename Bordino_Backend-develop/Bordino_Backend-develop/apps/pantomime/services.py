from django.core.exceptions import ValidationError
from django.db import IntegrityError, transaction
from django.db.models import Count, Q

from apps.pantomime.models import PantomimeCard, PantomimeCategory, PantomimeGame, PantomimeSettings
from apps.users.models.customer import Customer


def config_payload() -> dict:
    """What the app needs to set up a game: the switch, the limits and the active clues."""
    settings = PantomimeSettings.current()
    categories = list(
        PantomimeCategory.objects.filter(is_active=True)
        .annotate(card_count=Count("cards", filter=Q(cards__is_active=True)))
        .filter(card_count__gt=0)
        .order_by("order", "create_time")  # (a grouped query does not apply Meta.ordering)
    )
    cards = PantomimeCard.objects.filter(is_active=True, category__in=categories).values_list(
        "pk", "category__slug", "difficulty", "text"
    )
    return {
        "enabled": settings.enabled,
        "limits": {
            "turn_seconds": [settings.min_turn_seconds, settings.max_turn_seconds],
            "challenge_seconds": [settings.min_challenge_seconds, settings.max_challenge_seconds],
            "max_rounds": settings.max_rounds,
            "max_teams": settings.max_teams,
            "max_members": settings.max_members,
        },
        "categories": [
            {"id": c.slug, "label": c.name, "icon": c.icon, "weight": float(c.weight), "count": c.card_count}
            for c in categories
        ],
        "cards": [{"id": str(pk), "category": slug, "difficulty": d, "text": text} for pk, slug, d, text in cards],
    }


def save_game(customer: Customer, data: dict) -> tuple[PantomimeGame, bool]:
    """Records a finished game once per request id (a resend returns the first record)."""
    request_id = data["request_id"]
    earlier = PantomimeGame.objects.filter(customer=customer, request_id=request_id).first()
    if earlier:
        return earlier, False
    # Kept in the game's order (turns point at them by index); ranked only for showing.
    teams = data["teams"]
    best = min(t["rank"] for t in teams)
    try:
        with transaction.atomic():
            game = PantomimeGame.objects.create(
                customer=customer,
                request_id=request_id,
                format=data["format"],
                mode=data["mode"],
                rounds=data["rounds"],
                team_count=len(teams),
                winners="، ".join(t["name"] for t in teams if t["rank"] == best)[:200],
                teams=teams,
                turns=data["turns"],
            )
    except (IntegrityError, ValidationError):
        # The same game sent twice at once: the other request recorded it (seen by the save's own
        # validation, or by the database's unique constraint).
        earlier = PantomimeGame.objects.filter(customer=customer, request_id=request_id).first()
        if earlier is None:
            raise
        return earlier, False
    return game, True


def summary(game: PantomimeGame) -> dict:
    return {
        "id": str(game.pk),
        "played_at": game.create_time.isoformat(),
        "format": game.format,
        "mode": game.mode,
        "rounds": game.rounds,
        "winners": game.winners,
        "teams": [
            {"name": t["name"], "score": t["score"], "rank": t["rank"]} for t in sorted(game.teams, key=lambda t: t["rank"])
        ],
    }


def history(customer: Customer, limit: int = 20) -> dict:
    games = PantomimeGame.objects.filter(customer=customer)
    by_format = dict(games.values_list("format").annotate(n=Count("id")).values_list("format", "n"))
    return {
        "total": sum(by_format.values()),
        "by_format": {f: by_format.get(f, 0) for f in PantomimeGame.Format.values},
        "results": [summary(g) for g in games.order_by("-create_time")[:limit]],
    }
