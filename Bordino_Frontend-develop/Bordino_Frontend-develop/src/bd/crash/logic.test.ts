import { DEFAULT_FORM, afterAutoRound, autoCashout, num, plot, validate } from "./logic";

const limits = { minBet: 1, maxBet: 1000, balance: 500, maxMultiplier: 100 };

describe("crash form", () => {
	it("reads Persian and Arabic digits and the Persian decimal mark", () => {
		expect(num("۱۲")).toBe(12);
		expect(num("٢٫٥")).toBe(2.5);
		expect(num("")).toBeNaN();
	});

	it("checks the stake against the server's limits and the balance", () => {
		expect(validate(DEFAULT_FORM, limits, false)).toBe("");
		expect(validate({ ...DEFAULT_FORM, stake: "0" }, limits, false)).toMatch("بین");
		expect(validate({ ...DEFAULT_FORM, stake: "600" }, limits, false)).toMatch("امتیاز کافی");
		expect(validate({ ...DEFAULT_FORM, stake: "2.5" }, limits, false)).toMatch("بین");
	});

	it("needs a cash-out multiplier only when it is used", () => {
		const off = { ...DEFAULT_FORM, autoCash: false, target: "" };
		expect(validate(off, limits, false)).toBe("");
		expect(autoCashout(off, false)).toBeNull();
		expect(validate(off, limits, true)).toMatch("ضریب"); // automatic play always cashes out
		expect(validate({ ...DEFAULT_FORM, target: "1" }, limits, false)).toMatch("ضریب");
		expect(autoCashout({ ...DEFAULT_FORM, target: "۲٫۵" }, false)).toBe("2.50");
	});
});

describe("automatic play", () => {
	const run = { base: 10, stake: 10, played: 0, net: 0 };
	const won = { bet: 10, payout: 20, status: "won" };
	const lost = { bet: 10, payout: 0, status: "lost" };

	it("goes back to the base or raises by the percentage, per the rule", () => {
		const form = { ...DEFAULT_FORM, count: "0", lossMode: "increase" as const, lossPercent: "100" };
		const afterLoss = afterAutoRound(run, lost, form, limits);
		expect(afterLoss.next).toMatchObject({ stake: 20, played: 1, net: -10 });
		expect(afterLoss.stop).toBe("");
		expect(afterAutoRound(afterLoss.next, won, form, limits).next.stake).toBe(10);
	});

	it("a small win that pays back only the bet still counts as a win", () => {
		const form = { ...DEFAULT_FORM, count: "0", lossMode: "increase" as const, lossPercent: "100" };
		expect(afterAutoRound(run, { bet: 10, payout: 10, status: "won" }, form, limits).next.stake).toBe(10);
	});

	it("stops at the round count, the profit and loss limits, and an unaffordable stake", () => {
		expect(afterAutoRound(run, won, { ...DEFAULT_FORM, count: "1" }, limits).stop).toMatch("دور تمام شد");
		expect(afterAutoRound(run, won, { ...DEFAULT_FORM, count: "0", profitLimit: "10" }, limits).stop).toMatch("حد سود");
		expect(afterAutoRound(run, lost, { ...DEFAULT_FORM, count: "0", lossLimit: "10" }, limits).stop).toMatch("حد ضرر");
		const big = { ...DEFAULT_FORM, count: "0", lossMode: "increase" as const, lossPercent: "1000" };
		expect(afterAutoRound({ ...run, stake: 100 }, lost, big, limits).stop).toMatch("موجودی");
		expect(afterAutoRound(run, won, { ...DEFAULT_FORM, count: "0" }, limits).stop).toBe("");
	});
});

describe("chart", () => {
	it("starts at the bottom left and ends at the tip of the curve inside the stage", () => {
		const p = plot(5, 0.06, Math.exp(0.3), 600, 320);
		expect(p.line.startsWith("M35.00 292.00")).toBe(true);
		expect(p.tip[0]).toBeGreaterThan(35);
		expect(p.tip[0]).toBeLessThan(600 - 32);
		expect(p.tip[1]).toBeLessThan(292);
		expect(p.tip[1]).toBeGreaterThan(95 - 1);
		expect(p.grid).toHaveLength(4);
	});

	it("draws nothing before the round flies", () => {
		const p = plot(0, 0.06, 1, 600, 320);
		expect(p.tip).toEqual([35, 292]);
	});
});
