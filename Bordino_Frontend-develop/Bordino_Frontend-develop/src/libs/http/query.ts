import { useMemo } from "react";

import requester, { type RequestError } from "./requester";
import useAuthStore, { tokenUser } from "@libs/stores/authStore";
import {
	type UseQueryOptions,
	useQuery as useTanStackQuery,
} from "@tanstack/react-query";
import axios from "axios";

import { AUTH_URLS } from "@/api/urls";
import useUserStore from "@/libs/stores/userStore";

export interface Res<TData> {
	data: TData;
	statusCode: number;
}
export type Modify<T, R> = Omit<T, keyof R> & R;
type Tokens = { newAccessToken: string; newRefreshToken: string };
let refreshPromise: Promise<Tokens | null> | null = null;

/**
 * Run `task` while holding the one session lock shared by every tab of this site (Web Locks), so
 * two tabs never refresh, or refresh and log out, at the same time: refresh tokens rotate, and
 * the second one to use the old token would be refused. Without Web Locks it just runs.
 */
function withSessionLock<T>(task: () => Promise<T>): Promise<T> {
	const locks = typeof navigator !== "undefined" ? navigator.locks : undefined;
	// request() resolves to what the task resolves to (lib.dom types it one Promise too deep).
	return locks ? (locks.request("bordino-session", task) as unknown as Promise<T>) : task();
}

async function refreshAccessToken(refreshToken: string) {
	if (refreshPromise) {
		return refreshPromise;
	}

	refreshPromise = withSessionLock(async (): Promise<Tokens | null> => {
		// While this waited for the lock another tab may have refreshed (its tokens are in
		// storage), logged out, or logged in as someone else.
		await useAuthStore.persist.rehydrate();
		const stored = useAuthStore.getState();
		if (!stored.refreshToken || tokenUser(stored.refreshToken) !== tokenUser(refreshToken)) {
			throw new Error("Session changed before refresh");
		}
		if (stored.refreshToken !== refreshToken && stored.accessToken) {
			return { newAccessToken: stored.accessToken, newRefreshToken: stored.refreshToken };
		}
		try {
			const response = await axios.post<{
				result: {
					access: string;
					refresh: string;
				};
			}>(`${process.env.NEXT_PUBLIC_REFRESH_URL}token/refresh/`, {
				refresh: stored.refreshToken,
			});

			const {
				result: { access, refresh },
			} = response.data;

			// Logged out elsewhere while this was on its way: the new pair is valid on the
			// server, so end it there too instead of leaving it alive.
			if (useAuthStore.getState().refreshToken !== stored.refreshToken) {
				requester
					.post(AUTH_URLS.LOGOUT, { refresh }, { headers: { Authorization: `Bearer ${access}` } })
					.catch(() => undefined);
				throw new Error("Session changed during refresh");
			}
			useAuthStore.getState().login(access, refresh);

			return { newAccessToken: access, newRefreshToken: refresh };
		} catch (error: any) {
			// Only the session this refresh belonged to ends: if someone logged in meanwhile
			// (another tab), their newer session stays.
			if (
				error.response?.status === 401 &&
				useAuthStore.getState().refreshToken === stored.refreshToken
			) {
				useAuthStore.getState().logout();
				useUserStore.getState().clearUser();
			}
			throw error;
		}
	}).finally(() => {
		refreshPromise = null;
	});

	return refreshPromise;
}

/**
 * Send an authenticated request with the session's current access token. On a 401: when the
 * token changed while the request was out (another request refreshed it) just resend with the
 * new one; otherwise refresh once and resend. The refresh token is read when the 401 arrives,
 * never captured before the request, because each refresh replaces it (rotation). A retry only
 * ever goes out for the user who sent the request: a session that changed hands meanwhile (logout
 * and login as someone else, maybe in another tab) gets the original error instead.
 */
async function withAuth<T>(send: (accessToken: string | null) => Promise<T>): Promise<T> {
	const used = useAuthStore.getState().accessToken;
	const owner = tokenUser(used);
	try {
		return await send(used);
	} catch (error: any) {
		if (error?.response?.status !== 401) throw error;
		const { accessToken, refreshToken } = useAuthStore.getState();
		if (accessToken && accessToken !== used) {
			if (tokenUser(accessToken) !== owner) throw error;
			return send(accessToken);
		}
		if (!refreshToken) throw error;
		const refreshed = await refreshAccessToken(refreshToken);
		if (!refreshed || tokenUser(refreshed.newAccessToken) !== owner) throw error;
		return send(refreshed.newAccessToken);
	}
}

async function fetchWithAuth(url: string, headers?: Record<string, string>) {
	// No headers = a public request: no token, no refresh.
	const send = (token: string | null) =>
		requester.get(url, {
			headers: headers && token ? { ...headers, Authorization: `Bearer ${token}` } : headers,
		});
	const { status, data } = headers ? await withAuth(send) : await send(null);
	return { statusCode: status, data };
}

export { fetchWithAuth, refreshAccessToken, withAuth, withSessionLock };

function createDefaultFetcher(url: string, headers?: Record<string, string>) {
	async function fetcher() {
		return await fetchWithAuth(url, headers ?? undefined);
	}
	return fetcher;
}

export interface Options<D, E> extends Modify<
	UseQueryOptions<D, E>,
	{ queryKey?: UseQueryOptions<D, E>["queryKey"] }
> {
	url: string;
	headers?: boolean;
}

export default function useQuery<TData, TError = RequestError | null>(
	options: Options<Res<TData>, TError> | string,
) {
	const _options: UseQueryOptions<Res<TData>, TError> = useMemo(() => {
		if (typeof options === "string") {
			const { accessToken: currentAccessToken } = useAuthStore.getState();

			return {
				queryKey: [options],
				queryFn: createDefaultFetcher(
					options,
					currentAccessToken
						? { Authorization: `Bearer ${currentAccessToken}` }
						: undefined,
				),
			};
		}

		const { accessToken: currentAccessToken } = useAuthStore.getState();
		const headers =
			options.headers && currentAccessToken
				? { Authorization: `Bearer ${currentAccessToken}` }
				: undefined;

		const queryFn =
			options.queryFn ?? createDefaultFetcher(options.url, headers);

		const queryKey = options.queryKey ?? [options.url];

		return {
			...options,
			queryFn,
			queryKey,
		};
	}, [options]);

	const { data: res, ...rest } = useTanStackQuery<Res<TData>, TError>(_options);

	const data = res?.data;
	const statusCode = res?.statusCode;

	return {
		data,
		statusCode,
		...rest,
	};
}
