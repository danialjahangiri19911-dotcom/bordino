from django import forms

from apps.wallet.models.currency_preset_wallet import CurrencyPresetWallet


class CurrencyPresetWalletForm(forms.ModelForm):
    actions = forms.MultipleChoiceField(
        choices=CurrencyPresetWallet.Action.choices,
        required=True,
        widget=forms.CheckboxSelectMultiple,
    )

    class Meta:
        model = CurrencyPresetWallet
        fields = (
            "name",
            "wallet_type",
            "status",
            "activation_by",
            "currency",
            "actions",
            "default",
        )
