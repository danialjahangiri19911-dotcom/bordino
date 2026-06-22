from apps.users.models.signup_reason import SignupReason


class SignupReasonQueryRepository:
    @staticmethod
    def all():
        return SignupReason.objects.all()

    @classmethod
    def filter_by_reasons(cls, reasons):
        return cls.all().filter(reason__in=reasons)
