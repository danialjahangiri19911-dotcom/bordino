import uuid

from django.core.management.base import BaseCommand
from django.db import transaction

from apps.lottery.models import LotteryWheel, LotteryWheelPrize
from apps.users.models import Sponsor
from apps.wallet.models import Token

# UUID ثابت تا فرانت بتواند به‌صورت پیش‌فرض همین گردونه را باز کند
WHEEL_ID = uuid.UUID("11111111-1111-1111-1111-111111111111")

# نام جوایز فارسی است (در دیتابیس ذخیره می‌شود) — مجموع احتمال = 100
PRIZES = [
    # (name, prize_amount, probability, prize_type)  --> مجموع احتمال = 100
    ("۵۰۰٬۰۰۰ تومان", 500000, 5, LotteryWheelPrize.PrizeType.CASH),
    ("۲۰۰٬۰۰۰ تومان", 200000, 10, LotteryWheelPrize.PrizeType.CASH),
    ("۱۰۰٬۰۰۰ تومان", 100000, 20, LotteryWheelPrize.PrizeType.CASH),
    ("۵۰٬۰۰۰ تومان", 50000, 20, LotteryWheelPrize.PrizeType.CASH),
    ("۱۰۰ امتیاز", 100, 20, LotteryWheelPrize.PrizeType.RECHARGE),
    ("پوچ", 0, 25, LotteryWheelPrize.PrizeType.EMPTY),
]


class Command(BaseCommand):
    help = "Seed a sample lottery wheel with 5 prizes (incl. empty, probabilities sum to 100)"

    @transaction.atomic
    def handle(self, *args, **options):  # pylint: disable=unused-argument
        sponsor = Sponsor.objects.first()
        if not sponsor:
            # پیام‌های کنسول ASCII هستند تا روی کنسولِ ویندوز خطای یونی‌کد ندهند
            self.stdout.write(
                self.style.ERROR("No Sponsor found; create a Sponsor in admin first.")
            )
            return

        wheel, _created = LotteryWheel.objects.update_or_create(
            id=WHEEL_ID,
            defaults={
                "name": "گردونه شانسی",
                "owner": sponsor,
                "cost_per_spin": 10,
                "max_spins": 100000,
                "max_spins_per_customer": 1000,
                "status": LotteryWheel.Status.ACTIVE,
            },
        )

        token = Token.objects.first()
        if token:
            wheel.tokens_whitelist.add(token)

        # به‌روزرسانی/ساختِ جوایز بدون پاک‌کردنِ جوایزی که تراکنش دارند (PROTECT)
        desired_names = {p[0] for p in PRIZES}
        for name, amount, probability, prize_type in PRIZES:
            LotteryWheelPrize.objects.update_or_create(
                lottery_wheel=wheel,
                name=name,
                defaults={
                    "prize_amount": amount,
                    "probability": probability,
                    "prize_type": prize_type,
                },
            )
        # حذفِ جوایزِ قدیمیِ خارج از لیست (فقط اگر تراکنشی به آن‌ها وصل نباشد)
        for stale in wheel.lottery_wheel_prizes.exclude(name__in=desired_names):
            try:
                stale.delete()
            except Exception as exc:  # pylint: disable=broad-exception-caught
                self.stdout.write(
                    self.style.WARNING(
                        f"Skip deleting prize '{stale.name}' (referenced): {exc}"
                    )
                )

        total = sum(p[2] for p in PRIZES)
        self.stdout.write(
            self.style.SUCCESS(
                f"Wheel seeded: id={wheel.id} | {len(PRIZES)} prizes | "
                f"total probability={total}\n"
                f"Open: /pwa/gameNet?wheel={wheel.id}"
            )
        )
