"use client";

import { useSyncExternalStore } from "react";

import { useQuery, useQueryClient } from "@tanstack/react-query";

/**
 * «بردینو ادمین»'s own session and API client. The session is kept apart from the player app's (its
 * own storage key), so one phone can be signed in to both; its tokens are admin-app tokens (scope
 * "ops"): access 30 minutes, renewed here from the 12-hour refresh token, then a new SMS code.
 */

const KEY = "ops-auth";
const API = "/api/v1/ops/";

export interface OpsMe {
	id: string;
	phone: string;
	name: string;
	owner: boolean;
	roles: OpsRole[];
}
export type OpsRole = "reviewer" | "finance" | "settings" | "support";

interface Session {
	access: string;
	refresh: string;
	me: OpsMe;
}

export function session(): Session | null {
	try {
		const raw = localStorage.getItem(KEY);
		return raw ? (JSON.parse(raw) as Session) : null;
	} catch {
		return null;
	}
}

export function saveSession(s: Session | null) {
	try {
		if (s) localStorage.setItem(KEY, JSON.stringify(s));
		else localStorage.removeItem(KEY);
	} catch {
		// storage blocked: the session lasts this page only
	}
	window.dispatchEvent(new Event("ops-session"));
}

export class OpsError extends Error {
	status: number;
	code: string;
	data: Record<string, unknown>;
	constructor(message: string, status: number, code = "", data: Record<string, unknown> = {}) {
		super(message);
		this.status = status;
		this.code = code;
		this.data = data;
	}
}

let refreshing: { refresh: string; done: Promise<string | null> } | null = null;

/**
 * A new access token for THIS session (the one a request started with). It is stored only if that
 * session is still the device's session: a staff member who signs in meanwhile is never given, or
 * overwritten by, the previous one's token.
 */
async function renew(started: Session): Promise<string | null> {
	if (refreshing?.refresh === started.refresh) return refreshing.done;
	const done = (async () => {
		try {
			const r = await fetch(API + "auth/refresh/", {
				method: "POST",
				headers: { "Content-Type": "application/json", "Accept-Language": "fa" },
				body: JSON.stringify({ refresh: started.refresh }),
			});
			if (!r.ok) return null;
			const access: string | undefined = (await r.json())?.result?.access;
			if (!access) return null;
			const now = session();
			if (now?.refresh !== started.refresh) return null; // (someone else signed in meanwhile)
			saveSession({ ...now, access });
			return access;
		} catch {
			return null;
		} finally {
			setTimeout(() => {
				if (refreshing?.refresh === started.refresh) refreshing = null;
			}, 0);
		}
	})();
	refreshing = { refresh: started.refresh, done };
	return done;
}

function signedOut(started: Session | null) {
	// Only the session that failed ends (another staff member who signed in meanwhile stays).
	if (session()?.refresh !== started?.refresh) return;
	saveSession(null);
	// A full page load to the login page: nothing cached in memory survives the ended session.
	if (!location.pathname.startsWith("/ops/login")) location.replace("/ops/login");
}

/** One admin-app API call: the answer's `result`, or an OpsError with the server's message. A call
 * belongs to the session it started with: renewed and retried only within that session. */
export async function ops<T = unknown>(path: string, method = "GET", data?: unknown): Promise<T> {
	const started = session();
	const send = (access: string | undefined) =>
		fetch(API + path, {
			method,
			headers: {
				"Content-Type": "application/json",
				"Accept-Language": "fa",
				...(access ? { Authorization: `Bearer ${access}` } : {}),
			},
			body: data === undefined ? undefined : JSON.stringify(data),
		});
	let r = await send(started?.access);
	if (r.status === 401 && started && path.indexOf("auth/") !== 0) {
		const access = await renew(started);
		if (!access) {
			signedOut(started);
			throw new OpsError("نشست تمام شد؛ دوباره وارد شو.", 401, "signed_out");
		}
		r = await send(access); // (the same session's new token, never whoever is signed in now)
	}
	let body: { is_successful?: boolean; result?: T; errors?: Record<string, unknown> } = {};
	try {
		body = await r.json();
	} catch {
		// not JSON (a proxy error page)
	}
	if (!r.ok || body.is_successful === false) {
		const e = (body.errors ?? {}) as Record<string, unknown>;
		const message =
			(typeof e.error === "string" && e.error) ||
			(typeof e.detail === "string" && e.detail) ||
			(r.status === 403 ? "این بخش برای نقش تو باز نیست." : r.status >= 500 ? "خطای سرور؛ کمی بعد دوباره امتحان کن." : "درخواست انجام نشد.");
		throw new OpsError(message, r.status, typeof e.code === "string" ? e.code : "", e);
	}
	return body.result as T;
}

export function errorText(e: unknown): string {
	return e instanceof Error ? e.message : "درخواست انجام نشد.";
}

