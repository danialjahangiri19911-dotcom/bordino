import { clampFrame, coverScale, MAX_ZOOM, zoomAround } from "./photo";

// A 4000×3000 photo framed in a 300 px circle whose square starts at (40, 100).
const W = 4000;
const H = 3000;
const L = 40;
const T = 100;
const D = 300;

describe("profile photo framing", () => {
	it("never zooms out past the point where the photo stops covering the circle", () => {
		const f = clampFrame({ x: 0, y: 0, scale: 0.001 }, W, H, L, T, D);
		expect(f.scale).toBeCloseTo(coverScale(W, H, D));
		expect(H * f.scale).toBeCloseTo(D); // the short side exactly fills the frame
	});

	it("caps the zoom", () => {
		const f = clampFrame({ x: 0, y: 0, scale: 99 }, W, H, L, T, D);
		expect(f.scale).toBeCloseTo(coverScale(W, H, D) * MAX_ZOOM);
	});

	it("never leaves a gap inside the circle when dragged too far", () => {
		const s = coverScale(W, H, D) * 2;
		const right = clampFrame({ x: 5000, y: 5000, scale: s }, W, H, L, T, D);
		expect(right.x).toBe(L);
		expect(right.y).toBe(T);
		const left = clampFrame({ x: -99999, y: -99999, scale: s }, W, H, L, T, D);
		expect(left.x + W * s).toBeCloseTo(L + D);
		expect(left.y + H * s).toBeCloseTo(T + D);
	});

	it("keeps the pinched point under the fingers", () => {
		const f = { x: -100, y: 20, scale: 0.2 };
		const px = 190;
		const py = 250;
		const before = { u: (px - f.x) / f.scale, v: (py - f.y) / f.scale };
		const z = zoomAround(f, 0.5, px, py);
		expect((px - z.x) / z.scale).toBeCloseTo(before.u);
		expect((py - z.y) / z.scale).toBeCloseTo(before.v);
	});
});
