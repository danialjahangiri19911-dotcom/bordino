"use client";

import { type PointerEvent as ReactPointerEvent, type RefObject, useEffect } from "react";

/**
 * «Seesaw tilt» (2026-11-28): the main navigation tilts in 3D toward the tapped side — that end dips
 * away, the bar pivoting on its centre — then springs back. A horizontal bar (phones) turns on its
 * vertical axis, a vertical one (the desktop sidebar) on its horizontal axis. Nothing moves for a player
 * who asked for reduced motion.
 *
 * Each page draws its own navigation, so a tap that opens another page would cut the motion short; the
 * tilt in progress is kept here and the next page's bar picks it up where it was.
 */
const DURATION = 620;
const MAX_DEG = 11;

let current: { axis: "x" | "y"; deg: number; start: number } | null = null;

const reducedMotion = () => typeof window !== "undefined" && !!window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;

/** Dip toward the tap, overshoot back past level a little, settle (a spring). */
function frames(axis: "x" | "y", deg: number): Keyframe[] {
	const t = (d: number) => `perspective(520px) rotate${axis === "y" ? "Y" : "X"}(${d.toFixed(2)}deg)`;
	return [
		{ transform: t(0), offset: 0 },
		{ transform: t(deg), offset: 0.28, easing: "cubic-bezier(.3,.7,.4,1)" },
		{ transform: t(-deg * 0.32), offset: 0.55 },
		{ transform: t(deg * 0.12), offset: 0.75 },
		{ transform: t(-deg * 0.04), offset: 0.88 },
		{ transform: t(0), offset: 1 },
	];
}

function play(el: HTMLElement, axis: "x" | "y", deg: number, from = 0) {
	el.getAnimations?.().forEach((a) => a.cancel());
	// (no easing over the whole run: each keyframe carries its own, so the deepest tilt is at 28%)
	const anim = el.animate?.(frames(axis, deg), { duration: DURATION });
	if (anim && from > 0) anim.currentTime = from;
}

/** The bar's own pointer handler (tap side → tilt) and the hand-over of a tilt from the previous page. */
export function useSeesaw(ref: RefObject<HTMLElement | null>) {
	useEffect(() => {
		const el = ref.current;
		if (!el || !current || reducedMotion()) return;
		const elapsed = performance.now() - current.start;
		if (elapsed < DURATION) play(el, current.axis, current.deg, elapsed);
	}, [ref]);
	return (e: ReactPointerEvent<HTMLElement>) => {
		const el = ref.current;
		if (!el || reducedMotion()) return;
		const box = el.getBoundingClientRect();
		const horizontal = box.width >= box.height;
		// −1 … 1: where on the bar the tap landed, from its centre
		const pos = horizontal ? (e.clientX - (box.left + box.width / 2)) / (box.width / 2) : (e.clientY - (box.top + box.height / 2)) / (box.height / 2);
		const amount = Math.max(-1, Math.min(1, pos));
		if (Math.abs(amount) < 0.08) return; // a tap at the very middle: the seesaw stays level
		// The tapped end dips away from the viewer (measured at the deepest frame: a positive rotateY sends
		// the right edge back, a positive rotateX the bottom edge; `amount` is + for right / bottom).
		const axis = horizontal ? "y" : "x";
		const deg = amount * MAX_DEG;
		current = { axis, deg, start: performance.now() };
		play(el, axis, deg);
	};
}
