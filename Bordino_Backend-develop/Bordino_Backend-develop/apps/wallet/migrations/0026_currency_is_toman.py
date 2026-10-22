from django.db import migrations

RIAL, TOMAN = ("IRR", "کیف پول ریالی"), ("IRT", "تومان")
RIAL_WALLET, TOMAN_WALLET = "کیف پول ریالی", "کیف پول تومانی"


def to_toman(apps, schema_editor):
    """The stored amounts were always toman (the app shows and pays them as toman); only the
    labels said rial, which could make whoever pays a withdrawal pay a tenth of it."""
    Currency = apps.get_model("wallet", "Currency")
    if not Currency.objects.filter(symbol=TOMAN[0]).exists():
        Currency.objects.filter(symbol=RIAL[0]).update(symbol=TOMAN[0], name=TOMAN[1])
    apps.get_model("wallet", "CurrencyPresetWallet").objects.filter(name=RIAL_WALLET).update(
        name=TOMAN_WALLET
    )
    apps.get_model("wallet", "CurrencyWalletAccount").objects.filter(name=RIAL_WALLET).update(
        name=TOMAN_WALLET
    )


def to_rial(apps, schema_editor):
    Currency = apps.get_model("wallet", "Currency")
    Currency.objects.filter(symbol=TOMAN[0]).update(symbol=RIAL[0], name=RIAL[1])
    apps.get_model("wallet", "CurrencyPresetWallet").objects.filter(name=TOMAN_WALLET).update(
        name=RIAL_WALLET
    )
    apps.get_model("wallet", "CurrencyWalletAccount").objects.filter(name=TOMAN_WALLET).update(
        name=RIAL_WALLET
    )


class Migration(migrations.Migration):
    dependencies = [("wallet", "0025_wallet_history")]

    operations = [migrations.RunPython(to_toman, to_rial)]
