import * as Sentry from "@sentry/nextjs";

export async function register() {
	// در حالت توسعه Sentry را بارگذاری نکن: ابزارِ OpenTelemetry آن سربارِ
	// قابل‌توجه و اخطار در هر اجرا اضافه می‌کند. فقط در production فعال می‌شود.
	if (process.env.NODE_ENV === "development") return;

	if (process.env.NEXT_RUNTIME === "nodejs") {
		await import("../sentry.server.config");
	}

	if (process.env.NEXT_RUNTIME === "edge") {
		await import("../sentry.edge.config");
	}
}

export const onRequestError = Sentry.captureRequestError;
