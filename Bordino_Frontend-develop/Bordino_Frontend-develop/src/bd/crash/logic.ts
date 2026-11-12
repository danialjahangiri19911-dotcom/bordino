import { fa } from "../format";

/** The player's choices, as the design's form keeps them (numbers typed as text). */
export interface CrashForm {
	stake: string;
	target: string;
	autoCash: boolean;
	count: string;
	profitLimit: string;
	lossLimit: string;
	winMode: "reset" | "increase";
	lossMode: "reset" | "increase";
	winPercent: string;
	lossPercent: string;
}

export const DEFAULT_FORM: CrashForm = {
	stake: "1000",
	target: "2.00",
	autoCash: true,
	count: "5",
	profitLimit: "0",
	lossLimit: "0",
	winMode: "reset",
	lossMode: "reset",
	winPercent: "0",
	lossPercent: "0",
};

export interface Limits {
	minBet: number;
	maxBet: number;
	balance: number;
	maxMultiplier: number;
}

/** Persian/Arabic digits and «٫» typed on a phone keyboard → a JS number (NaN when empty). */
export function num(text: string) {
	const plain = text
		.replace(/[۰-۹]/g, (d) => String(d.charCodeAt(0) - 0x06f0))
		.replace(/[٠-٩]/g, (d) => String(d.charCodeAt(0) - 0x0660))
		.replace(/[٫,]/g, ".")
		.trim();
	return plain === "" ? NaN : Number(plain);
}

/** The form's problem for starting a round (manual or automatic), or "" when it can start. */
export function validate(form: CrashForm, limits: Limits, auto: boolean) {
	const stake = num(form.stake);
	if (!Number.isInteger(stake) || stake < limits.minBet || stake > limits.maxBet)
		return `سکهٔ شرط باید عددی بین ${fa(limits.minBet)} و ${fa(limits.maxBet)} باشد.`;
	if (stake > limits.balance) return `سکهٔ کافی نداری (موجودی ${fa(limits.balance)}).`;
	if (form.autoCash || auto) {
		const target = num(form.target);
		if (!Number.isFinite(target) || target < 1.01 || target > limits.maxMultiplier)
			return `ضریب برداشت باید بین ۱٫۰۱ و ${fa(limits.maxMultiplier)} باشد.`;
	}
	if (auto) {
		const count = num(form.count);
		if (!Number.isInteger(count) || count < 0 || count > 1000) return "تعداد دور باید بین ۰ و ۱۰۰۰ باشد.";
		for (const key of ["profitLimit", "lossLimit", "winPercent", "lossPercent"] as const) {
			const value = num(form[key]);
			if (!Number.isFinite(value) || value < 0 || value > (key.endsWith("Percent") ? 1000 : 10_000_000))
				return "تنظیمات توقف یا افزایش معتبر نیست.";
		}
	}
	return "";
}

/** The cash-out multiplier to send with the bet («2.00»), or null for a manual cash-out. */
export function autoCashout(form: CrashForm, auto: boolean) {
	if (!form.autoCash && !auto) return null;
	return (Math.round(num(form.target) * 100) / 100).toFixed(2);
}

export interface AutoRun {
	base: number;
	stake: number;
	played: number;
	net: number;
}

/**
 * After a finished automatic round: the next stake, or why the run stops. A zero count or limit
 * means «no limit», as in the design.
 */
export function afterAutoRound(run: AutoRun, result: { bet: number; payout: number; status: string }, form: CrashForm, limits: Limits) {
	const played = run.played + 1;
	const net = run.net + result.payout - result.bet;
	const won = result.status === "won";
	const mode = won ? form.winMode : form.lossMode;
	const pct = num(won ? form.winPercent : form.lossPercent) || 0;
	const stake = mode === "increase" ? Math.max(1, Math.round(run.stake * (1 + pct / 100))) : run.base;
	const next: AutoRun = { base: run.base, stake, played, net };
	const count = num(form.count) || 0;
	const profitLimit = num(form.profitLimit) || 0;
	const lossLimit = num(form.lossLimit) || 0;
	let stop = "";
	if (count > 0 && played >= count) stop = `اجرای خودکار پس از ${fa(played)} دور تمام شد.`;
	else if (profitLimit > 0 && net >= profitLimit) stop = "اجرای خودکار با رسیدن به حد سود متوقف شد.";
	else if (lossLimit > 0 && -net >= lossLimit) stop = "اجرای خودکار با رسیدن به حد ضرر متوقف شد.";
	else if (stake > limits.balance) stop = "موجودی برای دور بعد کافی نیست؛ اجرای خودکار متوقف شد.";
	else if (stake > limits.maxBet || stake < limits.minBet) stop = "شرط دور بعد خارج از حد مجاز است؛ اجرای خودکار متوقف شد.";
	return { next, stop };
}

