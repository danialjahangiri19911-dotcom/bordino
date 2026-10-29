from decimal import Decimal

from django.core.validators import MaxValueValidator, MinValueValidator
from django.db import models
from django.db.models import Q
from django.utils.translation import gettext_lazy as _

from apps.django_helper.models.base import AbstractBaseModel


class CrashConfiguration(AbstractBaseModel):
    """تنظیماتِ بازیِ انفجار (یک ردیف؛ اولین ردیف استفاده می‌شود)."""

    class Meta(AbstractBaseModel.Meta):
        verbose_name = _("تنظیمات انفجار")
        verbose_name_plural = _("تنظیمات انفجار")

    enabled = models.BooleanField(default=True, verbose_name=_("فعال"))
    min_bet = models.PositiveIntegerField(
        default=1, validators=[MinValueValidator(1)], verbose_name=_("حداقل شرط (امتیاز)")
    )
    max_bet = models.PositiveIntegerField(
        default=1000, validators=[MinValueValidator(1)], verbose_name=_("حداکثر شرط (امتیاز)")
    )
    max_payout = models.PositiveIntegerField(
        default=100000,
        validators=[MinValueValidator(2)],
        verbose_name=_("سقف برد هر دست (امتیاز)"),
        help_text=_("اگر برد به این سقف برسد، دست خودکار برداشت می‌شود."),
    )
    house_edge = models.DecimalField(
        max_digits=5,
        decimal_places=4,
        default=Decimal("0.0100"),
        validators=[MinValueValidator(Decimal("0")), MaxValueValidator(Decimal("0.5"))],
        verbose_name=_("سهم سیستم"),
        help_text=_("۰٫۰۱ یعنی ۱٪ (بازگشت ۹۹٪ به بازیکن، مثل Stake)."),
    )
    max_multiplier = models.DecimalField(
        max_digits=10,
        decimal_places=2,
        default=Decimal("1000.00"),
        validators=[MinValueValidator(Decimal("1.01"))],
        verbose_name=_("سقف ضریب"),
    )

    def clean(self):
        super().clean()
        from django.core.exceptions import ValidationError

        if self.min_bet > self.max_bet:
            raise ValidationError({"min_bet": _("حداقل شرط نباید از حداکثر بیشتر باشد.")})

    @classmethod
    def current(cls) -> "CrashConfiguration":
        config = cls.objects.order_by("create_time").first()
        return config or cls.objects.create()

    def __str__(self):
        return str(_("تنظیمات انفجار"))


class CrashSeed(AbstractBaseModel):
    """بذرِ بازیکن (client seed) و شمارندهٔ دست‌ها برای اثباتِ منصفانه بودن."""

    customer = models.OneToOneField(
        "users.Customer", on_delete=models.CASCADE, related_name="crash_seed"
    )
    client_seed = models.CharField(max_length=64)
    next_nonce = models.PositiveIntegerField(default=0)

    def __str__(self):
        return f"{self.customer} / {self.client_seed}:{self.next_nonce}"


class CrashRound(AbstractBaseModel):
    class Meta(AbstractBaseModel.Meta):
        verbose_name = _("دست انفجار")
        verbose_name_plural = _("دست‌های انفجار")
        constraints = [
            models.UniqueConstraint(
                fields=["customer"],
                condition=Q(status="active"),
                name="crash_one_active_round_per_customer",
            )
        ]
        indexes = [
            models.Index(fields=["customer", "-create_time"], name="crash_customer_recent"),
            models.Index(fields=["status", "started_at"], name="crash_status_started"),
        ]

    class Status(models.TextChoices):
        ACTIVE = "active", _("در جریان")
        WON = "won", _("برد")
        LOST = "lost", _("باخت")

    customer = models.ForeignKey(
        "users.Customer", on_delete=models.PROTECT, related_name="crash_rounds"
    )
    token_account = models.ForeignKey(
        "wallet.TokenWalletAccount", on_delete=models.PROTECT, related_name="crash_rounds"
    )
    bet = models.PositiveIntegerField(verbose_name=_("شرط"))
    auto_cashout = models.DecimalField(
        max_digits=10, decimal_places=2, null=True, blank=True, verbose_name=_("برداشت خودکار")
    )
    # Auto cash-out forced by CrashConfiguration.max_payout at bet time.
    payout_cap_multiplier = models.DecimalField(max_digits=12, decimal_places=2)
    # The parameters the crash point was generated with, so a round stays verifiable after
    # an admin changes the configuration.
    house_edge = models.DecimalField(max_digits=5, decimal_places=4, default=Decimal("0.0100"))
    max_multiplier = models.DecimalField(max_digits=10, decimal_places=2, default=Decimal("1000.00"))

    server_seed = models.CharField(max_length=64)
    server_seed_hash = models.CharField(max_length=64)
    client_seed = models.CharField(max_length=64)
    nonce = models.PositiveIntegerField()
    crash_point = models.DecimalField(max_digits=10, decimal_places=2, verbose_name=_("نقطه انفجار"))
    started_at = models.DateTimeField()

    status = models.CharField(
        max_length=10, choices=Status.choices, default=Status.ACTIVE, verbose_name=_("وضعیت")
    )
    cashout_multiplier = models.DecimalField(
        max_digits=10, decimal_places=2, null=True, blank=True, verbose_name=_("ضریب برداشت")
    )
    payout = models.PositiveIntegerField(default=0, verbose_name=_("برد"))
    settled_at = models.DateTimeField(null=True, blank=True)

    @property
    def target_multiplier(self):
        """Where the round cashes out on its own: the player's auto target or the payout cap."""
        if self.auto_cashout is None:
            return self.payout_cap_multiplier
        return min(self.auto_cashout, self.payout_cap_multiplier)

    def __str__(self):
        return f"{self.customer} {self.bet} @ {self.crash_point} ({self.status})"


