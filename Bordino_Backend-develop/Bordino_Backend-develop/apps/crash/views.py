import asyncio
import re

from asgiref.sync import sync_to_async
from django.http import JsonResponse
from django.utils import timezone
from django.views.decorators.http import require_GET
from rest_framework import serializers, status
from rest_framework.exceptions import AuthenticationFailed
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.throttling import UserRateThrottle
from rest_framework.views import APIView
from rest_framework_simplejwt.authentication import JWTAuthentication
from rest_framework_simplejwt.exceptions import InvalidToken

from drf_spectacular.utils import extend_schema

from apps.crash.models import (
    CHICKEN_DIFFICULTIES,
    ChickenConfiguration,
    ChickenRound,
    CrashConfiguration,
    CrashRound,
)
from apps.crash.services import chicken, fair, rounds
from apps.django_helper.drf.responses.standard import StandardResponse

HISTORY_SIZE = 20
# The long-poll answers at the crash or after this many seconds, whichever comes first.
WAIT_MAX_SECONDS = 20


class CrashThrottle(UserRateThrottle):
    scope = "crash"
    rate = "240/min"


def _error(exc: rounds.CrashError):
    if isinstance(exc, rounds.RoundNotFound):
        code = status.HTTP_404_NOT_FOUND
    elif isinstance(exc, rounds.StaleRound):
        code = status.HTTP_409_CONFLICT
    else:
        code = status.HTTP_400_BAD_REQUEST
    return Response({"error": exc.message}, status=code)


class BetSerializer(serializers.Serializer):
    bet = serializers.IntegerField(min_value=1)
    auto_cashout = serializers.DecimalField(
        max_digits=10, decimal_places=2, required=False, allow_null=True
    )


class SeedSerializer(serializers.Serializer):
    client_seed = serializers.CharField(min_length=1, max_length=64)

    def validate_client_seed(self, value):
        if not re.fullmatch(r"[A-Za-z0-9_-]+", value):
            raise serializers.ValidationError("فقط حروف انگلیسی، عدد، - و _ مجاز است.")
        return value


class CrashConfigView(APIView):
    """Limits, the player's seed and balance, and any round still running (to resume it)."""

    permission_classes = (IsAuthenticated,)

    @extend_schema(tags=["crash"], summary="Crash game config and player state")
    def get(self, request):
        try:
            customer = rounds.customer_for(request.user)
        except rounds.CrashError as exc:
            return _error(exc)
        now = timezone.now()
        rounds.settle_due(customer=customer, now=now)
        config = CrashConfiguration.current()
        seed = rounds.seed_for(customer)
        account = rounds.points_account(request.user)
        active = CrashRound.objects.filter(
            customer=customer, status=CrashRound.Status.ACTIVE
        ).first()
        return Response(
            {
                "enabled": config.enabled,
                "min_bet": config.min_bet,
                "max_bet": config.max_bet,
                "max_payout": config.max_payout,
                "house_edge": str(config.house_edge),
                "max_multiplier": str(config.max_multiplier),
                "growth_per_ms": fair.GROWTH_PER_MS,
                "start_delay_ms": fair.START_DELAY_MS,
                "client_seed": seed.client_seed,
                "next_nonce": seed.next_nonce,
                "balance": account.amount if account else 0,
                "active_round": rounds.round_payload(active, now) if active else None,
                "server_time": now.isoformat(),
            }
        )


class CrashRoundsView(APIView):
    permission_classes = (IsAuthenticated,)

    def get_throttles(self):
        return [CrashThrottle()] if self.request.method == "POST" else []

    @extend_schema(tags=["crash"], summary="The player's recent crash rounds")
    def get(self, request):
        try:
            customer = rounds.customer_for(request.user)
        except rounds.CrashError as exc:
            return _error(exc)
        now = timezone.now()
        rounds.settle_due(customer=customer, now=now)
        recent = CrashRound.objects.filter(customer=customer).order_by("-create_time")[
            :HISTORY_SIZE
        ]
        return Response(
            {
                "results": [rounds.round_payload(r, now) for r in recent],
                "server_time": now.isoformat(),
            }
        )

    @extend_schema(tags=["crash"], summary="Place a bet (starts a round)", request=BetSerializer)
    def post(self, request):
        serializer = BetSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        try:
            round_, balance = rounds.place_bet(
                request.user,
                serializer.validated_data["bet"],
                serializer.validated_data.get("auto_cashout"),
            )
        except rounds.CrashError as exc:
            return _error(exc)
        now = timezone.now()
        return Response(
            {
                "round": rounds.round_payload(round_, now),
                "balance": balance,
                "server_time": now.isoformat(),
            },
            status=status.HTTP_201_CREATED,
        )


