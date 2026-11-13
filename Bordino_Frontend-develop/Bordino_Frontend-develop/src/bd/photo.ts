/**
 * Profile-photo helpers: open whatever the phone hands over, shrink it at once (a 50 MP camera photo
 * would otherwise be kept at full size while the player frames it), rotate, and cut the framed square.
 */

/** The longest side kept while framing: plenty for a 512 px avatar, small enough for any phone. */
export const WORK_SIDE = 1600;
/** The uploaded picture's side; the server keeps at most 512 px. */
export const OUT_SIDE = 512;
export const MAX_ZOOM = 5;

export class PhotoError extends Error {}

// ── Opening a chosen file (2026-11-13) ──
// What went wrong before, on phones: a valid JPG answered «this is not a picture» when the browser could
// not DECODE it (a 50 MP photo decoded at full size runs out of memory in a WebView) or could not READ it
// (a gallery photo still in the cloud, or a picker that hands over an empty file). Now the file is read
// once, its real format is told from its first bytes (not from its name or type, which phones often
// leave out or get wrong), it is decoded already shrunk, and each failure says what really happened.

export type PhotoKind = "jpeg" | "png" | "gif" | "webp" | "bmp" | "heif" | "avif";

const MIME: Record<PhotoKind, string> = {
	jpeg: "image/jpeg",
	png: "image/png",
	gif: "image/gif",
	webp: "image/webp",
	bmp: "image/bmp",
	heif: "image/heic",
	avif: "image/avif",
};

/** HEIF brands (iPhone and many Android cameras save HEIC): the box after «ftyp» at byte 4. */
const HEIF_BRANDS = ["heic", "heix", "hevc", "hevx", "heim", "heis", "hevm", "hevs", "mif1", "msf1"];
const AVIF_BRANDS = ["avif", "avis"];

const ascii = (b: Uint8Array, from: number, to: number) => String.fromCharCode(...b.slice(from, to));

/** The picture format from the file's first bytes, or null when they are no picture we know. */
export function sniff(b: Uint8Array): PhotoKind | null {
	if (b.length < 12) return null;
	if (b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff) return "jpeg";
	if (b[0] === 0x89 && ascii(b, 1, 4) === "PNG") return "png";
	if (ascii(b, 0, 4) === "GIF8") return "gif";
	if (ascii(b, 0, 4) === "RIFF" && ascii(b, 8, 12) === "WEBP") return "webp";
	if (b[0] === 0x42 && b[1] === 0x4d) return "bmp";
	if (ascii(b, 4, 8) === "ftyp") {
		// The major brand, then the compatible brands of the ftyp box.
		const size = Math.min(b.length, ((b[0] << 24) | (b[1] << 16) | (b[2] << 8) | b[3]) >>> 0 || 32);
		const brands: string[] = [ascii(b, 8, 12)];
		for (let i = 16; i + 4 <= size; i += 4) brands.push(ascii(b, i, i + 4));
		if (brands.some((x) => AVIF_BRANDS.includes(x))) return "avif";
		if (brands.some((x) => HEIF_BRANDS.includes(x))) return "heif";
	}
	return null;
}

/** HEIC/HEIF by content, not by name or type (phones often send neither). */
export async function looksLikeHeif(file: Blob): Promise<boolean> {
	return sniff(new Uint8Array(await file.slice(0, 64).arrayBuffer())) === "heif";
}

