from drf_spectacular.utils import extend_schema
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.throttling import UserRateThrottle
from rest_framework.views import APIView

from apps.coins import services

TAGS = ["coins"]
CODES = {"not_found": 404, "closed": 409, "gateway": 502, "no_account": 409}


class ReadThrottle(UserRateThrottle):
    scope = "coins_read"
    rate = "60/min"


class PayThrottle(UserRateThrottle):
    scope = "coins_pay"
    rate = "20/min"


def _error(exc: services.CoinError):
    return Response({"error": exc.message, "code": exc.code}, status=CODES.get(exc.code, 400))


class PackagesView(APIView):
    """The coin packages on sale and whether buying is open."""

    permission_classes = (IsAuthenticated,)
    throttle_classes = (ReadThrottle,)

    @extend_schema(tags=TAGS, summary="Coin packages")
    def get(self, request):
        mode = services.pay_mode()
        account = services.balance.points_account(request.user)
        return Response(
            {
                "packages": [services.package_payload(p) for p in services.packages()],
                "open": mode != "off",
                "mode": mode,
                "balance": int(account.amount) if account is not None else 0,
            }
        )


class PurchaseView(APIView):
    """Buy a package: starts a Zibal payment and says where to pay it."""

    permission_classes = (IsAuthenticated,)
    throttle_classes = (PayThrottle,)

    @extend_schema(tags=TAGS, summary="Start a coin purchase (Zibal)")
    def post(self, request):
        data = request.data if isinstance(request.data, dict) else {}
        try:
            purchase, url = services.start(request.user, str(data.get("package_id") or ""))
        except services.CoinError as exc:
            return _error(exc)
        return Response({"payment_url": url, **services.purchase_payload(purchase)})


class VerifyView(APIView):
    """Back from Zibal (or the sandbox page): confirms the payment once; another user's is «not found»."""

    permission_classes = (IsAuthenticated,)
    throttle_classes = (PayThrottle,)

    @extend_schema(tags=TAGS, summary="Confirm a coin purchase")
    def post(self, request):
        data = request.data if isinstance(request.data, dict) else {}
        success = str(data.get("success", "")).lower() in ("1", "true")
        try:
            purchase = services.confirm(request.user, str(data.get("trackId") or ""), success)
        except services.CoinError as exc:
            return _error(exc)
        return Response(services.purchase_payload(purchase, request.user))