export interface Plot {
	line: string;
	area: string;
	tip: [number, number];
	/** Horizontal grid lines at round multipliers (they slide down as the chart zooms out). */
	grid: { y: number; label: string }[];
	/** Seconds along the bottom, at round values. */
	ticks: { x: number; label: string }[];
	/** Where the player cashed out, once the curve has passed it. */
	mark: [number, number] | null;
	left: number;
	right: number;
}

/**
 * A 1/2/5×10^n step giving at most `maxTicks` ticks over `span`, so the grid stays readable (and
 * bounded) however far the chart zooms out.
 */
export function niceStep(span: number, maxTicks: number, min: number) {
	if (!Number.isFinite(span) || span <= 0) return min;
	const raw = span / maxTicks;
	const magnitude = 10 ** Math.floor(Math.log10(raw));
	const step = [1, 2, 5, 10].map((m) => m * magnitude).find((v) => v >= raw) ?? 10 * magnitude;
	return Math.max(min, step);
}

/**
 * The chart for the server's curve m(t) = e^(k·t): `endSec` seconds of flight drawn so far, `k`
 * per second, inside a `width` × `height` stage. Both axes grow with the round (time and
 * multiplier keep ~15% headroom), so the chart zooms out as the multiplier climbs, with grid
 * lines at round values that slide as it does (as the earlier crash board did). `cashAt` = the
 * cash-out multiplier, marked on the curve once reached.
 */
export function plot(endSec: number, k: number, multiplier: number, width: number, height: number, cashAt: number | null = null): Plot {
	const left = 35;
	const right = width - 32;
	// Below the big multiplier and its caption (they end ~140 px down), so the climbing tip never
	// runs into them.
	const top = 145;
	const bottom = height - 28;
	const maxT = Math.max(8, endSec * 1.15);
	const maxY = Math.max(2, 1 + (multiplier - 1) * 1.15);
	const x = (t: number) => left + ((right - left) * t) / maxT;
	const y = (v: number) => bottom - ((bottom - top) * (v - 1)) / (maxY - 1);
	const points = Array.from({ length: 61 }, (_, i) => {
		const t = (endSec * i) / 60;
		return [x(t), y(Math.exp(t * k))] as [number, number];
	});
	const line = points.map(([px, py], i) => `${i ? "L" : "M"}${px.toFixed(2)} ${py.toFixed(2)}`).join(" ");
	const tip = points[points.length - 1];
	const yStep = niceStep(maxY - 1, 4, 0.1);
	// The 1× baseline, then round multiples of the step (5×, 10×, not 6×, 11×).
	const grid: Plot["grid"] = [{ y: y(1), label: `${fa(1)}×` }];
	for (let i = Math.floor(1 / yStep + 1e-9) + 1; i <= Math.floor(1 / yStep) + 40; i++) {
		const v = Math.round(i * yStep * 100) / 100;
		if (v > maxY + 1e-9) break;
		grid.push({ y: y(v), label: `${fa(v, yStep < 1 ? 1 : 0)}×` });
	}
	const tStep = niceStep(maxT, 5, 1);
	const ticks: Plot["ticks"] = [];
	for (let i = 1; i <= 40; i++) {
		const t = i * tStep;
		if (t > maxT + 1e-9) break;
		ticks.push({ x: x(t), label: `${fa(t)}ث` });
	}
	const cashSec = cashAt && cashAt >= 1 ? Math.log(cashAt) / k : null;
	const mark = cashSec !== null && cashSec <= endSec + 0.001 ? ([x(cashSec), y(cashAt!)] as [number, number]) : null;
	return { line, area: `${line} L${tip[0]} ${bottom} L${left} ${bottom} Z`, tip, grid, ticks, mark, left, right };
}
