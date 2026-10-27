"use client";

import { useEffect } from "react";

import * as Sentry from "@sentry/nextjs";

/** The whole app failed: the root layout (and its stylesheet) may be gone, so this is self-contained. */
export default function GlobalError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
	useEffect(() => {
		Sentry.captureException(error);
	}, [error]);

	return (
		<html lang="fa" dir="rtl">
			<body style={{ margin: 0, background: "#fff8eb", color: "#25252b", font: "14px/1.9 Tahoma, Arial, sans-serif" }}>
				<main style={{ minHeight: "100dvh", display: "grid", placeItems: "center", padding: 24, textAlign: "center" }}>
					<div style={{ border: "2px solid #25252b", boxShadow: "5px 5px 0 #25252b", background: "#fffdf5", padding: 24, maxWidth: 360 }}>
						<h1 style={{ fontSize: 20, fontWeight: 500, margin: "0 0 8px" }}>مشکلی پیش آمد</h1>
						<p style={{ margin: "0 0 16px" }}>صفحه بارگذاری نشد. دوباره تلاش کن.</p>
						<button
							type="button"
							onClick={() => reset()}
							style={{ font: "inherit", background: "#d64142", color: "#fff", border: "2px solid #25252b", boxShadow: "4px 4px 0 #25252b", padding: "9px 19px", cursor: "pointer" }}
						>
							تلاش دوباره
						</button>
					</div>
				</main>
			</body>
		</html>
	);
}
