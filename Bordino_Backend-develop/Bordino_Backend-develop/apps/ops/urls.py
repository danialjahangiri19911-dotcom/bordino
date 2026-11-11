from django.urls import path

from apps.ops import views_auth as a
from apps.ops import views_coins as c
from apps.ops import views_dash as d
from apps.ops import views_games as g
from apps.ops import views_money as m

P = "api/v1/ops/"
urlpatterns = [
    path(P + "auth/send/", a.SendCodeView.as_view(), name="ops_send"),
    path(P + "auth/verify/", a.VerifyCodeView.as_view(), name="ops_verify"),
    path(P + "auth/refresh/", a.RefreshView.as_view(), name="ops_refresh"),
    path(P + "auth/logout/", a.LogoutView.as_view(), name="ops_logout"),
    path(P + "me/", a.MeView.as_view(), name="ops_me"),
    path(P + "home/", d.MeHomeView.as_view(), name="ops_home"),
    path(P + "staff/", a.StaffView.as_view(), name="ops_staff"),
    path(P + "staff/<uuid:member_id>/", a.StaffMemberView.as_view(), name="ops_staff_member"),
    path(P + "audit/", a.AuditView.as_view(), name="ops_audit"),
    # games
    path(P + "games/queue/", g.QueueView.as_view(), name="ops_queue"),
    path(P + "games/versions/<uuid:version_id>/", g.VersionView.as_view(), name="ops_version"),
    path(P + "games/versions/<uuid:version_id>/decide/", g.DecideView.as_view(), name="ops_decide"),
    path(P + "games/live/", g.LiveGamesView.as_view(), name="ops_live"),
    path(P + "games/<uuid:game_id>/runs/", g.GameRunsView.as_view(), name="ops_runs"),
    path(P + "games/runs/<uuid:run_id>/exclude/", g.ExcludeRunView.as_view(), name="ops_exclude"),
    path(P + "games/<uuid:game_id>/<str:action>/", g.GameActionView.as_view(), name="ops_game_action"),
    # money
    path(P + "withdrawals/", m.WithdrawalsView.as_view(), name="ops_withdrawals"),
    path(P + "withdrawals/<uuid:tx_id>/", m.WithdrawalView.as_view(), name="ops_withdrawal"),
    path(P + "withdrawals/<uuid:tx_id>/<str:decision>/", m.WithdrawalDecideView.as_view(), name="ops_withdrawal_decide"),
    path(P + "bank-accounts/", m.BankAccountsView.as_view(), name="ops_bank_accounts"),
    path(P + "bank-accounts/<uuid:account_id>/<str:decision>/", m.BankAccountDecideView.as_view(), name="ops_bank_account_decide"),
    # settings, dashboards, users
    path(P + "coins/packages/", c.PackagesView.as_view(), name="ops_coin_packages"),
    path(P + "coins/packages/<uuid:package_id>/", c.PackageView.as_view(), name="ops_coin_package"),
    path(P + "coins/purchases/", c.PurchasesView.as_view(), name="ops_coin_purchases"),
    path(P + "settings/", d.SettingsView.as_view(), name="ops_settings"),
    path(P + "settings/<str:key>/", d.SettingView.as_view(), name="ops_setting"),
    path(P + "overview/", d.OverviewView.as_view(), name="ops_overview"),
    path(P + "maintenance/", d.MaintenanceView.as_view(), name="ops_maintenance"),
    path(P + "users/", d.UserSearchView.as_view(), name="ops_users"),
]
