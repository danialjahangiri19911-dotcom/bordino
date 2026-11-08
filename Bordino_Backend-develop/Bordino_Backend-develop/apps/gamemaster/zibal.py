"""Zibal (IPG v1 REST, https://help.zibal.ir/IPG/API/), as caffemenu's order-service uses it.

Modes (setting GM_ZIBAL_MODE):
- "sandbox" (the default, the first step): no money moves. A transaction gets a local trackId and
  the payer goes to Bordino's own «پرداخت آزمایشی» page, which approves or cancels it.
- "test": Zibal's own test merchant ("zibal") on the real gateway (needs the server to reach Zibal).
- "live": the real merchant (GM_ZIBAL_MERCHANT, from Zibal's panel).
Amounts here are in toman; Zibal takes rial (×10).
"""

import json
import logging
import urllib.error
import urllib.request
import uuid
from dataclasses import dataclass

logger = logging.getLogger(__name__)

API = "https://gateway.zibal.ir"
TEST_MERCHANT = "zibal"


class ZibalError(Exception):
    pass


@dataclass
class Verified:
    ok: bool
    amount_rial: int | None
    ref_number: str
    card: str
    result: int | None


def _mode() -> str:
    from apps.gamemaster.services import setting  # pylint: disable=import-outside-toplevel

    mode = str(setting("GM_ZIBAL_MODE") or "sandbox").lower()
    return mode if mode in ("sandbox", "test", "live") else "sandbox"


def mode() -> str:
    return _mode()


def _merchant() -> str:
    from apps.gamemaster.services import setting  # pylint: disable=import-outside-toplevel

    if _mode() == "test":
        return TEST_MERCHANT
    merchant = str(setting("GM_ZIBAL_MERCHANT") or "").strip()
    if not merchant:
        raise ZibalError("پرداخت آنلاین هنوز راه‌اندازی نشده است.")
    return merchant


def _post(path: str, body: dict) -> dict:
    request = urllib.request.Request(
        f"{API}{path}", data=json.dumps(body).encode(), headers={"Content-Type": "application/json"}, method="POST"
    )
    try:
        with urllib.request.urlopen(request, timeout=15) as response:  # noqa: S310 (a fixed https URL)
            return json.loads(response.read().decode() or "{}")
    except (urllib.error.URLError, TimeoutError, ValueError) as exc:
        logger.warning("zibal %s failed: %s", path, exc)
        raise ZibalError("ارتباط با درگاه پرداخت برقرار نشد؛ کمی بعد دوباره امتحان کن.") from exc


def request(amount_toman: int, description: str, callback_url: str, order_id: str, mobile: str = "") -> str:
    """A new transaction: its trackId."""
    if _mode() == "sandbox":
        return f"sbx-{uuid.uuid4().hex}"
    body = {
        "merchant": _merchant(),
        "amount": int(amount_toman) * 10,
        "callbackUrl": callback_url,
        "description": description[:255],
        "orderId": order_id,
    }
    if mobile:
        body["mobile"] = mobile
    data = _post("/v1/request", body)
    if data.get("result") != 100 or not data.get("trackId"):
        logger.warning("zibal request refused: %s", data)
        raise ZibalError("درگاه پرداخت این تراکنش را نپذیرفت.")
    return str(data["trackId"])


def pay_url(track_id: str, sandbox_url: str) -> str:
    return sandbox_url if _mode() == "sandbox" else f"{API}/start/{track_id}"


def verify(track_id: str, sandbox_success: bool = False) -> Verified:
    """Asks Zibal whether the transaction was paid (result 100 = now, 201 = before). In sandbox mode
    the «پرداخت آزمایشی» page's answer stands in for it."""
    if _mode() == "sandbox":
        if not track_id.startswith("sbx-"):
            return Verified(False, None, "", "", None)
        return Verified(bool(sandbox_success), None, f"SANDBOX-{track_id[4:16]}", "sandbox", 100 if sandbox_success else None)
    data = _post("/v1/verify", {"merchant": _merchant(), "trackId": int(track_id) if track_id.isdigit() else track_id})
    result = data.get("result")
    return Verified(
        result in (100, 201),
        int(data["amount"]) if str(data.get("amount", "")).isdigit() else None,
        str(data.get("refNumber") or ""),
        str(data.get("cardNumber") or ""),
        result,
    )
