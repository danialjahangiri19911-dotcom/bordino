from django.conf import settings
from django.core.cache import cache
from rest_framework import serializers, status
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from drf_spectacular.utils import extend_schema

from apps.notifications import services
from apps.notifications.models import Category, PushSubscription


def _body(customer):
    pref = services.preferences(customer)
    return {
        "lottery": pref.lottery,
        "account": pref.account,
        "games": pref.games,
        # Whether this server can send Web Push at all, and the key a browser subscribes with.
        "push_available": services.push_available(),
        "vapid_public_key": settings.VAPID_PUBLIC_KEY or None,
        "devices": PushSubscription.objects.filter(customer=customer).count(),
    }


class PreferenceSerializer(serializers.Serializer):
    lottery = serializers.BooleanField(required=False)
    account = serializers.BooleanField(required=False)
    games = serializers.BooleanField(required=False)


class PreferencesView(APIView):
    """«مدیریت اعلان‌ها»: the three switches, stored on the server."""

    permission_classes = (IsAuthenticated,)

    @extend_schema(tags=["notifications"], summary="Notification preferences")
    def get(self, request):
        if not hasattr(request.user, "customer"):
            return Response({"error": "No customer profile"}, status=status.HTTP_400_BAD_REQUEST)
        return Response(_body(request.user.customer))

    @extend_schema(tags=["notifications"], summary="Change notification preferences", request=PreferenceSerializer)
    def patch(self, request):
        if not hasattr(request.user, "customer"):
            return Response({"error": "No customer profile"}, status=status.HTTP_400_BAD_REQUEST)
        data = PreferenceSerializer(data=request.data)
        data.is_valid(raise_exception=True)
        pref = services.preferences(request.user.customer)
        for field, value in data.validated_data.items():
            setattr(pref, field, value)
        pref.save()
        return Response(_body(request.user.customer))


class SubscriptionSerializer(serializers.Serializer):
    endpoint = serializers.URLField(max_length=1000)
    keys = serializers.DictField(child=serializers.CharField(max_length=200))

    def validate_endpoint(self, value):
        if not value.startswith("https://"):
            raise serializers.ValidationError("Push endpoints are https.")
        return value

    def validate_keys(self, value):
        if not value.get("p256dh") or not value.get("auth"):
            raise serializers.ValidationError("p256dh and auth are required.")
        return value


class EndpointSerializer(serializers.Serializer):
    endpoint = serializers.CharField(max_length=1000)


class PushSubscriptionView(APIView):
    """This device's Web Push subscription: saved when the player allows notifications here."""

    permission_classes = (IsAuthenticated,)

    @extend_schema(tags=["notifications"], summary="Register this device", request=SubscriptionSerializer)
    def post(self, request):
        if not hasattr(request.user, "customer"):
            return Response({"error": "No customer profile"}, status=status.HTTP_400_BAD_REQUEST)
        data = SubscriptionSerializer(data=request.data)
        data.is_valid(raise_exception=True)
        v = data.validated_data
        # One row per endpoint: the same browser signed in as another player moves to that player.
        PushSubscription.objects.update_or_create(
            endpoint=v["endpoint"],
            defaults={
                "customer": request.user.customer,
                "p256dh": v["keys"]["p256dh"],
                "auth": v["keys"]["auth"],
                "user_agent": request.headers.get("User-Agent", "")[:300],
            },
        )
        return Response(_body(request.user.customer), status=status.HTTP_201_CREATED)


class PushUnsubscribeView(APIView):
    permission_classes = (IsAuthenticated,)

    @extend_schema(tags=["notifications"], summary="Forget this device", request=EndpointSerializer)
    def post(self, request):
        data = EndpointSerializer(data=request.data)
        data.is_valid(raise_exception=True)
        PushSubscription.objects.filter(endpoint=data.validated_data["endpoint"], customer__user=request.user).delete()
        if not hasattr(request.user, "customer"):
            return Response(status=status.HTTP_204_NO_CONTENT)
        return Response(_body(request.user.customer))


class TestNotificationView(APIView):
    """«ارسال اعلان آزمایشی»: proves the chain works on the player's own devices (once a minute)."""

    permission_classes = (IsAuthenticated,)

    @extend_schema(tags=["notifications"], summary="Send a test notification to my devices")
    def post(self, request):
        if not hasattr(request.user, "customer"):
            return Response({"error": "No customer profile"}, status=status.HTTP_400_BAD_REQUEST)
        if not cache.add(f"notify-test:{request.user.pk}", 1, timeout=60):
            return Response({"error": "یک دقیقه صبر کن و دوباره امتحان کن."}, status=status.HTTP_429_TOO_MANY_REQUESTS)
        customer = request.user.customer
        pref = services.preferences(customer)
        category = next((c for c in Category.values if pref.wants(c)), None)
        if category is None:
            return Response({"error": "همهٔ اعلان‌ها خاموش است."}, status=status.HTTP_409_CONFLICT)
        delivered = services.send(customer, category, "اعلان آزمایشی بردینو", "اعلان‌ها روی این دستگاه کار می‌کنند.", "/pwa/profile/notifications")
        return Response({"delivered": delivered})
