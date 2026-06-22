from apps.users.models.customer import Customer
from apps.users.models.user import User


class CustomerQueryRepository:
    @staticmethod
    def all():
        return Customer.objects.all()

    @classmethod
    def filter_by_referral_code(cls, referral_code):
        customer = cls.all().filter(referral_code=referral_code).last()
        if not customer:
            raise Customer.DoesNotExist(f"No customer found with referral code: {referral_code}")
        return customer

    @classmethod
    def count_referrals_by_user(cls, user: User):
        return cls.all().filter(invited_by=user).count()

    @classmethod
    def count_referrals_by_referral_code(cls, referral_code: str):
        try:
            referrer_customer = cls.filter_by_referral_code(referral_code)
            return cls.count_referrals_by_user(referrer_customer.user)
        except Customer.DoesNotExist:
            return 0

    @classmethod
    def get_referrals_by_user(cls, user: User):
        return cls.all().filter(invited_by=user)

    @classmethod
    def get_referrals_by_referral_code(cls, referral_code: str):
        try:
            referrer_customer = cls.filter_by_referral_code(referral_code)
            return cls.get_referrals_by_user(referrer_customer.user)
        except Customer.DoesNotExist:
            return cls.all().none()
