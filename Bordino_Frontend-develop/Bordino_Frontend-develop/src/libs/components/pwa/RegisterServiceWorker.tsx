"use client";

import { useEffect } from "react";

/**
 * Registers the service worker next-pwa generates (/sw.js). next-pwa 5 injects its own registration
 * into the Pages Router entry, which the App Router does not have, so nothing registered it: no
 * install criteria, no cached static assets. Scope /pwa = the app (the worker only caches fonts and
 * images; pages and API answers are never cached, so no account's data can be served to another).
 */
export default function RegisterServiceWorker() {
	useEffect(() => {
		if (process.env.NODE_ENV !== "production" || !("serviceWorker" in navigator)) return;
		navigator.serviceWorker.register("/sw.js", { scope: "/pwa" }).catch(() => undefined);
	}, []);
	return null;
}
