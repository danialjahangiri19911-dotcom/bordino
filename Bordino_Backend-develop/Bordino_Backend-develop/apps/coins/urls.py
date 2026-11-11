from django.urls import path

from apps.coins.views import PackagesView, PurchaseView, VerifyView

urlpatterns = [
    path("api/v1/coins/packages/", PackagesView.as_view(), name="coins_packages"),
    path("api/v1/coins/purchases/", PurchaseView.as_view(), name="coins_purchase"),
    path("api/v1/coins/purchases/verify/", VerifyView.as_view(), name="coins_verify"),
]
