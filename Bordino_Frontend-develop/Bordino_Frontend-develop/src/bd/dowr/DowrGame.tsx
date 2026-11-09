"use client";

import { useEffect, useRef, useState } from "react";

import Link from "next/link";
import { useRouter } from "next/navigation";

import Icon from "../Icon";
import { styleClass, useBdStyle, useResolvedScheme } from "../appearance";
import { askLeave, useBackHandler, useBrowserBackGuard } from "../back";
import { fa } from "../format";
import { EmptyState, LoadState, R, useRequireLogin } from "../ui";
import { type DowrConfig, type DowrResult, report, saveGame, useDowrConfig, useDowrHistory } from "./api";
import { installLucideShim } from "./lucide";
import "./vendor/dowr.css";
import "./dowr-app.css";

import { gameErrorMessage } from "@/api/games/request";

/** What the design module exposes once its scripts have run (vendor/*.js). */
interface DowrApi {
	markup(style: "neu" | "brutal" | "neon"): string;
	mount(root: Element, options?: { onComplete?: (result: DowrResult) => void }): { getState(): { phase: string } | null; destroy(): void };
}
type Globals = { BordinoDowr?: DowrApi; BordinoDowrDecks?: { categories: unknown[]; cards: unknown[] } };

const LEAVE = {
	title: "از دُور خارج می‌شوی؟",
	text: "امتیازهای این بازی پاک می‌شوند.",
	yes: "خروج",
	no: "ادامهٔ بازی",
};
const RUNNING = ["playing", "handoff", "paused", "timedout", "exploded"];

let loading: Promise<DowrApi> | null = null;
/** The design's scripts, once, in their order (decks → engine → interface). */
function loadModule(): Promise<DowrApi> {
	installLucideShim();
	loading ??= (async () => {
		// (classic scripts that set globals, not ES modules: imported for their effect only)
		// @ts-expect-error -- vendored script, no module shape
		await import("./vendor/decks.js");
		// @ts-expect-error -- vendored script, no module shape
		await import("./vendor/engine.js");
		// @ts-expect-error -- vendored script, no module shape
		await import("./vendor/dowr.js");
		return (globalThis as Globals).BordinoDowr as DowrApi;
	})();
	return loading;
}

/** The design's three looks for the app's three styles (the app's dark mode is dowr-app.css). */
const LOOK = { brutal: "brutal", neon: "neon", neu: "neu" } as const;

/** Keeps the setup within what Bordino allows (the admin's limits): longer games and the bomb off the list. */
function applyLimits(root: HTMLElement, limits: DowrConfig["limits"]) {
	const cap = (setting: string, max: number) => {
		const select = root.querySelector<HTMLSelectElement>(`select[data-setting="${setting}"]`);
		if (!select) return;
		let removed = false;
		for (const o of [...select.options]) {
			if (Number(o.value) > max) {
				removed ||= o.selected;
				o.remove();
			}
		}
		if (removed && select.options.length) {
			select.value = select.options[select.options.length - 1].value;
			select.dispatchEvent(new Event("change", { bubbles: true }));
		}
	};
	cap("rounds", limits.max_rounds);
	cap("seconds", limits.max_seconds);
	if (!limits.bomb_allowed) {
		const bomb = root.querySelector<HTMLInputElement>('input[data-setting="bombEnabled"]');
		if (bomb?.checked) {
			bomb.checked = false;
			bomb.dispatchEvent(new Event("change", { bubbles: true }));
		}
		root.querySelector<HTMLElement>(".dr-bomb-settings")?.setAttribute("hidden", "");
	}
}

