from django.urls import path

from apps.notifications.views import (
    PreferencesView,
    PushSubscriptionView,
    PushUnsubscribeView,
    TestNotificationView,
)

urlpatterns = [
    path("api/v1/notifications/preferences/", PreferencesView.as_view(), name="notification_preferences"),
    path("api/v1/notifications/push-subscriptions/", PushSubscriptionView.as_view(), name="push_subscribe"),
    path("api/v1/notifications/push-subscriptions/remove/", PushUnsubscribeView.as_view(), name="push_unsubscribe"),
    path("api/v1/notifications/test/", TestNotificationView.as_view(), name="notification_test"),
]
