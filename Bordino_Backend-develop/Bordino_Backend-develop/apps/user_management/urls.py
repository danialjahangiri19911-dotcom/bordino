from django.urls import include, path
from rest_framework.routers import DefaultRouter

from rest_framework_simplejwt.views import TokenRefreshView, TokenVerifyView

from apps.user_management.views.category.list import CategoryListView
from apps.user_management.views.customer.customer_profile import CustomerProfileView
from apps.user_management.views.customer.profile_image import CustomerProfileImageView
from apps.user_management.views.customer.step1_profile_setup import StepProfileSetupView
from apps.user_management.views.customer.step2_daily_usage_time import StepDailyUsageTimeView
from apps.user_management.views.customer.step3_usage_goal import StepUsageGoalView
from apps.user_management.views.customer.step4_interest_selection import StepInterestSelectionView
from apps.user_management.views.daily_usage.list import DailyUsageListView
from apps.user_management.views.otp.resend import OtpResendView
from apps.user_management.views.signup_reason.list import SignupReasonListView
from apps.user_management.views.user.login import UserLoginView
from apps.user_management.views.user.logout import LogoutView
from apps.user_management.views.user.registration import UserRegistrationView

_API_ROUTER = DefaultRouter()

_API_ROUTER.register(
    "login",
    UserLoginView,
    basename="user_registration_verify",
)
_API_ROUTER.register(
    "logout",
    LogoutView,
    basename="user_logout",
)
_API_ROUTER.register("registration", UserRegistrationView, basename="user_registration")
_API_ROUTER.register("resend_otp", OtpResendView, basename="otp_resend")

_API_ROUTER.register(
    "customer/step/profile-setup",
    StepProfileSetupView,
    basename="customer_step_profile_setup",
)

_API_ROUTER.register(
    "customer/step/daily-usage-time",
    StepDailyUsageTimeView,
    basename="customer_step_daily_usage_time",
)

_API_ROUTER.register(
    "customer/step/usage-goal",
    StepUsageGoalView,
    basename="customer_step_usage_goal",
)

_API_ROUTER.register(
    "customer/step/interest-selection",
    StepInterestSelectionView,
    basename="customer_step_interest_selection",
)

_API_ROUTER.register(
    "customer/profile",
    CustomerProfileView,
    basename="customer_profile",
)

_API_ROUTER.register(
    r"customer/profile-image",
    CustomerProfileImageView,
    basename="customer-profile-image",
)

urlpatterns = [
    path("api/v1/", include(_API_ROUTER.urls)),
    path(
        "api/v1/customer/step/daily-usage-time/",
        DailyUsageListView.as_view(),
        name="customer_step_daily_usage_time",
    ),
    path(
        "api/v1/customer/step/usage-goal/",
        SignupReasonListView.as_view(),
        name="customer_step_signup_reasons",
    ),
    path(
        "api/v1/customer/step/interest-selection/",
        CategoryListView.as_view(),
        name="customer_step_categories",
    ),
]

urlpatterns += [
    path("token/refresh/", TokenRefreshView.as_view(), name="token_refresh"),
    path("token/verify/", TokenVerifyView.as_view(), name="token_verify"),
]