export default function DowrGame() {
	const allowed = useRequireLogin();
	const style = useBdStyle();
	const scheme = useResolvedScheme();
	const router = useRouter();
	const config = useDowrConfig();
	const history = useDowrHistory();
	const host = useRef<HTMLDivElement>(null);
	const game = useRef<ReturnType<DowrApi["mount"]> | null>(null);
	const leaveRef = useRef<() => void>(() => undefined);
	const [phase, setPhase] = useState<string>("setup");
	const [saved, setSaved] = useState<{ ok: boolean; text: string } | null>(null);
	const [failed, setFailed] = useState<string | null>(null);
	const cfg = config.data?.result;
	const refetchHistory = useRef(history.refetch);
	refetchHistory.current = history.refetch;
	const look = LOOK[style] ?? "neu";

	useEffect(() => {
		document.title = "دُور | بردینو";
	}, []);

	// Mount once the cards are here; the server's topics and cards replace the bundled deck.
	useEffect(() => {
		if (!allowed || !cfg?.enabled || !host.current || game.current) return undefined;
		let cancelled = false;
		let observer: MutationObserver | null = null;
		let poll = 0;
		loadModule()
			.then((api) => {
				if (cancelled || !host.current) return;
				const decks = (globalThis as Globals).BordinoDowrDecks;
				if (decks && cfg.cards.length) {
					decks.categories = cfg.categories;
					decks.cards = cfg.cards;
				}
				host.current.innerHTML = api.markup(look);
				const root = host.current.querySelector<HTMLElement>("[data-dowr]");
				if (!root) return;
				// Like the other games: the title without the design's dot, and the exit arrow in the
				// game's own header (beside sound and help) instead of a bar above it.
				root.querySelector(".dr-brand h2 span")?.remove();
				const exit = document.createElement("button");
				exit.type = "button";
				exit.className = "dr-icon dowr-exit";
				exit.setAttribute("aria-label", "خروج از بازی");
				exit.innerHTML = '<i data-lucide="arrow-left" aria-hidden="true"></i>';
				exit.addEventListener("click", () => leaveRef.current());
				root.querySelector(".dr-tools")?.appendChild(exit);
				// (one id per finished game, the same for its resends; also where crypto.randomUUID is missing)
				const requestId = () =>
					typeof crypto !== "undefined" && crypto.randomUUID ? crypto.randomUUID() : `${Date.now()}-${Math.random().toString(36).slice(2)}`;
				game.current = api.mount(root, {
					onComplete(result) {
						const data = report(result, requestId());
						const send = (tries: number): Promise<void> =>
							saveGame(data)
								.then(() => {
									setSaved({ ok: true, text: "نتیجهٔ این بازی در «بازی‌های اخیر» ثبت شد." });
									void refetchHistory.current();
								})
								.catch((e) => (tries > 0 ? new Promise((r) => setTimeout(r, 2000)).then(() => send(tries - 1)) : setSaved({ ok: false, text: gameErrorMessage(e) })));
						void send(2);
					},
				});
				applyLimits(root, cfg.limits);
				observer = new MutationObserver(() => applyLimits(root, cfg.limits));
				observer.observe(root, { childList: true, subtree: true });
				poll = window.setInterval(() => setPhase(game.current?.getState()?.phase ?? "setup"), 500);
			})
			.catch(() => setFailed("بارگذاری بازی نشد؛ صفحه را دوباره باز کن."));
		return () => {
			cancelled = true;
			observer?.disconnect();
			window.clearInterval(poll);
		};
	}, [allowed, cfg, look]);

	// The app's style changes while the page is open: the same game, another look (never a restart).
	useEffect(() => {
		const root = host.current?.querySelector("[data-dowr]");
		if (!root) return;
		root.classList.remove("dr-neu", "dr-brutal", "dr-neon");
		root.classList.add(`dr-${look}`);
	}, [look]);

	// Leaving the page ends the game (its timers and sound).
	useEffect(
		() => () => {
			game.current?.destroy();
			game.current = null;
		},
		[],
	);

	const running = RUNNING.includes(phase);
	const leave = () => {
		const go = () => router.push(R.games);
		if (!running) {
			go();
			return;
		}
		const pause = host.current?.querySelector<HTMLButtonElement>('[data-act="pause"]');
		const wasPlaying = phase === "playing" || phase === "handoff";
		if (wasPlaying) pause?.click();
		askLeave(LEAVE, go, () => {
			if (wasPlaying && game.current?.getState()?.phase === "paused") host.current?.querySelector<HTMLButtonElement>('[data-act="pause"]')?.click();
		});
	};
	leaveRef.current = leave;
	useBackHandler(true, leave);
	useBrowserBackGuard(running, leave);

	if (!allowed) return null;
	const recent = history.data?.result?.games ?? [];
	return (
		<div className={`dowr-page dowr-${look}`} data-scheme={scheme}>
			{config.isLoading || config.error ? (
				<div className={`bd-product dowr-bar ${styleClass(style)}`}>
					<LoadState loading={config.isLoading} error={config.error} onRetry={config.refetch} />
				</div>
			) : null}
			{cfg && !cfg.enabled ? (
				<div className={`bd-product dowr-bar ${styleClass(style)}`}>
					<EmptyState icon="messages-square" title="دُور فعلاً در دسترس نیست" text="به‌زودی دوباره باز می‌شود؛ تا آن موقع بازی‌های دیگر گیمنت را امتحان کن." action={<Link className="bd-action" href={R.games}>گیمنت</Link>} />
				</div>
			) : null}
			{failed ? (
				<div className={`bd-product dowr-bar ${styleClass(style)}`}>
					<EmptyState icon="triangle-alert" title="بازی باز نشد" text={failed} />
				</div>
			) : null}
			{/* The design's own game (kept outside .bd-product: the app's element styles never reach it). */}
			<div ref={host} className="dowr-host" />
			{saved ? (
				<div className={`bd-product dowr-bar ${styleClass(style)}`}>
					<p className={saved.ok ? "dowr-saved" : "dowr-unsaved"} role="status">
						<Icon name={saved.ok ? "circle-check" : "circle-alert"} /> {saved.text}
					</p>
				</div>
			) : null}
			{recent.length && !running ? (
				<section className={`bd-product dowr-bar dowr-recent ${styleClass(style)}`} aria-label="بازی‌های اخیر دُور">
					<h3>بازی‌های اخیر</h3>
					<ul>
						{recent.slice(0, 5).map((g) => (
							<li key={g.id}>
								<b>{g.winners || "—"}</b>
								<small>
									{g.mode === "taboo" ? "کلمات ممنوعه" : "دور کلاسیک"}، {fa(g.rounds)} دور، {g.teams.map((t) => `${t.name}: ${fa(t.score)}`).join("، ")}
								</small>
							</li>
						))}
					</ul>
				</section>
			) : null}
		</div>
	);
}
