"use client";

import { useEffect, useSyncExternalStore } from "react";

import { PALETTES } from "./palettes";
import useThemeModeStore, { type Appearance, type BdStyle, DEFAULT_STYLE } from "@libs/uiHooks/useThemeModeStore";

const DARK_QUERY = "(prefers-color-scheme: dark)";

/**
 * Runs in <head> before the page paints: reads the stored appearance (lt-theme-store) and marks
 * <html> with the resolved scheme and the chosen style, so a player never sees a flash of the wrong
 * look. The design's colours switch on html[data-bd-scheme="dark"] (see bd.css) and the style on
 * html[data-bd-style] (themes.css). Every style has light and dark (Neon too since 2026-11-27); a
 * store from before that (version < 2) with Neon keeps the dark it always had.
 */
export const APPEARANCE_SCRIPT = `(function(){try{var m="system",t="neu";var s=localStorage.getItem("lt-theme-store");if(s){var v=JSON.parse(s);if(v&&v.state&&["light","dark","system"].indexOf(v.state.mode)>=0)m=v.state.mode;if(v&&v.state&&["brutal","neon","neu"].indexOf(v.state.style)>=0)t=v.state.style;if(t==="brutal"&&!(v.version>=1))t="neu";if(t==="neon"&&!(v.version>=2))m="dark";}var d=m==="dark"||(m==="system"&&window.matchMedia&&matchMedia("${DARK_QUERY}").matches);var e=document.documentElement;e.setAttribute("data-bd-scheme",d?"dark":"light");e.setAttribute("data-bd-style",t);e.style.colorScheme=d?"dark":"light";}catch(_){}})();`;

/** The page background before and around the app, per style and scheme (the browser bar too). */
const pageColor = (style: BdStyle, scheme: "light" | "dark") => PALETTES[style][scheme].page;

function systemDark() {
	return typeof window !== "undefined" && !!window.matchMedia && window.matchMedia(DARK_QUERY).matches;
}

function subscribeSystem(onChange: () => void) {
	if (typeof window === "undefined" || !window.matchMedia) return () => undefined;
	const query = window.matchMedia(DARK_QUERY);
	query.addEventListener("change", onChange);
	return () => query.removeEventListener("change", onChange);
}

export function resolveScheme(mode: Appearance, deviceDark: boolean, style: BdStyle = DEFAULT_STYLE): "light" | "dark" {
	void style; // (every style has both schemes; kept in the signature for its callers)
	return mode === "dark" || (mode === "system" && deviceDark) ? "dark" : "light";
}

const SERVER_STYLE = (): BdStyle => DEFAULT_STYLE;

/**
 * The chosen style. The server renders the default (neumorphism), so the first client render matches
 * it and then switches (useSyncExternalStore), never a hydration mismatch.
 */
export function useBdStyle(): BdStyle {
	return useSyncExternalStore(
		useThemeModeStore.subscribe,
		() => useThemeModeStore.getState().style ?? DEFAULT_STYLE,
		SERVER_STYLE,
	);
}

/** The classes of a design surface (.bd-product) in the chosen style. */
export function styleClass(style: BdStyle): string {
	return style === "neon" ? "st-neon bd-night" : style === "neu" ? "st-neu" : "st-brutal";
}

/**
 * One of the design's illustrations in the chosen style: neobrutalism's sit in /bd/art, the other
 * styles' (their own handoff's pictures) in /bd/art/<style>/, each at 400 and 840 px wide.
 */
export function artSrc(style: BdStyle, name: string, width: 400 | 840): string {
	return style === "brutal" ? `/bd/art/${name}-${width}.webp` : `/bd/art/${style}/${name}-${width}.webp`;
}

/** src and srcSet of an illustration in the player's style. */
export function useArt(name: string): { src: string; srcSet: string } {
	const style = useBdStyle();
	return { src: artSrc(style, name, 400), srcSet: `${artSrc(style, name, 400)} 400w, ${artSrc(style, name, 840)} 840w` };
}

/** A game's style class: `<prefix>-brutal`, `<prefix>-neon`, or `<prefix>-neu` (the games' base look). */
export function gameStyleClass(prefix: string, style: BdStyle): string {
	return `${prefix}-${style}`;
}

/** The scheme on screen now: the player's choice, or the device's while it is «مطابق دستگاه». */
export function useResolvedScheme(): "light" | "dark" {
	const { mode } = useThemeModeStore();
	const style = useBdStyle();
	const deviceDark = useSyncExternalStore(subscribeSystem, systemDark, () => false);
	return resolveScheme(mode, deviceDark, style);
}

/** Keeps <html data-bd-scheme> in step with the stored choice and with the device setting. */
export function useApplyScheme() {
	const scheme = useResolvedScheme();
	const style = useBdStyle();
	useEffect(() => {
		const root = document.documentElement;
		root.setAttribute("data-bd-scheme", scheme);
		root.setAttribute("data-bd-style", style);
		root.style.colorScheme = scheme;
		const meta = document.querySelector('meta[name="theme-color"]');
		if (meta) meta.setAttribute("content", pageColor(style, scheme));
	}, [scheme, style]);
	return scheme;
}
