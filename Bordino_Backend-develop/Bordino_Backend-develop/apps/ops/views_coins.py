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
