from django.db import migrations

# The brand is written «بردینو» (it was «بوردینو»); the points wallet's display name carries it.
OLD_BRAND = "بوردینو"
NEW_BRAND = "بردینو"

# Iranian banks and credit institutions that hold Sheba (IBAN) accounts today, keyed by the
# three-digit bank code inside the Sheba number (IRkk BBB…, BBB = code). Withdrawals are paid by
# a manual Sheba transfer (Paya/Satna) from the admin panel, which reaches every one of these.
# Left out: the central bank (010) and institutions merged away or dissolved (Ansar, Ghavamin,
# Hekmat, Kowsar, Mehr Eghtesad → Sepah; Ayandeh → Melli; Tosee credit institution), whose old
# Sheba numbers now belong to the bank that took them over.
BANKS = [
    ("011", "بانک صنعت و معدن"),
    ("012", "بانک ملت"),
    ("013", "بانک رفاه کارگران"),
    ("014", "بانک مسکن"),
    ("015", "بانک سپه"),
    ("016", "بانک کشاورزی"),
    ("017", "بانک ملی ایران"),
    ("018", "بانک تجارت"),
    ("019", "بانک صادرات ایران"),
    ("020", "بانک توسعه صادرات ایران"),
    ("021", "پست بانک ایران"),
    ("022", "بانک توسعه تعاون"),
    ("053", "بانک کارآفرین"),
    ("054", "بانک پارسیان"),
    ("055", "بانک اقتصاد نوین"),
    ("056", "بانک سامان"),
    ("057", "بانک پاسارگاد"),
    ("058", "بانک سرمایه"),
    ("059", "بانک سینا"),
    ("060", "بانک قرض‌الحسنه مهر ایران"),
    ("061", "بانک شهر"),
    ("064", "بانک گردشگری"),
    ("066", "بانک دی"),
    ("069", "بانک ایران زمین"),
    ("070", "بانک قرض‌الحسنه رسالت"),
    ("075", "مؤسسه اعتباری ملل"),
    ("078", "بانک خاورمیانه"),
    ("095", "بانک ایران و ونزوئلا"),
]


def forwards(apps, schema_editor):
    TokenWalletAccount = apps.get_model("wallet", "TokenWalletAccount")
    for account in TokenWalletAccount.objects.filter(name__contains=OLD_BRAND):
        account.name = account.name.replace(OLD_BRAND, NEW_BRAND)
        account.save(update_fields=["name"])

    Bank = apps.get_model("wallet", "Bank")
    for code, name in BANKS:
        # An admin may already have added a bank by hand: keep its row (and logo), fix the name.
        bank = Bank.objects.filter(code=code).first() or Bank.objects.filter(name=name, code__isnull=True).first()
        if bank:
            bank.code = code
            bank.name = name
            bank.is_active = True
            bank.save(update_fields=["code", "name", "is_active"])
        else:
            Bank.objects.create(code=code, name=name, is_active=True)


def backwards(apps, schema_editor):
    # Bank rows may already be used by bank accounts (PROTECT); they stay.
    TokenWalletAccount = apps.get_model("wallet", "TokenWalletAccount")
    for account in TokenWalletAccount.objects.filter(name__contains=NEW_BRAND):
        account.name = account.name.replace(NEW_BRAND, OLD_BRAND)
        account.save(update_fields=["name"])


class Migration(migrations.Migration):
    dependencies = [("wallet", "0028_wheel_prize_account")]

    operations = [migrations.RunPython(forwards, backwards)]
