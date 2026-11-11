"""Coins for money: the packages Bordino sells and each purchase through Zibal.

Coins ARE the points currency (the «L» token account, renamed «سکه» in the app): a paid purchase adds
its coins through one ActivityTransaction (section "coin_purchase", one per purchase), whose post_save
signal moves the balance. The database's unique (customer, section, action_type) makes that credit
happen once, however many times the payment is confirmed.
"""

from django.core.exceptions import ValidationError
from django.db import models
from django.utils.translation import gettext_lazy as _

from apps.django_helper.models.base import AbstractBaseModel

MIN_PRICE_TOMAN = 1_000
MAX_PRICE_TOMAN = 100_000_000
MAX_COINS = 10_000_000


class CoinPackage(AbstractBaseModel):
    """A package on the «خرید سکه» page. A discount is shown when the original price is higher."""

    coins = models.PositiveIntegerField(verbose_name=_("تعداد سکه"))
    price_toman = models.PositiveIntegerField(verbose_name=_("قیمت (تومان)"), help_text=_("مبلغی که پرداخت می‌شود."))
    original_price_toman = models.PositiveIntegerField(
        null=True, blank=True, verbose_name=_("قیمت قبل از تخفیف (تومان)"), help_text=_("خالی = بدون تخفیف. باید از قیمت بیشتر باشد.")
    )
    badge = models.CharField(max_length=30, blank=True, verbose_name=_("برچسب"), help_text=_("مثلاً «پرفروش»؛ اختیاری."))
    is_active = models.BooleanField(default=True, verbose_name=_("فعال"))
    sort_order = models.PositiveSmallIntegerField(default=0, verbose_name=_("ترتیب"))

    class Meta(AbstractBaseModel.Meta):
        ordering = ("sort_order", "price_toman")
        verbose_name = _("بستهٔ سکه")
        verbose_name_plural = _("بسته‌های سکه")

    def clean(self):
        errors = {}
        if not self.coins or self.coins > MAX_COINS:
            errors["coins"] = _("تعداد سکه باید بین ۱ و ۱۰٬۰۰۰٬۰۰۰ باشد.")
        if not self.price_toman or not MIN_PRICE_TOMAN <= self.price_toman <= MAX_PRICE_TOMAN:
            errors["price_toman"] = _("قیمت باید بین ۱٬۰۰۰ و ۱۰۰٬۰۰۰٬۰۰۰ تومان باشد.")
        if self.original_price_toman is not None and self.price_toman and self.original_price_toman <= self.price_toman:
            errors["original_price_toman"] = _("قیمت قبل از تخفیف باید از قیمت بیشتر باشد (یا خالی بماند).")
        if self.original_price_toman is not None and self.original_price_toman > MAX_PRICE_TOMAN:
            errors["original_price_toman"] = _("قیمت قبل از تخفیف بیش از حد است.")
        if any(ch in (self.badge or "") for ch in "<>&\"'`"):
            errors["badge"] = _("این نویسه‌ها در برچسب مجاز نیستند.")
        if errors:
            raise ValidationError(errors)

    @property
    def discount_percent(self) -> int:
        if not self.original_price_toman or self.original_price_toman <= self.price_toman:
            return 0
        return round((self.original_price_toman - self.price_toman) * 100 / self.original_price_toman)

    def __str__(self):
        return f"{self.coins} سکه — {self.price_toman} تومان"


class CoinPurchase(AbstractBaseModel):
    """One payment for one package (its coins and price are copied: a later edit of the package does
    not change what this purchase pays or gives)."""

    class Status(models.TextChoices):
        PENDING = "pending", _("در انتظار پرداخت")
        PAID = "paid", _("پرداخت شد")
        FAILED = "failed", _("ناموفق")
        CANCELLED = "cancelled", _("لغو شد")

    customer = models.ForeignKey("users.Customer", on_delete=models.PROTECT, related_name="coin_purchases", verbose_name=_("کاربر"))
    package = models.ForeignKey(CoinPackage, on_delete=models.PROTECT, related_name="purchases", verbose_name=_("بسته"))
    coins = models.PositiveIntegerField(verbose_name=_("سکه"))
    amount_toman = models.PositiveIntegerField(verbose_name=_("مبلغ (تومان)"))
    original_toman = models.PositiveIntegerField(null=True, blank=True, verbose_name=_("قیمت قبل از تخفیف"))
    track_id = models.CharField(max_length=64, unique=True, verbose_name=_("شناسهٔ زیبال"))
    mode = models.CharField(max_length=10, verbose_name=_("حالت درگاه"), help_text=_("sandbox = آزمایشی، بدون جابه‌جایی پول."))
    status = models.CharField(max_length=10, choices=Status.choices, default=Status.PENDING, db_index=True, verbose_name=_("وضعیت"))
    ref_number = models.CharField(max_length=64, blank=True, verbose_name=_("شمارهٔ پیگیری"))
    card = models.CharField(max_length=32, blank=True, verbose_name=_("کارت"))
    verified_at = models.DateTimeField(null=True, blank=True, verbose_name=_("زمان تأیید"))
    credit = models.OneToOneField(
        "wallet.ActivityTransaction", null=True, blank=True, on_delete=models.PROTECT, related_name="coin_purchase", verbose_name=_("واریز سکه")
    )

    class Meta(AbstractBaseModel.Meta):
        verbose_name = _("خرید سکه")
        verbose_name_plural = _("خریدهای سکه")

    def __str__(self):
        return f"{self.coins} سکه — {self.amount_toman} تومان ({self.get_status_display()})"
