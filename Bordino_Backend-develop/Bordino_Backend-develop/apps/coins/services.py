"""Buying coins: start a Zibal payment for a package, then confirm it once and credit the coins.

The payment switch is COIN_ZIBAL_MODE: "off" (the page shows the packages, buying is closed),
"sandbox" (Bordino's «پرداخت آزمایشی» page approves or cancels; NO MONEY MOVES, the coins are still
credited), "test" (Zibal's test merchant) or "live" (the real merchant, COIN_ZIBAL_MERCHANT or the
Game Master one).
"""

import uuid
from datetime import timedelta

from django.conf import settings
from django.core.exceptions import ValidationError
from django.db import IntegrityError, transaction
from django.utils import timezone

from apps.coins.models import CoinPackage, CoinPurchase
from apps.configuration.models.system_configuration import SystemConfiguration
from apps.gamemaster import zibal
from apps.wallet.models.transactions.activity import ActivityTransaction
from apps.wallet.repositories.token_wallet_account.query import TokenWalletAccountQueryRepository
from apps.wallet.services import balance

SECTION = "coin_purchase"
MODES = ("off", "sandbox", "test", "live")
DEFAULTS = {
    "COIN_ZIBAL_MODE": "sandbox",
    "COIN_ZIBAL_MERCHANT": "",
    # While the cash wallet is hidden: a toman prize (wheel, lottery) is paid as the same number of coins.
    "CASH_PRIZES_AS_COINS": True,
}
OPEN_MINUTES = 20


class CoinError(Exception):
    def __init__(self, message: str, code: str = "invalid"):
        super().__init__(message)
        self.message = message
        self.code = code


def setting(key: str):
    return SystemConfiguration.objects.get(key, DEFAULTS[key])


def cash_prizes_as_coins() -> bool:
    """1 coin = 1 toman: a toman prize is paid as that many coins while the cash wallet is hidden."""
    value = setting("CASH_PRIZES_AS_COINS")
    return value is True or str(value).strip().lower() in ("true", "1", "yes", "on")


def pay_mode() -> str:
    mode = str(setting("COIN_ZIBAL_MODE") or "sandbox").lower()
    return mode if mode in MODES else "sandbox"


def public_base() -> str:
    return getattr(settings, "MISSIONS_PUBLIC_URL", "").rstrip("/")


def packages():
    return CoinPackage.objects.filter(is_active=True).order_by("sort_order", "price_toman")


def package_payload(p: CoinPackage) -> dict:
    return {
        "id": str(p.pk),
        "coins": p.coins,
        "price_toman": p.price_toman,
        "original_price_toman": p.original_price_toman if p.discount_percent else None,
        "discount_percent": p.discount_percent,
        "discount_toman": (p.original_price_toman - p.price_toman) if p.discount_percent else 0,
        "badge": p.badge,
    }


def purchase_payload(purchase: CoinPurchase, user=None) -> dict:
    account = balance.points_account(user) if user is not None else None
    return {
        "track_id": purchase.track_id,
        "status": purchase.status,
        "coins": purchase.coins,
        "amount_toman": purchase.amount_toman,
        "original_toman": purchase.original_toman,
        "ref_number": purchase.ref_number,
        "mode": purchase.mode,
        "balance": int(account.amount) if account is not None else None,
    }


def _customer(user):
    customer = getattr(user, "customer", None)
    if customer is None:
        raise CoinError("این حساب کیف سکه ندارد.", "not_found")
    return customer


def start(user, package_id) -> tuple[CoinPurchase, str]:
    """A Zibal transaction for the package (an open one of the same package is reused) and where to
    pay it."""
    mode = pay_mode()
    if mode == "off":
        raise CoinError("خرید سکه فعلاً بسته است؛ کمی بعد دوباره سر بزن.", "closed")
    customer = _customer(user)
    try:
        package = packages().get(pk=package_id)
    except (CoinPackage.DoesNotExist, ValidationError, ValueError):  # (a malformed id too)
        raise CoinError("این بسته پیدا نشد.", "not_found") from None
    base = public_base()
    with transaction.atomic():
        open_one = (
            CoinPurchase.objects.select_for_update()
            .filter(
                customer=customer,
                package=package,
                status=CoinPurchase.Status.PENDING,
                mode=mode,
                coins=package.coins,
                amount_toman=package.price_toman,
                create_time__gte=timezone.now() - timedelta(minutes=OPEN_MINUTES),
            )
            .first()
        )
        if open_one is None:
            order = uuid.uuid4()
            try:
                track = zibal.request(
                    package.price_toman,
                    f"خرید {package.coins} سکه در بردینو",
                    f"{base}/pwa/coins/callback",
                    str(order),
                    user.phone_number or "",
                    prefix="COIN",
                )
            except zibal.ZibalError as exc:
                raise CoinError(str(exc), "gateway") from exc
            open_one = CoinPurchase.objects.create(
                id=order,
                customer=customer,
                package=package,
                coins=package.coins,
                amount_toman=package.price_toman,
                original_toman=package.original_price_toman if package.discount_percent else None,
                track_id=track,
                mode=mode,
            )
    sandbox = f"{base}/pwa/coins/sandbox?trackId={open_one.track_id}&amount={open_one.amount_toman}"
    return open_one, zibal.pay_url(open_one.track_id, sandbox, prefix="COIN")