/** A JPEG's EXIF orientation (1–8; 1 = as stored). Orientations 5–8 swap width and height. */
export function jpegOrientation(b: Uint8Array): number {
	let i = 2;
	while (i + 4 < b.length && b[i] === 0xff) {
		const marker = b[i + 1];
		const len = (b[i + 2] << 8) | b[i + 3];
		if (marker === 0xe1 && ascii(b, i + 4, i + 8) === "Exif") {
			const t = i + 10; // the TIFF header
			const little = b[t] === 0x49;
			const u16 = (o: number) => (little ? b[o] | (b[o + 1] << 8) : (b[o] << 8) | b[o + 1]);
			const u32 = (o: number) => (little ? (b[o] | (b[o + 1] << 8) | (b[o + 2] << 16) | (b[o + 3] << 24)) >>> 0 : ((b[o] << 24) | (b[o + 1] << 16) | (b[o + 2] << 8) | b[o + 3]) >>> 0);
			const ifd = t + u32(t + 4);
			const count = ifd + 2 <= b.length ? u16(ifd) : 0;
			for (let k = 0; k < count; k++) {
				const e = ifd + 2 + k * 12;
				if (e + 10 > b.length) break;
				if (u16(e) === 0x0112) {
					const v = u16(e + 8);
					return v >= 1 && v <= 8 ? v : 1;
				}
			}
			return 1;
		}
		if (marker === 0xda || len < 2) break; // the image data starts: no EXIF before it
		i += 2 + len;
	}
	return 1;
}

/** The stored size in pixels (before any EXIF rotation), from the header; null when not found. */
export function pictureSize(b: Uint8Array, kind: PhotoKind): { width: number; height: number } | null {
	const be16 = (o: number) => (b[o] << 8) | b[o + 1];
	const le16 = (o: number) => b[o] | (b[o + 1] << 8);
	const le24 = (o: number) => b[o] | (b[o + 1] << 8) | (b[o + 2] << 16);
	const be32 = (o: number) => ((b[o] << 24) | (b[o + 1] << 16) | (b[o + 2] << 8) | b[o + 3]) >>> 0;
	const ok = (width: number, height: number) => (width > 0 && height > 0 ? { width, height } : null);
	switch (kind) {
		case "jpeg": {
			let i = 2;
			while (i + 9 < b.length) {
				if (b[i] !== 0xff) {
					i++;
					continue;
				}
				const m = b[i + 1];
				// SOF0–SOF15, except DHT (C4), JPG (C8) and DAC (CC): the frame's size.
				if (m >= 0xc0 && m <= 0xcf && m !== 0xc4 && m !== 0xc8 && m !== 0xcc) return ok(be16(i + 7), be16(i + 5));
				if (m === 0xd8 || m === 0x01 || (m >= 0xd0 && m <= 0xd7)) {
					i += 2;
					continue;
				}
				i += 2 + be16(i + 2);
			}
			return null;
		}
		case "png":
			return b.length >= 24 ? ok(be32(16), be32(20)) : null;
		case "gif":
			return b.length >= 10 ? ok(le16(6), le16(8)) : null;
		case "bmp":
			return b.length >= 26 ? ok(Math.abs(le16(18) | (le16(20) << 16)), Math.abs(le16(22) | (le16(24) << 16))) : null;
		case "webp": {
			const chunk = ascii(b, 12, 16);
			if (chunk === "VP8X" && b.length >= 30) return ok(le24(24) + 1, le24(27) + 1);
			if (chunk === "VP8 " && b.length >= 30) return ok(le16(26) & 0x3fff, le16(28) & 0x3fff);
			if (chunk === "VP8L" && b.length >= 25) {
				const bits = (b[21] | (b[22] << 8) | (b[23] << 16) | (b[24] << 24)) >>> 0;
				return ok((bits & 0x3fff) + 1, ((bits >> 14) & 0x3fff) + 1);
			}
			return null;
		}
		default:
			return null; // (HEIF/AVIF: their size is deep in the file; they decode without a size hint)
	}
}

const UNREADABLE = "این عکس از گوشی خوانده نشد (شاید هنوز در فضای ابری است یا دسترسی به آن قطع شد)؛ دوباره انتخاب کن یا عکس دیگری بفرست.";
const NOT_A_PICTURE = "این فایل عکس نیست؛ یک عکس انتخاب کن (JPG، PNG، WebP، HEIC، AVIF، GIF یا BMP).";
const NOT_DECODED = "این عکس باز نشد؛ شاید خیلی بزرگ است. یک عکس دیگر یا اسکرین‌شات همین عکس را انتخاب کن.";

