import { useMemo } from "react";

import requester, { type RequestError } from "./requester";
import useAuthStore from "@libs/stores/authStore";
import {
	type UseQueryOptions,
	useQuery as useTanStackQuery,
} from "@tanstack/react-query";
import axios from "axios";

import useUserStore from "@/libs/stores/userStore";

export interface Res<TData> {
	data: TData;
	statusCode: number;
}
export type Modify<T, R> = Omit<T, keyof R> & R;
let refreshPromise: Promise<{
	newAccessToken: string;
	newRefreshToken: string;
} | null> | null = null;

async function refreshAccessToken(refreshToken: string) {
	if (refreshPromise) {
		return refreshPromise;
	}

	refreshPromise = (async () => {
		try {
			const response = await axios.post<{
				result: {
					access: string;
					refresh: string;
				};
			}>(`${process.env.NEXT_PUBLIC_REFRESH_URL}token/refresh/`, {
				refresh: refreshToken,
			});

			const {
				result: { access, refresh },
			} = response.data;

			useAuthStore.getState().login(access, refresh);

			return { newAccessToken: access, newRefreshToken: refresh };
		} catch (error: any) {
			const status = error.response?.status;
			console.log(status);
			if (status === 401) {
				useAuthStore.getState().logout();
				useUserStore.getState().clearUser();
			}
			throw error;
		} finally {
			refreshPromise = null;
		}
	})();

	return refreshPromise;
}

async function fetchWithAuth(url: string, headers?: Record<string, string>) {
	const { refreshToken: currentRefreshToken } = useAuthStore.getState();

	try {
		const { status, data } = await requester.get(url, { headers });
		return { statusCode: status, data };
	} catch (error: any) {
		const { accessToken: currentAccessToken } = useAuthStore.getState();

		if (
			!!headers &&
			(error.response?.status === 401 || !currentAccessToken) &&
			currentRefreshToken
		) {
			try {
				const refreshResult = await refreshAccessToken(currentRefreshToken);

				if (!refreshResult) {
					throw new Error("Refresh failed");
				}

				const { newAccessToken } = refreshResult;

				const { status, data } = await requester.get(url, {
					headers: { ...headers, Authorization: `Bearer ${newAccessToken}` },
				});
				return { statusCode: status, data };
			} catch (refreshError: any) {
				// eslint-disable-next-line no-console
				console.log(refreshError);
				throw refreshError;
			}
		}
		if (error.response.status === 401) {
			useUserStore.getState().clearUser();
		}
		console.log(error);
		throw error;
	}
}

export { fetchWithAuth };

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
