"""Rewarded video before a game.

The app shows an offer, starts a session here, plays the ad and asks for the reward. The reward is
decided here, never by the app: the session's provider checks the completion, and the points are
paid once per session (ActivityTransaction is unique per customer/section/action) and at most
AD_REWARD_DAILY_LIMIT times a day.

Providers are pluggable. «demo» plays a sample video and can only check time on the server (the
reward needs at least the video's length between start and claim). «adivery» (the Adivery SDK in
the Android app) is paid only after Adivery's server calls ours for the view (adivery_callback);
switching is the AD_REWARD_PROVIDER setting.
"""

import hashlib
import hmac
import logging
import uuid

from dataclasses import dataclass
from datetime import timedelta
from zoneinfo import ZoneInfo

from django.db import transaction
from django.utils import timezone

from apps.configuration.models.system_configuration import SystemConfiguration
from apps.users.models.customer import Customer
from apps.wallet.models.ad_reward_session import AdRewardSession
from apps.wallet.models.transactions.activity import ActivityTransaction

SECTION = "rewarded_ad"
SESSION_TTL = timedelta(minutes=15)

# Configuration keys (admin → System configurations; env vars of the same name; else these).
DEFAULTS = {
    "AD_REWARD_ENABLED": True,
    "AD_REWARD_PROVIDER": "demo",
    "AD_REWARD_POINTS": 5,
    "AD_REWARD_DAILY_LIMIT": 5,
    "AD_DEMO_VIDEO_URL": "/bd/ads/demo-ad.mp4",
    "AD_DEMO_SECONDS": 15,
    # Adivery (docs.adivery.com): the app's id and its «جایزه‌ای» (rewarded) placement.
    "ADIVERY_APP_ID": "ce7eba05-cd4e-4fa6-aa35-15ad352795ee",
    "ADIVERY_REWARDED_PLACEMENT_ID": "e7e3f382-c0d7-4b9b-b754-b06e5ee5fac1",
    # The full-screen («میان‌صفحه‌ای») placement of the «دیدن تبلیغ تمام‌صفحه» missions. Adivery confirms
    # only rewarded views to our server: these are paid like a banner (shown, then a wait).
    "ADIVERY_INTERSTITIAL_PLACEMENT_ID": "f720b85e-b057-4f06-9ca8-77a83824568b",
    # Until Adivery calls our confirmation address (set by Adivery for the placement): trust the
    # app's «watched» after this many seconds — as safe as the demo, within the same daily limit.
    "ADIVERY_TRUST_APP": False,
    "ADIVERY_TRUST_SECONDS": 5,
}

logger = logging.getLogger(__name__)


def setting(key: str):
    return SystemConfiguration.objects.get(key, DEFAULTS[key])


class AdRewardError(Exception):
    """Refused, with a message for the player. `code` "pending": not confirmed yet, ask again."""

    def __init__(self, message: str = "", code: str = "invalid"):
        super().__init__(message)
        self.code = code


class AdProvider:
    name = ""

    def creative(self, customer: Customer | None = None) -> dict:  # pylint: disable=unused-argument
        """What the app needs to show the ad (a video address, or the SDK's placement id)."""
        raise NotImplementedError

    def watch_seconds(self) -> int:
        raise NotImplementedError

    def verify(self, session: AdRewardSession, evidence: dict) -> bool:
        """True when the ad was really watched to the end."""
        raise NotImplementedError


class DemoVideoProvider(AdProvider):
    """Development stand-in: a sample video served by the app itself. Nothing signs its end, so the
    only proof is time: the claim must come at least the video's length after the start."""

    name = "demo"

    def watch_seconds(self) -> int:
        return max(1, int(setting("AD_DEMO_SECONDS")))

    def creative(self, customer: Customer | None = None) -> dict:  # pylint: disable=unused-argument
        return {"video_url": setting("AD_DEMO_VIDEO_URL"), "seconds": self.watch_seconds(), "demo": True}

    def verify(self, session, evidence):
        # Both times are the server's: the whole length must have passed.
        elapsed = (timezone.now() - session.create_time).total_seconds()
        return elapsed >= session.min_watch_seconds


