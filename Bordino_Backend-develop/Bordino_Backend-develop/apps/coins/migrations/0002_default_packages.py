"""The first coin packages (1 coin ≈ 100 toman; bigger packages cheaper per coin). Editable afterwards in
«بردینو ادمین» → بسته‌های سکه and in the Django admin; only added when there are none yet."""

from django.db import migrations

PACKAGES = [
    # coins, price, original price (None = no discount), badge, order
    (100, 10_000, None, "", 1),
    (500, 45_000, 50_000, "", 2),
    (1000, 80_000, 100_000, "پرفروش", 3),
    (3000, 210_000, 300_000, "بیشترین تخفیف", 4),
]


def add(apps, schema_editor):
    CoinPackage = apps.get_model("coins", "CoinPackage")
    if CoinPackage.objects.exists():
        return
    for coins, price, original, badge, order in PACKAGES:
        CoinPackage.objects.create(coins=coins, price_toman=price, original_price_toman=original, badge=badge, sort_order=order)


class Migration(migrations.Migration):
    dependencies = [("coins", "0001_initial")]

    operations = [migrations.RunPython(add, migrations.RunPython.noop)]
