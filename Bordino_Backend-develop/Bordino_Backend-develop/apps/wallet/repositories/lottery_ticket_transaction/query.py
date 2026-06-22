from apps.users.models import Customer
from apps.wallet.models import TokenWalletAccount
from apps.wallet.models.transactions.lottery_ticket import LotteryTicketTransaction


class LotteryTicketTransactionQueryRepository:
    @staticmethod
    def all():
        return LotteryTicketTransaction.objects.all()

    @classmethod
    def filter_by_customer(cls, customer: Customer, token_account: TokenWalletAccount = None):
        query = cls.all().filter(customer=customer)
        if token_account:
            query = query.filter(source_wallet=token_account)
        return query.select_related("lottery", "token", "ticket", "token__logo")
