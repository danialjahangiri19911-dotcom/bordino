"""Rewarded video before a game.

The app shows an offer, starts a session here, plays the ad and asks for the reward. The reward is
decided here, never by the app: the session's provider checks the completion, and the points are
paid once per session (ActivityTransaction is unique per customer/section/action) and at most
AD_REWARD_DAILY_LIMIT times a day.

Providers are pluggable. «demo» plays a sample video and can only check time on the server (the
reward needs at least the video's length between start and claim). The real ad SDK (AdDelivery)
gets its own provider whose verify() checks the network's signed server-to-server completion
callback; switching is the AD_REWARD_PROVIDER setting.
"""

from dataclasses import dataclass
from datetime import timedelta

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
}


def setting(key: str):
    return SystemConfiguration.objects.get(key, DEFAULTS[key])


class AdRewardError(Exception):
    """Refused, with a message for the player."""


class AdProvider:
    name = ""

    def creative(self) -> dict:
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

    def creative(self) -> dict:
        return {"video_url": setting("AD_DEMO_VIDEO_URL"), "seconds": self.watch_seconds(), "demo": True}

    def verify(self, session, evidence):
        # Both times are the server's: the whole length must have passed.
        elapsed = (timezone.now() - session.create_time).total_seconds()
        return elapsed >= session.min_watch_seconds


PROVIDERS: dict[str, AdProvider] = {DemoVideoProvider.name: DemoVideoProvider()}


def provider() -> AdProvider | None:
    # An unknown name (a typo, or the real SDK's provider not deployed yet) offers nothing rather
    # than quietly paying through the demo.
    return PROVIDERS.get(str(setting("AD_REWARD_PROVIDER")))


def _rewarded_today(customer: Customer) -> int:
    start = timezone.localtime().replace(hour=0, minute=0, second=0, microsecond=0)
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
    return Offer(available, points, remaining, p.name, p.creative() if available else {})


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


def complete(customer: Customer, session_id, evidence: dict | None = None) -> Claim:
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
        if session.status == AdRewardSession.Status.REWARDED:
            return Claim(session, already=True)
        if timezone.now() - session.create_time > SESSION_TTL:
            raise AdRewardError("زمان این ویدیو گذشته است؛ دوباره امتحان کن.")
        if not PROVIDERS[session.provider].verify(session, evidence or {}):
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
