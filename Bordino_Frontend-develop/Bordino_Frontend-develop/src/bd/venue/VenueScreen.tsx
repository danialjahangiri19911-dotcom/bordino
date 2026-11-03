"use client";

import { useEffect, useRef, useState } from "react";

import axios from "axios";

import { fa } from "../format";
import { type VenueScreen as Screen, venueScreen } from "../missions/api";
import "./venue.css";

/** How long a shown code is still accepted after its 30 seconds (services.QR_GRACE). */
const GRACE_MS = 120_000;
const RETRY_MS = 5_000;

type State = "loading" | "ok" | "offline" | "gone";

/**
 * The QR a venue shows on a tablet or TV (/venue/<key>, opened from the admin): a new code every 30
 * seconds, so a photo of it sent to someone elsewhere soon stops working. It asks the server for each
 * code just as the last one ends; without a connection it keeps the last code while it is still
 * accepted, then says it is reconnecting.
 */
export default function VenueScreen({ screenKey }: { screenKey: string }) {
	const [screen, setScreen] = useState<Screen | null>(null);
	const [state, setState] = useState<State>("loading");
	const [now, setNow] = useState(() => Date.now());
	const fetchedAt = useRef(0);

	useEffect(() => {
		let stopped = false;
		let timer: number | undefined;
		const load = async () => {
			try {
				const next = await venueScreen(screenKey);
				if (stopped) return;
				fetchedAt.current = Date.now();
				setScreen(next);
				setState("ok");
				timer = window.setTimeout(load, next.expires_in * 1000 + 250);
			} catch (e) {
				if (stopped) return;
				if (axios.isAxiosError(e) && e.response?.status === 404) {
					setState("gone");
					return;
				}
				setState("offline");
				timer = window.setTimeout(load, RETRY_MS);
			}
		};
		void load();
		return () => {
			stopped = true;
			window.clearTimeout(timer);
		};
	}, [screenKey]);

	// The countdown, once a second.
	useEffect(() => {
		const t = window.setInterval(() => setNow(Date.now()), 1000);
		return () => window.clearInterval(t);
	}, []);

	// Keeps the screen on while this page is shown (where the browser allows it).
	useEffect(() => {
		type Lock = { release(): Promise<void> };
		const wake = (navigator as Navigator & { wakeLock?: { request(type: "screen"): Promise<Lock> } }).wakeLock;
		if (!wake) return undefined;
		let lock: Lock | null = null;
		const take = () => {
			if (document.visibilityState === "visible") wake.request("screen").then((l) => (lock = l)).catch(() => undefined);
		};
		take();
		document.addEventListener("visibilitychange", take);
		return () => {
			document.removeEventListener("visibilitychange", take);
			void lock?.release().catch(() => undefined);
		};
	}, []);

	const age = now - fetchedAt.current;
	const left = screen ? Math.max(0, Math.ceil(screen.expires_in - age / 1000)) : 0;
	// The last code is shown only while the server still takes it.
	const showCode = !!screen && state !== "gone" && age < screen.expires_in * 1000 + GRACE_MS;

	const fullScreen = () => {
		void document.documentElement.requestFullscreen?.().catch(() => undefined);
	};

	return (
		<main className="vn" aria-live="polite">
			<header className="vn-top">
				<span className="vn-brand">
					<span className="vn-logo" aria-hidden="true">
						ب
					</span>
					بردینو
				</span>
				<button type="button" className="vn-full" onClick={fullScreen}>
					تمام‌صفحه
				</button>
			</header>

			{state === "gone" ? (
				<section className="vn-card vn-note">
					<h1>این لینک نمایشگر دیگر کار نمی‌کند</h1>
					<p>لینک تازه را از پنل مدیریت بگیرید (مأموریت ← «لینک نمایشگر محل»).</p>
				</section>
			) : !screen ? (
				<section className="vn-card vn-note">
					<h1>{state === "offline" ? "در حال اتصال…" : "در حال آماده‌سازی…"}</h1>
				</section>
			) : (
				<section className="vn-card">
					<div className="vn-copy">
						<p className="vn-kicker">مأموریت حضوری</p>
						<h1>{screen.title}</h1>
						<p className="vn-points">
							<strong>+{fa(screen.points)}</strong> امتیاز
						</p>
						<ol className="vn-steps">
							<li>دوربین گوشی را روی این QR بگیر.</li>
							<li>لینک را باز کن و وارد بردینو شو.</li>
							<li>امتیاز به کیف امتیازت اضافه می‌شود.</li>
						</ol>
						{!screen.active ? <p className="vn-warn">این مأموریت فعلاً غیرفعال است.</p> : null}
					</div>
					<div className="vn-qr-wrap">
						{showCode ? (
							<img
								className="vn-qr"
								src={`data:image/svg+xml;charset=utf-8,${encodeURIComponent(screen.svg)}`}
								alt="QR مأموریت؛ با دوربین گوشی اسکن کنید"
							/>
						) : (
							<div className="vn-qr vn-qr-wait">در حال اتصال…</div>
						)}
						<div className="vn-timer" aria-label={`QR تا ${fa(left)} ثانیهٔ دیگر عوض می‌شود`}>
							<span className="vn-bar" style={{ transform: `scaleX(${screen.step ? Math.min(1, left / screen.step) : 0})` }} />
						</div>
						<p className="vn-small" dir="rtl">
							{state === "offline" ? "اتصال قطع است؛ دوباره وصل می‌شویم…" : `${fa(left)} ثانیه تا کد بعدی · هر ${fa(screen.step)} ثانیه یک کد تازه`}
						</p>
					</div>
				</section>
			)}
		</main>
	);
}
