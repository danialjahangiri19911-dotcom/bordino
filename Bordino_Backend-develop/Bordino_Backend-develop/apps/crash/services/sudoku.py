"""Sudoku, judged on the server.

The browser plays the board, but the board comes from here: the server makes the puzzle (with
exactly ONE solution), keeps the solution with the paid play, and pays the board rewards (a
finished row or box, the win, the level) only for numbers that match it, and the win only after a
believable solving time. The old way — the browser saying «I won» — is closed for these rewards
(RecordActionService refuses them).

A program can solve any Sudoku in an instant: no server check proves a person did. What this
does prove is that a reward belongs to a puzzle the server issued for a paid play, at that
puzzle's real difficulty (unlocked by real wins), with the correct board, not before the minimum
time. Each reward still pays once per player (ActivityTransaction is unique per action).
"""

import random
from dataclasses import dataclass

from django.db import IntegrityError, transaction
from django.db.models import Q
from django.utils import timezone
from django.utils.translation import gettext as _

from apps.crash.models import SudokuRound
from apps.crash.services.rounds import CrashError, RoundNotFound, customer_for

SECTION = "sudoku"
CLUES = {"easy": 36, "medium": 30, "hard": 24}
# Seconds from the start before a win is believed (a person cannot fill 45-57 cells faster).
MIN_SOLVE_SECONDS = {"easy": 60, "medium": 90, "hard": 120}
# A level opens after this many wins of the level below (as the app always showed it).
UNLOCK = {"medium": ("easy", 1), "hard": ("medium", 2)}
# The rewards this module pays; the generic record-action endpoint refuses them for Sudoku.
VERIFIED_ACTIONS = (
    "row_completed",
    "box_completed",
    "win_game",
    "easy_level_completed",
    "medium_level_completed",
    "hard_level_completed",
)
PLUCK_ATTEMPTS = 6
ALL = 0x3FE  # bits 1..9


