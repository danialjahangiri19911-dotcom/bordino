from django.urls import include, path
from rest_framework.routers import DefaultRouter

from apps.wallet.views.activity import RecordActionCRUDView, ScoreHistoryView, ScoreStatusViewSet
from apps.wallet.views.bank.list import BankListView
from apps.wallet.views.bank_account.views import BankAccountViewSet
from apps.wallet.views.currency_transaction.list import CurrencyTransactionListView
from apps.wallet.views.wallet.currency_summary import CurrencyWalletSummaryView
from apps.wallet.views.wallet.summary import PointsWalletSummaryView
from apps.wallet.views.wallet.transactions import PointsWalletTransactionsView
from apps.wallet.views.wallet.withdraw import CurrencyWithdrawViewSet

router = DefaultRouter()
router.register("api/v1/wallet/bank-accounts", BankAccountViewSet, basename="bank-account")
router.register(
    "api/v1/wallet/currency/transactions",
    CurrencyTransactionListView,
    basename="currency-transaction",
)
router.register("api/v1/wallet/banks", BankListView, basename="bank")
router.register(
    "api/v1/activity",
    RecordActionCRUDView,
    basename="activity",
)
router.register(
    "api/v1/activity/score-status",
    ScoreStatusViewSet,
    basename="score-status",
)

urlpatterns = [
    path(
        "api/v1/wallet/points/summary/",
        PointsWalletSummaryView.as_view(),
        name="points_wallet_summary",
    ),
    path(
        "api/v1/wallet/points/transactions/",
        PointsWalletTransactionsView.as_view(),
        name="points_wallet_transactions",
    ),
    path(
        "api/v1/wallet/currency/summary/",
        CurrencyWalletSummaryView.as_view(),
        name="currency_wallet_summary",
    ),
    path(
        "api/v1/wallet/currency/withdraw/",
        CurrencyWithdrawViewSet.as_view({"post": "create"}),
        name="currency_withdraw",
    ),
    path(
        "api/v1/activity/score-history/",
        ScoreHistoryView.as_view(),
        name="score_history",
    ),
    path("", include(router.urls)),
]