def default_chicken_difficulties():
    # Lanes and per-lane hit chance; with a 2% edge the last lane pays about
    # ×3.4 (easy), ×14 (medium) and ×10,000 (hard), like Galaxsys' Chicken Crash.
    return {
        "easy": {"lanes": 24, "hit": "0.05"},
        "medium": {"lanes": 19, "hit": "0.13"},
        "hard": {"lanes": 16, "hit": "0.44"},
    }


CHICKEN_DIFFICULTIES = ("easy", "medium", "hard")


class ChickenConfiguration(AbstractBaseModel):
    """تنظیماتِ بازیِ مرغ فراری (یک ردیف؛ اولین ردیف استفاده می‌شود)."""

    class Meta(AbstractBaseModel.Meta):
        verbose_name = _("تنظیمات مرغ فراری")
        verbose_name_plural = _("تنظیمات مرغ فراری")

    enabled = models.BooleanField(default=True, verbose_name=_("فعال"))
    min_bet = models.PositiveIntegerField(
        default=1, validators=[MinValueValidator(1)], verbose_name=_("حداقل شرط (امتیاز)")
    )
    max_bet = models.PositiveIntegerField(
        default=1000, validators=[MinValueValidator(1)], verbose_name=_("حداکثر شرط (امتیاز)")
    )
    max_payout = models.PositiveIntegerField(
        default=100000,
        validators=[MinValueValidator(2)],
        verbose_name=_("سقف برد هر دست (امتیاز)"),
        help_text=_("اگر برد به این سقف برسد، دست خودکار برداشت می‌شود."),
    )
    house_edge = models.DecimalField(
        max_digits=5,
        decimal_places=4,
        default=Decimal("0.0200"),
        validators=[MinValueValidator(Decimal("0")), MaxValueValidator(Decimal("0.5"))],
        verbose_name=_("سهم سیستم"),
        help_text=_("۰٫۰۲ یعنی ۲٪ (بازگشت ۹۸٪ به بازیکن، مثل نسخهٔ اصلی)."),
    )
    difficulties = models.JSONField(
        default=default_chicken_difficulties,
        verbose_name=_("سطح‌ها"),
        help_text=_('برای هر سطح: lanes = خط‌های پیش‌نمایش پیش از شروع (جادهٔ هر دست تا سقف برد ادامه دارد)، hit = احتمال برخورد در هر خط (مثلاً "0.05").'),
    )

    def clean(self):
        super().clean()
        from django.core.exceptions import ValidationError

        if self.min_bet > self.max_bet:
            raise ValidationError({"min_bet": _("حداقل شرط نباید از حداکثر بیشتر باشد.")})
        levels = self.difficulties if isinstance(self.difficulties, dict) else {}
        for key in CHICKEN_DIFFICULTIES:
            level = levels.get(key)
            try:
                lanes = int(level["lanes"])
                hit = Decimal(str(level["hit"]))
            except (TypeError, KeyError, ValueError, ArithmeticError):
                raise ValidationError({"difficulties": _("سطح %(key)s ناقص است.") % {"key": key}})
            if not 1 <= lanes <= 50 or not Decimal("0") < hit < Decimal("1"):
                raise ValidationError(
                    {"difficulties": _("سطح %(key)s: ۱ تا ۵۰ خط و احتمال بین ۰ و ۱.") % {"key": key}}
                )

    @classmethod
    def current(cls) -> "ChickenConfiguration":
        config = cls.objects.order_by("create_time").first()
        return config or cls.objects.create()

    def level(self, difficulty):
        level = self.difficulties[difficulty]
        return int(level["lanes"]), Decimal(str(level["hit"]))

    def __str__(self):
        return str(_("تنظیمات مرغ فراری"))


