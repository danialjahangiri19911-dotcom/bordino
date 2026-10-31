/**
 * A place's QR scanned while signed out: the code is kept through the sign-in (this device only, for
 * an hour) and the signed-in app opens it again.
 */
const KEY = "bd-pending-qr";
const KEEP_MS = 60 * 60 * 1000;

export function rememberQr(token: string) {
	try {
		localStorage.setItem(KEY, JSON.stringify({ token, at: Date.now() }));
	} catch {
		// Storage blocked: the player scans again after signing in.
	}
}

/** The waiting code (and forgets it), or null. */
export function takePendingQr(): string | null {
	try {
		const raw = localStorage.getItem(KEY);
		if (!raw) return null;
		localStorage.removeItem(KEY);
		const { token, at } = JSON.parse(raw) as { token?: unknown; at?: unknown };
		return typeof token === "string" && typeof at === "number" && Date.now() - at < KEEP_MS ? token : null;
	} catch {
		return null;
	}
}