/** Who the stored session belongs to: every cached answer is kept under it, so another staff member
 * signing in on the same device never sees the previous one's data (not even for a moment). */
export function sessionUser(): string {
	return session()?.me?.id ?? "";
}

/** Session changes: this tab's own (ops-session) and any other tab's (storage). */
export function subscribeSession(cb: () => void) {
	window.addEventListener("ops-session", cb);
	window.addEventListener("storage", cb);
	return () => {
		window.removeEventListener("ops-session", cb);
		window.removeEventListener("storage", cb);
	};
}

/** Who is signed in now ("" nobody; null before the page has read the device's storage): a
 * component using it renders again when another tab signs in as someone else. */
export function useSessionUser(): string | null {
	return useSyncExternalStore(subscribeSession, sessionUser, () => null);
}

const REVOKE = "ops-revoke";
const pendingRevokes = (): string[] => {
	try {
		const list = JSON.parse(localStorage.getItem(REVOKE) || "[]");
		return Array.isArray(list) ? list.filter((x) => typeof x === "string").slice(-5) : [];
	} catch {
		return [];
	}
};
const keepRevokes = (list: string[]) => {
	try {
		if (list.length) localStorage.setItem(REVOKE, JSON.stringify(list.slice(-5)));
		else localStorage.removeItem(REVOKE);
	} catch {
		// storage blocked: nothing to keep
	}
};

/** Asks the server to end one session; true once it has (or it was already over / not ours). */
async function revoke(refresh: string): Promise<boolean> {
	try {
		const r = await fetch(API + "auth/logout/", {
			method: "POST",
			headers: { "Content-Type": "application/json", "Accept-Language": "fa" },
			body: JSON.stringify({ refresh }),
		});
		return r.ok || r.status === 400;
	} catch {
		return false;
	}
}

/** Sign-outs the server did not confirm (offline, busy): tried again whenever the admin app opens. */
export async function retryRevokes() {
	const list = pendingRevokes();
	if (!list.length) return;
	const left: string[] = [];
	for (const refresh of list) if (!(await revoke(refresh))) left.push(refresh);
	keepRevokes(left);
}

/** Ends the session on the server (by its refresh token: works after the access token expired),
 * then forgets it here, with every cached admin answer. */
export async function signOut(clear: () => void) {
	const s = session();
	// Not confirmed by the server: kept aside and sent again next time (never just forgotten while it
	// still works there).
	if (s?.refresh && !(await revoke(s.refresh))) keepRevokes([...pendingRevokes(), s.refresh]);
	saveSession(null);
	clear();
}

/** A GET that refreshes with the page (and after each action that invalidates "ops"). */
export function useOps<T>(path: string | null, refetchInterval?: number) {
	// (a hook: another tab signing in as someone else renders this again, under their key)
	const who = useSessionUser() ?? "";
	return useQuery<T, OpsError>({
		queryKey: ["ops", who, path],
		// The answer is stored under `who`: fetched only while `who` is still the signed-in staff member
		// (never someone else's answer filed under their name, or theirs under someone else's).
		queryFn: async () => {
			if (sessionUser() !== who) throw new OpsError("نشست عوض شد؛ صفحه را دوباره باز کن.", 401, "session_changed");
			const result = await ops<T>(path as string);
			if (sessionUser() !== who) throw new OpsError("نشست عوض شد؛ صفحه را دوباره باز کن.", 401, "session_changed");
			return result;
		},
		enabled: !!path,
		refetchInterval,
		retry: (n, e) => n < 2 && !(e instanceof OpsError && e.status < 500),
		staleTime: 10_000,
	});
}

/** After a change: every admin-app query loads again. */
export function useRefresh() {
	const qc = useQueryClient();
	return () => void qc.invalidateQueries({ queryKey: ["ops"] });
}

export const ROLE_NAME: Record<OpsRole, string> = {
	reviewer: "بررسی بازی",
	finance: "مالی",
	settings: "تنظیمات",
	support: "پشتیبانی",
};

export function dateText(iso: string | null | undefined, withTime = true): string {
	if (!iso) return "—";
	return new Intl.DateTimeFormat("fa-IR", withTime ? { dateStyle: "medium", timeStyle: "short" } : { dateStyle: "medium" }).format(new Date(iso));
}

export function ago(iso: string | null | undefined): string {
	if (!iso) return "—";
	const s = Math.max(0, (Date.now() - new Date(iso).getTime()) / 1000);
	const rtf = new Intl.RelativeTimeFormat("fa", { numeric: "auto" });
	if (s < 60) return "همین الان";
	if (s < 3600) return rtf.format(-Math.round(s / 60), "minute");
	if (s < 86400) return rtf.format(-Math.round(s / 3600), "hour");
	return rtf.format(-Math.round(s / 86400), "day");
}
