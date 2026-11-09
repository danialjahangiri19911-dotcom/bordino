"""«بردینو ادمین»: settings (the settings role), dashboards and user lookup (any role), maintenance."""

import shutil
from datetime import timedelta

from django.core.cache import cache
from django.db import connection
from django.db.models import Count, Q, Sum
from django.db.models.functions import TruncDate
from django.utils import timezone
from rest_framework.response import Response
from rest_framework.views import APIView

from apps.ops import settings_catalog as catalog
from apps.ops.auth import IsOps, audit, role_permission
from apps.ops.middleware import errors_last_24h
from apps.ops import roles
from apps.ops.views_auth import err
from apps.wallet.services.ad_reward import DAY_ZONE

SettingsRole = role_permission("settings")
AnyRole = role_permission("reviewer", "finance", "settings", "support")


# ── settings ──


class SettingsView(APIView):
    permission_classes = (SettingsRole,)

    def get(self, request):
        from apps.configuration.models.system_configuration import SystemConfiguration  # pylint: disable=import-outside-toplevel

        body = {"groups": catalog.GROUPS, "settings": [catalog.current(e) for e in catalog.CATALOG]}
        if roles.is_owner(request.user):
            body["other"] = [
                {"key": r.key, "value": r.value, "type": r.value_type, "description": r.description}
                for r in SystemConfiguration.objects.exclude(key__in=catalog.BY_KEY).order_by("key")
            ]
        return Response(body)


class SettingView(APIView):
    permission_classes = (SettingsRole,)

    def put(self, request, key):
        try:
            entry, before = catalog.put(key, (request.data or {}).get("value"))
        except catalog.SettingError as exc:
            return err(str(exc), "invalid", 400)
        audit(request, "setting_change", "setting", key, before=before, after=entry["value"])
        return Response({"setting": entry})

    def delete(self, request, key):
        try:
            entry, before = catalog.reset(key)
        except catalog.SettingError as exc:
            return err(str(exc), "invalid", 400)
        audit(request, "setting_reset", "setting", key, before=before, after=entry["value"])
        return Response({"setting": entry})


# ── dashboards ──


def _day_start(now, days_back=0):
    local = timezone.localtime(now, DAY_ZONE) - timedelta(days=days_back)
    return local.replace(hour=0, minute=0, second=0, microsecond=0)


def overview() -> dict:
    from apps.gamemaster.models import Game, GameVersion  # pylint: disable=import-outside-toplevel
    from apps.gamemaster.services import LIVE  # pylint: disable=import-outside-toplevel
    from apps.lottery.models.lottery import Lottery  # pylint: disable=import-outside-toplevel
    from apps.missions.models import MysteryCheckin, MysteryRun  # pylint: disable=import-outside-toplevel
    from apps.ops.views_money import withdrawals  # pylint: disable=import-outside-toplevel
    from apps.users.models.customer import Customer  # pylint: disable=import-outside-toplevel
    from apps.wallet.models import BankAccount, CurrencyTransaction  # pylint: disable=import-outside-toplevel
    from apps.wallet.models.transactions.activity import ActivityTransaction  # pylint: disable=import-outside-toplevel

    now = timezone.now()
    today, week, month = _day_start(now), _day_start(now, 6), _day_start(now, 29)
    customers = Customer.objects.all()
    users = customers.aggregate(
        total=Count("id"),
        new_today=Count("id", filter=Q(create_time__gte=today)),
        new_7=Count("id", filter=Q(create_time__gte=week)),
        new_30=Count("id", filter=Q(create_time__gte=month)),
        active_today=Count("id", filter=Q(last_active_date__gte=today)),
        active_7=Count("id", filter=Q(last_active_date__gte=week)),
        active_30=Count("id", filter=Q(last_active_date__gte=month)),
    )
    per_day = dict(
        customers.filter(create_time__gte=month)
        .annotate(day=TruncDate("create_time", tzinfo=DAY_ZONE))
        .values_list("day")
        .annotate(n=Count("id"))
        .values_list("day", "n")
    )
    active_per_day = dict(
        ActivityTransaction.objects.filter(create_time__gte=month)
        .annotate(day=TruncDate("create_time", tzinfo=DAY_ZONE))
        .values_list("day")
        .annotate(n=Count("customer", distinct=True))
        .values_list("day", "n")
    )
    days = [(month + timedelta(days=i)).date() for i in range(30)]
    done = ActivityTransaction.objects.filter(status=ActivityTransaction.Status.COMPLETED)
    points = done.aggregate(
        issued_today=Sum("score_value", filter=Q(create_time__gte=today, score_value__gt=0)),
        issued_7=Sum("score_value", filter=Q(create_time__gte=week, score_value__gt=0)),
        spent_today=Sum("score_value", filter=Q(create_time__gte=today, score_value__lt=0)),
        spent_7=Sum("score_value", filter=Q(create_time__gte=week, score_value__lt=0)),
    )
    w = withdrawals()
    cash = {
        "pending": w.filter(status=CurrencyTransaction.Status.PENDING).count(),
        "pending_amount": int(w.filter(status=CurrencyTransaction.Status.PENDING).aggregate(s=Sum("amount"))["s"] or 0),
        "paid_30": int(w.filter(status=CurrencyTransaction.Status.COMPLETED, update_time__gte=month).aggregate(s=Sum("amount"))["s"] or 0),
        "bank_accounts_pending": BankAccount.objects.filter(is_deleted=False, status=BankAccount.Status.PENDING).count(),
    }
    games = {
        "waiting_review": GameVersion.objects.filter(status=GameVersion.Status.SUBMITTED).count(),
        "live": Game.objects.filter(status__in=LIVE).count(),
        "expired": Game.objects.filter(status=Game.Status.EXPIRED).count(),
        "drafts": Game.objects.filter(status=Game.Status.DRAFT).count(),
        "mystery_runs_today": MysteryRun.objects.filter(create_time__gte=today).count(),
        "stage_proofs_today": MysteryCheckin.objects.filter(create_time__gte=today).count(),
    }
    lotteries = {"active": Lottery.objects.filter(status=Lottery.Status.ACTIVE).count()}
    return {
        "at": now.isoformat(),
        "users": users,
        "days": [d.isoformat() for d in days],
        "signups": [per_day.get(d, 0) for d in days],
        "active": [active_per_day.get(d, 0) for d in days],
        "points": {k: int(v or 0) for k, v in points.items()},
        "cash": cash,
        "games": games,
        "lotteries": lotteries,
    }


