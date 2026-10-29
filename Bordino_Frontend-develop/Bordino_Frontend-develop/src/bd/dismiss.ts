"use client";

import { type RefObject, useEffect, useRef } from "react";

/**
 * While `active`, a tap anywhere outside `box` dismisses it — the same as the dialog's own
 * «cancel» (`onDismiss`) — and that tap does nothing else (it does not also press what is behind).
 * Taps, not touches: scrolling the page does not close anything. The tap that opened the box does
 * not count (the listener is added after it).
 */
export function useDismissOutside(active: boolean, box: RefObject<HTMLElement | null>, onDismiss: () => void) {
	const handler = useRef(onDismiss);
	handler.current = onDismiss;
	useEffect(() => {
		if (!active) return undefined;
		const onClick = (event: MouseEvent) => {
			const el = box.current;
			if (!el || (event.target instanceof Node && el.contains(event.target))) return;
			// Something else on top (the Android Back question, a toast): not ours to close.
			if (event.target instanceof Element && event.target.closest(".bd-sheet-backdrop, .bd-toast")) return;
			event.preventDefault();
			event.stopPropagation();
			handler.current();
		};
		document.addEventListener("click", onClick, true);
		return () => document.removeEventListener("click", onClick, true);
	}, [active, box]);
}
