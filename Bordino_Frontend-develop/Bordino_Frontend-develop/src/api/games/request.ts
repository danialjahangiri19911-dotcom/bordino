import type { ResponseApiData } from "@libs/http/interfaces";
import { withAuth } from "@libs/http/query";
import requester from "@libs/http/requester";
import axios from "axios";

/**
 * Authenticated call for the points games, with the same refresh-on-401 the app's queries use:
 * a session can outlast a 1-hour access token mid-game. Returns the `result` of the response.
 */
export async function call<T>(
	method: "get" | "post",
	url: string,
	body?: unknown,
): Promise<T> {
	const send = (token: string | null) =>
		requester.request<ResponseApiData<T>>({
			method,
			url,
			data: body,
			headers: token ? { Authorization: `Bearer ${token}` } : undefined,
		});

	return (await withAuth(send)).data.result;
}

/** The server's message for a failed game call, in Persian. */
export function gameErrorMessage(error: unknown): string {
	if (axios.isAxiosError(error)) {
		const errors = error.response?.data?.errors;
		if (typeof errors?.error === "string") return errors.error;
		if (errors && typeof errors === "object") {
			const first = Object.values(errors)[0];
			if (Array.isArray(first) && first.length) return String(first[0]);
		}
		if (!error.response) return "ارتباط با سرور برقرار نشد.";
	}
	return "خطایی رخ داد. دوباره تلاش کن.";
}
