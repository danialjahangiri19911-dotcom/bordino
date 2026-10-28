"use client";

import { type CSSProperties, type KeyboardEvent, type PointerEvent, useContext, useEffect, useRef, useState } from "react";

import { useRouter } from "next/navigation";

import Icon from "../Icon";
import { useResolvedScheme } from "../appearance";
import { fa } from "../format";
import { useBackHandler } from "../back";
import { R, useRequireLogin } from "../ui";
import { inertIf } from "./SudokuGame";
import { type Soundtrack, createSoundtrack } from "./soundtrack";
import "./game2048.css";

import useGetPlayCost from "@/api/games/useGetPlayCost";
import { GameContext } from "@/libs/context/2048/GameProvider";
import PersistedGameProvider from "@/libs/context/2048/PersistedGameProvider";
import type { Direction } from "@/libs/games/2048/types";
import { currentUserId } from "@/libs/stores/authStore";

const KEYS: Record<string, Direction> = { ArrowUp: "up", ArrowDown: "down", ArrowLeft: "left", ArrowRight: "right", w: "up", s: "down", a: "left", d: "right" };
const digits = (n: number) => n.toLocaleString("fa-IR", { useGrouping: false });
// Per account: another player on this phone keeps their own record.
const bestKey = () => `2048-best-score:${currentUserId()}`;

type Confirm = "" | "reset" | "exit";

