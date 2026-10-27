"use client";

import { useEffect, useState } from "react";

import { fa } from "./format";

/** Seconds left until an absolute deadline, ticking each second and resynced when the tab returns. */
export default function useCountdown(deadline?: string | null) {
	const read = () => (deadline ? Math.max(0, Math.floor((new Date(deadline).getTime() - Date.now()) / 1000)) : 0);
	const [left, setLeft] = useState(read);
	useEffect(() => {
		setLeft(read());
		if (!deadline) return;
		const timer = window.setInterval(() => setLeft(read()), 1000);
		const onVisible = () => document.visibilityState === "visible" && setLeft(read());
		document.addEventListener("visibilitychange", onVisible);
		return () => {
			window.clearInterval(timer);
			document.removeEventListener("visibilitychange", onVisible);
		};
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, [deadline]);
	return left;
}

/** «۲ روز و ۰۳:۱۵:۰۹» */
export function formatLeft(seconds: number): string {
	const days = Math.floor(seconds / 86400);
	const pad = (n: number) => fa(n).padStart(2, "۰");
	const clock = `${pad(Math.floor((seconds % 86400) / 3600))}:${pad(Math.floor((seconds % 3600) / 60))}:${pad(seconds % 60)}`;
	return days ? `${fa(days)} روز و ${clock}` : clock;
}
