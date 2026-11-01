import { labelPoint, landingRotation, sliceAt, spinEasing, wedgePath, wheelPoint } from "./wheelMath";

const slices = [
	{ start: 0, end: 90 },
	{ start: 90, end: 100 },
	{ start: 100, end: 360 },
];

describe("wheel geometry", () => {
	it("measures angles from the top, clockwise", () => {
		const [x, y] = wheelPoint(0, 100);
		expect([Math.round(x), Math.round(y)]).toEqual([200, 100]);
		const [rx, ry] = wheelPoint(90, 100);
		expect([Math.round(rx), Math.round(ry)]).toEqual([300, 200]);
	});

	it("draws big slices with the large arc and a lone slice as a circle", () => {
		expect(wedgePath(100, 360)).toContain(" 0 1 1 ");
		expect(wedgePath(0, 90)).toContain(" 0 0 1 ");
		expect(wedgePath(0, 360)).toMatch(/^M200 9 A191/);
		expect(wedgePath(5, 5)).toBe("");
	});

	it("puts a label in the middle of its slice", () => {
		const [x, y] = labelPoint(80, 100);
		expect([Math.round(x), Math.round(y)]).toEqual([339, 200]);
	});

	it("finds the slice under the pointer after any turn", () => {
		expect(sliceAt(slices, 0)).toBe(0);
		expect(sliceAt(slices, -95)).toBe(1);
		expect(sliceAt(slices, 360 * 3 - 95)).toBe(1);
		expect(sliceAt(slices, 45)).toBe(2);
	});

	it("lands the chosen angle under the pointer", () => {
		for (const target of [0, 95, 230.5, 359]) {
			const r = landingRotation(1234, target);
			expect(r).toBeGreaterThan(1234 + 360 * 5 - 1);
			const slice = slices.findIndex((s) => target >= s.start && target < s.end);
			expect(sliceAt(slices, r)).toBe(slice);
		}
	});

	it("eases from 0 to 1 without going past", () => {
		expect(spinEasing(0)).toBe(0);
		expect(spinEasing(1)).toBe(1);
		expect(spinEasing(2)).toBe(1);
		for (let t = 0.1; t < 1; t += 0.1) expect(spinEasing(t)).toBeGreaterThan(spinEasing(t - 0.1));
	});
});
