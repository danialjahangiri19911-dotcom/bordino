"""«بردینو ادمین»: withdrawal requests and bank accounts (the finance role).

A withdrawal is a CurrencyTransaction to a bank account, PENDING since the player asked (the amount
already left their balance). Marking it paid (with the bank's reference) closes it; failed or
cancelled gives the amount back — exactly once, under the row lock, by the wallet's own signals
(apps/wallet/signals.py). A finished one never changes again. Players withdraw only to an APPROVED
bank account, so approving accounts is part of the same job."""

from django.core.exceptions import ValidationError
from django.db import transaction
from django.db.models import Count, Q, Sum
from rest_framework.response import Response
from rest_framework.views import APIView

from apps.ops.auth import audit, role_permission
from apps.ops.views_auth import err
from apps.wallet.models import BankAccount, CurrencyTransaction
from apps.wallet.models.transactions.activity import ActivityTransaction
from apps.wallet.services import balance

Finance = role_permission("finance")
Status = CurrencyTransaction.Status


def _tell(user, title: str, body: str):
    from apps.notifications import services as notifications  # pylint: disable=import-outside-toplevel

    customer = getattr(user, "customer", None)
    if customer is None:
        return
    try:
        notifications.queue(customer, "account", title, body, url="/pwa/wallet")
    except Exception:  # pylint: disable=broad-except
        pass  # a notice never stops the decision


def _owner(tx: CurrencyTransaction):
    return tx.bank_account.user if tx.bank_account_id else None


def _withdrawal_row(tx: CurrencyTransaction) -> dict:
    user = _owner(tx)
    acc = tx.bank_account
    return {
        "id": str(tx.pk),
        "amount": int(tx.amount),
        "currency": tx.currency.name if tx.currency_id else "",
        "status": tx.status,
        "requested_at": tx.create_time.isoformat(),
        "updated_at": tx.update_time.isoformat(),
        "description": tx.description,
        "user": {"id": str(user.pk), "phone": "0" + user.phone_number, "name": user.username or ""} if user else None,
        "bank": {
            "id": str(acc.pk),
            "name": acc.bank.name if acc.bank_id else "",
            "iban": acc.iban,
            "holder": acc.account_holder,
            "status": acc.status,
        }
        if acc
        else None,
    }


def withdrawals():
    return CurrencyTransaction.objects.filter(bank_account__isnull=False).select_related("bank_account__bank", "bank_account__user", "currency")


class WithdrawalsView(APIView):
    permission_classes = (Finance,)

    def get(self, request):
        status = request.query_params.get("status") or "pending"
        qs = withdrawals()
        if status != "all":
            qs = qs.filter(status=status)
        q = (request.query_params.get("q") or "").strip()
        if q:
            digits = "".join(ch for ch in q if ch.isdigit())
            phone = digits[1:] if digits.startswith("0") else digits
            qs = qs.filter(Q(bank_account__iban__icontains=q.replace(" ", "")) | Q(bank_account__user__phone_number__contains=phone or q) | Q(bank_account__account_holder__icontains=q))
        qs = qs.order_by("create_time" if status == "pending" else "-create_time")[:200]
        totals = dict(
            withdrawals().values_list("status").annotate(n=Count("id")).values_list("status", "n")
        )
        waiting = withdrawals().filter(status=Status.PENDING).aggregate(s=Sum("amount"))["s"] or 0
        return Response({"withdrawals": [_withdrawal_row(t) for t in qs], "counts": totals, "pending_amount": int(waiting)})


class WithdrawalView(APIView):
    permission_classes = (Finance,)

    def get(self, request, tx_id):
        tx = withdrawals().filter(pk=tx_id).first()
        if tx is None:
            return err("پیدا نشد.", "not_found", 404)
        user = _owner(tx)
        history = withdrawals().filter(bank_account__user=user).exclude(pk=tx.pk).order_by("-create_time")[:10]
        paid = withdrawals().filter(bank_account__user=user, status=Status.COMPLETED).aggregate(s=Sum("amount"), n=Count("id"))
        cash = balance.currency_account(user)
        points = balance.points_account(user)
        customer = getattr(user, "customer", None)
        earned = (
            ActivityTransaction.objects.filter(customer=customer, status=ActivityTransaction.Status.COMPLETED).aggregate(
                pos=Sum("score_value", filter=Q(score_value__gt=0)), n=Count("id")
            )
            if customer
            else {"pos": 0, "n": 0}
        )
        return Response(
            {
                "withdrawal": _withdrawal_row(tx),
                "player": {
                    "joined": user.create_time.isoformat() if hasattr(user, "create_time") else None,
                    "last_active": customer.last_active_date.isoformat() if customer and customer.last_active_date else None,
                    "cash_balance": int(cash.balance) if cash else 0,
                    "points": int(points.amount) if points else 0,
                    "points_earned": int(earned["pos"] or 0),
                    "activities": earned["n"],
                    "paid_before": int(paid["s"] or 0),
                    "paid_count": paid["n"],
                    "bank_accounts": BankAccount.objects.filter(user=user, is_deleted=False).count(),
                },
                "history": [_withdrawal_row(t) for t in history],
            }
        )


