"""Sending notifications.

A notification goes out only when the player's switch for its category is on (preferences) and
only to devices the player allowed (push subscriptions, Web Push with VAPID keys). Each one is
logged under a key so retries never repeat it. Sending happens in Celery (tasks.py); callers use
`queue` / `queue_broadcast`, which wait for the surrounding transaction to commit.
"""

import json
import logging
from urllib.parse import urlsplit

from django.conf import settings
from django.db import models
from django.core.exceptions import ValidationError
from django.db import IntegrityError, transaction
from django.utils import timezone

from apps.notifications.models import AppDevice, NotificationLog, NotificationPreference, PushSubscription
from apps.users.models.customer import Customer

logger = logging.getLogger(__name__)


# Where browsers' push services live (Chrome/Opera/Samsung: FCM, Firefox: Mozilla, Edge: WNS, Safari:
# Apple). A subscription's endpoint is sent to the server by the browser, i.e. by the client: only
# these hosts are ever contacted, so it cannot point the server at anything else.
PUSH_HOSTS = ("fcm.googleapis.com",)
PUSH_HOST_SUFFIXES = (".push.services.mozilla.com", ".notify.windows.com", ".push.apple.com")


def is_push_endpoint(url: str) -> bool:
    try:
        parts = urlsplit(url)
    except ValueError:
        return False
    host = (parts.hostname or "").lower()
    if parts.scheme != "https" or parts.port not in (None, 443) or parts.username or parts.password:
        return False
    return host in PUSH_HOSTS or any(host.endswith(s) for s in PUSH_HOST_SUFFIXES)


class TransientPushError(Exception):
    """Every device failed for a reason that may pass (time-out, 5xx): worth retrying later."""


class PartlyDelivered(Exception):
    """Some devices got it and some failed for a reason that may pass: retry only those (the
    others must not get it twice). `retry` is send()'s argument for that retry; `delivered` the
    devices reached this time."""

    def __init__(self, retry: dict, delivered: int):
        super().__init__(f"retry {retry}")
        self.retry = retry
        self.delivered = delivered


PUSHE_URL = "https://api.pushe.co/v2/messaging/rapid/"


def pushe_available() -> bool:
    """The Android app's notifications (Pushe API token + app id from console.pushe.co)."""
    return bool(settings.PUSHE_API_TOKEN and settings.PUSHE_APP_ID)


def _pushe(devices: list[AppDevice], payload: dict) -> str:
    """One Pushe «rapid» (transactional) request for this player's app devices: "ok", "failed"
    (may pass: network, 5xx) or "error" (4xx: configuration)."""
    import requests  # pylint: disable=import-outside-toplevel

    body = {
        "app_id": settings.PUSHE_APP_ID,
        "device_id": [d.device_id for d in devices][:500],
        "data": {"title": payload["title"], "content": payload["body"] or payload["title"], "action": {"action_type": "A"}},
    }
    try:
        r = requests.post(
            PUSHE_URL, json=body, timeout=10,
            headers={"Authorization": f"Token {settings.PUSHE_API_TOKEN}", "Content-Type": "application/json"},
        )
    except requests.RequestException as e:
        logger.warning("Pushe send failed: %s", e)
        return "failed"
    if 200 <= r.status_code < 300:
        AppDevice.objects.filter(pk__in=[d.pk for d in devices]).update(last_sent_at=timezone.now())
        return "ok"
    logger.warning("Pushe answered %s: %s", r.status_code, r.text[:300])
    # 5xx may pass (retried); 4xx is a wrong token/app id/device — retrying would not help.
    return "failed" if r.status_code >= 500 else "error"


def push_available() -> bool:
    return bool(settings.VAPID_PUBLIC_KEY and settings.VAPID_PRIVATE_KEY)


def preferences(customer: Customer) -> NotificationPreference:
    pref, _ = NotificationPreference.objects.get_or_create(customer=customer)
    return pref


def _push(sub: PushSubscription, payload: dict) -> str:
    """"ok", "gone" (the browser dropped it; deleted) or "failed" (may work later)."""
    from pywebpush import WebPushException, webpush  # pylint: disable=import-outside-toplevel

    if not is_push_endpoint(sub.endpoint):
        sub.delete()
        return "gone"

    try:
        webpush(
            subscription_info={"endpoint": sub.endpoint, "keys": {"p256dh": sub.p256dh, "auth": sub.auth}},
            data=json.dumps(payload, ensure_ascii=False),
            vapid_private_key=settings.VAPID_PRIVATE_KEY,
            vapid_claims={"sub": settings.VAPID_SUBJECT},
            ttl=24 * 3600,
            timeout=10,
        )
    except WebPushException as e:
        status = getattr(e.response, "status_code", None)
        if status in (404, 410):
            # The browser dropped this subscription (app removed, permission revoked).
            sub.delete()
            return "gone"
        logger.warning("Web push to %s failed: %s", sub.pk, e)
        return "failed"
    except Exception as e:  # pylint: disable=broad-exception-caught
        logger.warning("Web push to %s failed: %s", sub.pk, e)
        return "failed"
    PushSubscription.objects.filter(pk=sub.pk).update(last_sent_at=timezone.now())
    return "ok"


