/**
 * Where a guest was going when the app sent them to sign in (2026-11-26, product review: after the SMS
 * code the player lands where they meant to go, not on a fixed page). Kept on this device for 30
 * minutes; only the app's own pages, never the sign-in pages themselves.
 */
const KEY = "bd-after-login";
const KEEP_MS = 30 * 60 * 1000;
const AUTH_PAGES = ["/pwa/register", "/pwa/otp", "/pwa/onboarding", "/pwa/login"];

function usable(path: string): boolean {
	return path.startsWith("/pwa/") && !AUTH_PAGES.some((p) => path === p || path.startsWith(`${p}/`) || path.startsWith(`${p}?`));
}

export function rememberDestination(path: string) {
	if (!usable(path)) return;
	try {
		localStorage.setItem(KEY, JSON.stringify({ path, at: Date.now() }));
	} catch {
		// storage blocked: the player lands on the default page
	}
}

// What was taken a moment ago: a sign-in page that redirects twice (its profile answer re-rendering
// it) sends the player to the same place both times, not to the default page the second time.
let taken: { path: string | null; at: number } | null = null;

/** The remembered page (once: reading it forgets it), or null. */
export function takeDestination(): string | null {
	if (taken && Date.now() - taken.at < 5000) return taken.path;
	let path: string | null = null;
	try {
		const raw = localStorage.getItem(KEY);
		if (raw) {
			localStorage.removeItem(KEY);
			const saved = JSON.parse(raw) as { path?: unknown; at?: unknown };
			if (typeof saved.path === "string" && typeof saved.at === "number" && Date.now() - saved.at < KEEP_MS && usable(saved.path)) path = saved.path;
		}
	} catch {
		path = null;
	}
	taken = path ? { path, at: Date.now() } : null;
	return path;
}
