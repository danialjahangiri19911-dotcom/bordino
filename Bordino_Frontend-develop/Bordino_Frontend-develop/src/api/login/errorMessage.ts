import axios from "axios";

/**
 * What to tell the player when a login call fails, in Persian: the server's own message (it
 * answers in Persian, see requester's Accept-Language), or what went wrong with the connection.
 */
export function authErrorMessage(error: unknown): string {
	if (!axios.isAxiosError(error)) return "مشکلی پیش آمد. دوباره تلاش کنید.";
	if (!error.response) return "اتصال برقرار نشد. اینترنت را بررسی کنید و دوباره بزنید.";
	const errors = (error.response.data as { errors?: unknown } | undefined)?.errors;
	const messages =
		typeof errors === "string"
			? [errors]
			: Array.isArray(errors)
				? errors
				: errors && typeof errors === "object"
					? Object.values(errors).flat()
					: [];
	const first = messages.find((m) => typeof m === "string");
	if (first) return first;
	if (error.response.status === 429) return "درخواست‌ها زیاد شد. کمی بعد دوباره تلاش کنید.";
	return "مشکلی پیش آمد. دوباره تلاش کنید.";
}
