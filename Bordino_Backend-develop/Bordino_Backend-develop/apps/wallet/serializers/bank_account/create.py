from django.utils.translation import gettext_lazy as _
from rest_framework import serializers

from apps.django_helper.drf.serializers import BaseModelSerializer
from apps.wallet.models import BankAccount
from apps.wallet.services.iban import is_valid_iban, normalize_iban


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
