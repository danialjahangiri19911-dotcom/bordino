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

/** A private game's invite opened while signed out: kept through the sign-in like a QR. */
const INVITE_KEY = "bd-pending-invite";

export function rememberInvite(token: string) {
	try {
		localStorage.setItem(INVITE_KEY, JSON.stringify({ token, at: Date.now() }));
	} catch {
		// Storage blocked: the player opens the link again after signing in.
	}
}

export function takePendingInvite(): string | null {
	try {
		const raw = localStorage.getItem(INVITE_KEY);
		if (!raw) return null;
		localStorage.removeItem(INVITE_KEY);
		const { token, at } = JSON.parse(raw) as { token?: unknown; at?: unknown };
		return typeof token === "string" && typeof at === "number" && Date.now() - at < KEEP_MS ? token : null;
	} catch {
		return null;
	}
}
