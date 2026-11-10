"use client";

import { useEffect, useRef, useState } from "react";

import Link from "next/link";
import { useRouter } from "next/navigation";

import { styleClass, useBdStyle, useResolvedScheme } from "../appearance";
import { useBackHandler } from "../back";
import { installLucideShim } from "../dowr/lucide";
import { EmptyState, LoadState, R, useRequireLogin } from "../ui";
import { type SpyConfig, useSpyConfig } from "./api";
import "./vendor/spy-ui.css";
import "./spy-app.css";

/** What the design module exposes once its scripts have run (vendor/*.js). */
interface SpyApi {
	mount(root: Element, options?: { storageKey?: string }): { destroy(): void; getState(): { screen: string; phase?: string } };
}
type Globals = { BordinoSpyUI?: SpyApi; SpyEngine?: { categories: unknown[]; words: unknown[] } };

const STORAGE = "bordino-spy-v1";
const LOOKS = ["neon", "neu", "brutal"] as const;

let loading: Promise<SpyApi> | null = null;
/** The design's scripts, once, in their order (engine → interface). */
function loadModule(): Promise<SpyApi> {
	installLucideShim();
	loading ??= (async () => {
		// (classic scripts that set globals, not ES modules: imported for their effect only)
		// @ts-expect-error -- vendored script, no module shape
		await import("./vendor/spy-engine.js");
		// @ts-expect-error -- vendored script, no module shape
		await import("./vendor/spy-ui.js");
		return (globalThis as Globals).BordinoSpyUI as SpyApi;
	})();
	return loading;
}

/**
 * The server's topics and words in the module's shapes. The module writes a topic's name into its
 * markup as it is (its words it escapes itself): the name arrives here escaped, the id and icon kept to
 * slug letters and unique.
 */
