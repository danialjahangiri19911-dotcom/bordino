from django.db.models import Case, DecimalField, F, Prefetch, Q, Sum, Value, When

from apps.wallet.models import BasePresetWallet, Wallet
from apps.wallet.repositories.currency_wallet_account.query import (
    CurrencyWalletAccountQueryRepository,
)


class WalletQueryRepository:
    @staticmethod
    def all():
        return Wallet.objects.all()

    @classmethod
    def filter_by_user(cls, user):
        return cls.all().filter(owner=user)

    @classmethod
    def wallet_base_on_wallet_type(cls, user, wallet_type, preset_wallet_type):
        from apps.wallet.repositories.token_wallet_account.query import (
            TokenWalletAccountQueryRepository,
        )

        return (
            cls.all()
            .filter(
                Q(owner=user)
                & (Q(wallet_type=wallet_type) | Q(wallet_type=Wallet.WalletType.MIXED))
            )
            .prefetch_related(
                Prefetch(
                    "currency_wallet_accounts",
                    queryset=CurrencyWalletAccountQueryRepository.filter_by_wallet_type(
                        preset_wallet_type
                    ),
                ),
                Prefetch(
                    "token_wallet_accounts",
                    queryset=TokenWalletAccountQueryRepository.filter_by_wallet_type(
                        preset_wallet_type
                    ),
                ),
            )
        )

    @classmethod
    def customer_wallet(cls, user):
        wallet_type = Wallet.WalletType.CUSTOMER
        preset_wallet_type = BasePresetWallet.WalletType.CUSTOMER
        return cls.wallet_base_on_wallet_type(user, wallet_type, preset_wallet_type).annotate(
            split_balance=Sum(
                Case(
                    When(
                        currency_wallet_accounts__preset_wallet__wallet_type=preset_wallet_type,
                        then="currency_wallet_accounts__balance",
                    ),
                    default=Value(0, output_field=DecimalField()),
                ),
                distinct=True,
            )
        )

    @classmethod
    def sponsor_wallet(cls, user):
        wallet_type = Wallet.WalletType.SPONSOR
        preset_wallet_type = BasePresetWallet.WalletType.SPONSOR
        return cls.wallet_base_on_wallet_type(user, wallet_type, preset_wallet_type).annotate(
            split_balance=Sum(
                Case(
                    When(
                        currency_wallet_accounts__preset_wallet__wallet_type=preset_wallet_type,
                        then="currency_wallet_accounts__balance",
                    ),
                    default=Value(0, output_field=DecimalField()),
                ),
                distinct=True,
            )
            + Sum(
                Case(
                    When(
                        token_wallet_accounts__preset_wallet__wallet_type=preset_wallet_type,
                        then=F("token_wallet_accounts__amount")
                        * F("token_wallet_accounts__token__price"),
                    ),
                    default=Value(0, output_field=DecimalField()),
                ),
                distinct=True,
            )
        )

    @classmethod
    def combined_wallet(cls, user):
        return cls.filter_by_user(user).annotate(
            split_balance=Sum(
                "currency_wallet_accounts__balance",
                default=Value(0, output_field=DecimalField()),
                distinct=True,
            )
            + Sum(
                F("token_wallet_accounts__amount") * F("token_wallet_accounts__token__price"),
                default=Value(0, output_field=DecimalField()),
                distinct=True,
            )
        )