def send(
    customer: Customer, category: str, title: str, body: str = "", url: str = "/pwa/main", key: str | None = None,
    retry: dict | None = None,
) -> int:
    """Sends now (Celery calls this). Returns the number of devices reached. `retry` (from
    PartlyDelivered) limits a retry to the devices that failed: {"subs": [ids], "pushe": bool}."""
    if not preferences(customer).wants(category):
        return 0
    subs = list(PushSubscription.objects.filter(customer=customer)) if push_available() else []
    devices = list(AppDevice.objects.filter(customer=customer)) if pushe_available() else []
    log = None
    if retry is not None:
        # The key's log row is already there (it holds what was delivered): only the rest.
        subs = [s for s in subs if str(s.pk) in set(retry.get("subs", []))]
        devices = devices if retry.get("pushe") else []
        log = NotificationLog.objects.filter(customer=customer, key=(key or "")[:120]).first() if key else None
    elif key:
        try:
            with transaction.atomic():
                log = NotificationLog.objects.create(
                    customer=customer, category=category, key=key[:120], title=title[:200], body=body[:500], url=url[:300]
                )
        except (IntegrityError, ValidationError):
            # Already sent under this key (save() validates the unique key first; the database
            # constraint catches two senders at the same moment).
            return 0
    if not subs and not devices:
        return 0
    payload = {"title": title, "body": body, "url": url, "tag": key or category}
    results = [_push(sub, payload) for sub in subs]
    failed_subs = [str(sub.pk) for sub, result in zip(subs, results) if result == "failed"]
    pushe_failed = False
    if devices:
        # One request for all the player's phones; it counts once per phone.
        pushe = _pushe(devices, payload)
        pushe_failed = pushe == "failed"
        results += [pushe] * len(devices)
    delivered = results.count("ok")
    if not delivered and "failed" in results and retry is None:
        # Nothing arrived, for a reason that may pass: free the key so a retry sends it.
        if log:
            log.delete()
        raise TransientPushError(f"{results.count('failed')} device(s) failed")
    if log and delivered:
        NotificationLog.objects.filter(pk=log.pk).update(delivered=models.F("delivered") + delivered)
    if failed_subs or pushe_failed:
        # Some got it (or this is already a retry): next time only the ones that failed.
        raise PartlyDelivered({"subs": failed_subs, "pushe": pushe_failed}, delivered)
    return delivered


def queue(customer: Customer, category: str, title: str, body: str = "", url: str = "/pwa/main", key: str | None = None):
    """Sends after the current transaction commits (nothing is sent for a change rolled back)."""
    from apps.notifications.tasks import send_notification  # pylint: disable=import-outside-toplevel

    # robust: the change it reports is already saved; a queue that is down must not turn that into
    # an error for the request (or stop a lottery's other winners from being told).
    transaction.on_commit(lambda: send_notification.delay(str(customer.pk), category, title, body, url, key), robust=True)


def queue_broadcast(category: str, title: str, body: str = "", url: str = "/pwa/main", key: str | None = None):
    """To every player with a device and the category on (new lottery, games news)."""
    from apps.notifications.tasks import broadcast  # pylint: disable=import-outside-toplevel

    transaction.on_commit(lambda: broadcast.delay(category, title, body, url, key), robust=True)


def broadcast_now(category: str, title: str, body: str = "", url: str = "/pwa/main", key: str | None = None) -> int:
    customers = Customer.objects.filter(
        models.Q(push_subscriptions__isnull=False) | models.Q(app_devices__isnull=False)
    ).distinct()
    total = 0
    for customer in customers.iterator():
        retry = None
        try:
            total += send(customer, category, title, body, url, f"{key}:{customer.pk}" if key else None)
            continue
        except PartlyDelivered as e:
            total += e.delivered
            retry = e.retry
        except TransientPushError:
            pass
        # Their key was freed (or only some devices failed): hand them to the retrying task
        # (back-off, up to 5 tries).
        from apps.notifications.tasks import send_notification  # pylint: disable=import-outside-toplevel

        item_key = f"{key}:{customer.pk}" if key else None
        try:
            send_notification.apply_async(
                (str(customer.pk), category, title, body, url, item_key), {"retry": retry}, countdown=60
            )
        except Exception:  # pylint: disable=broad-exception-caught
            logger.warning("Broadcast %s: could not queue a retry for %s", key, customer.pk)
    return total
