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

import { jpegOrientation, pictureSize, sniff } from "./photo";

/** A minimal JPEG header: SOI, an APP1 EXIF block with one orientation tag, then SOF0 with a size. */
function jpeg(width: number, height: number, orientation?: number, little = false): Uint8Array {
	const parts: number[] = [0xff, 0xd8];
	if (orientation) {
		const u16 = (v: number) => (little ? [v & 255, v >> 8] : [v >> 8, v & 255]);
		const u32 = (v: number) => (little ? [v & 255, (v >> 8) & 255, (v >> 16) & 255, v >>> 24] : [v >>> 24, (v >> 16) & 255, (v >> 8) & 255, v & 255]);
		const tiff = [...(little ? [0x49, 0x49] : [0x4d, 0x4d]), ...u16(42), ...u32(8), ...u16(1), ...u16(0x0112), ...u16(3), ...u32(1), ...u16(orientation), 0, 0, ...u32(0)];
		const body = [0x45, 0x78, 0x69, 0x66, 0, 0, ...tiff];
		parts.push(0xff, 0xe1, (body.length + 2) >> 8, (body.length + 2) & 255, ...body);
	}
	parts.push(0xff, 0xc0, 0, 17, 8, height >> 8, height & 255, width >> 8, width & 255, 3, 1, 0x22, 0, 2, 0x11, 1, 3, 0x11, 1);
	parts.push(0xff, 0xda, 0, 2);
	return new Uint8Array(parts);
}

/** (jsdom has no TextEncoder: one byte per character, enough for these ASCII headers) */
const bytesOf = (text: string) => Uint8Array.from(text, (c) => c.charCodeAt(0));

describe("profile photo: the real format, size and turn from the file's bytes", () => {
	it("knows a JPEG whatever its name or type says, and its size", () => {
		const b = jpeg(8000, 6000);
		expect(sniff(b)).toBe("jpeg");
		expect(pictureSize(b, "jpeg")).toEqual({ width: 8000, height: 6000 });
		expect(jpegOrientation(b)).toBe(1);
	});

	it("reads the EXIF turn (big- and little-endian): portrait camera photos are stored sideways", () => {
		expect(jpegOrientation(jpeg(4000, 3000, 6))).toBe(6);
		expect(jpegOrientation(jpeg(4000, 3000, 8, true))).toBe(8);
	});

	it("knows PNG, GIF, WebP, BMP, HEIC and AVIF, and refuses what is no picture", () => {
		const png = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 13, 10, 26, 10, 0, 0, 0, 13, 0x49, 0x48, 0x44, 0x52, 0, 0, 7, 0xd0, 0, 0, 3, 0xe8]);
		expect(sniff(png)).toBe("png");
		expect(pictureSize(png, "png")).toEqual({ width: 2000, height: 1000 });
		expect(sniff(bytesOf("GIF89a\x10\x00\x20\x00......"))).toBe("gif");
		expect(sniff(bytesOf("RIFF\0\0\0\0WEBPVP8 "))).toBe("webp");
		expect(sniff(new Uint8Array([0x42, 0x4d, ...new Array(30).fill(0)]))).toBe("bmp");
		const ftyp = (brand: string, compat = "") => bytesOf(`\0\0\0\x18ftyp${brand}\0\0\0\0${compat}mif1`);
		expect(sniff(ftyp("heic"))).toBe("heif");
		expect(sniff(ftyp("avif"))).toBe("avif");
		expect(sniff(ftyp("mif1", "avif"))).toBe("avif");
		expect(sniff(bytesOf("%PDF-1.7 hello world"))).toBeNull();
		expect(sniff(new Uint8Array([0xff, 0xd8]))).toBeNull(); // (too short to be a picture)
	});
});
