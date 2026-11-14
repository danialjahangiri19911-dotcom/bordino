import json
import logging
import random
from datetime import timedelta

from django.db import transaction
from django.utils import timezone

from apps.clientlog.models import ClientLog

logger = logging.getLogger("clientlog")
KEEP_DAYS = 30
MAX_DATA = 4000  # characters of JSON per step


def _clean(data) -> dict:
    if not isinstance(data, dict):
        return {}
    text = json.dumps(data, ensure_ascii=False, default=str)
    if len(text) > MAX_DATA:
        return {"_cut": text[:MAX_DATA]}
    return json.loads(text)


def record(user, flow: str, step: str, *, attempt: str = "", level: str = "info", data=None, source: str = "server",
           user_agent: str = "", ip=None, client_time=None) -> ClientLog | None:
    """One step, also written to the server log (docker logs) so a trace survives even without the database."""
    phone = getattr(user, "phone_number", "") or ""
    # The server log first: it survives a request whose database work is rolled back.
    (logger.warning if level == "error" else logger.info)(
        "clientlog %s %s %s/%s attempt=%s %s", source, phone, flow, step, attempt, json.dumps(_clean(data or {}), ensure_ascii=False, default=str)[:600]
    )
    try:
        # (its own savepoint: a failed write never breaks the caller's transaction)
        with transaction.atomic():
            return _save(user, phone, flow, step, attempt, level, data, source, user_agent, ip, client_time)
    except Exception:  # pylint: disable=broad-except  (tracing must never break what it traces)
        logger.exception("clientlog: could not store %s/%s", flow, step)
        return None


def _save(user, phone, flow, step, attempt, level, data, source, user_agent, ip, client_time):
    row = ClientLog.objects.create(
        user=user if getattr(user, "is_authenticated", False) else None,
        phone=phone[:20],
        flow=str(flow or "")[:40],
        attempt=str(attempt or "")[:40],
        step=str(step or "")[:60],
        level=level if level in ("info", "error") else "info",
        source=source[:10],
        data=_clean(data or {}),
        user_agent=(user_agent or "")[:300],
        ip=ip,
        client_time=client_time,
    )
    if random.random() < 0.01:  # (now and then: the old ones go)
        ClientLog.objects.filter(create_time__lt=timezone.now() - timedelta(days=KEEP_DAYS)).delete()
    return row
