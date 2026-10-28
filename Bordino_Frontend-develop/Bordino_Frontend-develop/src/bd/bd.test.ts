import { fa, faDate, normalizePhone } from "./format";
import { landingRotation, slicesFor } from "./wheelMath";

import type { WheelPrize } from "@/api/lottery/types/getWheelType";

describe("normalizePhone", () => {
	it("accepts the ways people type an Iranian mobile number", () => {
		for (const typed of ["09121234567", "9121234567", "+989121234567", "00989121234567", "۰۹۱۲۱۲۳۴۵۶۷", "٠٩١٢١٢٣٤٥٦٧", "0912 123 4567", "0912-123-4567"]) {
			expect(normalizePhone(typed)).toBe("9121234567");
		}
	});
	it("refuses what is not one", () => {
		for (const typed of ["", "0912123456", "091212345678", "08121234567", "abc", "+19121234567"]) {
			expect(normalizePhone(typed)).toBeNull();
		}
	});
});

describe("display formatting", () => {
	it("writes numbers and dates in Persian digits", () => {
		expect(fa(1250000)).toBe("۱٬۲۵۰٬۰۰۰");
		expect(faDate("2026-10-27T08:00:00Z")).toBe("۱۴۰۵/۰۸/۰۵");
		expect(faDate(null)).toBe("—");
	});
});

const prize = (id: number, type: WheelPrize["prize_type"], amount: number, probability: number): WheelPrize => ({
	id,
	name: String(amount),
	prize_amount: String(amount),
	prize_type: type,
	probability,
});
const WHEEL = [prize(1, "empty", 0, 30), prize(2, "recharge", 5, 30), prize(3, "recharge", 10, 22), prize(4, "recharge", 20, 12), prize(5, "recharge", 40, 5), prize(6, "recharge", 90, 1)];

describe("wheel slices", () => {
	it("cover the whole wheel in order, sized by the odds", () => {
		const slices = slicesFor(WHEEL, 1);
		expect(slices[0].start).toBe(0);
		expect(slices[slices.length - 1].end).toBeCloseTo(360);
		slices.slice(1).forEach((s, i) => expect(s.start).toBeCloseTo(slices[i].end));
		expect(slices[0].end - slices[0].start).toBeCloseTo(108); // 30 of 100
	});
	it("make prizes M times rarer and M times bigger at multiplier M (empty takes the rest)", () => {
		const one = slicesFor(WHEEL, 1);
		const three = slicesFor(WHEEL, 3);
		const span = (s: { start: number; end: number }) => s.end - s.start;
		expect(span(three[2])).toBeCloseTo(span(one[2]) / 3);
		expect(three[2].short).toBe("۳۰");
		expect(span(three[0])).toBeGreaterThan(span(one[0]));
	});
	it("draw small prizes at their exact chance (no minimum size that inflates them)", () => {
		// Codex phase 1 #7: a 1% prize at ×5 is a 0.2% chance on the server, so 0.72° — not 3.6°.
		const wheel = [prize(1, "empty", 0, 99), prize(2, "recharge", 50, 1)];
		const five = slicesFor(wheel, 5);
		expect(five[1].end - five[1].start).toBeCloseTo(0.72);
		expect(five[0].end - five[0].start).toBeCloseTo(359.28);
	});
});

describe("wheel landing", () => {
	it("brings the target angle under the top pointer after five or more turns", () => {
		for (const current of [0, 37, 360 * 7 + 123]) {
			for (const target of [0, 10, 179.5, 359]) {
				const next = landingRotation(current, target);
				expect(next - current).toBeGreaterThanOrEqual(1800);
				expect(next - current).toBeLessThan(2160);
				// The point drawn at `target` is turned by `next`; it must end at 0 (the top).
				expect((((target + next) % 360) + 360) % 360).toBeCloseTo(0, 6);
			}
		}
	});
});