class ChickenRound(AbstractBaseModel):
    class Meta(AbstractBaseModel.Meta):
        verbose_name = _("دست مرغ فراری")
        verbose_name_plural = _("دست‌های مرغ فراری")
        constraints = [
            models.UniqueConstraint(
                fields=["customer"],
                condition=Q(status="active"),
                name="chicken_one_active_round_per_customer",
            )
        ]
        indexes = [models.Index(fields=["customer", "-create_time"], name="chicken_customer_recent")]

    Status = CrashRound.Status

    customer = models.ForeignKey(
        "users.Customer", on_delete=models.PROTECT, related_name="chicken_rounds"
    )
    token_account = models.ForeignKey(
        "wallet.TokenWalletAccount", on_delete=models.PROTECT, related_name="chicken_rounds"
    )
    bet = models.PositiveIntegerField(verbose_name=_("شرط"))
    difficulty = models.CharField(max_length=10, verbose_name=_("سطح"))
    # Snapshotted at bet time, so an admin change never alters a running round.
    lanes = models.PositiveSmallIntegerField()
    hit_chance = models.DecimalField(max_digits=6, decimal_places=4)
    house_edge = models.DecimalField(max_digits=5, decimal_places=4)
    max_payout = models.PositiveIntegerField()

    server_seed = models.CharField(max_length=64)
    server_seed_hash = models.CharField(max_length=64)
    client_seed = models.CharField(max_length=64)
    nonce = models.PositiveIntegerField()
    # The lane the car hits; null = the chicken crosses every lane.
    hit_lane = models.PositiveSmallIntegerField(null=True, blank=True, verbose_name=_("خط برخورد"))

    step = models.PositiveSmallIntegerField(default=0, verbose_name=_("خط فعلی"))
    status = models.CharField(
        max_length=10, choices=Status.choices, default=Status.ACTIVE, verbose_name=_("وضعیت")
    )
    cashout_multiplier = models.DecimalField(
        max_digits=12, decimal_places=2, null=True, blank=True, verbose_name=_("ضریب برداشت")
    )
    payout = models.PositiveIntegerField(default=0, verbose_name=_("برد"))
    settled_at = models.DateTimeField(null=True, blank=True)

    def __str__(self):
        return f"{self.customer} {self.bet} {self.difficulty} lane {self.step} ({self.status})"


class SudokuRound(AbstractBaseModel):
    """One paid Sudoku game: the puzzle the server issued and its only solution. The board rewards
    (rows, boxes, the win, the level) are paid against this, never on the browser's word."""

    class Meta(AbstractBaseModel.Meta):
        verbose_name = _("دست سودوکو")
        verbose_name_plural = _("دست‌های سودوکو")
        indexes = [models.Index(fields=["customer", "difficulty", "status"], name="sudoku_customer_level")]

    class Status(models.TextChoices):
        ACTIVE = "active", _("در حال بازی")
        WON = "won", _("برد")

    customer = models.ForeignKey("users.Customer", on_delete=models.PROTECT, related_name="sudoku_rounds")
    # The paid play this board belongs to (one board per charge; a retried start finds it).
    charge = models.OneToOneField("wallet.GamePlayCharge", on_delete=models.PROTECT, related_name="sudoku_round")
    difficulty = models.CharField(max_length=10, verbose_name=_("سطح"))
    # 81 cells, row by row; 0 = empty. The solution never leaves the server.
    puzzle = models.JSONField()
    solution = models.JSONField()
    status = models.CharField(max_length=10, choices=Status.choices, default=Status.ACTIVE, verbose_name=_("وضعیت"))
    finished_at = models.DateTimeField(null=True, blank=True)

    def __str__(self):
        return f"{self.customer} sudoku {self.difficulty} ({self.status})"