type Source = CanvasImageSource & { width: number; height: number; close?: () => void };

/** Decodes the picture, asking the browser for a copy already at most WORK_SIDE px when the size is known. */
async function decode(blob: Blob, size: { width: number; height: number } | null, swap: boolean): Promise<Source> {
	if (typeof createImageBitmap === "function") {
		if (size) {
			const w = swap ? size.height : size.width; // (the size as shown, after the EXIF turn)
			const h = swap ? size.width : size.height;
			const k = Math.min(1, WORK_SIDE / Math.max(w, h));
			if (k < 1) {
				try {
					// Decoded straight at the small size: a 50 MP photo never has to fit in memory whole.
					return await createImageBitmap(blob, { imageOrientation: "from-image", resizeWidth: Math.max(1, Math.round(w * k)), resizeHeight: Math.max(1, Math.round(h * k)), resizeQuality: "high" });
				} catch {
					// (a browser without the resize options: the plain decode below)
				}
			}
		}
		try {
			// Camera photos keep their EXIF rotation.
			return await createImageBitmap(blob, { imageOrientation: "from-image" });
		} catch {
			// Older WebViews refuse the options object or the format; the <img> path below may still work.
		}
	}
	const url = URL.createObjectURL(blob);
	try {
		const image = new Image();
		image.decoding = "async";
		await new Promise<void>((resolve, reject) => {
			image.onload = () => resolve();
			image.onerror = () => reject(new Error("decode"));
			image.src = url;
		});
		return Object.assign(image, { width: image.naturalWidth, height: image.naturalHeight });
	} finally {
		URL.revokeObjectURL(url);
	}
}

function canvasOf(width: number, height: number) {
	const canvas = document.createElement("canvas");
	canvas.width = width;
	canvas.height = height;
	const ctx = canvas.getContext("2d");
	if (!ctx) throw new PhotoError("canvas");
	return { canvas, ctx };
}

/** Chrome and Android cannot show HEIC: a libheif decoder, downloaded only for such a photo (a slow
 * connection gets a clear answer instead of a picker that seems to hang). */
async function decodeHeif(file: Blob): Promise<Source> {
	const load = import("heic-to/next");
	const timeout = new Promise<never>((_, reject) => setTimeout(() => reject(new Error("timeout")), 45_000));
	const { heicTo } = await Promise.race([load, timeout]);
	const bitmap = await heicTo({ blob: file, type: "bitmap", options: { imageOrientation: "from-image" } });
	return bitmap as unknown as Source;
}

