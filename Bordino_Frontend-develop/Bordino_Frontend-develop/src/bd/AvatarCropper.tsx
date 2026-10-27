"use client";

import { useCallback, useEffect, useRef, useState } from "react";

const VIEW = 260; // the square (and its circle) the player frames, in CSS pixels
const OUT = 512; // the uploaded picture's side; the server keeps at most 512 px
const MAX_ZOOM = 4;

interface Props {
	file: File;
	onCancel: () => void;
	onDone: (picture: Blob) => void;
}

/**
 * «کدام بخش عکس دیده شود؟»: the chosen photo under a round frame; drag (or the arrow keys) to move
 * it, the slider (or +/−) to zoom. «ذخیره» sends exactly the framed square.
 */
export default function AvatarCropper({ file, onCancel, onDone }: Readonly<Props>) {
	const [img, setImg] = useState<HTMLImageElement | null>(null);
	const [failed, setFailed] = useState(false);
	const [zoom, setZoom] = useState(1);
	const [pos, setPos] = useState({ x: 0, y: 0 });
	const drag = useRef<{ id: number; x: number; y: number; px: number; py: number } | null>(null);
	const box = useRef<HTMLDivElement>(null);

	useEffect(() => {
		// A load that finishes after this file was replaced (or the effect re-ran) is ignored: its
		// object URL is already revoked, which would otherwise report the new photo as broken.
		let alive = true;
		setFailed(false);
		setImg(null);
		const url = URL.createObjectURL(file);
		const image = new Image();
		image.onload = () => {
			if (!alive) return;
			setImg(image);
			const s = VIEW / Math.min(image.naturalWidth, image.naturalHeight);
			// Start centred, filling the frame.
			setPos({ x: (VIEW - image.naturalWidth * s) / 2, y: (VIEW - image.naturalHeight * s) / 2 });
		};
		image.onerror = () => alive && setFailed(true);
		image.src = url;
		return () => {
			alive = false;
			URL.revokeObjectURL(url);
		};
	}, [file]);

	useEffect(() => {
		box.current?.focus();
		const onKey = (e: KeyboardEvent) => {
			if (e.key === "Escape") onCancel();
		};
		window.addEventListener("keydown", onKey);
		return () => window.removeEventListener("keydown", onKey);
	}, [onCancel, img]);

	const scale = img ? (VIEW / Math.min(img.naturalWidth, img.naturalHeight)) * zoom : 1;
	const w = img ? img.naturalWidth * scale : VIEW;
	const h = img ? img.naturalHeight * scale : VIEW;
	// The picture always covers the whole frame.
	const clamp = useCallback(
		(x: number, y: number, cw = w, ch = h) => ({
			x: Math.min(0, Math.max(VIEW - cw, x)),
			y: Math.min(0, Math.max(VIEW - ch, y)),
		}),
		[w, h],
	);

	const setZoomKeepingCentre = (next: number) => {
		if (!img) return;
		const z = Math.min(MAX_ZOOM, Math.max(1, next));
		const base = VIEW / Math.min(img.naturalWidth, img.naturalHeight);
		const nw = img.naturalWidth * base * z;
		const nh = img.naturalHeight * base * z;
		// The point of the picture under the frame's centre stays there.
		const cx = (VIEW / 2 - pos.x) / w;
		const cy = (VIEW / 2 - pos.y) / h;
		setZoom(z);
		setPos(clamp(VIEW / 2 - cx * nw, VIEW / 2 - cy * nh, nw, nh));
	};

	const save = () => {
		if (!img) return;
		const canvas = document.createElement("canvas");
		canvas.width = OUT;
		canvas.height = OUT;
		const ctx = canvas.getContext("2d");
		if (!ctx) return;
		ctx.fillStyle = "#fff";
		ctx.fillRect(0, 0, OUT, OUT);
		const side = VIEW / scale;
		ctx.drawImage(img, -pos.x / scale, -pos.y / scale, side, side, 0, 0, OUT, OUT);
		canvas.toBlob((blob) => blob && onDone(blob), "image/jpeg", 0.9);
	};

	return (
		<div className="bd-crop-backdrop" role="presentation" onClick={(e) => e.target === e.currentTarget && onCancel()}>
			<section className="bd-product st-brutal bd-panel bd-crop" role="dialog" aria-modal="true" aria-label="انتخاب بخش نمایش عکس پروفایل">
				<h3>کدام بخش عکس دیده شود؟</h3>
				<p className="bd-muted">عکس را بکش تا جای دلخواه داخل دایره بیاید؛ با نوار پایین بزرگ‌نمایی کن.</p>
				{failed ? (
					<p className="bd-field-error">این عکس باز نشد؛ یک عکس JPG، PNG یا WebP دیگر انتخاب کن.</p>
				) : (
					<div
						ref={box}
						className="bd-crop-view"
						dir="ltr"
						tabIndex={0}
						aria-label="کادر عکس؛ با کلیدهای جهت جابه‌جا و با + و − بزرگ‌نمایی کن"
						style={{ width: VIEW, height: VIEW }}
						onPointerDown={(e) => {
							e.currentTarget.setPointerCapture(e.pointerId);
							drag.current = { id: e.pointerId, x: e.clientX, y: e.clientY, px: pos.x, py: pos.y };
						}}
						onPointerMove={(e) => {
							const d = drag.current;
							if (!d || d.id !== e.pointerId) return;
							setPos(clamp(d.px + e.clientX - d.x, d.py + e.clientY - d.y));
						}}
						onPointerUp={() => {
							drag.current = null;
						}}
						onPointerCancel={() => {
							drag.current = null;
						}}
						onKeyDown={(e) => {
							const step = e.shiftKey ? 30 : 10;
							const moves: Record<string, [number, number]> = { ArrowLeft: [step, 0], ArrowRight: [-step, 0], ArrowUp: [0, step], ArrowDown: [0, -step] };
							if (moves[e.key]) {
								e.preventDefault();
								setPos(clamp(pos.x + moves[e.key][0], pos.y + moves[e.key][1]));
							} else if (e.key === "+" || e.key === "=") setZoomKeepingCentre(zoom + 0.2);
							else if (e.key === "-") setZoomKeepingCentre(zoom - 0.2);
						}}
					>
						{img ? (
							<img src={img.src} alt="" draggable={false} style={{ width: w, height: h, transform: `translate(${pos.x}px, ${pos.y}px)` }} />
						) : (
							<span className="bd-muted">در حال باز کردن عکس…</span>
						)}
						<span className="bd-crop-ring" aria-hidden="true" />
					</div>
				)}
				<label className="rt-field bd-crop-zoom">
					<span>بزرگ‌نمایی</span>
					<input type="range" min={1} max={MAX_ZOOM} step={0.01} value={zoom} disabled={!img} onChange={(e) => setZoomKeepingCentre(Number(e.target.value))} />
				</label>
				<div className="bd-actions">
					<button type="button" className="bd-action" disabled={!img} onClick={save}>
						ذخیرهٔ عکس
					</button>
					<button type="button" className="bd-secondary" onClick={onCancel}>
						انصراف
					</button>
				</div>
			</section>
		</div>
	);
}
