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
	stake: "10",
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
		return `امتیاز شرط باید عددی بین ${fa(limits.minBet)} و ${fa(limits.maxBet)} باشد.`;
	if (stake > limits.balance) return `امتیاز کافی نداری (موجودی ${fa(limits.balance)}).`;
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
	grid: number[];
	labels: { x: number; y: number; text: string; anchor: "end" | "middle" }[];
}

/**
 * The design's chart (plot() in crash.js) for the server's curve m(t) = e^(k·t): `endSec` seconds of
 * flight drawn so far, `k` per second, inside a `width` × `height` stage.
 */
export function plot(endSec: number, k: number, multiplier: number, width: number, height: number): Plot {
	const left = 35;
	const right = width - 32;
	const top = 95;
	const bottom = height - 28;
	const maxT = Math.max(10, endSec * 1.15);
	const maxY = Math.max(2, Math.ceil(multiplier * 1.18 * 2) / 2);
	const x = (t: number) => left + ((right - left) * t) / maxT;
	const y = (v: number) => bottom - ((bottom - top) * (v - 1)) / (maxY - 1);
	const points = Array.from({ length: 61 }, (_, i) => {
		const t = (endSec * i) / 60;
		return [x(t), y(Math.exp(t * k))] as [number, number];
	});
	const line = points.map(([px, py], i) => `${i ? "L" : "M"}${px.toFixed(2)} ${py.toFixed(2)}`).join(" ");
	const tip = points[points.length - 1];
	const grid = [0, 1, 2, 3].map((i) => top + ((bottom - top) * i) / 3);
	const labels: Plot["labels"] = [];
	for (let i = 0; i < 3; i++) labels.push({ x: left - 6, y: grid[i] + 4, text: `${fa(maxY - ((maxY - 1) * i) / 3, 1)}×`, anchor: "end" });
	for (let i = 1; i <= 3; i++) labels.push({ x: x((maxT * i) / 3), y: height - 9, text: `${fa(Math.round((maxT * i) / 3))}ث`, anchor: "middle" });
	return { line, area: `${line} L${tip[0]} ${bottom} L${left} ${bottom} Z`, tip, grid, labels };
}
