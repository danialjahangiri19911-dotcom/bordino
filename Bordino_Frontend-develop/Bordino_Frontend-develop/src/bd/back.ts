"use client";

import { useEffect, useRef } from "react";

/**
 * What the Android Back button does first (BackButton.tsx): the most recently opened overlay that
 * registered here (a sheet, a dialog, a game's exit question) gets it. Only when nothing is
 * registered does Back go to the previous page.
 */
const stack: { current: () => void }[] = [];

/** While `active`, Back calls `onBack` (usually: close this overlay) instead of leaving the page. */
export function useBackHandler(active: boolean, onBack: () => void) {
	const handler = useRef(onBack);
	handler.current = onBack;
	useEffect(() => {
		if (!active) return;
		const entry = { current: () => handler.current() };
		stack.push(entry);
		return () => {
			const i = stack.lastIndexOf(entry);
			if (i >= 0) stack.splice(i, 1);
		};
	}, [active]);
}

/** Gives Back to the newest overlay; false when there is none. */
export function handleBackInPage(): boolean {
	const top = stack[stack.length - 1];
	if (!top) return false;
	top.current();
	return true;
}

export interface LeaveQuestion {
	title: string;
	text: string;
	yes: string;
}

/** Asks `q` and, on «yes», leaves the page (set by BackButton; null outside the Android app). */
let ask: ((q: LeaveQuestion) => void) | null = null;

export function setLeaveAsker(fn: typeof ask) {
	ask = fn;
}

/**
 * While `active` (a round in progress), Back first asks `question`; «yes» goes back as usual.
 * Without the asker (a browser), Back is the browser's own and this does nothing.
 */
export function useLeaveGuard(active: boolean, question: LeaveQuestion) {
	useBackHandler(active, () => ask?.(question));
}