/** The chosen file as a canvas of at most WORK_SIDE px, or a PhotoError with a message for the player. */
export async function openPhoto(file: File): Promise<HTMLCanvasElement> {
	if (file.size > 60 * 1024 * 1024) throw new PhotoError("حجم این عکس خیلی زیاد است؛ عکس دیگری انتخاب کن.");
	// Read once (a cloud photo or a revoked grant fails HERE: not a format problem).
	let buffer: ArrayBuffer;
	try {
		buffer = await file.arrayBuffer();
	} catch {
		throw new PhotoError(UNREADABLE);
	}
	const bytes = new Uint8Array(buffer);
	if (!bytes.length) throw new PhotoError(UNREADABLE);
	const kind = sniff(bytes);
	// The true type for the decoder (a picker's «application/octet-stream» or none at all misleads some).
	const blob = new Blob([buffer], { type: kind ? MIME[kind] : file.type || "" });
	const size = kind ? pictureSize(bytes, kind) : null;
	const swap = kind === "jpeg" && jpegOrientation(bytes) >= 5;
	let source: Source;
	try {
		// Whatever the browser shows itself first: JPEG, PNG, WebP, GIF, BMP, AVIF, and HEIC on Safari.
		source = await decode(blob, size, swap);
	} catch {
		const heif = kind === "heif" || (!kind && (/hei[cf]/i.test(file.type) || /\.hei[cf]$/i.test(file.name)));
		if (!heif) throw new PhotoError(kind ? NOT_DECODED : NOT_A_PICTURE);
		try {
			source = await decodeHeif(blob);
		} catch {
			throw new PhotoError("این عکس HEIC باز نشد (یا اینترنت برای باز کردنش کند بود)؛ دوباره امتحان کن یا یک عکس JPG انتخاب کن (یا از «گرفتن عکس» استفاده کن).");
		}
	}
	if (!source.width || !source.height) throw new PhotoError(NOT_DECODED);
	try {
		const k = Math.min(1, WORK_SIDE / Math.max(source.width, source.height));
		const { canvas, ctx } = canvasOf(Math.max(1, Math.round(source.width * k)), Math.max(1, Math.round(source.height * k)));
		ctx.drawImage(source, 0, 0, canvas.width, canvas.height);
		return canvas;
	} catch (e) {
		if (e instanceof PhotoError && e.message !== "canvas") throw e;
		throw new PhotoError(NOT_DECODED);
	} finally {
		if (typeof source.close === "function") source.close();
	}
}

/** The photo turned a quarter turn clockwise. */
export function rotateQuarter(photo: HTMLCanvasElement): HTMLCanvasElement {
	const { canvas, ctx } = canvasOf(photo.height, photo.width);
	ctx.translate(canvas.width, 0);
	ctx.rotate(Math.PI / 2);
	ctx.drawImage(photo, 0, 0);
	return canvas;
}

export interface Frame {
	/** The photo's top-left corner inside the viewport, in CSS px. */
	x: number;
	y: number;
	/** CSS px per photo px. */
	scale: number;
}

/** The smallest scale at which the photo still covers the round frame (diameter `d`). */
export function coverScale(width: number, height: number, d: number) {
	return d / Math.min(width, height);
}

/**
 * Keeps the photo covering the frame: scale between cover and MAX_ZOOM × cover, and no gap inside the
 * circle's square (`left`/`top` = the square's corner in the viewport, `d` = its side).
 */
export function clampFrame(f: Frame, width: number, height: number, left: number, top: number, d: number): Frame {
	const min = coverScale(width, height, d);
	const scale = Math.min(min * MAX_ZOOM, Math.max(min, f.scale));
	const w = width * scale;
	const h = height * scale;
	return {
		scale,
		x: Math.min(left, Math.max(left + d - w, f.x)),
		y: Math.min(top, Math.max(top + d - h, f.y)),
	};
}

/** Zooms to `next` keeping the photo point under (px, py) where it is (a pinch or a wheel turn). */
export function zoomAround(f: Frame, next: number, px: number, py: number): Frame {
	const k = next / f.scale;
	return { scale: next, x: px - (px - f.x) * k, y: py - (py - f.y) * k };
}

/** The framed square as a OUT_SIDE px JPEG. */
export function cutSquare(photo: HTMLCanvasElement, f: Frame, left: number, top: number, d: number): Promise<Blob> {
	const { canvas, ctx } = canvasOf(OUT_SIDE, OUT_SIDE);
	ctx.fillStyle = "#fff";
	ctx.fillRect(0, 0, OUT_SIDE, OUT_SIDE);
	ctx.imageSmoothingQuality = "high";
	const side = d / f.scale;
	ctx.drawImage(photo, (left - f.x) / f.scale, (top - f.y) / f.scale, side, side, 0, 0, OUT_SIDE, OUT_SIDE);
	return new Promise((resolve, reject) =>
		canvas.toBlob((blob) => (blob ? resolve(blob) : reject(new PhotoError("ساختن عکس نشد؛ دوباره امتحان کن."))), "image/jpeg", 0.9),
	);
}
