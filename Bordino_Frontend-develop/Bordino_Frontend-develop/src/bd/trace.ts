/**
 * Step-by-step traces of a flow the server cannot see (2026-11-14: the profile photo — attempts that failed
 * on the phone and never reached the server). Each step goes to /api/v1/client-log/ (apps.clientlog), grouped
 * by an attempt id; staff read them in «بردینو ادمین» by phone number. Never blocks or breaks the flow: a
 * step that cannot be sent is dropped.
 */
import { withAuth } from "@/libs/http/query";
import useAuthStore from "@libs/stores/authStore";
import requester from "@/libs/http/requester";

type Flow = "profile_photo" | "mission_photo";
type Event = { step: string; level: "info" | "error"; data: Record<string, unknown>; at: string };

const queues = new Map<string, { flow: Flow; attempt: string; events: Event[]; envSent: boolean }>();
let timer: ReturnType<typeof setTimeout> | null = null;

/** A new attempt id (one per pick of a photo; the server's own steps of the upload carry the same). */
export function newAttempt(): string {
	try {
		return crypto.randomUUID().slice(0, 12);
	} catch {
		return `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`;
	}
}

/** The device and browser, once per attempt. */
function env(): Record<string, unknown> {
	const w = window as unknown as { Capacitor?: { isNativePlatform?: () => boolean; getPlatform?: () => string } };
	const nav = navigator as Navigator & { deviceMemory?: number; userAgentData?: { mobile?: boolean; platform?: string } };
	return {
		app: w.Capacitor?.isNativePlatform?.() ? `native:${w.Capacitor.getPlatform?.() ?? "?"}` : "web",
		standalone: window.matchMedia?.("(display-mode: standalone)").matches ?? false,
		memory_gb: nav.deviceMemory ?? null,
		screen: `${window.screen?.width}x${window.screen?.height}@${window.devicePixelRatio}`,
		bitmap: typeof createImageBitmap === "function",
		online: navigator.onLine,
		lang: navigator.language,
		page: window.location.pathname,
	};
}

/** The page is closing or going to the background: what is waiting goes now, even if the page ends. */
function flushOnLeave() {
	const token = useAuthStore.getState().accessToken;
	for (const q of queues.values()) {
		if (!q.events.length) continue;
		const body = JSON.stringify({ flow: q.flow, attempt: q.attempt, env: q.envSent ? undefined : env(), events: q.events.splice(0, 30) });
		q.envSent = true;
		try {
			void fetch("/api/v1/client-log/", { method: "POST", keepalive: true, headers: { "Content-Type": "application/json", ...(token ? { Authorization: `Bearer ${token}` } : {}) }, body }).catch(() => undefined);
		} catch {
			// dropped
		}
	}
}

let listening = false;
function listen() {
	if (listening || typeof window === "undefined") return;
	listening = true;
	window.addEventListener("pagehide", flushOnLeave);
	document.addEventListener("visibilitychange", () => document.visibilityState === "hidden" && flushOnLeave());
}

async function flush() {
	timer = null;
	const batches = [...queues.values()].filter((q) => q.events.length);
	for (const q of batches) {
		const events = q.events.splice(0, 30);
		const body = { flow: q.flow, attempt: q.attempt, env: q.envSent ? undefined : env(), events };
		q.envSent = true;
		try {
			await withAuth((token) => requester.post("client-log/", body, { headers: token ? { Authorization: `Bearer ${token}` } : undefined }));
		} catch {
			// dropped: tracing must never get in the way
		}
	}
}

/** One step of an attempt (sent within a second, in batches). */
export function trace(flow: Flow, attempt: string, step: string, data: Record<string, unknown> = {}, level: "info" | "error" = "info") {
	if (typeof window === "undefined" || !attempt) return;
	const key = `${flow}:${attempt}`;
	const q = queues.get(key) ?? { flow, attempt, events: [], envSent: false };
	queues.set(key, q);
	q.events.push({ step, level, data, at: new Date().toISOString() });
	listen();
	// An error goes at once (the player may leave right after it); the rest in a batch within a second.
	if (level === "error") {
		if (timer) clearTimeout(timer);
		timer = setTimeout(() => void flush(), 0);
	} else if (!timer) timer = setTimeout(() => void flush(), 800);
}

/** An error as text for a trace (name, message, and nothing huge). */
export function errorInfo(e: unknown): Record<string, unknown> {
	if (e instanceof Error) return { error: `${e.name}: ${e.message}`.slice(0, 300) };
	return { error: String(e).slice(0, 300) };
}
