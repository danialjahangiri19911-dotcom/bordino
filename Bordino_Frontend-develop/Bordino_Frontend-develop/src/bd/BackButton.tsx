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

/** Screens where Back leaves the app (asks first). */
const ROOTS = new Set<string>([R.home, R.landing, "/pwa", R.login, R.otp]);
/** The bottom-navigation tabs: Back from one goes to the home tab. */
const TABS = new Set<string>([R.games, R.wallet, R.profile]);

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
	const [question, setQuestion] = useState<(LeaveQuestion & { onYes: () => void }) | null>(null);

	useBackHandler(!!question, () => setQuestion(null));

	// The leave question works everywhere (a game's exit button asks it in a browser too).
	useEffect(() => {
		setLeaveAsker((q, go) => setQuestion({ ...q, onYes: go ?? (() => window.history.back()) }));
		return () => setLeaveAsker(null);
	}, []);

	useEffect(() => {
		const app = capacitorApp();
		if (!app) return;
		let canGoBackNow = false;
		// The previous page, or (opened directly, nothing before it) the page above this one.
		const leave = () => {
			const here = path.current.replace(/\/+$/, "") || "/";
			if (canGoBackNow) window.history.back();
			else router.replace(parentOf(here));
		};
		setLeaveAsker((q, go) => setQuestion({ ...q, onYes: go ?? leave }));
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
			setLeaveAsker((q, go) => setQuestion({ ...q, onYes: go ?? (() => window.history.back()) }));
			void Promise.resolve(handle).then((h) => h?.remove?.());
		};
	}, [router]);

	if (!question) return null;
	return (
		<div className="bd-sheet-backdrop" role="presentation" onClick={(e) => e.target === e.currentTarget && setQuestion(null)}>
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
				<button type="button" className="bd-sheet-item bd-sheet-cancel" autoFocus onClick={() => setQuestion(null)}>
					ماندن
				</button>
			</div>
		</div>
	);
}