class CrashCashoutView(APIView):
    permission_classes = (IsAuthenticated,)
    throttle_classes = (CrashThrottle,)

    @extend_schema(tags=["crash"], summary="Cash out the running round")
    def post(self, request, round_id):
        try:
            round_ = rounds.cash_out(request.user, round_id)
        except rounds.CrashError as exc:
            return _error(exc)
        account = rounds.points_account(request.user)
        now = timezone.now()
        return Response(
            {
                "round": rounds.round_payload(round_, now),
                "balance": account.amount if account else 0,
                "server_time": now.isoformat(),
            }
        )


class CrashSeedView(APIView):
    permission_classes = (IsAuthenticated,)
    throttle_classes = (CrashThrottle,)

    @extend_schema(tags=["crash"], summary="Change the client seed", request=SeedSerializer)
    def post(self, request):
        serializer = SeedSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        try:
            customer = rounds.customer_for(request.user)
        except rounds.CrashError as exc:
            return _error(exc)
        seed = rounds.seed_for(customer)
        seed.client_seed = serializer.validated_data["client_seed"]
        seed.save(update_fields=["client_seed", "update_time"])
        return Response({"client_seed": seed.client_seed, "next_nonce": seed.next_nonce})


def _json(status_code, data):
    return JsonResponse(StandardResponse(status_code, data).generate_body(), status=status_code)


def _authenticate(request):
    try:
        result = JWTAuthentication().authenticate(request)
    except (AuthenticationFailed, InvalidToken):
        return None
    return result[0] if result else None


def _round_state(user, round_id):
    try:
        round_ = rounds.get_round(user, round_id)
    except rounds.CrashError:
        return None
    now = timezone.now()
    return round_, {
        "round": rounds.round_payload(round_, now),
        "balance": getattr(rounds.points_account(user), "amount", 0),
        "server_time": now.isoformat(),
    }


@require_GET
async def round_wait_view(request, round_id):
    """Long-poll: answers when the round wins on its own, when its curve reaches the crash
    point, at once when its status differs from `?seen=`, or after 20 s — whichever is first.

    Async so a waiting player holds no worker thread; the crash point is only in the answer
    once the crash has happened.
    """
    user = await sync_to_async(_authenticate)(request)
    if user is None:
        return _json(401, {"detail": "Authentication credentials were not provided."})

    state = await sync_to_async(_round_state)(user, round_id)
    if state is None:
        return _json(404, {"error": "دست پیدا نشد."})
    round_, _ = state

    # `seen` = the status on the player's screen. A different one (e.g. an auto cash-out that won
    # while this request was on its way) is news: answer now instead of sleeping to the crash.
    seen = request.GET.get("seen")
    delay = (rounds.wake_at(round_) - timezone.now()).total_seconds()
    if seen and seen != round_.status:
        delay = 0
    if delay > 0:
        # A few ms of slack so the reveal check never runs just before the crash instant.
        await asyncio.sleep(min(delay + 0.02, WAIT_MAX_SECONDS))
        state = await sync_to_async(_round_state)(user, round_id)
        if state is None:
            return _json(404, {"error": "دست پیدا نشد."})
    return _json(200, state[1])


# ---- Chicken (مرغ فراری) ------------------------------------------------------------------


class ChickenBetSerializer(serializers.Serializer):
    bet = serializers.IntegerField(min_value=1)
    difficulty = serializers.ChoiceField(choices=CHICKEN_DIFFICULTIES)


