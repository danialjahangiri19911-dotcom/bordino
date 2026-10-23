"use client";

import { useEffect } from "react";

import * as Sentry from "@sentry/nextjs";

export default function GlobalError({
	error,
}: {
	error: Error & { digest?: string };
}) {
	useEffect(() => {
		Sentry.captureException(error);
	}, [error]);

	// The whole app failed to render (this replaces the root layout): a Persian screen with a way
	// to try again, instead of Next's English default.
	return (
		<html lang="fa" dir="rtl">
			<body>
				<div
					style={{
						minHeight: "100vh",
						display: "flex",
						flexDirection: "column",
						alignItems: "center",
						justifyContent: "center",
						gap: 16,
						padding: 24,
						textAlign: "center",
						fontFamily: "system-ui, sans-serif",
					}}
				>
					<h1 style={{ fontSize: 20, margin: 0 }}>مشکلی پیش آمد</h1>
					<p style={{ margin: 0, color: "#5B5B5B" }}>
						لطفاً صفحه را دوباره باز کن. اگر مشکل ادامه داشت بعداً امتحان کن.
					</p>
					<button
						type="button"
						onClick={() => window.location.assign("/pwa/main")}
						style={{
							background: "#e64056",
							color: "#fff",
							border: 0,
							borderRadius: 12,
							padding: "12px 24px",
							fontWeight: 700,
							fontSize: 16,
						}}
					>
						بازگشت به خانه
					</button>
				</div>
			</body>
		</html>
	);
}
