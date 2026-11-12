"""«بردینو ادمین»: the coin packages (the settings role) and recent coin purchases (finance or settings)."""

from django.core.exceptions import ValidationError
from django.db import transaction
from rest_framework.response import Response
from rest_framework.views import APIView

from apps.coins.models import CoinPackage, CoinPurchase
from apps.ops.auth import audit, role_permission
from apps.ops.views_auth import err

SettingsRole = role_permission("settings")
MoneyRole = role_permission("finance", "settings")
FIELDS = ("coins", "price_toman", "original_price_toman", "badge", "is_active", "sort_order")


def payload(p: CoinPackage) -> dict:
    return {
        "id": str(p.pk),
        "coins": p.coins,
        "price_toman": p.price_toman,
        "original_price_toman": p.original_price_toman,
        "discount_percent": p.discount_percent,
        "badge": p.badge,
        "is_active": p.is_active,
        "sort_order": p.sort_order,
        "sold": p.purchases.filter(status=CoinPurchase.Status.PAID).count(),
    }


def _apply(p: CoinPackage, data: dict):
    """Copies the known fields from `data`, typed; anything else is ignored."""
    for name in FIELDS:
        if name not in data:
            continue
        raw = data[name]
        if name == "badge":
            p.badge = str(raw or "").strip()[:30]
        elif name == "is_active":
            p.is_active = raw is True or str(raw).lower() in ("true", "1")
        elif name == "original_price_toman" and raw in (None, "", 0, "0"):
            p.original_price_toman = None
        else:
            try:
                value = int(raw)
            except (TypeError, ValueError):
                raise ValidationError({name: "عدد درست وارد کن."}) from None
            if value < 0:
                raise ValidationError({name: "عدد منفی مجاز نیست."})
            setattr(p, name, value)


def _invalid(exc: ValidationError):
    fields = {k: [str(m) for m in v] for k, v in getattr(exc, "message_dict", {}).items()}
    first = next(iter(fields.values()), [str(exc)])[0]
    return Response({"error": first, "code": "invalid", "fields": fields}, status=400)


class PackagesView(APIView):
    permission_classes = (SettingsRole,)

    def get(self, request):
        return Response({"packages": [payload(p) for p in CoinPackage.objects.order_by("sort_order", "price_toman")]})

    def post(self, request):
        data = request.data if isinstance(request.data, dict) else {}
        p = CoinPackage(coins=0, price_toman=0)
        try:
            with transaction.atomic():
                _apply(p, data)
                p.save()
                audit(request, "coin_package_add", "coin_package", p.pk, after=payload(p))
        except ValidationError as exc:
            return _invalid(exc)
        return Response({"package": payload(p)}, status=201)


class PackageView(APIView):
    permission_classes = (SettingsRole,)

    def put(self, request, package_id):
        data = request.data if isinstance(request.data, dict) else {}
        try:
            with transaction.atomic():
                p = CoinPackage.objects.select_for_update().filter(pk=package_id).first()
                if p is None:
                    return err("این بسته پیدا نشد.", "not_found", 404)
                before = payload(p)
                _apply(p, data)
                p.save()
                audit(request, "coin_package_change", "coin_package", p.pk, before=before, after=payload(p))
        except ValidationError as exc:
            return _invalid(exc)
        return Response({"package": payload(p)})


class PurchasesView(APIView):
    """The latest coin purchases (read-only)."""

    permission_classes = (MoneyRole,)

    def get(self, request):
        rows = CoinPurchase.objects.select_related("customer__user").order_by("-create_time")[:100]
        return Response(
            {
                "purchases": [
                    {
                        "id": str(r.pk),
                        "phone": r.customer.user.phone_number,
                        "coins": r.coins,
                        "amount_toman": r.amount_toman,
                        "status": r.status,
                        "status_label": r.get_status_display(),
                        "mode": r.mode,
                        "ref_number": r.ref_number,
                        "time": r.create_time,
                    }
                    for r in rows
                ]
            }
        )


# ── entry fees: one GameConfiguration.play_cost per game (Sudoku per level) ──

GAMES = {
    "sudoku": "سودوکو",
    "game_2048": "۲۰۴۸",
    "pantomime": "پانتومیم",
    "dowr": "دُور",
    "spy": "جاسوس",
}
LEVELS = {"easy": "آسان", "medium": "متوسط", "hard": "سخت"}
MAX_FEE = 10_000_000


def fee_payload(c) -> dict:
    return {
        "id": str(c.pk),
        "game": c.game_name,
        "game_label": GAMES.get(c.game_name, c.game_name),
        "level": c.difficulty_level or "",
        "level_label": LEVELS.get(c.difficulty_level or "", ""),
        "fee": int(c.play_cost),
        "active": c.is_active,
    }


class FeesView(APIView):
    """Each game's entry fee in coins (charged once per new game or round, by the server)."""

    permission_classes = (SettingsRole,)

    def get(self, request):
        from apps.configuration.models.game.configuration import GameConfiguration  # pylint: disable=import-outside-toplevel

        order = list(GAMES)
        rows = [c for c in GameConfiguration.objects.filter(game_name__in=order)]
        rows.sort(key=lambda c: (order.index(c.game_name), list(LEVELS).index(c.difficulty_level) if c.difficulty_level in LEVELS else -1))
        return Response({"fees": [fee_payload(c) for c in rows]})


class FeeView(APIView):
    permission_classes = (SettingsRole,)

    def put(self, request, config_id):
        from apps.configuration.models.game.configuration import GameConfiguration  # pylint: disable=import-outside-toplevel

        raw = (request.data or {}).get("fee") if isinstance(request.data, dict) else None
        try:
            fee = int(str(raw).strip())
        except (TypeError, ValueError):
            return err("عدد درست وارد کن.", "invalid", 400)
        if not 0 <= fee <= MAX_FEE:
            return err("هزینه باید بین ۰ و ۱۰٬۰۰۰٬۰۰۰ سکه باشد.", "invalid", 400)
        with transaction.atomic():
            c = GameConfiguration.objects.select_for_update().filter(pk=config_id, game_name__in=list(GAMES)).first()
            if c is None:
                return err("این بازی پیدا نشد.", "not_found", 404)
            before = int(c.play_cost)
            GameConfiguration.objects.filter(pk=c.pk).update(play_cost=fee)
            c.play_cost = fee
            audit(request, "game_fee_change", "game_fee", c.pk, game=c.game_name, level=c.difficulty_level or "", before=before, after=fee)
        return Response({"fee": fee_payload(c)})
