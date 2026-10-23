import React from "react";

import Link from "next/link";

// A page that does not exist: say so in Persian and offer the way back.
export default function NotFound() {
	return (
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
			}}
		>
			<h1 style={{ fontSize: 20, margin: 0 }}>این صفحه پیدا نشد</h1>
			<p style={{ margin: 0, color: "#5B5B5B" }}>
				آدرس را اشتباه وارد کرده‌ای یا صفحه دیگر وجود ندارد.
			</p>
			<Link
				href="/pwa/main"
				style={{
					background: "#e64056",
					color: "#fff",
					borderRadius: 12,
					padding: "12px 24px",
					textDecoration: "none",
					fontWeight: 700,
				}}
			>
				بازگشت به خانه
			</Link>
		</div>
	);
}
