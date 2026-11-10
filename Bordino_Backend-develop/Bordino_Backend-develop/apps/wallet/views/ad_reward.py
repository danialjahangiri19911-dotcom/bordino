import hmac
import logging
import random
from datetime import timedelta

from django.utils import timezone

from rest_framework import serializers, status
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework.throttling import AnonRateThrottle
from rest_framework.response import Response
from rest_framework.views import APIView

from drf_spectacular.utils import extend_schema

from apps.wallet.models import AdiveryCallbackAttempt
from apps.wallet.services import ad_reward
from apps.wallet.services.balance import points_account

logger = logging.getLogger(__name__)
KEEP_ATTEMPTS = timedelta(days=90)


def _customer(request):
    return getattr(request.user, "customer", None)


def _offer_body(o: ad_reward.Offer):
    return {
        "available": o.available,
        "reward_points": o.reward_points,
        "remaining_today": o.remaining_today,
        "provider": o.provider,
        "creative": o.creative,
    }


class AdRewardOfferView(APIView):
    """Whether a rewarded video can be offered now, for how many points, and what to play."""

    permission_classes = (IsAuthenticated,)

    @extend_schema(tags=["wallet"], summary="Rewarded ad offer")
    def get(self, request):
        customer = _customer(request)
        if customer is None:
            return Response({"available": False}, status=status.HTTP_200_OK)
        return Response(_offer_body(ad_reward.offer(customer)))


class AdRewardStartSerializer(serializers.Serializer):
    placement = serializers.CharField(max_length=50, required=False, allow_blank=True)


class AdRewardStartView(APIView):
    permission_classes = (IsAuthenticated,)

    @extend_schema(tags=["wallet"], summary="Start a rewarded ad view", request=AdRewardStartSerializer)
    def post(self, request):
        customer = _customer(request)
        if customer is None:
            return Response({"error": "No customer profile"}, status=status.HTTP_400_BAD_REQUEST)
        data = AdRewardStartSerializer(data=request.data)
        data.is_valid(raise_exception=True)
        try:
            session = ad_reward.start(customer, data.validated_data.get("placement", ""))
        except ad_reward.AdRewardError as e:
            return Response({"error": str(e)}, status=status.HTTP_409_CONFLICT)
        return Response(
            {
                "session_id": str(session.pk),
                "reward_points": session.reward_points,
                "min_watch_seconds": session.min_watch_seconds,
                "provider": session.provider,
                "creative": ad_reward.PROVIDERS[session.provider].creative(),
            },
            status=status.HTTP_201_CREATED,
        )


class AdRewardCompleteView(APIView):
    """Claims the reward of a watched ad. Repeating the claim pays nothing more."""

    permission_classes = (IsAuthenticated,)

    @extend_schema(tags=["wallet"], summary="Claim a rewarded ad view")
    def post(self, request, session_id):
        customer = _customer(request)
        if customer is None:
            return Response({"error": "No customer profile"}, status=status.HTTP_400_BAD_REQUEST)
        try:
            claim = ad_reward.complete(customer, session_id, request.data if isinstance(request.data, dict) else {})
        except ad_reward.AdRewardError as e:
            return Response({"error": str(e), "code": e.code}, status=status.HTTP_409_CONFLICT)
        account = points_account(request.user)
        return Response(
            {
                "rewarded": True,
                "already_rewarded": claim.already,
                "reward_points": claim.session.reward_points,
                "points_balance": int(account.amount) if account else None,
            }
        )


class AdiveryCallbackThrottle(AnonRateThrottle):
    scope = "adivery_callback"
    rate = "300/min"


def _received(request) -> dict:
    """What the caller sent, from the address and the body: names and (shortened) values, at most 20."""
    out: dict = {}
    sources = [request.query_params]
    try:
        if hasattr(request.data, "items"):
            sources.append(request.data)
    except Exception:  # pylint: disable=broad-except
        out["(body)"] = "unreadable"
    for source in sources:
        for key in list(source.keys())[:20]:
            if len(out) >= 20:
                break
            value = source.get(key)
            out[str(key)[:40]] = str(value)[:120] if value is not None else None
    return out


def record_attempt(request, secret, outcome, http, message=""):
    """One row per call to the confirmation address (and a log line). Never in the way: a failure to
    record is only logged."""
    try:
        secret_ok = hmac.compare_digest(str(secret or "").encode("utf-8", "replace"), ad_reward.adivery_callback_secret().encode())
        received = _received(request)
        from apps.ops.auth import client_ip  # pylint: disable=import-outside-toplevel

        AdiveryCallbackAttempt.objects.create(
            method=request.method[:8],
            ip=(client_ip(request) or "")[:64],
            secret_ok=secret_ok,
            params=received,
            session_ref=str(received.get("uid") or "")[:100],
            outcome=outcome,
            http_status=http,
            message=str(message or "")[:200],
        )
        logger.info("Adivery callback %s secret_ok=%s -> %s %s params=%s", request.method, secret_ok, http, outcome, sorted(received))
        if random.random() < 0.02:  # (now and then: what is older than 90 days goes)
            AdiveryCallbackAttempt.objects.filter(create_time__lt=timezone.now() - KEEP_ATTEMPTS).delete()
    except Exception:  # pylint: disable=broad-except
        logger.exception("Adivery callback attempt not recorded")


class AdiveryCallbackView(APIView):
    """Adivery's server: «this view earned its reward» (uid = our session id, pid = placement,
    eid = its unique event id). The address carries a secret; it is entered in the Adivery panel."""

    authentication_classes = ()
    permission_classes = (AllowAny,)
    throttle_classes = (AdiveryCallbackThrottle,)

    def _handle(self, request, secret):
        params = request.query_params
        outcome, message, http = AdiveryCallbackAttempt.Outcome.ERROR, "", 500
        try:
            result = ad_reward.adivery_callback(secret, params.get("uid", ""), params.get("pid", ""), params.get("eid", ""))
        except ad_reward.AdRewardError as e:
            http = {"not_found": status.HTTP_404_NOT_FOUND, "conflict": status.HTTP_409_CONFLICT}.get(e.code, status.HTTP_400_BAD_REQUEST)
            outcome, message = AdiveryCallbackAttempt.Outcome.REFUSED, str(e)
            return Response({"ok": False, "error": str(e)}, status=http)
        else:
            http = 200
            outcome = (
                AdiveryCallbackAttempt.Outcome.ALREADY
                if result.already
                else AdiveryCallbackAttempt.Outcome.PAID if result.paid else AdiveryCallbackAttempt.Outcome.NOT_PAID
            )
            message = result.reason
            # 200 also when verified but not paid (the day's limit): Adivery need not try again.
            return Response({"ok": True, "paid": result.paid, "already": result.already})
        finally:
            record_attempt(request, secret, outcome, http, message)

    @extend_schema(tags=["wallet"], summary="Adivery reward confirmation (server to server)")
    def get(self, request, secret):
        return self._handle(request, secret)

    @extend_schema(tags=["wallet"], summary="Adivery reward confirmation (server to server)")
    def post(self, request, secret):
        return self._handle(request, secret)
