"use client";

import { useEffect, useState } from "react";

/** Swipes that start here belong to the game (2048 moves, the boards), not to the top bar. */
const GAME_SURFACES = ".sd-board, .g48-board, .ck-board, .cr-stage, input, select, textarea";
const SWIPE = 40;
const SCROLL = 8;

/**
 * A game's top bar while a round is in play: hidden, back with a downward swipe (or scrolling up),
 * hidden again with an upward swipe (or scrolling down). Before and after a round it is shown as
 * usual. Returns whether the bar is hidden now. The caller renders the bar in `.bd-bar` so it
 * floats over the game while playing (showing it never pushes the board down).
 */
export function useAutoHideBar(playing: boolean): boolean {
	const [hidden, setHidden] = useState(false);
	useEffect(() => {
		if (!playing) {
			setHidden(false);
			return undefined;
		}
		setHidden(true);
		let lastY = window.scrollY;
		let touchY: number | null = null;
		const onScroll = () => {
			const y = window.scrollY;
			if (y < lastY - SCROLL) setHidden(false);
			else if (y > lastY + SCROLL) setHidden(true);
			lastY = y;
		};
		const onWheel = (e: WheelEvent) => {
			if (e.deltaY < -SCROLL) setHidden(false);
			else if (e.deltaY > SCROLL) setHidden(true);
		};
		const onTouchStart = (e: TouchEvent) => {
			const target = e.target instanceof Element ? e.target : null;
			touchY = target?.closest(GAME_SURFACES) ? null : (e.touches[0]?.clientY ?? null);
		};
		const onTouchMove = (e: TouchEvent) => {
			if (touchY === null) return;
			const dy = (e.touches[0]?.clientY ?? touchY) - touchY;
			if (dy > SWIPE) {
				setHidden(false);
				touchY = null;
			} else if (dy < -SWIPE) {
				setHidden(true);
				touchY = null;
			}
		};
		window.addEventListener("scroll", onScroll, { passive: true });
		window.addEventListener("wheel", onWheel, { passive: true });
		window.addEventListener("touchstart", onTouchStart, { passive: true });
		window.addEventListener("touchmove", onTouchMove, { passive: true });
		return () => {
			window.removeEventListener("scroll", onScroll);
			window.removeEventListener("wheel", onWheel);
			window.removeEventListener("touchstart", onTouchStart);
			window.removeEventListener("touchmove", onTouchMove);
		};
	}, [playing]);
	return hidden;
}

/** Class names for the bar's wrapper. */
export function barClass(playing: boolean, hidden: boolean) {
	return `bd-bar ${playing ? "bd-bar-floating" : ""} ${playing && hidden ? "bd-bar-hidden" : ""}`;
}
