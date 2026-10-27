import type { ResponseApiData } from "./interfaces";
import { emitError } from "./useErrorListeners";
import settings from "@libs/settings";
import useAuthStore from "@libs/stores/authStore";
import axios, { type AxiosError, type AxiosResponse } from "axios";

import { ACTIVITY_URLS, AUTH_URLS, CUSTOMER_URLS } from "@/api/urls";

const requester = axios.create({
	baseURL: settings.apiBaseUrl,
	timeout: 2 * 60 * 1000,
	withCredentials: false,
	// The API answers in Persian when asked (Django's messages, e.g. a wrong OTP code).
	headers: { "Accept-Language": "fa" },
});

export type ApiError<T> = {
	status?: number;
	message?: string;
	response?: {
		data?: ResponseApiData<T>;
		status?: number;
	};
};

const DISABLE_SHOW_ERROR_CLIENT_PATHS = [
	"/pwa/otp",
	"/pwa/main",
	"/pwa/wallet",
	// The points games show their own errors next to the bet button.
	"/pwa/crash",
	"/pwa/chicken",
	// The neobrutalism pages (src/bd) show a failed request in place (LoadState / Notice).
	"/pwa/register",
	"/pwa/onboarding",
	"/pwa/profile",
	"/pwa/lottery",
	"/pwa/gameNet",
	"/pwa/rules",
	"/pwa/wheel",
];

const DISABLE_401_ERRORS = ["/pwa/register"];

export type RequestError<Res = ResponseApiData<unknown>> = AxiosError<Res>;
export type RequestSuccess<Res = ResponseApiData<unknown>> = AxiosResponse<Res>;

export const isRequestError = axios.isAxiosError;

export const standardErrorMessage = (
	e: RequestError<{ errors: Record<string, string[]> }>,
): string => {
	const errors = e?.response?.data?.errors;
	if (errors && typeof errors === "object") {
		return Object.entries(errors)
			.map(([key, messages]) =>
				Array.isArray(messages)
					? `${key}: ${messages.join(", ")}`
					: `${key}: ${messages}`,
			)
			.join(" | ");
	}
	if (Array.isArray(errors)) {
		return (errors as string[]).join(", ");
	}
	return typeof errors === "string" ? errors : "An unexpected error occurred";
};

requester.interceptors.response.use(
	(response) => response,
	(error: RequestError<{ errors: Record<string, string[]> }>) => {
		const errorMessage = standardErrorMessage(error);

		const currentPath = window.location.pathname;
		const shouldDisableError = DISABLE_SHOW_ERROR_CLIENT_PATHS.some((path) =>
			currentPath.includes(path),
		);

		const has401Err = DISABLE_401_ERRORS.some((path) =>
			currentPath.includes(path),
		);

		if (has401Err && error.status === 401) {
			return;
		}

		// An expired access token is renewed and the request resent (libs/http/query withAuth);
		// only a failed renewal ends the session, so this 401 is not the user's problem.
		if (error.status === 401 && useAuthStore.getState().refreshToken) {
			return Promise.reject(error);
		}

		// Logout is best effort: it clears the device whatever the server says.
		if (error.config?.url === AUTH_URLS.LOGOUT) {
			return Promise.reject(error);
		}

		if (error.config?.url === CUSTOMER_URLS.PROFILE && error.status === 404) {
			return Promise.reject(error);
		}

		// خطاهای resend-otp (مثل «۶۰ ثانیه صبر کنید») را به‌صورت سراسری toast نکن؛
		// این اطلاعات از طریق شمارش معکوسِ صفحه‌ی OTP نمایش داده می‌شود.
		if (error.config?.url === AUTH_URLS.RESEND_OTP) {
			return Promise.reject(error);
		}

		// ثبت اکشن‌های امتیازی (سودوکو/بازی‌ها) پس‌زمینه‌ای است؛ اگر امتیازی
		// برای آن اکشن تنظیم نشده باشد بک‌اند خطا می‌دهد، ولی نباید بازی را
		// با toast سراسری قطع کند.
		if (error.config?.url === ACTIVITY_URLS.RECORD_ACTION) {
			return Promise.reject(error);
		}

		// خطای واکشیِ گردونه (۴۰۴ وقتی هنوز گردونه‌ای ساخته نشده) و خلاصهٔ امتیاز
		// را toast نکن؛ فرانت به‌صورت دمو/۰ ادامه می‌دهد. خطای spin (POST) همچنان نمایش داده می‌شود.
		const reqUrl = error.config?.url ?? "";
		const reqMethod = (error.config?.method ?? "").toLowerCase();
		if (
			reqMethod === "get" &&
			(reqUrl.includes("lottery-wheel/") || reqUrl.includes("points/summary"))
		) {
			return Promise.reject(error);
		}

		if (!shouldDisableError) {
			emitError(errorMessage);
		}

		return Promise.reject(error);
	},
);

export default requester;
