"use client";

import { useEffect, useSyncExternalStore } from "react";

import useThemeModeStore, { type Appearance } from "@libs/uiHooks/useThemeModeStore";

const DARK_QUERY = "(prefers-color-scheme: dark)";

/**
 * Runs in <head> before the page paints: reads the stored appearance (lt-theme-store) and marks
 * <html> with the resolved scheme, so a dark-mode player never sees a light flash. The design's
 * colours switch on html[data-bd-scheme="dark"] (see bd.css).
 */
export const APPEARANCE_SCRIPT = `(function(){try{var m="system";var s=localStorage.getItem("lt-theme-store");if(s){var v=JSON.parse(s);if(v&&v.state&&["light","dark","system"].indexOf(v.state.mode)>=0)m=v.state.mode;}var d=m==="dark"||(m==="system"&&window.matchMedia&&matchMedia("${DARK_QUERY}").matches);var e=document.documentElement;e.setAttribute("data-bd-scheme",d?"dark":"light");e.style.colorScheme=d?"dark":"light";}catch(_){}})();`;

function systemDark() {
	return typeof window !== "undefined" && !!window.matchMedia && window.matchMedia(DARK_QUERY).matches;
}

function subscribeSystem(onChange: () => void) {
	if (typeof window === "undefined" || !window.matchMedia) return () => undefined;
	const query = window.matchMedia(DARK_QUERY);
	query.addEventListener("change", onChange);
	return () => query.removeEventListener("change", onChange);
}

export function resolveScheme(mode: Appearance, deviceDark: boolean): "light" | "dark" {
	return mode === "dark" || (mode === "system" && deviceDark) ? "dark" : "light";
}

/** The scheme on screen now: the player's choice, or the device's while it is «مطابق دستگاه». */
export function useResolvedScheme(): "light" | "dark" {
	const { mode } = useThemeModeStore();
	const deviceDark = useSyncExternalStore(subscribeSystem, systemDark, () => false);
	return resolveScheme(mode, deviceDark);
}

/** Keeps <html data-bd-scheme> in step with the stored choice and with the device setting. */
export function useApplyScheme() {
	const scheme = useResolvedScheme();
	useEffect(() => {
		const root = document.documentElement;
		root.setAttribute("data-bd-scheme", scheme);
		root.style.colorScheme = scheme;
		const meta = document.querySelector('meta[name="theme-color"]');
		if (meta) meta.setAttribute("content", scheme === "dark" ? "#24211e" : "#fff8eb");
	}, [scheme]);
	return scheme;
}