def _box(r: int, c: int) -> int:
    return (r // 3) * 3 + c // 3


def count_solutions(cells: list[int], limit: int = 2) -> int:
    """How many solutions the 81 `cells` (0 = empty) have, counting no further than `limit`:
    0 (none, or the givens clash), 1, or `limit` (more than one). Bitmasks per row/column/box and
    the cell with the fewest candidates first."""
    cells = list(cells)
    rows = [0] * 9
    cols = [0] * 9
    boxes = [0] * 9
    for i, v in enumerate(cells):
        if not v:
            continue
        r, c = divmod(i, 9)
        bit = 1 << v
        b = _box(r, c)
        if rows[r] & bit or cols[c] & bit or boxes[b] & bit:
            return 0
        rows[r] |= bit
        cols[c] |= bit
        boxes[b] |= bit

    found = 0

    def search():
        nonlocal found
        best = -1
        best_mask = 0
        best_count = 10
        for i in range(81):
            if cells[i]:
                continue
            r, c = divmod(i, 9)
            mask = ALL & ~(rows[r] | cols[c] | boxes[_box(r, c)])
            n = mask.bit_count()
            if n == 0:
                return
            if n < best_count:
                best, best_mask, best_count = i, mask, n
                if n == 1:
                    break
        if best < 0:
            found += 1
            return
        r, c = divmod(best, 9)
        b = _box(r, c)
        for v in range(1, 10):
            bit = 1 << v
            if not best_mask & bit:
                continue
            cells[best] = v
            rows[r] |= bit
            cols[c] |= bit
            boxes[b] |= bit
            search()
            cells[best] = 0
            rows[r] &= ~bit
            cols[c] &= ~bit
            boxes[b] &= ~bit
            if found >= limit:
                return

    search()
    return found


def make_solution(rng: random.Random) -> list[int]:
    """A full, random, valid Sudoku (81 cells)."""
    cells = [0] * 81
    rows = [0] * 9
    cols = [0] * 9
    boxes = [0] * 9

    def fill(i: int) -> bool:
        if i == 81:
            return True
        r, c = divmod(i, 9)
        b = _box(r, c)
        digits = list(range(1, 10))
        rng.shuffle(digits)
        for v in digits:
            bit = 1 << v
            if rows[r] & bit or cols[c] & bit or boxes[b] & bit:
                continue
            cells[i] = v
            rows[r] |= bit
            cols[c] |= bit
            boxes[b] |= bit
            if fill(i + 1):
                return True
            cells[i] = 0
            rows[r] &= ~bit
            cols[c] &= ~bit
            boxes[b] &= ~bit
        return False

    fill(0)
    return cells


def make_puzzle(difficulty: str, rng: random.Random | None = None) -> tuple[list[int], list[int]]:
    """(puzzle, solution), 81 cells each: numbers are removed from a full solution only while the
    board keeps exactly one solution, down to the difficulty's clue count (or the fewest clues
    any of a few removal orders reaches: a few more clues, never an ambiguous board)."""
    rng = rng or random.SystemRandom()
    target = CLUES[difficulty]
    solution = make_solution(rng)
    best = list(solution)
    best_size = 81
    for _attempt in range(PLUCK_ATTEMPTS):
        if best_size <= target:
            break
        puzzle = list(solution)
        size = 81
        order = list(range(81))
        rng.shuffle(order)
        for i in order:
            if size <= target:
                break
            value = puzzle[i]
            puzzle[i] = 0
            if count_solutions(puzzle, 2) == 1:
                size -= 1
            else:
                puzzle[i] = value
        if size < best_size:
            best, best_size = puzzle, size
    return best, solution


def grid(cells: list[int]) -> list[list[int]]:
    return [cells[r * 9 : r * 9 + 9] for r in range(9)]


def wins(customer, difficulty: str) -> int:
    """Won rounds of `difficulty` (the level reward from before server-judged boards counts once)."""
    from apps.wallet.models.transactions.activity import ActivityTransaction  # pylint: disable=import-outside-toplevel

    won = SudokuRound.objects.filter(customer=customer, difficulty=difficulty, status=SudokuRound.Status.WON).count()
    legacy = ActivityTransaction.objects.filter(
        customer=customer, section=SECTION, action_type=f"{difficulty}_level_completed"
    ).filter(~Q(metadata__has_key="round")).exists()
    return won + (1 if legacy else 0)


def check_unlocked(customer, difficulty: str):
    if difficulty not in CLUES:
        raise CrashError(_("این سطح وجود ندارد."))
    need = UNLOCK.get(difficulty)
    if need and wins(customer, need[0]) < need[1]:
        names = {"easy": "آسان", "medium": "متوسط"}
        raise CrashError(_("سطح %(level)s پس از %(count)s برد %(below)s باز می‌شود.") % {
            "level": {"medium": "متوسط", "hard": "سخت"}[difficulty],
            "count": need[1],
            "below": names[need[0]],
        })


def start(user, difficulty: str, request_id: str) -> tuple[SudokuRound, int]:
    """Pays for a game (the charge is idempotent by `request_id`) and issues its puzzle. A retry
    with the same id gets the same round back: one charge, one board."""
    from apps.wallet.models import GamePlayCharge  # pylint: disable=import-outside-toplevel
    from apps.wallet.services import balance  # pylint: disable=import-outside-toplevel
    from apps.wallet.services.game_play.charge import GamePlayChargeService  # pylint: disable=import-outside-toplevel

    customer = customer_for(user)
    if not request_id:
        raise CrashError(_("شناسهٔ درخواست لازم است."))
    earlier = SudokuRound.objects.filter(customer=customer, charge__request_id=request_id).first()
    if earlier:
        account = balance.points_account(user)
        return earlier, int(account.amount) if account else 0
    check_unlocked(customer, difficulty)
    # The puzzle first (it takes a moment), outside the transaction that locks the wallet.
    puzzle, solution = make_puzzle(difficulty)
    with transaction.atomic():
        result = GamePlayChargeService().charge(user, SECTION, request_id=request_id, difficulty=difficulty)
        charge = GamePlayCharge.objects.get(customer=customer, request_id=request_id)
        round_ = SudokuRound.objects.filter(charge=charge).first()
        if round_ is None:
            round_ = SudokuRound.objects.create(
                customer=customer, charge=charge, difficulty=difficulty, puzzle=puzzle, solution=solution
            )
    return round_, result.new_amount


@dataclass
class Awarded:
    action: str
    points: int


def report(user, round_id, board: list[list[int]]) -> tuple[SudokuRound, list[Awarded], str]:
    """The board as the player has it now. Pays what it really shows: each row or box that is
    finished and matches the solution, and — the whole board right, after the minimum time — the
    win and the level. Returns the round, what was paid now, and a note (why a win was not paid)."""
    from apps.configuration.services.scoring.dto import AwardScoreDTO  # pylint: disable=import-outside-toplevel
    from apps.configuration.services.scoring.service import ScoreService  # pylint: disable=import-outside-toplevel
    from apps.wallet.models.transactions.activity import ActivityTransaction  # pylint: disable=import-outside-toplevel

    customer = customer_for(user)
    cells = [v for row in board for v in row]
    if len(board) != 9 or any(len(row) != 9 for row in board) or any(not isinstance(v, int) or not 0 <= v <= 9 for v in cells):
        raise CrashError(_("جدول نامعتبر است."))
    with transaction.atomic():
        round_ = SudokuRound.objects.select_for_update().filter(pk=round_id, customer=customer).first()
        if round_ is None:
            raise RoundNotFound()
        puzzle, solution = round_.puzzle, round_.solution
        if any(puzzle[i] and cells[i] != puzzle[i] for i in range(81)):
            raise CrashError(_("این جدول با جدول این دست یکی نیست."))
        right = [cells[i] == solution[i] for i in range(81)]
        due = []
        if any(all(right[r * 9 + c] for c in range(9)) for r in range(9)):
            due.append("row_completed")
        if any(all(right[(b // 3) * 27 + (b % 3) * 3 + (k // 3) * 9 + k % 3] for k in range(9)) for b in range(9)):
            due.append("box_completed")
        note = ""
        if all(right) and round_.status == SudokuRound.Status.ACTIVE:
            elapsed = (timezone.now() - round_.create_time).total_seconds()
            if elapsed < MIN_SOLVE_SECONDS[round_.difficulty]:
                note = _("این جدول سریع‌تر از حد ممکن حل شد؛ جایزهٔ برد داده نمی‌شود.")
            else:
                round_.status = SudokuRound.Status.WON
                round_.finished_at = timezone.now()
                round_.save(update_fields=["status", "finished_at", "update_time"])
                due += ["win_game", f"{round_.difficulty}_level_completed"]
        awarded = []
        for action in due:
            if ActivityTransaction.objects.filter(customer=customer, section=SECTION, action_type=action).exists():
                continue  # each reward pays once per player
            try:
                with transaction.atomic():
                    tx = ScoreService().award_score(
                        AwardScoreDTO(
                            user=user,
                            section=SECTION,
                            action_type=action,
                            metadata={"difficulty": round_.difficulty, "round": str(round_.pk)},
                            description=None,
                        )
                    )
                awarded.append(Awarded(action, int(tx.score_value)))
            except (ValueError, IntegrityError):
                # Daily cap reached, not configured, or claimed at the same moment: not paid now.
                continue
    return round_, awarded, note


def round_payload(round_: SudokuRound) -> dict:
    """What the app sees: the puzzle, never the solution."""
    return {
        "id": str(round_.pk),
        "difficulty": round_.difficulty,
        "puzzle": grid(round_.puzzle),
        "status": round_.status,
        "create_time": round_.create_time.isoformat(),
    }
