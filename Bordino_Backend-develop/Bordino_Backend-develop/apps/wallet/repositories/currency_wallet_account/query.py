from apps.wallet.models import CurrencyWalletAccount


class CurrencyWalletAccountQueryRepository:
    @staticmethod
    def all():
        return CurrencyWalletAccount.objects.all()

    @classmethod
    def filter_by_wallet_type(cls, preset_wallet_type):
        return cls.all().filter(preset_wallet__wallet_type=preset_wallet_type)
