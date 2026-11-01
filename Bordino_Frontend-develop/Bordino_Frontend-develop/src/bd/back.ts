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
	/** The stay button (default «ماندن»). */
	no?: string;
}

/**
 * Asks `q`; on «yes» runs `go` (default: leave the page as Back would), on staying `stay`. Set by
 * BackButton.
 */
let ask: ((q: LeaveQuestion, go?: () => void, stay?: () => void) => void) | null = null;
/** The questions of the leave guards now active (newest last). */
const guards: LeaveQuestion[] = [];

export function setLeaveAsker(fn: typeof ask) {
	ask = fn;
}

/**
 * While `active` (a round in progress), Back first asks `question`; «yes» goes back as usual.
 * Without the asker (a browser), Back is the browser's own and this does nothing.
 */
export function useLeaveGuard(active: boolean, question: LeaveQuestion) {
	useBackHandler(active, () => ask?.(question));
	const q = useRef(question);
	q.current = question;
	useEffect(() => {
		if (!active) return;
		const entry = q.current;
		guards.push(entry);
		return () => {
			const i = guards.lastIndexOf(entry);
			if (i >= 0) guards.splice(i, 1);
		};
	}, [active]);
}

/**
 * A game's «leave now?» (its exit button, Back during a round): the one question sheet every game
 * shows, the same look and place. `stay` runs when the player stays (a paused timer resumes).
 */
export function askLeave(q: LeaveQuestion, go: () => void, stay?: () => void) {
	if (ask) ask(q, go, stay);
	else go();
}

/** Leaving by a button (a game's exit): asks first while a leave guard is active, then runs `go`. */
export function confirmLeave(go: () => void) {
	const q = guards[guards.length - 1];
	if (q && ask) ask(q, go);
	else go();
}