function View() {
	const game = useContext(GameContext);
	if (!game) throw new Error("2048 view needs its GameProvider");
	const { push } = useRouter();
	const scheme = useResolvedScheme();
	const { data: costData, refetch: refetchCost } = useGetPlayCost({ gameName: "game_2048" });
	const [confirm, setConfirm] = useState<Confirm>("");
	const [help, setHelp] = useState(false);
	const [sound, setSound] = useState(true);
	const [hidden, setHidden] = useState(false);
	const [best, setBest] = useState(0);
	const [gain, setGain] = useState(0);
	const [problem, setProblem] = useState<string | null>(null);
	const music = useRef<Soundtrack | null>(null);
	const interacted = useRef(false);
	const press = useRef<{ x: number; y: number; id: number } | null>(null);
	const boardRef = useRef<HTMLButtonElement>(null);
	const dialogRef = useRef<HTMLDivElement>(null);
	const lastScore = useRef(game.score);
	const seen = useRef<Map<string, number>>(new Map());

	const playCost = costData?.result?.play_cost;
	const points = costData?.result?.current_amount;
	const playing = !game.needsStart && game.status === "ongoing";
	// Android Back: closes the open question, asks «از بازی خارج شوی؟» mid-game, else leaves (as the
	// header's exit button does).
	// A charge on its way holds Back: leaving now would lose the game being paid for.
	useBackHandler(true, () => (game.isCharging ? undefined : confirm ? setConfirm("") : playing ? setConfirm("exit") : push(R.games)));
	const modal: "" | "ready" | "win" | "lost" | Confirm = confirm || (game.needsStart ? "ready" : game.status === "won" ? "win" : game.status === "lost" ? "lost" : "");

	useEffect(() => {
		music.current = createSoundtrack();
		const onVisible = () => setHidden(document.hidden);
		document.addEventListener("visibilitychange", onVisible);
		return () => {
			document.removeEventListener("visibilitychange", onVisible);
			music.current?.destroy();
		};
	}, []);
	useEffect(() => {
		if (sound && playing && !modal && !hidden && interacted.current) music.current?.start();
		else music.current?.stop();
	}, [sound, playing, modal, hidden]);

	// The record stays on this device, per account (as before).
	useEffect(() => {
		const stored = Number(localStorage.getItem(bestKey()) || 0);
		const next = Math.max(stored, game.score || 0);
		if (next !== stored) localStorage.setItem(bestKey(), String(next));
		setBest(next);
	}, [game.score]);
	// «+۱۲» over the score after a merge, and the merge sound.
	useEffect(() => {
		const delta = game.score - lastScore.current;
		lastScore.current = game.score;
		if (delta > 0) {
			setGain(delta);
			if (sound && !hidden) music.current?.effect();
		}
	}, [game.score, sound, hidden]);
	useEffect(() => {
		seen.current = new Map(Object.values(game.tiles).map((t) => [t.id, t.value]));
	}, [game.tiles]);
	useEffect(() => {
		if (modal) dialogRef.current?.querySelector<HTMLButtonElement>("button:not(:disabled)")?.focus({ preventScroll: true });
		else boardRef.current?.focus({ preventScroll: true });
	}, [modal]);

	/** Charged on the server first (the provider runs one start at a time), then a new board. */
	const start = async () => {
		interacted.current = true;
		setProblem(null);
		if (await game.startPaidGame()) {
			void refetchCost();
			setConfirm("");
		} else setProblem("بازی شروع نشد؛ موجودی امتیاز یا اتصال را بررسی کن.");
	};
	const move = (dir: Direction) => {
		if (!playing || modal) return;
		interacted.current = true;
		game.move(dir);
	};

	const onKey = (e: KeyboardEvent<HTMLElement>) => {
		if (modal) {
			if (e.key === "Escape" && confirm) {
				e.preventDefault();
				setConfirm("");
			}
			if (e.key === "Tab" && dialogRef.current) {
				const buttons = [...dialogRef.current.querySelectorAll<HTMLButtonElement>("button:not(:disabled)")];
				if (e.shiftKey && document.activeElement === buttons[0]) {
					e.preventDefault();
					buttons[buttons.length - 1]?.focus();
				} else if (!e.shiftKey && document.activeElement === buttons[buttons.length - 1]) {
					e.preventDefault();
					buttons[0]?.focus();
				}
			}
			return;
		}
		const dir = KEYS[e.key];
		if (dir && !e.ctrlKey && !e.metaKey && !e.altKey) {
			e.preventDefault();
			move(dir);
		}
	};
	const down = (e: PointerEvent<HTMLButtonElement>) => {
		if (e.isPrimary === false || e.button !== 0) return;
		press.current = { x: e.clientX, y: e.clientY, id: e.pointerId };
		e.currentTarget.setPointerCapture?.(e.pointerId);
	};
	const up = (e: PointerEvent<HTMLButtonElement>) => {
		const p = press.current;
		if (!p || p.id !== e.pointerId) return;
		press.current = null;
		const dx = e.clientX - p.x;
		const dy = e.clientY - p.y;
		if (Math.max(Math.abs(dx), Math.abs(dy)) < 20) return;
		move(Math.abs(dx) > Math.abs(dy) ? (dx > 0 ? "right" : "left") : dy > 0 ? "down" : "up");
	};

	// Tiles keep their engine id, so the design's CSS slides them; a changed value pops, a new one spawns.
	// (compared with the values of the last committed render, so a re-render does not drop the effect)
	const tiles = game.tilesByIds.map((id) => game.tiles[id]).filter(Boolean);
	const previous = seen.current;
	const drawn = tiles.map((t) => {
		const before = previous.get(t.id);
		return { ...t, pop: before !== undefined && before !== t.value, spawn: before === undefined && previous.size > 0 };
	});
	const maxTile = tiles.length ? Math.max(...tiles.map((t) => t.value)) : 0;

	const dialog: Record<string, [string, string]> = {
		ready: ["عددها را به هم برسان", playCost !== undefined ? `هر بازی ${fa(playCost)} امتیاز${points !== undefined ? ` · موجودی تو ${fa(points)} امتیاز` : ""}` : "هزینهٔ بازی در حال دریافت است…"],
		win: ["۲۰۴۸ را ساختی!", `امتیاز این بازی: ${fa(game.score)}. یک رکورد بزرگ‌تر؟`],
		lost: ["این دور تمام شد", `حرکتی باقی نمانده؛ امتیاز نهایی ${fa(game.score)}.`],
		reset: ["از نو شروع کنیم؟", `صفحهٔ فعلی پاک می‌شود و بازی تازه${playCost !== undefined ? ` ${fa(playCost)} امتیاز` : ""} هزینه دارد؛ رکوردت می‌ماند.`],
		exit: ["از بازی خارج شوی؟", "بازی روی همین دستگاه نگه داشته می‌شود و هر وقت برگردی ادامه دارد."],
	};

	return (
		<div className="bd-game-page">
			<article className={`g48 g48-brutal ${scheme === "dark" ? "g48-dark" : ""}`} dir="rtl" aria-label="بازی ۲۰۴۸" onKeyDown={onKey}>
				<header className="g48-header" {...inertIf(!!modal)}>
					<div className="g48-brand">
						<span className="g48-mark" aria-hidden="true">
							<b>2</b>
							<b>4</b>
						</span>
						<div>
							<span className="g48-eyebrow">بردینو / بازی‌های فکری</span>
							<h2 id="game-title" tabIndex={-1}>
								۲۰۴۸<span className="g48-title-dot">.</span>
							</h2>
						</div>
					</div>
					<div className="g48-tools">
						<button type="button" className="g48-icon" aria-label={sound ? "قطع موسیقی و افکت‌ها" : "پخش موسیقی و افکت‌ها"} aria-pressed={sound} onClick={() => { interacted.current = true; setSound(!sound); }}>
							<Icon name={sound ? "volume-2" : "volume-x"} />
						</button>
						<button type="button" className="g48-icon" aria-label="راهنمای بازی" aria-expanded={help} onClick={() => setHelp(!help)}>
							<Icon name="circle-help" />
						</button>
						<button type="button" className="g48-icon" aria-label="خروج از بازی" disabled={game.isCharging} onClick={() => (playing ? setConfirm("exit") : push(R.games))}>
							<Icon name="arrow-right" />
						</button>
					</div>
				</header>
				<section className="g48-help" hidden={!help}>
					<b>یک حرکت، یک ترکیب</b>
					<p>عددهای یکسان را با کشیدن روی صفحه یا کلیدهای جهت‌نما به هم برسان. هر ترکیب به امتیاز بازی اضافه می‌شود. هدف، ساختن کاشی ۲۰۴۸ است؛ زمان محدودی ندارد.</p>
					<small>هر بازی امتیاز کیف‌پول می‌گیرد؛ امتیاز و رکورد خود بازی به کیف‌پول اضافه نمی‌شوند.</small>
				</section>
				<div className="g48-layout">
					<section className="g48-play">
						<div className="g48-scorebar">
							<div>
								<span>امتیاز بازی</span>
								<strong>{fa(game.score)}</strong>
								<em key={game.score} className={gain ? "g48-gain" : ""} aria-hidden="true">
									{gain ? `+${fa(gain)}` : ""}
								</em>
							</div>
							<div>
								<span>رکورد این دستگاه</span>
								<strong>{fa(best)}</strong>
							</div>
						</div>
						<div className="g48-board-frame">
							<button
								type="button"
								ref={boardRef}
								className="g48-board"
								aria-label={`صفحهٔ ۲۰۴۸، امتیاز ${fa(game.score)}، بزرگ‌ترین کاشی ${fa(maxTile)}؛ کلیدهای جهت‌نما برای حرکت.`}
								disabled={!!modal}
								onPointerDown={down}
								onPointerUp={up}
								onPointerCancel={() => {
									press.current = null;
								}}
							>
								<span className="g48-grid" aria-hidden="true">
									{Array.from({ length: 16 }, (_, i) => (
										<span key={i} />
									))}
								</span>
								<span className="g48-tiles" aria-hidden="true">
									{drawn.map((t) => (
										<span
											key={t.id}
											className={`g48-tile${t.pop ? " g48-pop" : ""}${t.spawn ? " g48-spawn" : ""}`}
											data-value={t.value}
											style={{ "--x": t.position[0], "--y": t.position[1] } as CSSProperties}
										>
											<b>{digits(t.value)}</b>
										</span>
									))}
								</span>
							</button>
							{modal ? (
								<div className="g48-overlay">
									<div className="g48-dialog" ref={dialogRef} role="dialog" aria-modal="true" aria-label="وضعیت بازی">
										<span className="g48-dialog-number" aria-hidden="true">
											{modal === "ready" || modal === "win" ? "۲۰۴۸" : fa(game.score)}
										</span>
										<h3>{dialog[modal][0]}</h3>
										<p>{dialog[modal][1]}</p>
										{problem ? (
											<p className="g48-problem" role="alert">
												{problem}
											</p>
										) : null}
										<div className="g48-dialog-actions">
											{modal === "exit" ? (
												<>
													<button type="button" className="g48-primary" onClick={() => { music.current?.stop(); push(R.games); }}>
														خروج از بازی
													</button>
													<button type="button" className="g48-secondary" onClick={() => setConfirm("")}>
														ادامهٔ همین بازی
													</button>
												</>
											) : (
												<>
													<button type="button" className="g48-primary" disabled={game.isCharging} onClick={() => void start()}>
														{game.isCharging ? "در حال شروع…" : modal === "reset" ? "شروع دوباره" : modal === "ready" ? "شروع بازی" : "بازی تازه"}
													</button>
													{modal === "reset" ? (
														<button type="button" className="g48-secondary" onClick={() => setConfirm("")}>
															ادامهٔ همین بازی
														</button>
													) : modal === "lost" && game.canUndo ? (
														<button type="button" className="g48-secondary" onClick={game.undo}>
															برگشت یک حرکت
														</button>
													) : null}
												</>
											)}
										</div>
									</div>
								</div>
							) : null}
						</div>
						<p className="g48-hint">برای حرکت، روی زمین بکش یا از کلیدهای جهت‌نما استفاده کن.</p>
					</section>
					<aside className="g48-side" {...inertIf(!!modal)}>
						<div className="g48-main-actions">
							<button type="button" className="g48-primary" disabled={game.isCharging || game.needsStart} onClick={() => setConfirm("reset")}>
								<Icon name="rotate-cw" />
								بازی تازه
							</button>
							<button type="button" className="g48-secondary" disabled={!game.canUndo || !playing} onClick={game.undo}>
								<Icon name="undo-2" />
								یک حرکت عقب
							</button>
						</div>
					</aside>
				</div>
				<footer className="g48-footer">
					<span>
						<b>{fa(game.moveCount)}</b> حرکت
					</span>
					<span>{playCost !== undefined ? `هر بازی ${fa(playCost)} امتیاز` : ""}</span>
				</footer>
				<p className="g48-sr" aria-live="polite">
					{game.status === "won" ? "۲۰۴۸ ساخته شد" : game.status === "lost" ? "بازی تمام شد" : `امتیاز ${fa(game.score)}`}
				</p>
			</article>
		</div>
	);
}

/** «۲۰۴۸» in the Bordino-2048-Game-Design look, on the app's own 2048 engine and paid start. */
export default function Game2048() {
	const allowed = useRequireLogin();
	if (!allowed) return null;
	return (
		<PersistedGameProvider>
			<View />
		</PersistedGameProvider>
	);
}
