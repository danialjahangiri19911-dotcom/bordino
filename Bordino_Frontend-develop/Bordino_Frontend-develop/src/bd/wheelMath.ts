import { PRIZE_UNIT } from "./features";
import { fa } from "./format";

import type { WheelPrize } from "@/api/lottery/types/getWheelType";

export function prizeLabel(amount: number, type: WheelPrize["prize_type"]) {
	return `${fa(amount)} ${type === "cash" ? PRIZE_UNIT : "سکه"}`;
}

/** What a prize pays at multiplier M and bet scale (bet / cost_per_spin), rounded down as the server does. */
export function paid(prize: WheelPrize, M = 1, scale = 1): number {
	return Math.floor(Number(prize.prize_amount || 0) * M * scale + 1e-9);
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
export function slicesFor(prizes: WheelPrize[], M: number, scale = 1): Slice[] {
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
			label: prize.prize_type === "empty" ? "پوچ" : prizeLabel(paid(prize, M, scale), prize.prize_type),
			short:
				prize.prize_type === "empty"
					? "پوچ"
					: `${fa(paid(prize, M, scale))}${prize.prize_type === "cash" ? " ت" : ""}`,
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

const mod360 = (n: number) => ((n % 360) + 360) % 360;
const CENTER = 200;
const RADIUS = 191;
const LABEL_RADIUS = 139;

/** A point on the 400×400 wheel drawing at `angle` (0 = top, clockwise) and distance `r`. */
export function wheelPoint(angle: number, r: number): [number, number] {
	const a = ((angle - 90) * Math.PI) / 180;
	return [CENTER + r * Math.cos(a), CENTER + r * Math.sin(a)];
}

/** The SVG path of a slice from `start` to `end` degrees (0 = top, clockwise). */
export function wedgePath(start: number, end: number): string {
	const span = end - start;
	if (span <= 0) return "";
	if (span >= 359.999) return `M${CENTER} ${CENTER - RADIUS} A${RADIUS} ${RADIUS} 0 1 1 ${CENTER - 0.01} ${CENTER - RADIUS} Z`;
	const [ax, ay] = wheelPoint(start, RADIUS);
	const [bx, by] = wheelPoint(end, RADIUS);
	return `M${CENTER} ${CENTER} L${ax.toFixed(2)} ${ay.toFixed(2)} A${RADIUS} ${RADIUS} 0 ${span > 180 ? 1 : 0} 1 ${bx.toFixed(2)} ${by.toFixed(2)} Z`;
}

/** Where a slice's label sits (its middle, toward the rim). */
export function labelPoint(start: number, end: number): [number, number] {
	return wheelPoint((start + end) / 2, LABEL_RADIUS);
}

/** The slice under the top pointer when the wheel is turned `rotation` degrees clockwise. */
export function sliceAt(slices: { start: number; end: number }[], rotation: number): number {
	const at = mod360(-rotation);
	const i = slices.findIndex((s) => at >= s.start && at < s.end);
	return i < 0 ? slices.length - 1 : i;
}

/** The design's spin: fast start, long soft stop (t from 0 to 1). */
export function spinEasing(t: number): number {
	const x = Math.max(0, Math.min(1, t));
	return 1 - (1 - x) ** 4 * (1 + 4 * x);
}
