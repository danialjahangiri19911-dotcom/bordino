import { fa } from "./format";

import type { WheelPrize } from "@/api/lottery/types/getWheelType";

export function prizeLabel(amount: number, type: WheelPrize["prize_type"]) {
	return `${fa(amount)} ${type === "cash" ? "تومان" : "امتیاز"}`;
}

export interface Slice {
	prize: WheelPrize;
	label: string;
	/** On the wheel: the amount only (points), «ت» after a cash amount. */
	short: string;
	start: number;
	end: number;
}

/**
 * Slices sized like the odds at multiplier M: a prize pays ×M and is M times rarer, the empty
 * slices take what the prizes give up (the server applies the same rule when it draws).
 */
export function slicesFor(prizes: WheelPrize[], M: number): Slice[] {
	const nonEmpty = prizes.filter((p) => p.prize_type !== "empty");
	const empties = prizes.filter((p) => p.prize_type === "empty");
	// Exact odds (no minimum size): a slice drawn bigger than its chance would mislead the player.
	const size = (p: WheelPrize) => Math.max(0, (p.probability || 0) / M);
	const used = nonEmpty.reduce((s, p) => s + size(p), 0);
	const emptyTotal = Math.max(0, 100 - used);
	const emptyBase = empties.reduce((s, p) => s + (p.probability || 0), 0);
	const weights = prizes.map((p) =>
		p.prize_type === "empty"
			? empties.length === 1
				? emptyTotal
				: emptyBase > 0
					? (p.probability / emptyBase) * emptyTotal
					: emptyTotal / empties.length
			: size(p),
	);
	const total = weights.reduce((s, w) => s + Math.max(w, 0), 0) || 1;
	let at = 0;
	return prizes.map((prize, i) => {
		const span = (Math.max(weights[i], 0) / total) * 360;
		const slice = {
			prize,
			label: prize.prize_type === "empty" ? "پوچ" : prizeLabel(Number(prize.prize_amount || 0) * M, prize.prize_type),
			short:
				prize.prize_type === "empty"
					? "پوچ"
					: `${fa(Number(prize.prize_amount || 0) * M)}${prize.prize_type === "cash" ? " ت" : ""}`,
			start: at,
			end: at + span,
		};
		at += span;
		return slice;
	});
}

/**
 * The wheel's next rotation (degrees, clockwise) so that `target` (an angle on the wheel, 0 = top,
 * clockwise like conic-gradient) stops under the top pointer, after five full turns.
 */
export function landingRotation(current: number, target: number): number {
	return current + 360 * 5 + ((((-target - current) % 360) + 360) % 360);
}
