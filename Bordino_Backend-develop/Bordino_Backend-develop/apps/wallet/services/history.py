"""The two wallet histories: every movement of the points account and of the currency account,
once, signed, in its own unit, newest first, with the full time it happened.

Points rows are raw points (what the balance moves by). Currency rows are the stored amount
(toman, the unit the whole app shows). A cash prize belongs to the currency history even when it
came from a points activity (the wheel), a points prize to the points history.
"""

from django.db.models import Q

from apps.crash.models import ChickenRound, CrashRound
from apps.lottery.models import LotteryWheelPrize, LotteryWheelSpinLog
from apps.users.models import ProfileReward
from apps.wallet.models import (
    ActivityTransaction,
    CurrencyTransaction,
    GamePlayCharge,
    LotteryPrizeTransaction,
    LotteryTicketTransaction,
    LotteryWheelPrizeTransaction,
    ReferralRewardTransaction,
    TokenTransaction,
)
from apps.wallet.services.balance import POINTS_SYMBOL

GAME_TITLES = {"sudoku": "بازی سودوکو", "game_2048": "بازی ۲۰۴۸"}
ACTIVITY_TITLES = {"sudoku": "امتیاز سودوکو", "game_2048": "امتیاز ۲۰۴۸"}
WITHDRAWAL_STATUS = {
    CurrencyTransaction.Status.PENDING: "در انتظار واریز",
    CurrencyTransaction.Status.COMPLETED: "واریز شد",
    CurrencyTransaction.Status.FAILED: "ناموفق؛ مبلغ برگشت",
    CurrencyTransaction.Status.CANCELLED: "لغو شد؛ مبلغ برگشت",
}


def _row(obj_id, kind, title, amount, positive, when, icon=None, status=None, detail=None):
    return {
        "id": str(obj_id),
        "type": kind,
        "title": title,
        "amount": amount or 0,
        "is_positive": positive,
        "date": when,
        "icon": icon,
        "reference": str(obj_id).replace("-", "")[-8:],
        "status": status,
        "status_label": detail,
    }


def _logo(token):
    if token and token.logo and token.logo.file:
        return token.logo.file.url
    return None


def _newest_first(rows):
    # Full timestamps (not dates): same-day rows keep their real order.
    rows.sort(key=lambda r: (r["date"], r["id"]), reverse=True)
    return rows


