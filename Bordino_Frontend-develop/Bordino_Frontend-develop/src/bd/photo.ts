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

/** Many phones hand over photos with no type, or a type the old check refused; decoding decides. */
async function decode(file: Blob): Promise<CanvasImageSource & { width: number; height: number }> {
	if (typeof createImageBitmap === "function") {
		try {
			// Camera photos keep their EXIF rotation.
			return await createImageBitmap(file, { imageOrientation: "from-image" });
		} catch {
			// Older WebViews refuse the options object or the format; the <img> path below may still work.
		}
	}
	const url = URL.createObjectURL(file);
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

/** HEIF brands (iPhone and many Android cameras save HEIC): the box after «ftyp» at byte 4. */
const HEIF_BRANDS = ["heic", "heix", "hevc", "hevx", "heim", "heis", "hevm", "hevs", "mif1", "msf1"];

/** HEIC/HEIF by content, not by name or type (phones often send neither). */
export async function looksLikeHeif(file: Blob): Promise<boolean> {
	const head = new Uint8Array(await file.slice(0, 12).arrayBuffer());
	if (head.length < 12) return false;
	const text = String.fromCharCode(...head.slice(4, 12));
	return text.startsWith("ftyp") && HEIF_BRANDS.includes(text.slice(4, 8));
}

/** Chrome and Android cannot show HEIC: a libheif decoder, downloaded only for such a photo. */
async function decodeHeif(file: Blob) {
	const { heicTo } = await import("heic-to/next");
	const bitmap = await heicTo({ blob: file, type: "bitmap", options: { imageOrientation: "from-image" } });
	return bitmap as ImageBitmap & { width: number; height: number };
}

/** The chosen file as a canvas of at most WORK_SIDE px, or a PhotoError with a message for the player. */
export async function openPhoto(file: File): Promise<HTMLCanvasElement> {
	if (file.size > 60 * 1024 * 1024) throw new PhotoError("حجم این عکس خیلی زیاد است؛ عکس دیگری انتخاب کن.");
	let source: Awaited<ReturnType<typeof decode>>;
	try {
		// Whatever the browser shows itself first: JPEG, PNG, WebP, GIF, BMP, AVIF, and HEIC on Safari.
		source = await decode(file);
	} catch {
		const heif = (await looksLikeHeif(file).catch(() => false)) || /hei[cf]/i.test(file.type) || /\.hei[cf]$/i.test(file.name);
		if (!heif) throw new PhotoError("این فایل عکس نیست یا باز نشد؛ یک عکس دیگر انتخاب کن (JPG، PNG، WebP، HEIC، AVIF، GIF یا BMP).");
		try {
			source = await decodeHeif(file);
		} catch {
			throw new PhotoError("این عکس HEIC باز نشد؛ یک عکس JPG یا PNG انتخاب کن (یا از «گرفتن عکس» استفاده کن).");
		}
	}
	if (!source.width || !source.height) throw new PhotoError("این فایل باز نشد؛ یک عکس دیگر انتخاب کن.");
	const k = Math.min(1, WORK_SIDE / Math.max(source.width, source.height));
	const { canvas, ctx } = canvasOf(Math.round(source.width * k), Math.round(source.height * k));
	ctx.drawImage(source, 0, 0, canvas.width, canvas.height);
	if ("close" in source && typeof source.close === "function") source.close();
	return canvas;
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