class OverviewView(APIView):
    permission_classes = (AnyRole,)

    def get(self, request):
        data = cache.get("ops:overview")
        if data is None:
            data = overview()
            cache.set("ops:overview", data, 60)
        return Response({"overview": data})


# How late each timer may be before it is shown as a problem.
LATE = {"gamemaster_tick": timedelta(minutes=30), "settle_expired_crash_rounds": timedelta(minutes=5), "process_lottery_winners": timedelta(minutes=15)}


def _check(name, fn):
    try:
        return {"name": name, **fn()}
    except Exception as exc:  # pylint: disable=broad-except
        return {"name": name, "ok": False, "detail": f"{type(exc).__name__}: {str(exc)[:160]}"}


def maintenance() -> dict:
    from django_celery_beat.models import PeriodicTask  # pylint: disable=import-outside-toplevel

    now = timezone.now()

    def db():
        with connection.cursor() as c:
            c.execute("select pg_database_size(current_database()), (select count(*) from pg_stat_activity where datname = current_database())")
            size, conns = c.fetchone()
        return {"ok": True, "size_mb": round(size / 1048576, 1), "connections": conns}

    def redis():
        from django_redis import get_redis_connection  # pylint: disable=import-outside-toplevel

        r = get_redis_connection("default")
        r.ping()
        info = r.info("memory")
        return {"ok": True, "memory_mb": round(info.get("used_memory", 0) / 1048576, 1)}

    def workers():
        from apps.tasks.celery import app  # pylint: disable=import-outside-toplevel

        answers = app.control.ping(timeout=1.0) or []
        queued = None
        try:
            with app.connection_for_read() as conn:
                queued = conn.default_channel.client.llen("celery")
        except Exception:  # pylint: disable=broad-except
            queued = None
        return {"ok": bool(answers), "workers": len(answers), "queued": queued}

    def disk():
        total, used, free = shutil.disk_usage("/")
        return {"ok": free / total > 0.1, "free_gb": round(free / 1e9, 1), "used_percent": round(100 * used / total)}

    def timers():
        rows = []
        for t in PeriodicTask.objects.filter(enabled=True).order_by("name"):
            limit = LATE.get(t.name)
            late = bool(limit and (not t.last_run_at or now - t.last_run_at > limit))
            rows.append({"name": t.name, "last_run": t.last_run_at.isoformat() if t.last_run_at else None, "late": late})
        return {"ok": not any(r["late"] for r in rows), "tasks": rows}

    def errors():
        n = errors_last_24h()
        return {"ok": n < 50, "count": n}

    def migrations():
        with connection.cursor() as c:
            c.execute("select app, name, applied from django_migrations order by applied desc limit 1")
            app, name, applied = c.fetchone()
        return {"ok": True, "last": f"{app}.{name}", "applied": applied.isoformat()}

    checks = [
        _check("database", db),
        _check("redis", redis),
        _check("workers", workers),
        _check("timers", timers),
        _check("disk", disk),
        _check("errors", errors),
        _check("migrations", migrations),
    ]
    return {"at": now.isoformat(), "ok": all(c.get("ok") for c in checks), "checks": checks}