class AdiveryProvider(AdProvider):
    """The Adivery SDK in the Android app. The app tells the SDK this session's id (setUserId);
    after a full view Adivery's server calls adivery_callback with it, and only that call verifies
    the session: the app's own «I watched it» is never enough."""

    name = "adivery"

    def watch_seconds(self) -> int:
        return 1

    def creative(self, customer: Customer | None = None) -> dict:
        out = {"app_id": setting("ADIVERY_APP_ID"), "placement_id": setting("ADIVERY_REWARDED_PLACEMENT_ID")}
        if customer is not None:
            # What the app gives the SDK as its user id (see player_ref): Adivery's server sends it
            # back with each confirmed view.
            out["user_ref"] = player_ref(customer)
        return out

    def ready(self) -> bool:
        return bool(setting("ADIVERY_APP_ID")) and bool(setting("ADIVERY_REWARDED_PLACEMENT_ID"))

    def verify(self, session, evidence):
        if session.verified_at is not None:
            return True
        if str(setting("ADIVERY_TRUST_APP")).strip().lower() in ("true", "1", "yes", "on"):
            elapsed = (timezone.now() - session.create_time).total_seconds()
            return elapsed >= max(1, int(setting("ADIVERY_TRUST_SECONDS")))
        return False


PROVIDERS: dict[str, AdProvider] = {DemoVideoProvider.name: DemoVideoProvider(), AdiveryProvider.name: AdiveryProvider()}


def provider() -> AdProvider | None:
    # An unknown name (a typo, or the real SDK's provider not deployed yet) offers nothing rather
    # than quietly paying through the demo; so does Adivery before its placement is set.
    p = PROVIDERS.get(str(setting("AD_REWARD_PROVIDER")))
    if p is not None and not getattr(p, "ready", lambda: True)():
        return None
    return p


# The players' day (the server's clock is UTC): limits reset at midnight in Tehran.
DAY_ZONE = ZoneInfo("Asia/Tehran")


def today():
    return timezone.localtime(timezone=DAY_ZONE).date()


def _rewarded_today(customer: Customer) -> int:
    start = timezone.localtime(timezone=DAY_ZONE).replace(hour=0, minute=0, second=0, microsecond=0)
    return AdRewardSession.objects.filter(
        customer=customer, status=AdRewardSession.Status.REWARDED, completed_at__gte=start
    ).count()


@dataclass
class Offer:
    available: bool
    reward_points: int
    remaining_today: int
    provider: str
    creative: dict


def offer(customer: Customer) -> Offer:
    p = provider()
    if p is None:
        return Offer(False, 0, 0, "", {})
    limit = max(0, int(setting("AD_REWARD_DAILY_LIMIT")))
    remaining = max(0, limit - _rewarded_today(customer))
    points = max(0, int(setting("AD_REWARD_POINTS")))
    available = bool(setting("AD_REWARD_ENABLED")) and remaining > 0 and points > 0
    return Offer(available, points, remaining, p.name, p.creative(customer) if available else {})


def start(customer: Customer, placement: str, points: int | None = None) -> AdRewardSession:
    """`points` overrides the configured reward (a video mission pays its own amount); the daily
    limit is the same for every rewarded video."""
    o = offer(customer)
    if not o.available:
        raise AdRewardError("فعلاً ویدیوی جایزه‌داری نیست؛ سقف امروز پر شده یا این بخش خاموش است.")
    p = PROVIDERS[o.provider]
    return AdRewardSession.objects.create(
        customer=customer,
        provider=p.name,
        placement=(placement or "")[:50],
        reward_points=o.reward_points if points is None else points,
        min_watch_seconds=p.watch_seconds(),
    )


@dataclass
class Claim:
    session: AdRewardSession
    already: bool


