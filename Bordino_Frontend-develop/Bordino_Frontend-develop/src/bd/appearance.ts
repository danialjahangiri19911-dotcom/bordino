"use client";

import { useEffect, useSyncExternalStore } from "react";

import useThemeModeStore, { type Appearance, type BdStyle } from "@libs/uiHooks/useThemeModeStore";

const DARK_QUERY = "(prefers-color-scheme: dark)";

/**
 * Runs in <head> before the page paints: reads the stored appearance (lt-theme-store) and marks
 * <html> with the resolved scheme and the chosen style, so a player never sees a flash of the wrong
 * look. The design's colours switch on html[data-bd-scheme="dark"] (see bd.css) and the style on
 * html[data-bd-style] (themes.css). Neon is always dark.
 */
export const APPEARANCE_SCRIPT = `(function(){try{var m="system",t="brutal";var s=localStorage.getItem("lt-theme-store");if(s){var v=JSON.parse(s);if(v&&v.state&&["light","dark","system"].indexOf(v.state.mode)>=0)m=v.state.mode;if(v&&v.state&&["brutal","neon","neu"].indexOf(v.state.style)>=0)t=v.state.style;}var d=t==="neon"||m==="dark"||(m==="system"&&window.matchMedia&&matchMedia("${DARK_QUERY}").matches);var e=document.documentElement;e.setAttribute("data-bd-scheme",d?"dark":"light");e.setAttribute("data-bd-style",t);e.style.colorScheme=d?"dark":"light";}catch(_){}})();`;

/** The page background before and around the app, per style and scheme (the browser bar too). */
const PAGE_COLOR: Record<BdStyle, { light: string; dark: string }> = {
	brutal: { light: "#fff8eb", dark: "#24211e" },
	neon: { light: "#0e1020", dark: "#0e1020" },
	neu: { light: "#eceef2", dark: "#292e37" },
};

function systemDark() {
	return typeof window !== "undefined" && !!window.matchMedia && window.matchMedia(DARK_QUERY).matches;
}

function subscribeSystem(onChange: () => void) {
	if (typeof window === "undefined" || !window.matchMedia) return () => undefined;
	const query = window.matchMedia(DARK_QUERY);
	query.addEventListener("change", onChange);
	return () => query.removeEventListener("change", onChange);
}

export function resolveScheme(mode: Appearance, deviceDark: boolean, style: BdStyle = "brutal"): "light" | "dark" {
	return style === "neon" || mode === "dark" || (mode === "system" && deviceDark) ? "dark" : "light";
}

const SERVER_STYLE = (): BdStyle => "brutal";

/**
 * The chosen style. The server renders the default (brutal), so the first client render matches
 * it and then switches (useSyncExternalStore), never a hydration mismatch.
 */
export function useBdStyle(): BdStyle {
	return useSyncExternalStore(
		useThemeModeStore.subscribe,
		() => useThemeModeStore.getState().style ?? "brutal",
		SERVER_STYLE,
	);
}

/** The classes of a design surface (.bd-product) in the chosen style. */
export function styleClass(style: BdStyle): string {
	return style === "neon" ? "st-neon bd-night" : style === "neu" ? "st-neu" : "st-brutal";
}

/** A game's style class: `<prefix>-brutal`, `<prefix>-neon`, or `<prefix>-neu` (the games' base look). */
export function gameStyleClass(prefix: string, style: BdStyle): string {
	return `${prefix}-${style}`;
}

/** The scheme on screen now: the player's choice, or the device's while it is «مطابق دستگاه» (neon: dark). */
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
		if (meta) meta.setAttribute("content", PAGE_COLOR[style][scheme]);
	}, [scheme, style]);
	return scheme;
}