def points_history(user, token_account=None):
    customer = user.customer
    rows = []

    tickets = LotteryTicketTransaction.objects.filter(
        customer=customer, status=LotteryTicketTransaction.Status.COMPLETED
    ).select_related("lottery", "token", "token__logo")
    if token_account:
        tickets = tickets.filter(source_wallet=token_account)
    for t in tickets:
        title = f"خرید بلیط {t.lottery.name}" if t.lottery else "خرید بلیط"
        rows.append(_row(t.id, "ticket_purchase", title, t.amount, False, t.create_time, _logo(t.token)))

    referrals = ReferralRewardTransaction.objects.filter(
        referrer=customer, status=ReferralRewardTransaction.Status.COMPLETED
    ).select_related("token", "token__logo")
    if token_account:
        referrals = referrals.filter(token=token_account.token)
    for t in referrals:
        rows.append(
            _row(t.id, "referral_reward", "پاداش معرفی", t.tokens_amount, True, t.create_time, _logo(t.token))
        )

    transfers = TokenTransaction.objects.filter(
        Q(source_wallet__wallet__owner=user) | Q(destination_wallet__wallet__owner=user),
        status=TokenTransaction.Status.COMPLETED,
    ).select_related("destination_wallet__wallet", "token", "token__logo")
    if token_account:
        transfers = transfers.filter(Q(source_wallet=token_account) | Q(destination_wallet=token_account))
    for t in transfers:
        incoming = t.destination_wallet.wallet.owner_id == user.id
        rows.append(
            _row(t.id, "points_transfer", "انتقال امتیاز", t.amount, incoming, t.create_time, _logo(t.token))
        )

    # These always move the points (L) account: listed for it, not for another token's account.
    if token_account is None or token_account.token.symbol == POINTS_SYMBOL:
        for t in ActivityTransaction.objects.filter(
            customer=customer, status=ActivityTransaction.Status.COMPLETED, score_value__gt=0
        ):
            title = ACTIVITY_TITLES.get(t.section, "امتیاز فعالیت")
            rows.append(_row(t.id, "activity_reward", title, t.score_value, True, t.create_time))

        for c in GamePlayCharge.objects.filter(customer=customer, cost__gt=0):
            title = GAME_TITLES.get(c.game_name, "بازی")
            rows.append(_row(c.id, "game_play", title, c.cost, False, c.create_time))

        for s in LotteryWheelSpinLog.objects.filter(customer=customer, cost__gt=0):
            rows.append(_row(s.id, "wheel_spin", "چرخش گردونه", s.cost, False, s.create_time))


        for r in ProfileReward.objects.filter(customer=customer, points__gt=0):
            rows.append(
                _row(r.id, "profile_reward", "پاداش تکمیل پروفایل", r.points, True, r.create_time)
            )

    # Points prizes of the wheel, under the account they credited (older rows: the points account).
    showing_points = token_account is None or token_account.token.symbol == POINTS_SYMBOL
    for t in LotteryWheelPrizeTransaction.objects.filter(customer=customer).select_related("prize"):
        kind = t.prize_type or t.prize.prize_type
        if kind != LotteryWheelPrize.PrizeType.RECHARGE:
            continue
        if token_account is not None and (
            t.token_account_id != token_account.pk
            if t.token_account_id
            else not showing_points
        ):
            continue
        amount = t.amount if t.amount is not None else t.prize.prize_amount
        rows.append(_row(t.id, "wheel_prize", "جایزهٔ گردونه", amount, True, t.create_time))

    crash = CrashRound.objects.filter(customer=customer)
    chicken = ChickenRound.objects.filter(customer=customer)
    if token_account:
        crash = crash.filter(token_account=token_account)
        chicken = chicken.filter(token_account=token_account)
    for name, kind, rounds in (("انفجار", "crash", crash), ("مرغ فراری", "chicken", chicken)):
        for r in rounds:
            rows.append(_row(r.id, f"{kind}_bet", f"بازی {name}", r.bet, False, r.create_time))
            if r.payout:
                when = r.settled_at or r.create_time
                title = f"برد {name} ×{r.cashout_multiplier}"
                rows.append(_row(f"{r.id}-win", f"{kind}_win", title, r.payout, True, when))

    return _newest_first(rows)


def currency_history(user, currency_account=None):
    customer = user.customer
    rows = []

    withdrawals = CurrencyTransaction.objects.filter(
        Q(source_wallet__wallet__owner=user) | Q(destination_wallet__wallet__owner=user)
    ).select_related("bank_account", "bank_account__bank", "destination_wallet__wallet")
    if currency_account:
        withdrawals = withdrawals.filter(
            Q(source_wallet=currency_account) | Q(destination_wallet=currency_account)
        )
    for t in withdrawals:
        incoming = t.destination_wallet_id is not None and t.destination_wallet.wallet.owner_id == user.id
        if t.bank_account:
            detail = f"{t.bank_account.bank.name} | {t.bank_account.account_holder}"
            title = "برداشت به حساب بانکی"
        else:
            detail, title = None, "انتقال وجه"
        row = _row(t.id, "withdrawal" if t.bank_account else "transfer", title, t.amount, incoming,
                   t.create_time, status=t.status)
        row["status_label"] = WITHDRAWAL_STATUS.get(t.status) if t.bank_account else None
        row["destination_name"] = detail
        rows.append(row)

    for t in LotteryPrizeTransaction.objects.filter(ticket__customer=customer).select_related("lottery"):
        title = f"جایزهٔ {t.lottery.name}" if t.lottery else "جایزهٔ قرعه‌کشی"
        row = _row(t.id, "lottery_prize", title, t.prize_amount, True, t.create_time, status=t.status)
        # Won but not paid yet (the transfer failed; the team pays it by hand): not a credit yet.
        if t.status == LotteryPrizeTransaction.Status.PENDING:
            row["status_label"] = "در انتظار پرداخت"
        rows.append(row)

    for t in LotteryWheelPrizeTransaction.objects.filter(customer=customer).select_related("prize"):
        kind = t.prize_type or t.prize.prize_type
        if kind == LotteryWheelPrize.PrizeType.CASH:
            amount = t.amount if t.amount is not None else t.prize.prize_amount
            rows.append(_row(t.id, "wheel_prize", "جایزهٔ نقدی گردونه", amount, True, t.create_time))

    for row in rows:
        row.setdefault("destination_name", None)
    return _newest_first(rows)