def complete(customer: Customer, session_id, evidence: dict | None = None, mission: bool = False) -> Claim:
    """`mission`: the call comes from the missions service. A mission's video (its own points and
    daily limit) is paid only there, never through the plain rewarded-ad endpoint."""
    with transaction.atomic():
        # One claim at a time per player: two sessions claimed together must not both pass the
        # daily limit, and the same session claimed twice pays once.
        Customer.objects.select_for_update(no_key=True).filter(pk=customer.pk).first()
        session = (
            AdRewardSession.objects.select_for_update()
            .filter(pk=session_id, customer=customer)
            .first()
        )
        if session is None:
            raise AdRewardError("این ویدیو پیدا نشد.")
        if session.placement.startswith("mission:") and not mission:
            raise AdRewardError("این ویدیو از بخش «دریافت امتیاز» پرداخت می‌شود.")
        if session.status == AdRewardSession.Status.REWARDED:
            return Claim(session, already=True)
        if timezone.now() - session.create_time > SESSION_TTL:
            raise AdRewardError("زمان این ویدیو گذشته است؛ دوباره امتحان کن.")
        if not PROVIDERS[session.provider].verify(session, evidence or {}):
            if session.provider == AdiveryProvider.name:
                raise AdRewardError("در انتظار تأیید ادیوری…", "pending")
            raise AdRewardError("جایزه بعد از تماشای کامل ویدیو داده می‌شود.")
        if _rewarded_today(customer) >= int(setting("AD_REWARD_DAILY_LIMIT")):
            raise AdRewardError("سقف ویدیوهای جایزه‌دار امروز پر شده است.")
        # The points reach the points wallet through the ActivityTransaction post_save signal.
        session.activity_transaction = ActivityTransaction.objects.create(
            customer=customer,
            section=SECTION,
            action_type=f"ad:{session.pk}",
            score_value=session.reward_points,
            reward_data={"score": session.reward_points},
            metadata={"provider": session.provider, "placement": session.placement},
            status=ActivityTransaction.Status.COMPLETED,
            description=f"Rewarded ad ({session.provider}) before {session.placement or 'a game'}",
        )
        session.status = AdRewardSession.Status.REWARDED
        session.completed_at = timezone.now()
        session.save(update_fields=["activity_transaction", "status", "completed_at", "update_time"])
        return Claim(session, already=False)


# ── Adivery's server-to-server confirmation (docs.adivery.com/server) ──

# Which id Adivery sends back: the SDK puts the id set by setUserId into the request that LOADS an ad
# (fetch.adivery.com/api/v1/ads, read from SDK 4.9.0), not into the showing of it. The app loads the
# next ad ahead of the tap (and the SDK reloads after each view), so a per-view id would always be the
# previous view's, or none. The id is therefore the PLAYER's (signed, opaque): a confirmation pays
# that player's latest view still waiting for it.


def _player_mac(hex_pk: str) -> str:
    from django.conf import settings  # pylint: disable=import-outside-toplevel

    return hmac.new(settings.SECRET_KEY.encode(), f"adivery-player:{hex_pk}".encode(), hashlib.sha256).hexdigest()[:16]


def player_ref(customer: Customer) -> str:
    """The player's id for Adivery: «<customer id hex>-<signature>» (only [0-9a-f-]: nothing Adivery
    could mangle; it says nothing about the player without our key)."""
    hex_pk = uuid.UUID(str(customer.pk)).hex
    return f"{hex_pk}-{_player_mac(hex_pk)}"


def _player_from_ref(ref: str) -> Customer | None:
    hex_pk, _sep, mac = str(ref or "").partition("-")
    if len(hex_pk) != 32 or len(mac) != 16 or not hmac.compare_digest(mac, _player_mac(hex_pk)):
        return None
    try:
        return Customer.objects.filter(pk=uuid.UUID(hex_pk)).first()
    except ValueError:
        return None



def adivery_callback_secret() -> str:
    """The secret part of the callback address entered in the Adivery panel (derived from the
    site's SECRET_KEY: nothing to store, the same on every server process)."""
    from django.conf import settings  # pylint: disable=import-outside-toplevel

    return hmac.new(settings.SECRET_KEY.encode(), b"adivery-reward-callback", hashlib.sha256).hexdigest()[:40]


