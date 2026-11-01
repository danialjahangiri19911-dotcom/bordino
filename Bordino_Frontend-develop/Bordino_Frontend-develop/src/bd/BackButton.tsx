"use client";

import { useEffect, useRef, useState } from "react";

import { usePathname, useRouter } from "next/navigation";

import { type LeaveQuestion, handleBackInPage, setLeaveAsker, useBackHandler } from "./back";
import { R } from "./ui";

interface CapacitorApp {
	addListener: (event: "backButton", cb: (e: { canGoBack?: boolean }) => void) => unknown;
	exitApp: () => void;
}

/** The App plugin of the Android app (Bordino_Mobile), injected into this site by Capacitor. */
function capacitorApp(): CapacitorApp | null {
	const app = (window as unknown as { Capacitor?: { Plugins?: { App?: CapacitorApp } } }).Capacitor?.Plugins?.App;
	return app && typeof app.addListener === "function" ? app : null;
}

/**
 * The app's download address for an update from inside the app. Not on lottery.bordino.co: the
 * app keeps that host inside itself (where a download does nothing), while another address is
 * handed to the phone's browser, which downloads and installs the APK.
 */
export const APK_URL = "http://194.60.230.57:8097/download/bordino.apk";
/** «Later» on the update notice keeps it away this long. */
const UPDATE_SNOOZE_MS = 3 * 24 * 3600 * 1000;

/** Screens where Back leaves the app (asks first). */
const ROOTS = new Set<string>([R.home, R.landing, "/pwa", R.login, R.otp]);
/** The bottom-navigation tabs: Back from one goes to the home tab. */
const TABS = new Set<string>([R.games, R.earn, R.wallet, R.profile]);

/** Where Back goes when the page was opened directly (no page before it in this app). */
export function parentOf(path: string): string {
	const p = path.replace(/\/+$/, "") || "/";
	if (p.startsWith(`${R.profile}/`)) return R.profile;
	if (p.startsWith(`${R.wallet}/`)) return R.wallet;
	if (p.startsWith(`${R.lotteries}/`)) return R.lotteries;
	if (p === R.lotteries) return R.wallet;
	if ([R.sudoku, R.game2048, R.crash, R.chicken].some((g) => p === g || p.startsWith(`${g}/`))) return R.games;
	return R.home;
}

/** The dialog the last Back sent Escape to: if it is still open, it ignores Escape. */
let escaped: HTMLElement | null = null;

/** The newest open dialog that only knows Escape (MUI dialogs, older parts of the app). */
function closeOpenDialog(): boolean {
	const open = [...document.querySelectorAll<HTMLElement>('[aria-modal="true"]')].filter(
		(el) => !el.closest("[hidden]") && el.getClientRects().length > 0 && getComputedStyle(el).visibility !== "hidden",
	);
	const top = open[open.length - 1];
	// Still open after the last Escape: it does not close that way, so Back must not stop here.
	if (!top || top === escaped) return false;
	escaped = top;
	// If Escape did close it, forget it (the same dialog opened again later gets Escape again).
	window.setTimeout(() => {
		if (escaped === top && !(top.isConnected && top.getClientRects().length > 0)) escaped = null;
	}, 300);
	const target = top.contains(document.activeElement) ? (document.activeElement as HTMLElement) : top;
	target.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", code: "Escape", keyCode: 27, bubbles: true, cancelable: true }));
	return true;
}

/**
 * The Android Back button inside the app: closes the newest overlay, else a game's own exit
 * question, else goes to the previous page; on the home screen it asks before leaving the app.
 * In a browser (no Capacitor) nothing changes: Back is the browser's.
 */
