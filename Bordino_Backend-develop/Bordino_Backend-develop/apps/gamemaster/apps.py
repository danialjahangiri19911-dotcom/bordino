from django.apps import AppConfig


class GameMasterConfig(AppConfig):
    name = "apps.gamemaster"
    label = "gamemaster"
    verbose_name = "Game Master — بازی‌های سازندگان"

    def ready(self):
        # Every payout of a creator's game is booked against its budget (same transaction).
        from apps.gamemaster import budget  # pylint: disable=import-outside-toplevel
        from apps.missions import mystery  # pylint: disable=import-outside-toplevel

        if budget.on_payout not in mystery.payout_listeners:
            mystery.payout_listeners.append(budget.on_payout)
