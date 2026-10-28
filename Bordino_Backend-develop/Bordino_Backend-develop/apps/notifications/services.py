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
from django.core.exceptions import ValidationError
from django.db import IntegrityError, transaction
from django.utils import timezone

from apps.notifications.models import NotificationLog, NotificationPreference, PushSubscription
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


def send(customer: Customer, category: str, title: str, body: str = "", url: str = "/pwa/main", key: str | None = None) -> int:
    """Sends now (Celery calls this). Returns the number of devices reached."""
    if not preferences(customer).wants(category):
        return 0
    subs = list(PushSubscription.objects.filter(customer=customer))
    log = None
    if key:
        try:
            with transaction.atomic():
                log = NotificationLog.objects.create(
                    customer=customer, category=category, key=key[:120], title=title[:200], body=body[:500], url=url[:300]
                )
        except (IntegrityError, ValidationError):
            # Already sent under this key (save() validates the unique key first; the database
            # constraint catches two senders at the same moment).
            return 0
    if not subs or not push_available():
        return 0
    payload = {"title": title, "body": body, "url": url, "tag": key or category}
    results = [_push(sub, payload) for sub in subs]
    delivered = results.count("ok")
    if not delivered and "failed" in results:
        # Nothing arrived, for a reason that may pass: free the key so a retry sends it.
        if log:
            log.delete()
        raise TransientPushError(f"{results.count('failed')} device(s) failed")
    if log:
        NotificationLog.objects.filter(pk=log.pk).update(delivered=delivered)
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
    customers = Customer.objects.filter(push_subscriptions__isnull=False).distinct()
    total = 0
    for customer in customers.iterator():
        try:
            total += send(customer, category, title, body, url, f"{key}:{customer.pk}" if key else None)
        except TransientPushError:
            logger.warning("Broadcast %s: nothing delivered to %s this time", key, customer.pk)
    return total
