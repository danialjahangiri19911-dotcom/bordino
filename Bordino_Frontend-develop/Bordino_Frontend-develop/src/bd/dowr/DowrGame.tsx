"use client";

import { useEffect, useRef, useState } from "react";

import Link from "next/link";
import { useRouter } from "next/navigation";

import Icon from "../Icon";
import { styleClass, useBdStyle, useResolvedScheme } from "../appearance";
import { askLeave, useBackHandler, useBrowserBackGuard } from "../back";
import GameSettings from "../GameSettings";
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

/** The vendor writes a topic's id, label and icon into its markup as they are; so they arrive here as
 * plain text: the label escaped, the id and icon kept to slug letters, and every id unique (a topic is
 * selected and its cards filtered by id). */
const escapeHtml = (s: string) => s.replace(/[&<>"'`]/g, (c) => `&#${c.charCodeAt(0)};`);
const SLUG = /^[A-Za-z0-9_-]{1,40}$/;
function deckFrom(cfg: DowrConfig) {
	const used = new Set<string>();
	const unique = (id: unknown, i: number) => {
		let out = typeof id === "string" && SLUG.test(id) && !used.has(id) ? id : `t${i}`;
		while (used.has(out)) out += "_";
		used.add(out);
		return out;
	};
	const categories = cfg.categories.map((c, i) => ({ id: unique(c.id, i), label: escapeHtml(String(c.label ?? "")), icon: SLUG.test(c.icon) ? c.icon : "sparkles" }));
	const ids = new Map(cfg.categories.map((c, i) => [c.id, categories[i].id]));
	const cards = cfg.cards.filter((c) => ids.has(c.category)).map((c) => ({ ...c, category: ids.get(c.category) as string }));
	return { categories, cards };
}

/** Whether a new game may start: Bordino's switch is on and there are cards to draw. */
const playable = (cfg: DowrConfig | undefined) => !!cfg && cfg.enabled && cfg.cards.length > 0;

/** When the game was switched off (or emptied) after the page opened: the start buttons stop working;
 * a game already running plays to its end. */
function blockStart(root: HTMLElement, blocked: boolean) {
	for (const b of root.querySelectorAll<HTMLButtonElement>('[data-act="start"]')) b.disabled = blocked;
}

/** The topics a config offers (when they change, the setup is drawn again from them). */
const topicsKey = (cfg: DowrConfig | undefined) => (cfg ? cfg.categories.map((c) => c.id).join("\u0001") : "");

/** What the player chose on the setup page (its selects mirror the module's settings). */
type Chosen = { rounds: number; seconds: number; bomb: boolean };
function readChosen(root: HTMLElement): Chosen | null {
	const rounds = root.querySelector<HTMLSelectElement>('select[data-setting="rounds"]');
	const seconds = root.querySelector<HTMLSelectElement>('select[data-setting="seconds"]');
	if (!rounds || !seconds) return null;
	return { rounds: Number(rounds.value), seconds: Number(seconds.value), bomb: !!root.querySelector<HTMLInputElement>('input[data-setting="bombEnabled"]')?.checked };
}
const beyond = (c: Chosen, l: DowrConfig["limits"]) => c.rounds > l.max_rounds || c.seconds > l.max_seconds || (c.bomb && !l.bomb_allowed);

const SEATING_NOTE = "نوبت‌ها از بالای دایره، ساعت‌گرد می‌چرخد. دایره‌های روبه‌رو و هم‌رنگ، یک تیم‌اند.";

/**
 * The teams page as the app shows it: the team count, the table and its note in one card, and the
 * seats without their two numbers (the order is clockwise from the top, as the note says).
 * Runs after each of the module's renders; changes nothing that is already in place.
 */
function polishTeams(root: HTMLElement) {
	const seating = root.querySelector<HTMLElement>(".dr-seating");
	if (!seating || seating.parentElement?.classList.contains("dowr-seat-box")) return;
	const box = document.createElement("div");
	box.className = "dowr-seat-box";
	const label = root.querySelector(".dr-count-label");
	const note = seating.nextElementSibling?.classList.contains("dr-note") ? seating.nextElementSibling : null;
	seating.before(box);
	if (label) box.append(label);
	box.append(seating);
	if (note) {
		note.textContent = SEATING_NOTE;
		box.append(note);
	}
}

/** «·» beside Persian digits reads as a zero («۲ تیم · ۴ نفر» looks like «۲ تیم ۰ ۴ نفر»): the
 * design's separators become the Persian comma. (Text only; the module's markup is untouched.) */
function persianSeparators(root: HTMLElement) {
	const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
	for (let node = walker.nextNode(); node; node = walker.nextNode()) {
		const text = node.nodeValue ?? "";
		if (text.includes("·")) node.nodeValue = text.replace(/\s*·\s*/g, "، ");
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
	const observer = useRef<MutationObserver | null>(null);
	const poll = useRef(0);
	const [phase, setPhase] = useState<string>("setup");
	const [saved, setSaved] = useState<{ ok: boolean; text: string } | null>(null);
	const [failed, setFailed] = useState<string | null>(null);
	const [showSettings, setShowSettings] = useState(false);
	const [soundOn, setSoundOn] = useState(false);
	const cfg = config.data?.result;
	const refetchHistory = useRef(history.refetch);
	refetchHistory.current = history.refetch;
	const look = LOOK[style] ?? "neu";

	useEffect(() => {
		document.title = "دُور | بردینو";
	}, []);

	/** Ends the mounted game: its timers and sound, the observer, the poll, its DOM. */
	const teardown = () => {
		observer.current?.disconnect();
		observer.current = null;
		window.clearInterval(poll.current);
		polish.current = null;
		game.current?.destroy();
		game.current = null;
		if (host.current) host.current.innerHTML = "";
	};

	// The latest config and look for the module's callbacks (the game is mounted once and kept).
	const cfgRef = useRef(cfg);
	cfgRef.current = cfg;
	const lookRef = useRef(look);
	lookRef.current = look;
	const canPlay = playable(cfg);
	// One pass over the module's DOM: Bordino's limits, the start switch, the teams card, the commas.
	const polish = useRef<(() => void) | null>(null);
	// The topics the mounted game was drawn with; a new mount when they change between games.
	const mountedTopics = useRef("");
	const [mountKey, setMountKey] = useState(0);

	// Mount once, when the game may first be played. Never again for this page (a refetched config or
	// another style changes the running game, it never restarts it).
	useEffect(() => {
		if (!allowed || !canPlay || game.current) return undefined;
		let cancelled = false;
		loadModule()
			.then((api) => {
				const first = cfgRef.current;
				if (cancelled || !host.current || game.current || !first) return;
				const decks = (globalThis as Globals).BordinoDowrDecks;
				if (decks) Object.assign(decks, deckFrom(first));
				mountedTopics.current = topicsKey(first);
				host.current.innerHTML = api.markup(lookRef.current);
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
				// Settings, as in the other games: a Bordino dialog in front of the module's own buttons.
				const gear = document.createElement("button");
				gear.type = "button";
				gear.className = "dr-icon dowr-settings";
				gear.setAttribute("aria-label", "تنظیمات بازی");
				gear.setAttribute("aria-haspopup", "dialog");
				gear.innerHTML = '<i data-lucide="settings-2" aria-hidden="true"></i>';
				gear.addEventListener("click", () => {
					setSoundOn(root.querySelector('[data-act="sound"]')?.getAttribute("aria-pressed") === "true");
					setShowSettings((v) => !v);
				});
				root.querySelector('.dr-tools [data-act="help"]')?.before(gear);
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
				// What the player last chose on the setup page: «یک دست دیگر» on the results starts again
				// with it, without the setup page, so it is checked against the limits there.
				let chosen: Chosen | null = null;
				const livePhase = () => game.current?.getState()?.phase ?? "setup";
				polish.current = () => {
					const now = cfgRef.current;
					if (now) applyLimits(root, now.limits);
					chosen = readChosen(root) ?? chosen;
					blockStart(root, !playable(now));
					polishTeams(root);
					persianSeparators(root);
					setPhase(livePhase());
				};
				polish.current();
				root.addEventListener(
					"click",
					(e) => {
						const start = (e.target as Element | null)?.closest?.('[data-act="start"]');
						const now = cfgRef.current;
						if (!start || !now || readChosen(root) || !chosen || !beyond(chosen, now.limits)) return;
						// Bordino lowered the limits since that choice: back to the setup page with them applied.
						e.stopPropagation();
						e.preventDefault();
						root.querySelector<HTMLButtonElement>('[data-act="settings"]')?.click();
						root.querySelector<HTMLButtonElement>('[data-act="rules"]')?.click();
						polish.current?.();
					},
					true,
				);
				// (after the module's own handler: the back guard knows a game started at once)
				root.addEventListener("click", () => setPhase(livePhase()));
				// (the clock re-renders ~20×/s: one pass per frame at most)
				let queued = false;
				observer.current = new MutationObserver(() => {
					if (queued) return;
					queued = true;
					requestAnimationFrame(() => {
						queued = false;
						polish.current?.();
					});
				});
				observer.current.observe(root, { childList: true, subtree: true });
				poll.current = window.setInterval(() => setPhase(game.current?.getState()?.phase ?? "setup"), 500);
			})
			.catch(() => setFailed("بارگذاری بازی نشد؛ صفحه را دوباره باز کن."));
		return () => {
			cancelled = true;
		};
	}, [allowed, canPlay, mountKey]);

	// A newer config (Bordino edited the cards, the limits or the switch): the next game uses it.
	useEffect(() => {
		if (!cfg || !game.current) return;
		const decks = (globalThis as Globals).BordinoDowrDecks;
		if (decks && cfg.cards.length) Object.assign(decks, deckFrom(cfg));
		polish.current?.();
	}, [cfg]);

	// Other topics than the setup page was drawn with: the module keeps its own topic choice, so between
	// games (never during one, nor over its results) the game is mounted again from the new deck.
	useEffect(() => {
		if (!cfg || !game.current || !playable(cfg) || topicsKey(cfg) === mountedTopics.current) return;
		if ((game.current.getState()?.phase ?? "setup") !== "setup") return;
		teardown();
		setMountKey((k) => k + 1);
	}, [cfg, phase]);

	// The app's style changes while the page is open: the same game, another look (never a restart).
	useEffect(() => {
		const root = host.current?.querySelector("[data-dowr]");
		if (!root) return;
		root.classList.remove("dr-neu", "dr-brutal", "dr-neon");
		root.classList.add(`dr-${look}`);
	}, [look]);

	// Leaving the page ends the game (its timers and sound) and stops watching it.
	useEffect(() => teardown, []);

	const running = RUNNING.includes(phase);
	const leave = () => {
		const go = () => router.push(R.games);
		// (the game's phase now, not the last poll's: a game may have started a moment ago)
		const now = game.current?.getState()?.phase ?? "setup";
		if (!RUNNING.includes(now)) {
			go();
			return;
		}
		// Pause while asking; resume on «stay» only if this question is what paused it.
		const pausedHere = (now === "playing" || now === "handoff") && !!host.current?.querySelector<HTMLButtonElement>('[data-act="pause"]');
		if (pausedHere) host.current?.querySelector<HTMLButtonElement>('[data-act="pause"]')?.click();
		askLeave(LEAVE, go, () => {
			if (pausedHere && game.current?.getState()?.phase === "paused") host.current?.querySelector<HTMLButtonElement>('[data-act="pause"]')?.click();
		});
	};
	leaveRef.current = leave;
	useBackHandler(true, leave);
	useBrowserBackGuard(running, leave);

	/** Clicks the module's own buttons, in order (the setup steps only exist between games). */
	const act = (...names: string[]) => {
		setShowSettings(false);
		for (const n of names) host.current?.querySelector<HTMLButtonElement>(`[data-act="${n}"]`)?.click();
		polish.current?.();
	};

	if (!allowed) return null;
	const recent = history.data?.result?.games ?? [];
	return (
		<div className={`dowr-page dowr-${look}`} data-scheme={scheme}>
			{config.isLoading || config.error ? (
				<div className={`bd-product dowr-bar ${styleClass(style)}`}>
					<LoadState loading={config.isLoading} error={config.error} onRetry={config.refetch} />
				</div>
			) : null}
			{cfg && !cfg.enabled && !running ? (
				<div className={`bd-product dowr-bar ${styleClass(style)}`}>
					<EmptyState icon="messages-square" title="دُور فعلاً در دسترس نیست" text="به‌زودی دوباره باز می‌شود؛ تا آن موقع بازی‌های دیگر گیمنت را امتحان کن." action={<Link className="bd-action" href={R.games}>گیمنت</Link>} />
				</div>
			) : null}
			{cfg?.enabled && !cfg.cards.length && !running ? (
				<div className={`bd-product dowr-bar ${styleClass(style)}`}>
					<EmptyState icon="messages-square" title="کارتی برای بازی نیست" text="کارت‌های دُور در حال آماده شدن‌اند؛ کمی بعد دوباره سر بزن." action={<Link className="bd-action" href={R.games}>گیمنت</Link>} />
				</div>
			) : null}
			{failed ? (
				<div className={`bd-product dowr-bar ${styleClass(style)}`}>
					<EmptyState icon="triangle-alert" title="بازی باز نشد" text={failed} />
				</div>
			) : null}
			{/* The design's own game (kept outside .bd-product: the app's element styles never reach it). */}
			<div ref={host} className="dowr-host" hidden={!!cfg && !canPlay && !running} />
			<GameSettings
				open={showSettings}
				onClose={() => setShowSettings(false)}
				game="دُور"
				look={look}
				dark={scheme === "dark"}
				rows={[
					{
						kind: "toggle",
						id: "sound",
						label: "موسیقی و افکت‌ها",
						on: soundOn,
						onChange: (on) => {
							const b = host.current?.querySelector<HTMLButtonElement>('[data-act="sound"]');
							if (b && (b.getAttribute("aria-pressed") === "true") !== on) b.click();
							setSoundOn(on);
							window.setTimeout(() => setSoundOn(b?.getAttribute("aria-pressed") === "true"), 400);
						},
					},
					{ kind: "action", id: "teams", label: "تیم‌ها و بازیکن‌ها", hint: running ? "بعد از پایان این بازی عوض می‌شود." : undefined, button: "ویرایش", onClick: () => act("settings", "teams"), disabled: running },
					{ kind: "action", id: "rules", label: "دورها، زمان و حالت بازی", hint: running ? "بعد از پایان این بازی عوض می‌شود." : undefined, button: "ویرایش", onClick: () => act("settings", "rules"), disabled: running },
				]}
			/>
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
