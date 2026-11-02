from django.conf import settings
from django.core.cache import cache
from rest_framework import serializers, status
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from drf_spectacular.utils import extend_schema

from apps.notifications import services
from apps.notifications.models import AppDevice, Category, PushSubscription


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
        # The Android app (Pushe): whether the server can send, and which of the player's phones are on.
        "app_push_available": services.pushe_available(),
        "app_device_ids": list(AppDevice.objects.filter(customer=customer).values_list("device_id", flat=True)),
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
        changes = data.validated_data
        if changes:
            # Only the switches sent: two quick changes in parallel must not undo each other.
            type(pref).objects.filter(pk=pref.pk).update(**changes)
        return Response(_body(request.user.customer))


class SubscriptionSerializer(serializers.Serializer):
    endpoint = serializers.URLField(max_length=1000)
    keys = serializers.DictField(child=serializers.CharField(max_length=200))

    def validate_endpoint(self, value):
        if not services.is_push_endpoint(value):
            raise serializers.ValidationError("Not a browser push service address.")
        return value

    def validate_keys(self, value):
        if not value.get("p256dh") or not value.get("auth"):
            raise serializers.ValidationError("p256dh and auth are required.")
        return value


class EndpointSerializer(serializers.Serializer):
    endpoint = serializers.CharField(max_length=1000)


# Devices kept per player (each kind): a new one beyond this replaces the one unused longest, so one
# account can never make a notification go out to an unbounded number of addresses.
MAX_DEVICES = 10


def _keep_newest(queryset):
    stale = list(queryset.order_by("-update_time", "-pk").values_list("pk", flat=True)[MAX_DEVICES:])
    if stale:
        queryset.filter(pk__in=stale).delete()


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
        _keep_newest(PushSubscription.objects.filter(customer=request.user.customer))
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


class AppDeviceSerializer(serializers.Serializer):
    provider = serializers.ChoiceField(choices=AppDevice.Provider.choices, default=AppDevice.Provider.PUSHE)
    device_id = serializers.RegexField(r"^[A-Za-z0-9_.:-]{6,200}$")


class AppDeviceView(APIView):
    """The Android app on this phone (Pushe device id), saved when the player turns notifications on."""

    permission_classes = (IsAuthenticated,)

    @extend_schema(tags=["notifications"], summary="Register this phone (Android app)", request=AppDeviceSerializer)
    def post(self, request):
        if not hasattr(request.user, "customer"):
            return Response({"error": "No customer profile"}, status=status.HTTP_400_BAD_REQUEST)
        data = AppDeviceSerializer(data=request.data)
        data.is_valid(raise_exception=True)
        # One row per phone: the same phone signed in as another player moves to that player.
        AppDevice.objects.update_or_create(
            provider=data.validated_data["provider"],
            device_id=data.validated_data["device_id"],
            defaults={"customer": request.user.customer},
        )
        _keep_newest(AppDevice.objects.filter(customer=request.user.customer))
        return Response(_body(request.user.customer), status=status.HTTP_201_CREATED)


class AppDeviceRemoveView(APIView):
    permission_classes = (IsAuthenticated,)

    @extend_schema(tags=["notifications"], summary="Forget this phone (Android app)", request=AppDeviceSerializer)
    def post(self, request):
        data = AppDeviceSerializer(data=request.data)
        data.is_valid(raise_exception=True)
        AppDevice.objects.filter(device_id=data.validated_data["device_id"], customer__user=request.user).delete()
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
        try:
            delivered = services.send(customer, category, "اعلان آزمایشی بردینو", "اعلان‌ها روی این دستگاه کار می‌کنند.", "/pwa/profile/notifications")
        except services.PartlyDelivered as e:
            delivered = e.delivered
        except services.TransientPushError:
            delivered = 0
        return Response({"delivered": delivered})
