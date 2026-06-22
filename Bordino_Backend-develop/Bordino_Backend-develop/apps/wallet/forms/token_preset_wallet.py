from django import forms

from apps.wallet.models.token_preset_wallet import TokenPresetWallet


class TokenPresetWalletForm(forms.ModelForm):
    actions = forms.MultipleChoiceField(
        choices=TokenPresetWallet.Action.choices,
        required=True,
        widget=forms.CheckboxSelectMultiple,
    )

    class Meta:
        model = TokenPresetWallet
        fields = (
            "name",
            "wallet_type",
            "status",
            "activation_by",
            "actions",
            "refund_percentage",
            "default",
        )
