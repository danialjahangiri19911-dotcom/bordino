"use client";

import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";

import Icon from "./Icon";
import { useBackHandler } from "./back";
import { type Frame, clampFrame, coverScale, cutSquare, PhotoError, rotateQuarter, zoomAround } from "./photo";

interface Props {
	/** The chosen photo, already opened and shrunk (photo.ts openPhoto). */
	photo: HTMLCanvasElement;
	onCancel: () => void;
	onDone: (picture: Blob) => void;
	/** The framed picture could not be made (for the trace). */
	onProblem?: (message: string, error: unknown) => void;
}

interface Box {
	w: number;
	h: number;
	/** The round frame's square: corner and side, in the stage's CSS px. */
	left: number;
	top: number;
	d: number;
}

function boxOf(w: number, h: number): Box {
	const d = Math.max(120, Math.min(w, h, 460) - 40);
	return { w, h, d, left: (w - d) / 2, top: (h - d) / 2 };
}

/** The photo filling the frame, centred. */
function fitted(photo: HTMLCanvasElement, b: Box): Frame {
	const scale = coverScale(photo.width, photo.height, b.d);
	return { scale, x: (b.w - photo.width * scale) / 2, y: (b.h - photo.height * scale) / 2 };
}

/**
 * Full-screen photo framing, as in Telegram: drag with one finger, pinch with two (or the mouse
 * wheel / + −), double-tap to zoom, rotate a quarter turn, ✓ to keep exactly what is in the circle.
 */