class MaintenanceView(APIView):
    permission_classes = (AnyRole,)

    def get(self, request):
        return Response({"maintenance": maintenance()})


# ── users ──


class UserSearchView(APIView):
    """Support: one user by phone, username, or id — their account at a glance (read-only)."""

    permission_classes = (AnyRole,)

    def get(self, request):
        from django.contrib.auth import get_user_model  # pylint: disable=import-outside-toplevel

        q = (request.query_params.get("q") or "").strip()
        if len(q) < 3:
            return Response({"users": []})
        digits = "".join(ch for ch in q.translate(str.maketrans("۰۱۲۳۴۵۶۷۸۹", "0123456789")) if ch.isdigit())
        phone = digits[1:] if digits.startswith("0") else digits
        User = get_user_model()
        qs = User.objects.filter(Q(username__icontains=q) | (Q(phone_number__contains=phone) if len(phone) >= 4 else Q(pk__in=[])))
        users = list(qs.select_related("customer").order_by("-create_time")[:20])
        audit(request, "user_search", "user", "", q=q[:40])
        return Response({"users": [user_card(u, brief=len(users) > 1) for u in users]})


def user_card(u, brief=False) -> dict:
    from apps.missions.models import MysteryRun  # pylint: disable=import-outside-toplevel
    from apps.ops.views_money import _withdrawal_row, withdrawals  # pylint: disable=import-outside-toplevel
    from apps.wallet.models import BankAccount  # pylint: disable=import-outside-toplevel
    from apps.wallet.models.transactions.activity import ActivityTransaction  # pylint: disable=import-outside-toplevel
    from apps.wallet.services import balance  # pylint: disable=import-outside-toplevel

    c = getattr(u, "customer", None)
    card = {
        "id": str(u.pk),
        "phone": "0" + u.phone_number if u.phone_number else "",
        "name": u.username or "",
        "joined": u.create_time.isoformat(),
        "last_active": c.last_active_date.isoformat() if c and c.last_active_date else None,
        "active": u.is_active,
        "staff": roles.can_sign_in(u),
    }
    if brief or c is None:
        return card
    points = balance.points_account(u)
    cash = balance.currency_account(u)
    card.update(
        points=int(points.amount) if points else 0,
        cash=int(cash.balance) if cash else 0,
        streak=c.consecutive_active_days,
        recent=[
            {"at": t.create_time.isoformat(), "section": t.section, "action": t.action_type, "points": t.score_value, "status": t.status}
            for t in ActivityTransaction.objects.filter(customer=c).order_by("-create_time")[:15]
        ],
        games=[
            {"title": r.mystery.title, "status": r.status, "points": r.points_earned, "at": r.create_time.isoformat()}
            for r in MysteryRun.objects.filter(customer=c).select_related("mystery").order_by("-create_time")[:10]
        ],
        withdrawals=[_withdrawal_row(t) for t in withdrawals().filter(bank_account__user=u).order_by("-create_time")[:10]],
        bank_accounts=[
            {"bank": a.bank.name if a.bank_id else "", "iban": a.iban, "holder": a.account_holder, "status": a.status}
            for a in BankAccount.objects.filter(user=u, is_deleted=False).select_related("bank")
        ],
    )
    return card


class MeHomeView(APIView):
    """What needs the signed-in staff member now (by their roles): the home page's to-do."""

    permission_classes = (IsOps,)

    def get(self, request):
        from apps.gamemaster.models import GameVersion  # pylint: disable=import-outside-toplevel
        from apps.wallet.models import BankAccount, CurrencyTransaction  # pylint: disable=import-outside-toplevel

        mine = roles.roles_of(request.user)
        todo = {}
        if "reviewer" in mine:
            todo["games"] = GameVersion.objects.filter(status=GameVersion.Status.SUBMITTED).count()
        if "finance" in mine:
            from apps.ops.views_money import withdrawals  # pylint: disable=import-outside-toplevel

            todo["withdrawals"] = withdrawals().filter(status=CurrencyTransaction.Status.PENDING).count()
            todo["bank_accounts"] = BankAccount.objects.filter(is_deleted=False, status=BankAccount.Status.PENDING).count()
        return Response({"todo": todo, "roles": mine, "owner": roles.is_owner(request.user)})