class ChickenStepSerializer(serializers.Serializer):
    # Absent = one lane; a lane number = cross up to it and cash out there (Go Max = last lane).
    to = serializers.IntegerField(min_value=1, required=False, allow_null=True)
    # The lane the player sees the chicken on; a mismatch (lost response) returns 409.
    from_step = serializers.IntegerField(min_value=0, required=False, allow_null=True)


def _chicken_state(request, round_):
    account = rounds.points_account(request.user)
    return {"round": chicken.round_payload(round_), "balance": account.amount if account else 0}


class ChickenConfigView(APIView):
    """Limits, the per-lane multiplier table of each difficulty, seed, balance, unfinished round."""

    permission_classes = (IsAuthenticated,)

    @extend_schema(tags=["chicken"], summary="Chicken game config and player state")
    def get(self, request):
        try:
            customer = rounds.customer_for(request.user)
        except rounds.CrashError as exc:
            return _error(exc)
        config = ChickenConfiguration.current()
        seed = rounds.seed_for(customer)
        account = rounds.points_account(request.user)
        active = ChickenRound.objects.filter(
            customer=customer, status=ChickenRound.Status.ACTIVE
        ).first()
        levels = {}
        for key in CHICKEN_DIFFICULTIES:
            lanes, hit = config.level(key)
            levels[key] = {
                "lanes": lanes,
                "hit": str(hit),
                "multipliers": [
                    str(m) for m in chicken.lane_multipliers(lanes, hit, config.house_edge)
                ],
            }
        return Response(
            {
                "enabled": config.enabled,
                "min_bet": config.min_bet,
                "max_bet": config.max_bet,
                "max_payout": config.max_payout,
                "house_edge": str(config.house_edge),
                "difficulties": levels,
                "client_seed": seed.client_seed,
                "next_nonce": seed.next_nonce,
                "balance": account.amount if account else 0,
                "active_round": chicken.round_payload(active) if active else None,
            }
        )


class ChickenRoundsView(APIView):
    permission_classes = (IsAuthenticated,)

    def get_throttles(self):
        return [CrashThrottle()] if self.request.method == "POST" else []

    @extend_schema(tags=["chicken"], summary="The player's recent chicken rounds")
    def get(self, request):
        try:
            customer = rounds.customer_for(request.user)
        except rounds.CrashError as exc:
            return _error(exc)
        recent = ChickenRound.objects.filter(customer=customer).order_by("-create_time")[
            :HISTORY_SIZE
        ]
        return Response({"results": [chicken.round_payload(r) for r in recent]})

    @extend_schema(tags=["chicken"], summary="Place a bet (starts a round)", request=ChickenBetSerializer)
    def post(self, request):
        serializer = ChickenBetSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        try:
            round_, balance = chicken.place_bet(
                request.user,
                serializer.validated_data["bet"],
                serializer.validated_data["difficulty"],
            )
        except rounds.CrashError as exc:
            return _error(exc)
        return Response(
            {"round": chicken.round_payload(round_), "balance": balance},
            status=status.HTTP_201_CREATED,
        )


class ChickenStepView(APIView):
    permission_classes = (IsAuthenticated,)
    throttle_classes = (CrashThrottle,)

    @extend_schema(tags=["chicken"], summary="Cross the next lane (or up to `to`)", request=ChickenStepSerializer)
    def post(self, request, round_id):
        serializer = ChickenStepSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        try:
            round_ = chicken.step(
                request.user,
                round_id,
                serializer.validated_data.get("to"),
                from_step=serializer.validated_data.get("from_step"),
            )
        except rounds.CrashError as exc:
            return _error(exc)
        return Response(_chicken_state(request, round_))


class ChickenCashoutView(APIView):
    permission_classes = (IsAuthenticated,)
    throttle_classes = (CrashThrottle,)

    @extend_schema(tags=["chicken"], summary="Cash out at the current lane")
    def post(self, request, round_id):
        try:
            round_ = chicken.cash_out(request.user, round_id)
        except rounds.CrashError as exc:
            return _error(exc)
        return Response(_chicken_state(request, round_))