export default function AvatarEditor({ photo: chosen, onCancel, onDone, onProblem }: Readonly<Props>) {
	const [photo, setPhoto] = useState(chosen);
	const [box, setBox] = useState<Box | null>(null);
	const [frame, setFrame] = useState<Frame | null>(null);
	const [saving, setSaving] = useState(false);
	const [problem, setProblem] = useState<string | null>(null);
	const stage = useRef<HTMLDivElement>(null);
	const holder = useRef<HTMLDivElement>(null);
	// Gesture state lives in refs: pointer moves arrive faster than renders.
	const live = useRef<{ frame: Frame | null; box: Box | null }>({ frame: null, box: null });
	const pointers = useRef(new Map<number, { x: number; y: number }>());
	const pinch = useRef<{ dist: number; mx: number; my: number } | null>(null);
	const lastTap = useRef<{ t: number; x: number; y: number } | null>(null);
	const moved = useRef(0);

	const apply = useCallback(
		(next: Frame) => {
			const b = live.current.box;
			if (!b) return;
			const f = clampFrame(next, photo.width, photo.height, b.left, b.top, b.d);
			live.current.frame = f;
			setFrame(f);
		},
		[photo],
	);

	// The stage's size decides the frame; a rotation (new photo) or a resize starts from «fitted».
	useLayoutEffect(() => {
		const el = stage.current;
		if (!el) return;
		const measure = () => {
			const r = el.getBoundingClientRect();
			const b = boxOf(r.width, r.height);
			live.current.box = b;
			setBox(b);
			const f = fitted(photo, b);
			live.current.frame = f;
			setFrame(f);
		};
		measure();
		const ro = new ResizeObserver(measure);
		ro.observe(el);
		return () => ro.disconnect();
	}, [photo]);

	// The working canvas itself is shown (no second copy of a big photo in memory).
	useEffect(() => {
		const el = holder.current;
		if (!el) return;
		photo.className = "bd-photo-img";
		el.replaceChildren(photo);
	}, [photo]);

	// Android Back = «انصراف» (not while the picture is being cut).
	useBackHandler(true, () => !saving && onCancel());

	useEffect(() => {
		const prev = document.body.style.overflow;
		document.body.style.overflow = "hidden";
		stage.current?.focus();
		return () => {
			document.body.style.overflow = prev;
		};
	}, []);

	// The wheel needs a non-passive listener to keep the page from scrolling.
	useEffect(() => {
		const el = stage.current;
		if (!el) return;
		const onWheel = (e: WheelEvent) => {
			e.preventDefault();
			const f = live.current.frame;
			if (!f) return;
			const r = el.getBoundingClientRect();
			apply(zoomAround(f, f.scale * Math.exp(-e.deltaY * 0.0015), e.clientX - r.left, e.clientY - r.top));
		};
		el.addEventListener("wheel", onWheel, { passive: false });
		return () => el.removeEventListener("wheel", onWheel);
	}, [apply]);

	const local = (e: { clientX: number; clientY: number }) => {
		const r = stage.current!.getBoundingClientRect();
		return { x: e.clientX - r.left, y: e.clientY - r.top };
	};

	const doubleTap = (x: number, y: number) => {
		const f = live.current.frame;
		const b = live.current.box;
		if (!f || !b) return;
		const min = coverScale(photo.width, photo.height, b.d);
		apply(f.scale > min * 1.05 ? fitted(photo, b) : zoomAround(f, min * 2.5, x, y));
	};

	const zoomBy = (k: number) => {
		const f = live.current.frame;
		const b = live.current.box;
		if (f && b) apply(zoomAround(f, f.scale * k, b.w / 2, b.h / 2));
	};

	const confirm = async () => {
		const f = live.current.frame;
		const b = live.current.box;
		if (!f || !b || saving) return;
		setSaving(true);
		try {
			onDone(await cutSquare(photo, f, b.left, b.top, b.d));
		} catch (e) {
			setSaving(false);
			const message = e instanceof PhotoError ? e.message : "ساختن عکس نشد؛ دوباره امتحان کن.";
			onProblem?.(message, e);
			setProblem(message);
		}
	};

	const zoomPercent = frame && box ? Math.round((frame.scale / coverScale(photo.width, photo.height, box.d)) * 100) : 100;

	return (
		<div className="bd-photo-editor" role="dialog" aria-modal="true" aria-label="ویرایش عکس پروفایل">
			<p className="bd-photo-hint">عکس را بکش؛ با دو انگشت بزرگ و کوچک کن.</p>
			<div
				ref={stage}
				className="bd-photo-stage"
				dir="ltr"
				tabIndex={0}
				aria-label={`کادر عکس، بزرگ‌نمایی ${zoomPercent.toLocaleString("fa-IR")}٪؛ کلیدهای جهت برای جابه‌جایی، + و − برای بزرگ‌نمایی`}
				onPointerDown={(e) => {
					e.currentTarget.setPointerCapture(e.pointerId);
					pointers.current.set(e.pointerId, local(e));
					pinch.current = null;
					if (pointers.current.size === 1) moved.current = 0;
				}}
				onPointerMove={(e) => {
					const p = pointers.current.get(e.pointerId);
					const f = live.current.frame;
					if (!p || !f) return;
					const now = local(e);
					pointers.current.set(e.pointerId, now);
					if (pointers.current.size === 1) {
						moved.current += Math.abs(now.x - p.x) + Math.abs(now.y - p.y);
						apply({ ...f, x: f.x + now.x - p.x, y: f.y + now.y - p.y });
						return;
					}
					const [a, b] = [...pointers.current.values()];
					const dist = Math.hypot(a.x - b.x, a.y - b.y);
					const mx = (a.x + b.x) / 2;
					const my = (a.y + b.y) / 2;
					const prev = pinch.current;
					pinch.current = { dist, mx, my };
					moved.current += 100; // a pinch is never a tap
					if (!prev || !prev.dist) return;
					const z = zoomAround(f, f.scale * (dist / prev.dist), mx, my);
					apply({ ...z, x: z.x + mx - prev.mx, y: z.y + my - prev.my });
				}}
				onPointerUp={(e) => {
					const p = pointers.current.get(e.pointerId);
					pointers.current.delete(e.pointerId);
					pinch.current = null;
					if (!p || pointers.current.size || moved.current > 12) return;
					const t = Date.now();
					const last = lastTap.current;
					if (last && t - last.t < 320 && Math.hypot(p.x - last.x, p.y - last.y) < 30) {
						lastTap.current = null;
						doubleTap(p.x, p.y);
					} else lastTap.current = { t, x: p.x, y: p.y };
				}}
				onPointerCancel={(e) => {
					pointers.current.delete(e.pointerId);
					pinch.current = null;
				}}
				onKeyDown={(e) => {
					const f = live.current.frame;
					if (!f) return;
					const step = e.shiftKey ? 40 : 12;
					const moves: Record<string, [number, number]> = { ArrowLeft: [-step, 0], ArrowRight: [step, 0], ArrowUp: [0, -step], ArrowDown: [0, step] };
					if (moves[e.key]) {
						e.preventDefault();
						apply({ ...f, x: f.x + moves[e.key][0], y: f.y + moves[e.key][1] });
					} else if (e.key === "+" || e.key === "=") zoomBy(1.15);
					else if (e.key === "-") zoomBy(1 / 1.15);
					else if (e.key === "Enter") void confirm();
					else if (e.key === "Escape") onCancel();
				}}
			>
				<div
					ref={holder}
					className="bd-photo-holder"
					style={
						frame
							? { width: photo.width * frame.scale, height: photo.height * frame.scale, transform: `translate(${frame.x}px, ${frame.y}px)` }
							: { visibility: "hidden" }
					}
				/>
				{box ? <span className="bd-photo-ring" aria-hidden="true" style={{ left: box.left, top: box.top, width: box.d, height: box.d }} /> : null}
			</div>
			{problem ? (
				<p className="bd-photo-problem" role="alert">
					{problem}
				</p>
			) : null}
			<div className="bd-photo-bar">
				<button type="button" className="bd-photo-btn" onClick={onCancel} disabled={saving}>
					<Icon name="x" /> انصراف
				</button>
				<button
					type="button"
					className="bd-photo-btn bd-photo-round"
					aria-label="چرخاندن عکس"
					disabled={saving}
					onClick={() => {
						setProblem(null);
						setPhoto((p) => rotateQuarter(p));
					}}
				>
					<Icon name="rotate-cw" />
				</button>
				<button type="button" className="bd-photo-btn bd-photo-done" aria-label="تأیید و ذخیرهٔ عکس" onClick={() => void confirm()} disabled={saving || !frame}>
					{saving ? <Icon name="loader-circle" className="bd-spin" /> : <Icon name="check" />}
				</button>
			</div>
		</div>
	);
}
