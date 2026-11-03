import { currentUserId } from "@/libs/stores/authStore";

/**
 * One id per money action (a game charge, a wheel spin, a withdrawal), kept while its outcome is
 * unknown (no answer, or a server error): sending again reuses it and the server returns the first
 * result instead of charging, spinning or withdrawing a second time. Only an answer ends it —
 * success or a refusal (4xx; a 409 means the server already has the first one) — so the next
 * action gets a new id.
 *
 * Kept in this browser, per account, until answered: a reload, another tab or a later visit still
 * sends the same id (the server saw it, the page did not). There is no expiry on purpose: if the
 * first request never arrived, the same id simply makes it once; if it did, the server answers
 * with it. A key names the action AND its details (game, wheel and multiplier), so a different
 * action never reuses another's id.
 */
const STORE_KEY = "bd-pending-requests";

type Stored = Record<string, string>;
const memory = new Map<string, string>();

function scoped(key: string) {
	return `${currentUserId()}|${key}`;
}

function load(): Stored | null {
	try {
		const all = JSON.parse(localStorage.getItem(STORE_KEY) ?? "{}") as unknown;
		if (!all || typeof all !== "object") return {};
		// Only id strings (older builds stored {id, at}: those are taken over as they are).
		return Object.fromEntries(
			Object.entries(all as Record<string, unknown>)
				.map(([k, v]) => [k, typeof v === "string" ? v : (v as { id?: unknown })?.id])
				.filter((entry): entry is [string, string] => typeof entry[1] === "string"),
		);
	} catch {
		return null; // no storage here: memory stands in
	}
}

function save(all: Stored) {
	try {
		localStorage.setItem(STORE_KEY, JSON.stringify(all));
	} catch {
		// private mode: the in-memory id still covers retries on this page
	}
}

function newRequestId() {
	return typeof crypto !== "undefined" && crypto.randomUUID ? crypto.randomUUID() : `${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

/** The id still waiting for an answer under `key` (this account), if any — without making one. */
export function pendingRequestId(key: string): string | null {
	const k = scoped(key);
	const all = load();
	return (all ? all[k] : memory.get(k)) ?? null;
}

/** The id for `key` (this account): the pending one if there is one, else a new one. */
export function requestIdFor(key: string): string {
	const k = scoped(key);
	const all = load();
	const id = (all ? all[k] : memory.get(k)) ?? newRequestId();
	memory.set(k, id);
	if (all && all[k] !== id) save({ ...all, [k]: id });
	return id;
}

/**
 * The action sent with `id` got an answer. Only that id is cleared: another tab (or a later tap)
 * may already be waiting on a newer one under the same key.
 */
export function settleRequestId(key: string, id: string) {
	const k = scoped(key);
	if (memory.get(k) === id) memory.delete(k);
	const all = load();
	if (all && all[k] === id) {
		delete all[k];
		save(all);
	}
}

/** True when a failure leaves the outcome unknown: no answer, or a server error. */
export function isUncertain(e: unknown) {
	const status = (e as { response?: { status?: number } })?.response?.status;
	return !status || status >= 500;
}

export async function withRequestId<T>(key: string, send: (requestId: string) => Promise<T>): Promise<T> {
	const requestId = requestIdFor(key);
	try {
		const result = await send(requestId);
		settleRequestId(key, requestId);
		return result;
	} catch (e) {
		if (!isUncertain(e)) settleRequestId(key, requestId);
		throw e;
	}
}
