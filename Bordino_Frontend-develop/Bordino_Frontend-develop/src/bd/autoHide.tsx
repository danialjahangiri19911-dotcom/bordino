"use client";

import { type ReactNode, useCallback, useEffect, useRef, useState } from "react";

import Icon from "./Icon";

/** Touches that start here belong to the game (2048 swipes are moves; text fields), not to the
 * bar. The other boards and buttons are tapped, not swiped (a moving finger presses nothing): a
 * pull over them works. */
const GAME_SURFACES = ".g48-board, input, select, textarea";
/** How far a pull at the top of the page must go to bring the bar down. */
const PULL = 60;
/** The bar goes away again by itself after this long without being used. */
const SHOW_MS = 3000;

/**
 * A game's top bar (title, sound, info, exit) while a round is in play: out of the way, so the
 * player can scroll and play freely (scrolling alone never brings it back). It comes back with a
 * tap on the small handle at the top edge, or by pulling down while already at the top of the
 * page; it goes away again after a few seconds, or at once when the player touches the game.
 * Before and after a round it is an ordinary bar. While playing it floats over the game, so
 * showing it never moves the board.
 */
export function GameBar({ playing, children }: { playing: boolean; children: ReactNode }) {
	const [shown, setShown] = useState(false);
	const box = useRef<HTMLDivElement>(null);
	const timer = useRef<number | null>(null);

	const hideLater = useCallback(() => {
		if (timer.current) window.clearTimeout(timer.current);
		timer.current = window.setTimeout(() => setShown(false), SHOW_MS);
	}, []);
	const show = useCallback(() => {
		setShown(true);
		hideLater();
	}, [hideLater]);

	useEffect(() => {
		setShown(false);
		if (!playing) return undefined;
		let pullFrom: number | null = null;
		const onTouchStart = (e: TouchEvent) => {
			const target = e.target instanceof Element ? e.target : null;
			if (box.current && target && box.current.contains(target)) return;
			// A touch on the game while the bar is down puts it away.
			setShown(false);
			// Only a pull that starts at the very top of the page, off the board.
			pullFrom = window.scrollY <= 0 && !target?.closest(GAME_SURFACES) ? (e.touches[0]?.clientY ?? null) : null;
		};
		const onTouchMove = (e: TouchEvent) => {
			if (pullFrom === null) return;
			if ((e.touches[0]?.clientY ?? pullFrom) - pullFrom > PULL) {
				pullFrom = null;
				show();
			}
		};
		const onMouseDown = (e: MouseEvent) => {
			if (box.current && e.target instanceof Node && box.current.contains(e.target)) return;
			setShown(false);
		};
		window.addEventListener("touchstart", onTouchStart, { passive: true });
		window.addEventListener("touchmove", onTouchMove, { passive: true });
		window.addEventListener("mousedown", onMouseDown);
		return () => {
			window.removeEventListener("touchstart", onTouchStart);
			window.removeEventListener("touchmove", onTouchMove);
			window.removeEventListener("mousedown", onMouseDown);
			if (timer.current) window.clearTimeout(timer.current);
		};
	}, [playing, show]);

	const hidden = playing && !shown;
	return (
		<div
			ref={box}
			className={`bd-bar ${playing ? "bd-bar-floating" : ""} ${hidden ? "bd-bar-hidden" : ""}`}
			// Using the bar (sound, info) keeps it up a little longer.
			onPointerDown={() => playing && shown && hideLater()}
		>
			{children}
			{hidden ? (
				<button type="button" className="bd-bar-handle" aria-label="نمایش نوار بالای بازی" onClick={show}>
					<Icon name="chevron-left" />
				</button>
			) : null}
		</div>
	);
}