@dataclass
class Callback:
    paid: bool
    already: bool
    reason: str = ""


def adivery_callback(secret: str, uid: str, pid: str, eid: str) -> Callback:
    """Adivery says the view of session `uid` on placement `pid` earned its reward (event `eid`,
    unique; Adivery may repeat the call). Verifies the session, then pays it — through the
    mission when the video was a mission's — once."""
    if not hmac.compare_digest(str(secret or "").encode("utf-8", "replace"), adivery_callback_secret().encode()):
        raise AdRewardError("not found", "not_found")
    if not eid or len(eid) > 100:
        raise AdRewardError("bad event id")
    if str(pid or "") != str(setting("ADIVERY_REWARDED_PLACEMENT_ID") or "-"):
        raise AdRewardError("unknown placement")
    player = _player_from_ref(uid)
    session_id = None
    if player is None:
        # (the earlier form: the view's own id)
        try:
            session_id = uuid.UUID(str(uid))
        except ValueError as exc:
            raise AdRewardError("bad user id") from exc
    with transaction.atomic():
        if player is not None:
            # One match at a time per player (two confirmations must not pick the same view).
            Customer.objects.select_for_update(no_key=True).filter(pk=player.pk).first()
            # A repeat of a confirmation already applied: the same view.
            session = AdRewardSession.objects.select_for_update().filter(external_event_id=eid, provider=AdiveryProvider.name).first()
            if session is not None and session.customer_id != player.pk:
                raise AdRewardError("event already used", "conflict")
            if session is None:
                # The player's latest view still waiting for Adivery (one ad shows at a time; older
                # unfinished ones were left).
                session = (
                    AdRewardSession.objects.select_for_update()
                    .filter(
                        customer=player,
                        provider=AdiveryProvider.name,
                        verified_at__isnull=True,
                        create_time__gte=timezone.now() - SESSION_TTL,
                    )
                    .order_by("-create_time")
                    .first()
                )
            if session is None:
                raise AdRewardError("no view of this player is waiting", "not_found")
        else:
            session = (
                AdRewardSession.objects.select_for_update()
                .filter(pk=session_id, provider=AdiveryProvider.name)
                .first()
            )
        if session is None:
            raise AdRewardError("unknown session", "not_found")
        if session.external_event_id and session.external_event_id != eid:
            raise AdRewardError("session already confirmed by another event", "conflict")
        if AdRewardSession.objects.filter(external_event_id=eid).exclude(pk=session.pk).exists():
            raise AdRewardError("event already used", "conflict")
        if session.verified_at is None:
            session.external_event_id = eid
            session.verified_at = timezone.now()
            session.save(update_fields=["external_event_id", "verified_at", "update_time"])
        customer = session.customer
        mission_attempt = getattr(session, "mission_attempt", None) if session.placement.startswith("mission:") else None
    # Paid as the app would claim it (each path pays once and keeps its own limits).
    from apps.missions import services as missions  # pylint: disable=import-outside-toplevel

    try:
        if mission_attempt is not None:
            result = missions.claim(customer, mission_attempt.pk)
            return Callback(paid=True, already=result.already)
        result = complete(customer, session.pk)
        return Callback(paid=True, already=result.already)
    except (AdRewardError, missions.MissionError) as exc:
        # A rule says no (the day's limit, an old session...): recorded, final — not retried.
        logger.warning("Adivery reward for session %s not paid: %s", session.pk, exc)
        return Callback(paid=False, already=False, reason=str(exc))
    # Anything else (a database hiccup) is not caught: the answer is an error, Adivery calls again,
    # and the already-recorded confirmation pays then (once).


def interstitial_creative() -> dict | None:
    """What the app needs to show a full-screen ad (Adivery SDK), or None when none is set up."""
    app_id, placement = setting("ADIVERY_APP_ID"), setting("ADIVERY_INTERSTITIAL_PLACEMENT_ID")
    if not app_id or not placement:
        return None
    return {"app_id": app_id, "placement_id": placement}
