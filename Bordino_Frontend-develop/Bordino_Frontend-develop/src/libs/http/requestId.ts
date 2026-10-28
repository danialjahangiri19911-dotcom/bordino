/**
 * One id per money action (a game charge, a wheel spin), kept while its outcome is unknown (no
 * answer, or a server error): sending again reuses it and the server returns the first result
 * instead of charging or spinning a second time. A clear answer — success or a 4xx refusal —
 * ends it, so the next action gets a new id.
 */
const pending = new Map<string, string>();

function newRequestId() {
	return typeof crypto !== "undefined" && crypto.randomUUID ? crypto.randomUUID() : `${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

export async function withRequestId<T>(key: string, send: (requestId: string) => Promise<T>): Promise<T> {
	const requestId = pending.get(key) ?? newRequestId();
	pending.set(key, requestId);
	try {
		const result = await send(requestId);
		pending.delete(key);
		return result;
	} catch (e) {
		const status = (e as { response?: { status?: number } })?.response?.status;
		if (status && status < 500) pending.delete(key);
		throw e;
	}
}