export default function BackButton() {
	const router = useRouter();
	const pathname = usePathname();
	const path = useRef(pathname);
	path.current = pathname;
	const [question, setQuestion] = useState<(LeaveQuestion & { onYes: () => void; onNo?: () => void }) | null>(null);
	// Staying (the button, a tap outside, Back): the question goes, the asker's `stay` runs.
	const stay = () => {
		const after = question?.onNo;
		setQuestion(null);
		after?.();
	};
	// The Android app 1.0 (before the Back plugin): hardware Back closes it, so it asks for 1.1+.
	const [oldApp, setOldApp] = useState(false);

	useBackHandler(!!question, stay);

	// The leave question works everywhere (a game's exit button asks it in a browser too).
	useEffect(() => {
		setLeaveAsker((q, go, onNo) => setQuestion({ ...q, onYes: go ?? (() => window.history.back()), onNo }));
		return () => setLeaveAsker(null);
	}, []);

	// The bridge can come up a moment after the page: wait for the App plugin before deciding that
	// this is the old app (or a browser) without one.
	const [app, setApp] = useState<CapacitorApp | null>(null);
	useEffect(() => {
		if (!/BordinoApp\//.test(navigator.userAgent)) return undefined;
		let tries = 0;
		const look = () => {
			const found = capacitorApp();
			if (found) return setApp(found);
			if (++tries < 20) return void (timer = window.setTimeout(look, 250));
			let snoozed = false;
			try {
				snoozed = Date.now() - Number(localStorage.getItem("bd-app-update-later") || 0) < UPDATE_SNOOZE_MS;
			} catch {
				// no storage: ask
			}
			if (!snoozed) setOldApp(true);
		};
		let timer = window.setTimeout(look, 0);
		return () => window.clearTimeout(timer);
	}, []);

	useEffect(() => {
		if (!app) return;
		let canGoBackNow = false;
		// The previous page, or (opened directly, nothing before it) the page above this one.
		const leave = () => {
			const here = path.current.replace(/\/+$/, "") || "/";
			if (canGoBackNow) window.history.back();
			else router.replace(parentOf(here));
		};
		setLeaveAsker((q, go, onNo) => setQuestion({ ...q, onYes: go ?? leave, onNo }));
		const onBack = ({ canGoBack }: { canGoBack?: boolean }) => {
			canGoBackNow = !!canGoBack;
			if (handleBackInPage() || closeOpenDialog()) return;
			const here = path.current.replace(/\/+$/, "") || "/";
			if (ROOTS.has(here)) {
				setQuestion({
					title: "از بردینو خارج می‌شوی؟",
					text: "هر وقت برگردی، همین‌جا منتظرت هستیم.",
					yes: "خروج",
					onYes: () => app.exitApp(),
				});
			} else if (TABS.has(here)) {
				router.replace(R.home);
			} else {
				leave();
			}
		};
		const handle = app.addListener("backButton", onBack) as { remove?: () => void } | Promise<{ remove?: () => void }>;
		return () => {
			setLeaveAsker((q, go, onNo) => setQuestion({ ...q, onYes: go ?? (() => window.history.back()), onNo }));
			void Promise.resolve(handle).then((h) => h?.remove?.());
		};
	}, [router, app]);

	if (oldApp && !question) {
		return (
			<div className="bd-sheet-backdrop" role="presentation">
				<div className="bd-product st-brutal bd-sheet bd-leave" role="alertdialog" aria-modal="true" aria-labelledby="app-update-title">
					<p className="bd-leave-title" id="app-update-title">
						نسخهٔ تازهٔ اپ بردینو
					</p>
					<p className="bd-leave-text">
						در نسخه‌ای که نصب کرده‌ای، دکمهٔ برگشت گوشی برنامه را می‌بندد. نسخهٔ تازه را نصب کن؛ روی همین نسخه نصب می‌شود و حساب و
						امتیازهایت سر جایشان می‌مانند. اگر دانلود شروع نشد، این نشانی را در مرورگر باز کن: lottery.bordino.co/download/bordino.apk
					</p>
					<a className="bd-sheet-item bd-sheet-danger" href={APK_URL}>
						دانلود نسخهٔ تازه
					</a>
					<button
						type="button"
						className="bd-sheet-item bd-sheet-cancel"
						onClick={() => {
							try {
								localStorage.setItem("bd-app-update-later", String(Date.now()));
							} catch {
								// shown again next time
							}
							setOldApp(false);
						}}
					>
						بعداً
					</button>
				</div>
			</div>
		);
	}
	if (!question) return null;
	return (
		<div className="bd-sheet-backdrop" role="presentation" onClick={(e) => e.target === e.currentTarget && stay()}>
			<div className="bd-product st-brutal bd-sheet bd-leave" role="alertdialog" aria-modal="true" aria-labelledby="leave-title">
				<p className="bd-leave-title" id="leave-title">
					{question.title}
				</p>
				<p className="bd-leave-text">{question.text}</p>
				<button
					type="button"
					className="bd-sheet-item bd-sheet-danger"
					onClick={() => {
						const go = question.onYes;
						setQuestion(null);
						go();
					}}
				>
					{question.yes}
				</button>
				<button type="button" className="bd-sheet-item bd-sheet-cancel" autoFocus onClick={stay}>
					{question.no ?? "ماندن"}
				</button>
			</div>
		</div>
	);
}
