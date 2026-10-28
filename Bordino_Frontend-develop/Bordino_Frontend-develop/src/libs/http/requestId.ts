/**
 * One id per money action (a game charge, a wheel spin, a withdrawal), kept while its outcome is
 * unknown (no answer, or a server error): sending again reuses it and the server returns the first
 * result instead of charging, spinning or withdrawing a second time. A clear answer — success or a
 * 4xx refusal — ends it, so the next action gets a new id.
 *
 * The pending ids are also kept in this browser for a while, so a reload after a lost answer still
 * sends the same id (the server saw it, the page did not).
 */
const STORE_KEY = "bd-pending-requests";
/** After this long an unanswered action is history: a new tap is a new action. */
const KEEP_MS = 15 * 60 * 1000;

type Stored = Record<string, { id: string; at: number }>;
const memory = new Map<string, string>();

function load(): Stored {
	try {
		const all = JSON.parse(localStorage.getItem(STORE_KEY) ?? "{}") as Stored;
		const now = Date.now();
		return Object.fromEntries(Object.entries(all).filter(([, v]) => v && typeof v.id === "string" && now - v.at < KEEP_MS));
	} catch {
		return {};
	}
}

function save(all: Stored) {
	try {
		localStorage.setItem(STORE_KEY, JSON.stringify(all));
	} catch {
		// private mode: the in-memory id still covers retries on this page
	}
}

function storageWorks() {
	try {
		localStorage.setItem(`${STORE_KEY}-probe`, "1");
		localStorage.removeItem(`${STORE_KEY}-probe`);
		return true;
	} catch {
		return false;
	}
}

function newRequestId() {
	return typeof crypto !== "undefined" && crypto.randomUUID ? crypto.randomUUID() : `${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

/** The id for `key`: the pending one (this page, or a reload within KEEP_MS), else a new one. */
export function requestIdFor(key: string): string {
	const all = load();
	// The stored id rules (it expires, and another tab may have settled it); memory only stands in
	// where this browser cannot store anything.
	const id = all[key]?.id ?? (storageWorks() ? undefined : memory.get(key)) ?? newRequestId();
	memory.set(key, id);
	save({ ...all, [key]: { id, at: all[key]?.at ?? Date.now() } });
	return id;
}

/** The action got a clear answer: the next one gets a new id. */
export function settleRequestId(key: string) {
	memory.delete(key);
	const all = load();
	delete all[key];
	save(all);
}

/** True when a failure leaves the outcome unknown (no answer, a server error, or a conflict). */
export function isUncertain(e: unknown) {
	const status = (e as { response?: { status?: number } })?.response?.status;
	return !status || status >= 500 || status === 409;
}

export async function withRequestId<T>(key: string, send: (requestId: string) => Promise<T>): Promise<T> {
	const requestId = requestIdFor(key);
	try {
		const result = await send(requestId);
		settleRequestId(key);
		return result;
	} catch (e) {
		const status = (e as { response?: { status?: number } })?.response?.status;
		if (status && status < 500) settleRequestId(key);
		throw e;
	}
}
