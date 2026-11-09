"use client";

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

let refreshing: Promise<boolean> | null = null;

async function renew(): Promise<boolean> {
	const s = session();
	if (!s?.refresh) return false;
	refreshing ??= (async () => {
		try {
			const r = await fetch(API + "auth/refresh/", {
				method: "POST",
				headers: { "Content-Type": "application/json", "Accept-Language": "fa" },
				body: JSON.stringify({ refresh: s.refresh }),
			});
			if (!r.ok) return false;
			const body = await r.json();
			const access = body?.result?.access;
			if (!access) return false;
			saveSession({ ...s, access });
			return true;
		} catch {
			return false;
		} finally {
			setTimeout(() => {
				refreshing = null;
			}, 0);
		}
	})();
	return refreshing;
}

function signedOut() {
	saveSession(null);
	// A full page load to the login page: nothing cached in memory survives the ended session.
	if (!location.pathname.startsWith("/ops/login")) location.replace("/ops/login");
}

/** One admin-app API call: the answer's `result`, or an OpsError with the server's message. */
export async function ops<T = unknown>(path: string, method = "GET", data?: unknown, retry = true): Promise<T> {
	const s = session();
	const r = await fetch(API + path, {
		method,
		headers: {
			"Content-Type": "application/json",
			"Accept-Language": "fa",
			...(s?.access ? { Authorization: `Bearer ${s.access}` } : {}),
		},
		body: data === undefined ? undefined : JSON.stringify(data),
	});
	if (r.status === 401 && retry && path.indexOf("auth/") !== 0) {
		if (await renew()) return ops<T>(path, method, data, false);
		signedOut();
		throw new OpsError("نشست تمام شد؛ دوباره وارد شو.", 401, "signed_out");
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

/** Ends the session on the server (by its refresh token: works after the access token expired),
 * then forgets it here, with every cached admin answer. */
export async function signOut(clear: () => void) {
	const s = session();
	try {
		if (s?.refresh) await ops("auth/logout/", "POST", { refresh: s.refresh });
	} catch {
		// forgotten here anyway; the server refuses the session once its refresh expires
	}
	saveSession(null);
	clear();
}

/** A GET that refreshes with the page (and after each action that invalidates "ops"). */
export function useOps<T>(path: string | null, refetchInterval?: number) {
	const who = typeof window === "undefined" ? "" : sessionUser();
	return useQuery<T, OpsError>({
		queryKey: ["ops", who, path],
		queryFn: () => ops<T>(path as string),
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
