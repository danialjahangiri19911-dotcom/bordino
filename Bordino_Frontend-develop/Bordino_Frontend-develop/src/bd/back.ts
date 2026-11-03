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

/**
 * The browser's own Back (a browser, not the Android app, whose Back is useBackHandler's): while
 * `active`, one extra history entry for this same page catches it and `onBack` asks instead. The
 * entry copies Next's history state, so its router just shows this page again; it is taken back
 * off when the round is over. (Shared by the games: crash, pantomime.)
 */
export function useBrowserBackGuard(active: boolean, onBack: () => void) {
	const handler = useRef(onBack);
	handler.current = onBack;
	useEffect(() => {
		if (!active || typeof window === "undefined") return undefined;
		const guard = { bdBackGuard: true };
		// This page as it is now: whatever Back reached (one step, or several from the browser's
		// history menu, which skips the guard entry), this page is put back and the game asks.
		const pageUrl = window.location.href;
		const pageState = { ...(window.history.state ?? {}) };
		window.history.pushState({ ...pageState, ...guard }, "", pageUrl);
		let armed = true;
		const onPop = () => {
			if (!armed) return;
			// Back left the guard entry: put it back and ask.
			window.history.pushState({ ...pageState, ...guard }, "", pageUrl);
			// Like Android Back: the newest overlay first (an open question closes), else the game.
			if (!handleBackInPage()) handler.current();
		};
		window.addEventListener("popstate", onPop);
		// Where the browser has the Navigation API (Chrome, the Android WebView): any move through the
		// history (several steps from its Back menu too) is cancelled before the router sees it, and
		// the game asks. popstate above is the fallback; it cannot stop a jump of several steps, as
		// the router unmounts this page before that listener's turn.
		type NavigateEvent = Event & { navigationType?: string; cancelable: boolean };
		const nav = (window as Window & { navigation?: EventTarget }).navigation;
		const onNavigate = (event: Event) => {
			const e = event as NavigateEvent;
			if (!armed || e.navigationType !== "traverse" || !e.cancelable) return;
			e.preventDefault();
			if (!handleBackInPage()) handler.current();
		};
		nav?.addEventListener("navigate", onNavigate);
		return () => {
			armed = false;
			nav?.removeEventListener("navigate", onNavigate);
			window.removeEventListener("popstate", onPop);
			// The round is over (or the page is leaving): drop the guard entry if it is still on top.
			if ((window.history.state as { bdBackGuard?: boolean } | null)?.bdBackGuard) window.history.back();
		};
	}, [active]);
}