def _credit(user, customer, purchase: CoinPurchase) -> ActivityTransaction:
    # The coins account must exist before the ledger row: the signal skips a customer without one.
    if balance.points_account(user) is None:
        TokenWalletAccountQueryRepository.get_last_active_for_customer(customer)
        if balance.points_account(user) is None:
            raise CoinError("کیف سکهٔ این حساب پیدا نشد؛ با پشتیبانی تماس بگیر.", "no_account")
    try:
        with transaction.atomic():  # (a savepoint: a duplicate leaves the outer transaction usable)
            return ActivityTransaction.objects.create(
                customer=customer,
                section=SECTION,
                action_type=f"purchase:{purchase.pk}",
                score_value=purchase.coins,
                reward_data={"coins": purchase.coins},
                metadata={"track": purchase.track_id, "ref": purchase.ref_number, "package": str(purchase.package_id), "mode": purchase.mode},
                status=ActivityTransaction.Status.COMPLETED,
                description=f"Coin purchase {purchase.coins}",
            )
    except (IntegrityError, ValidationError):
        # Already credited (the unique ledger key; AbstractBaseModel.save runs full_clean, so it arrives
        # as a ValidationError, or as an IntegrityError from a race): that row, never a second credit.
        return ActivityTransaction.objects.get(customer=customer, section=SECTION, action_type=f"purchase:{purchase.pk}")


def confirm(user, track_id: str, success: bool) -> CoinPurchase:
    """The payer is back from Zibal (or the sandbox page): asks Zibal, and only a verified payment of
    exactly this amount credits the coins, once."""
    customer = _customer(user)
    with transaction.atomic():
        purchase = CoinPurchase.objects.select_for_update().filter(track_id=str(track_id or "")[:64]).first()
        if purchase is None or purchase.customer_id != customer.pk:
            raise CoinError("این پرداخت پیدا نشد.", "not_found")
        if purchase.status == CoinPurchase.Status.PAID:
            return purchase  # again (a reload, a second tab): already credited
        if purchase.mode == "sandbox" and purchase.status != CoinPurchase.Status.PENDING:
            return purchase  # a cancelled sandbox payment stays cancelled
        if purchase.mode != zibal.mode("COIN") or pay_mode() == "off":
            raise CoinError("حالت درگاه عوض شده؛ دوباره خرید کن.", "gateway")
        if not success and purchase.mode == "sandbox":
            purchase.status = CoinPurchase.Status.CANCELLED
            purchase.verified_at = timezone.now()
            purchase.save(update_fields=["status", "verified_at", "update_time"])
            return purchase
        try:
            result = zibal.verify(purchase.track_id, sandbox_success=success, prefix="COIN")
        except zibal.ZibalError as exc:
            raise CoinError(str(exc), "gateway") from exc
        ok = result.ok
        if ok and purchase.mode != "sandbox" and result.amount_rial != purchase.amount_toman * 10:
            ok = False  # no verified amount, or a different one: not this purchase
        purchase.ref_number, purchase.card = (result.ref_number or "")[:64], (result.card or "")[:32]
        purchase.verified_at = timezone.now()
        if ok:
            purchase.credit = _credit(user, customer, purchase)
            purchase.status = CoinPurchase.Status.PAID
        else:
            purchase.status = CoinPurchase.Status.FAILED if success else CoinPurchase.Status.CANCELLED
        purchase.save(update_fields=["status", "ref_number", "card", "verified_at", "credit", "update_time"])
    return purchase
