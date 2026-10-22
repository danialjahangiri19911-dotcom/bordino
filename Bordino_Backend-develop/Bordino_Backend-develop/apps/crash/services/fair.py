"""Provably-fair crash point and the multiplier curve.

Everything here is pure so a player (or a test) can recompute any round:

    digest = HMAC_SHA256(key=server_seed, msg=f"{client_seed}:{nonce}")
    x      = first 4 bytes of digest as a big-endian integer
    crash  = max(100, floor(2^32 * 100 * (10000 - edge_bp) / ((x + 1) * 10000))) / 100

Integer arithmetic only, so the same numbers come out in JS (BigInt) or by hand.
P(crash >= m) ~= (1 - edge) / m, which makes every cash-out target worth (1 - edge).
"""

import hashlib
import hmac
import math
import secrets
from decimal import ROUND_FLOOR, Decimal

# m(t) = e^(GROWTH_PER_MS * t): x2 at ~11.6 s, x10 at ~38 s.  The client draws the same curve.
GROWTH_PER_MS = 0.00006
# Rounds start this long after the bet, so the client's clock lines up before the curve moves.
START_DELAY_MS = 1000

_TWO_32 = 2**32
_CENT = Decimal("0.01")


def new_server_seed() -> str:
    return secrets.token_hex(32)


def new_client_seed() -> str:
    return secrets.token_hex(8)


def hash_seed(server_seed: str) -> str:
    return hashlib.sha256(server_seed.encode()).hexdigest()


def edge_basis_points(house_edge: Decimal) -> int:
    return int((Decimal(house_edge) * 10000).to_integral_value(rounding=ROUND_FLOOR))


def crash_point(
    server_seed: str, client_seed: str, nonce: int, house_edge: Decimal, max_multiplier: Decimal
) -> Decimal:
    digest = hmac.new(server_seed.encode(), f"{client_seed}:{nonce}".encode(), hashlib.sha256).digest()
    x = int.from_bytes(digest[:4], "big")
    cents = (_TWO_32 * 100 * (10000 - edge_basis_points(house_edge))) // ((x + 1) * 10000)
    point = Decimal(max(100, cents)) / 100
    return min(point, Decimal(max_multiplier).quantize(_CENT))


def floor_cents(value) -> Decimal:
    return Decimal(str(value)).quantize(_CENT, rounding=ROUND_FLOOR)


def multiplier_at(elapsed_ms: float) -> Decimal:
    """The multiplier shown `elapsed_ms` after the round started (1.00 before it starts)."""
    if elapsed_ms <= 0:
        return Decimal("1.00")
    # Tiny epsilon so e^(k * ms_to_reach(m)) lands on m rather than m - 0.01.
    return floor_cents(math.exp(GROWTH_PER_MS * elapsed_ms) + 1e-9)


def ms_to_reach(multiplier: Decimal) -> float:
    """Milliseconds after the start at which the curve reaches `multiplier`."""
    return math.log(float(multiplier)) / GROWTH_PER_MS
