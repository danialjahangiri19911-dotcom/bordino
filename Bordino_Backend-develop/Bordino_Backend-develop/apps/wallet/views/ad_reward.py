from rest_framework import serializers, status
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from drf_spectacular.utils import extend_schema

from apps.wallet.services import ad_reward
from apps.wallet.services.balance import points_account


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
            return Response({"error": str(e)}, status=status.HTTP_409_CONFLICT)
        account = points_account(request.user)
        return Response(
            {
                "rewarded": True,
                "already_rewarded": claim.already,
                "reward_points": claim.session.reward_points,
                "points_balance": int(account.amount) if account else None,
            }
        )