DECISIONS = {"pay": Status.COMPLETED, "fail": Status.FAILED, "cancel": Status.CANCELLED}
TOLD = {
    "pay": ("برداشت پرداخت شد", "مبلغ درخواست برداشتت به حساب بانکی‌ات واریز شد."),
    "fail": ("برداشت انجام نشد", "واریز درخواست برداشتت انجام نشد و مبلغ به کیف پولت برگشت."),
    "cancel": ("برداشت لغو شد", "درخواست برداشتت لغو شد و مبلغ به کیف پولت برگشت."),
}


class WithdrawalDecideView(APIView):
    """pay {reference} / fail {reason} / cancel {reason}: only a pending one, by one staff member."""

    permission_classes = (Finance,)

    def post(self, request, tx_id, decision):
        if decision not in DECISIONS:
            return err("کار نامعتبر است.", "not_found", 404)
        data = request.data or {}
        text = str(data.get("reference" if decision == "pay" else "reason") or "").strip()[:200]
        if not text:
            return err("شمارهٔ پیگیری بانک را بنویس." if decision == "pay" else "دلیل را بنویس (به سابقه اضافه می‌شود).")
        with transaction.atomic():
            tx = withdrawals().select_for_update(of=("self",)).filter(pk=tx_id).first()
            if tx is None:
                return err("پیدا نشد.", "not_found", 404)
            if tx.status != Status.PENDING:
                return err("این درخواست قبلاً بسته شده است.", "closed", 409, withdrawal=_withdrawal_row(tx))
            tx.status = DECISIONS[decision]
            label = {"pay": "پرداخت شد", "fail": "ناموفق", "cancel": "لغو شد"}[decision]
            tx.description = (f"{tx.description}\n" if tx.description else "") + f"{label}: {text}"
            try:
                tx.save()  # (the wallet's signals give the amount back for fail / cancel, once)
            except ValidationError as exc:
                return err("؛ ".join(sum(exc.message_dict.values(), [])) if hasattr(exc, "message_dict") else str(exc), "invalid", 409)
            audit(request, f"withdrawal_{decision}", "withdrawal", tx.pk, amount=int(tx.amount), text=text, user=str(_owner(tx).pk))
        _tell(_owner(tx), *TOLD[decision])
        return Response({"withdrawal": _withdrawal_row(withdrawals().get(pk=tx.pk))})


def _account_row(a: BankAccount) -> dict:
    return {
        "id": str(a.pk),
        "user": {"id": str(a.user_id), "phone": "0" + a.user.phone_number, "name": a.user.username or ""},
        "bank": a.bank.name if a.bank_id else "",
        "iban": a.iban,
        "holder": a.account_holder,
        "status": a.status,
        "added": a.create_time.isoformat(),
        "deleted": a.is_deleted,
    }


class BankAccountsView(APIView):
    permission_classes = (Finance,)

    def get(self, request):
        status = request.query_params.get("status") or "pending"
        qs = BankAccount.objects.filter(is_deleted=False).select_related("user", "bank")
        if status != "all":
            qs = qs.filter(status=status)
        qs = qs.order_by("create_time" if status == "pending" else "-create_time")[:200]
        counts = dict(BankAccount.objects.filter(is_deleted=False).values_list("status").annotate(n=Count("id")).values_list("status", "n"))
        return Response({"accounts": [_account_row(a) for a in qs], "counts": counts})


class BankAccountDecideView(APIView):
    permission_classes = (Finance,)

    def post(self, request, account_id, decision):
        if decision not in ("approve", "reject"):
            return err("کار نامعتبر است.", "not_found", 404)
        reason = str((request.data or {}).get("reason") or "").strip()[:200]
        if decision == "reject" and not reason:
            return err("دلیل رد را بنویس (به کاربر گفته می‌شود).")
        with transaction.atomic():
            a = BankAccount.objects.select_for_update(of=("self",)).select_related("user", "bank").filter(pk=account_id, is_deleted=False).first()
            if a is None:
                return err("پیدا نشد.", "not_found", 404)
            before = a.status
            a.status = BankAccount.Status.APPROVED if decision == "approve" else BankAccount.Status.REJECTED
            a.save(update_fields=["status", "update_time"])
            audit(request, f"bank_account_{decision}", "bank_account", a.pk, before=before, reason=reason, iban=a.iban)
        if decision == "approve":
            _tell(a.user, "حساب بانکی تأیید شد", "حالا می‌توانی به این حساب برداشت کنی.")
        else:
            _tell(a.user, "حساب بانکی تأیید نشد", reason)
        return Response({"account": _account_row(a)})