const escapeHtml = (s: string) => s.replace(/[&<>"'`]/g, (c) => `&#${c.charCodeAt(0)};`);
const SLUG = /^[A-Za-z0-9_-]{1,40}$/;
function bankFrom(cfg: SpyConfig) {
	const used = new Set<string>();
	const ids = new Map<string, string>();
	const categories = cfg.categories.map((c, i) => {
		let id = SLUG.test(c.id) && !used.has(c.id) ? c.id : `t${i}`;
		while (used.has(id)) id += "_";
		used.add(id);
		ids.set(c.id, id);
		return [id, escapeHtml(String(c.label ?? "")), SLUG.test(c.icon) ? c.icon : "folder", "", ""];
	});
	const words = cfg.words
		.filter((w) => ids.has(w.category))
		.map((w) => ({ id: w.id, text: w.text, related: w.related || "", category: ids.get(w.category), difficulty: w.difficulty, age: w.age, pack: "sample" }));
	return { categories, words };
}

/** The app's style is the game's look (the module's own theme setting is hidden in the app). */
function applyLook(root: HTMLElement, look: string) {
	if (root.classList.contains(`sp-${look}`)) return;
	for (const l of LOOKS) root.classList.remove(`sp-${l}`);
	root.classList.add(`sp-${look}`);
}

/** The module keeps its preferences on the device: it starts in the app's look. */
function storeLook(look: string) {
	try {
		const saved = JSON.parse(localStorage.getItem(STORAGE) || "null");
		if (saved && typeof saved === "object") {
			saved.prefs = { ...(saved.prefs || {}), theme: look };
			localStorage.setItem(STORAGE, JSON.stringify(saved));
		}
	} catch {
		// (storage blocked or unreadable: the module starts in its default look, fixed after its first render)
	}
}

export default function SpyGame() {
	const allowed = useRequireLogin();
	const style = useBdStyle();
	const scheme = useResolvedScheme();
	const router = useRouter();
	const config = useSpyConfig();
	const cfg = config.data?.result;
	const host = useRef<HTMLDivElement>(null);
	const game = useRef<ReturnType<SpyApi["mount"]> | null>(null);
	const observer = useRef<MutationObserver | null>(null);
	const leaveRef = useRef<() => void>(() => undefined);
	const [failed, setFailed] = useState<string | null>(null);
	const look = (LOOKS as readonly string[]).includes(style) ? style : "neon";
	const lookRef = useRef(look);
	lookRef.current = look;
	const canPlay = !!cfg && cfg.enabled && cfg.words.length > 0;

	useEffect(() => {
		document.title = "جاسوس | بردینو";
	}, []);

	// Mount once, when the game may first be played (a later config or style changes the same game).
	useEffect(() => {
		if (!allowed || !canPlay || game.current || !cfg) return undefined;
		let cancelled = false;
		loadModule()
			.then((api) => {
				if (cancelled || !host.current || game.current) return;
				const engine = (globalThis as Globals).SpyEngine;
				if (engine) Object.assign(engine, bankFrom(cfg));
				storeLook(lookRef.current);
				const root = document.createElement("div");
				host.current.replaceChildren(root);
				game.current = api.mount(root, { storageKey: STORAGE });
				const polish = () => {
					applyLook(root, lookRef.current);
					// The design's note «this design version has N sample word pairs» is about the
					// prototype, not the app (whose bank Bordino keeps growing): not shown.
					for (const note of root.querySelectorAll<HTMLElement>(".sp-notice")) {
						if (!note.hidden && note.textContent?.includes("نسخهٔ طراحی")) note.hidden = true;
					}
					// …nor its footer label «نمونهٔ تعاملی رابط» (interactive prototype).
					for (const label of root.querySelectorAll<HTMLElement>(".sp-footer > *")) {
						if (!label.hidden && label.textContent?.includes("نمونهٔ تعاملی")) label.hidden = true;
					}
					// The app's exit, beside the module's own sound and settings buttons.
					const tools = root.querySelector(".sp-tools");
					if (tools && !tools.querySelector(".spy-exit")) {
						const exit = document.createElement("button");
						exit.type = "button";
						exit.className = "sp-icon spy-exit";
						exit.setAttribute("aria-label", "خروج از بازی");
						exit.innerHTML = '<i data-lucide="arrow-left" aria-hidden="true"></i>';
						exit.addEventListener("click", () => leaveRef.current());
						tools.appendChild(exit);
						(globalThis as { lucide?: { createIcons?: () => void } }).lucide?.createIcons?.();
					}
					// One arrow at a time: on the game's own inner screens its «back to the game's home»
					// arrow; on its home, the app's exit.
					const exitButton = root.querySelector<HTMLElement>(".spy-exit");
					const inner = !!root.querySelector(".sp-header-back");
					if (exitButton && exitButton.hidden !== inner) exitButton.hidden = inner;
				};
				polish();
				// (the clock re-renders often: one pass per frame at most)
				let queued = false;
				observer.current = new MutationObserver(() => {
					if (queued) return;
					queued = true;
					requestAnimationFrame(() => {
						queued = false;
						polish();
					});
				});
				observer.current.observe(root, { childList: true, subtree: true, attributes: true, attributeFilter: ["class"] });
			})
			.catch(() => setFailed("بارگذاری بازی نشد؛ صفحه را دوباره باز کن."));
		return () => {
			cancelled = true;
		};
	}, [allowed, canPlay, cfg]);

	// A newer word bank (Bordino edited it): the next round draws from it.
	useEffect(() => {
		const engine = (globalThis as Globals).SpyEngine;
		if (cfg && game.current && engine && cfg.words.length) Object.assign(engine, bankFrom(cfg));
	}, [cfg]);

	// The app's style changes while the page is open: the same game, another look.
	useEffect(() => {
		const root = host.current?.querySelector<HTMLElement>(".sp");
		if (root) applyLook(root, look);
		storeLook(look);
	}, [look]);

	// Leaving the page ends the module (its timers, sound and listeners); its game stays saved.
	useEffect(
		() => () => {
			observer.current?.disconnect();
			game.current?.destroy();
			game.current = null;
		},
		[],
	);

	// Back / exit: on one of the game's inner screens, first to the game's own home (its «back home»
	// pauses and keeps a round under way: card hidden, time stopped); from its home, back to the games.
	// Nothing is lost, so nothing is asked.
	const leave = () => {
		const back = host.current?.querySelector<HTMLButtonElement>('.sp-header-back[data-a="home-confirm"]');
		if (back && game.current?.getState().screen !== "home") {
			back.click();
			return;
		}
		router.push(R.games);
	};
	leaveRef.current = leave;
	useBackHandler(true, leave);

	if (!allowed) return null;
	return (
		<div className={`spy-page spy-${look}`} data-scheme={scheme}>
			{config.isLoading || config.error ? (
				<div className={`bd-product spy-bar ${styleClass(style)}`}>
					<LoadState loading={config.isLoading} error={config.error} onRetry={config.refetch} />
				</div>
			) : null}
			{cfg && !canPlay ? (
				<div className={`bd-product spy-bar ${styleClass(style)}`}>
					<EmptyState
						icon="shield"
						title="جاسوس فعلاً در دسترس نیست"
						text="به‌زودی دوباره باز می‌شود؛ تا آن موقع بازی‌های دیگر گیمنت را امتحان کن."
						action={
							<Link className="bd-action" href={R.games}>
								گیمنت
							</Link>
						}
					/>
				</div>
			) : null}
			{failed ? (
				<div className={`bd-product spy-bar ${styleClass(style)}`}>
					<EmptyState icon="triangle-alert" title="بازی باز نشد" text={failed} />
				</div>
			) : null}
			{/* The design's own game (kept outside .bd-product: the app's element styles never reach it). */}
			<div ref={host} className="spy-host" hidden={!!cfg && !canPlay} />
		</div>
	);
}
