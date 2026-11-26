"""«بردینو ادمین»: rewarded videos per day — what was watched, what Adivery confirmed (what it pays the
owner for) and what the players were paid, so it can be matched with Adivery's own revenue report."""

from datetime import timedelta

from django.db.models import Count, Q, Sum
from django.db.models.functions import TruncDate
from django.utils import timezone
from rest_framework.response import Response
from rest_framework.views import APIView

from apps.ops.auth import role_permission
from apps.wallet.models import AdiveryCallbackAttempt, AdRewardSession
from apps.wallet.services.ad_reward import DAY_ZONE, AdiveryProvider

ReportRole = role_permission("finance", "settings")
MATCHED = (AdiveryCallbackAttempt.Outcome.PAID, AdiveryCallbackAttempt.Outcome.ALREADY, AdiveryCallbackAttempt.Outcome.NOT_PAID)


def daily(days: int) -> dict:
    """The last `days` Tehran days, oldest first, each counted on the day the view started."""
    first = (timezone.localtime(timezone.now(), DAY_ZONE) - timedelta(days=days - 1)).replace(hour=0, minute=0, second=0, microsecond=0)
    views = (
        AdRewardSession.objects.filter(provider=AdiveryProvider.name, create_time__gte=first)
        .annotate(day=TruncDate("create_time", tzinfo=DAY_ZONE))
        .values("day")
        .annotate(
            started=Count("id"),
            missions=Count("id", filter=Q(placement__startswith="mission:")),
            confirmed=Count("id", filter=Q(verified_at__isnull=False)),
            paid=Count("id", filter=Q(status=AdRewardSession.Status.REWARDED)),
            # paid on the app's own «watched» (ADIVERY_TRUST_APP), Adivery never confirmed it
            paid_unconfirmed=Count("id", filter=Q(status=AdRewardSession.Status.REWARDED, verified_at__isnull=True)),
            coins=Sum("reward_points", filter=Q(status=AdRewardSession.Status.REWARDED)),
            players=Count("customer", distinct=True),
        )
    )
    calls = (
        AdiveryCallbackAttempt.objects.filter(create_time__gte=first)
        .annotate(day=TruncDate("create_time", tzinfo=DAY_ZONE))
        .values("day")
        .annotate(callbacks=Count("id"), matched=Count("id", filter=Q(outcome__in=MATCHED)), refused=Count("id", filter=~Q(outcome__in=MATCHED)))
    )
    by_day = {row["day"]: row for row in views}
    for row in calls:
        by_day.setdefault(row["day"], {}).update(row)
    keys = ("started", "missions", "confirmed", "paid", "paid_unconfirmed", "coins", "players", "callbacks", "matched", "refused")
    rows = []
    for i in range(days):
        day = (first + timedelta(days=i)).date()
        found = by_day.get(day, {})
        rows.append({"day": day.isoformat(), **{k: int(found.get(k) or 0) for k in keys}})
    total = {k: sum(r[k] for r in rows) for k in keys if k != "players"}
    total["players"] = (
        AdRewardSession.objects.filter(provider=AdiveryProvider.name, create_time__gte=first).values("customer").distinct().count()
    )
    return {"days": rows, "total": total, "since": first.isoformat()}


class AdsDailyView(APIView):
    permission_classes = (ReportRole,)

    def get(self, request):
        try:
            days = int(request.query_params.get("days") or 14)
        except ValueError:
            days = 14
        return Response({"report": daily(max(1, min(days, 90)))})
