from django.utils.translation import gettext_lazy as _
from rest_framework import serializers

from apps.django_helper.drf.serializers import BaseModelSerializer
from apps.wallet.models import Bank, BankAccount
from apps.wallet.services.iban import bank_code_of, is_valid_iban, normalize_iban


class BankAccountCreateSerializer(BaseModelSerializer):
    class Meta:
        model = BankAccount
        fields = ("iban", "bank", "account_holder")

    def validate_iban(self, value):
        # Withdrawals are paid to this number: a mistyped one would send money nowhere.
        iban = normalize_iban(value)
        if not is_valid_iban(iban):
            raise serializers.ValidationError(_("شماره شبا معتبر نیست. آن را دوباره بررسی کنید."))
        return iban

    def validate_account_holder(self, value):
        value = (value or "").strip()
        if len(value) < 2:
            raise serializers.ValidationError(_("نام صاحب حساب را کامل وارد کنید."))
        return value

    def validate(self, attrs):
        # The Sheba number names its bank (IRkk BBB…): a number of another bank would be paid to
        # an account the player did not mean, or bounce.
        bank = attrs.get("bank")
        code = bank_code_of(attrs.get("iban", ""))
        if bank and bank.code and code and bank.code != code:
            owner = Bank.objects.filter(code=code, is_active=True).first()
            raise serializers.ValidationError(
                {
                    "iban": _("این شماره شبا مال «%(owner)s» است، نه «%(bank)s».")
                    % {"owner": owner.name if owner else _("بانک دیگری"), "bank": bank.name}
                }
            )
        if bank and not bank.is_active:
            raise serializers.ValidationError({"bank": _("این بانک فعلاً پذیرفته نمی‌شود.")})
        return attrs
