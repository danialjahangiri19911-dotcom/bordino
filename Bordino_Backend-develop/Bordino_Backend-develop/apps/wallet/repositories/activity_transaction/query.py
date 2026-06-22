from apps.users.models.customer import Customer
from apps.wallet.models.transactions.activity import ActivityTransaction


class ActivityTransactionQueryRepository:
    @staticmethod
    def all():
        return ActivityTransaction.objects.all()

    @staticmethod
    def filter_by_customer(customer: Customer):
        return ActivityTransaction.objects.filter(customer=customer)

    @staticmethod
    def get_by_customer_section_action(
        customer: Customer,
        section: str,
        action_type: str,
    ) -> ActivityTransaction | None:
        section = section.lower() if section else section
        try:
            return ActivityTransaction.objects.filter(
                customer=customer,
                section=section,
                action_type=action_type,
            ).first()
        except ActivityTransaction.DoesNotExist:
            return None

    @staticmethod
    def filter_by_customer_and_section(customer: Customer, section: str):
        section = section.lower() if section else section
        return ActivityTransaction.objects.filter(
            customer=customer,
            section=section,
        )

    @staticmethod
    def filter_by_status(status: str):
        return ActivityTransaction.objects.filter(status=status)

    @staticmethod
    def get_by_id(transaction_id: str) -> ActivityTransaction | None:
        try:
            return ActivityTransaction.objects.get(id=transaction_id)
        except ActivityTransaction.DoesNotExist:
            return None
