"use client";

import { type KeyboardEvent, useCallback, useEffect, useRef, useState } from "react";

import { useRouter } from "next/navigation";

import Icon from "../Icon";
import { useResolvedScheme } from "../appearance";
import { fa } from "../format";
import { useBackHandler } from "../back";
import { R, useRequireLogin } from "../ui";
import { type Soundtrack, createSoundtrack } from "./soundtrack";
import "./sudoku.css";

import { gameErrorMessage } from "@/api/games/request";
import useChargeGamePlay from "@/api/games/useChargeGamePlay";
import useGetPlayCost from "@/api/games/useGetPlayCost";
import { GAME_URLS } from "@/api/urls";
import { useSudokuStore } from "@/libs/games/sudoku/storage";
import type { CellValue, Difficulty, GameConfig, Index } from "@/libs/games/sudoku/types";
import { useSudoku } from "@/libs/hooks/useSudoku";
import { fetchWithAuth } from "@/libs/http/query";

const LEVELS: [Difficulty, string][] = [
	["easy", "آسان"],
	["medium", "متوسط"],
	["hard", "سخت"],
];
const label = (d: Difficulty | null) => LEVELS.find(([k]) => k === d)?.[1] ?? "آسان";
const box = (x: number, y: number) => Math.floor(x / 3) * 3 + Math.floor(y / 3);
const peers = (a: { x: number; y: number } | null, x: number, y: number) =>
	!!a && !(a.x === x && a.y === y) && (a.x === x || a.y === y || box(a.x, a.y) === box(x, y));
const clock = (s: number) => `${fa(Math.floor(s / 60)).padStart(2, "۰")}:${fa(s % 60).padStart(2, "۰")}`;
const DIGITS = "۱۲۳۴۵۶۷۸۹";
/** `inert` while a dialog is open (React 18 has no typed prop for it; the DOM attribute works). */
export const inertIf = (on: boolean) => (on ? ({ inert: true } as Record<string, boolean>) : {});

type Confirm = "" | "new" | "exit" | "level";
type Modal = "" | "ready" | "won" | "lost" | "pause" | Confirm;

/**
 * «سودوکو» in the Bordino-Sudoku-Game-Design look, on the app's own sudoku engine: every game is
 * paid for on the server (wallet/games/charge) after the level is checked (game/configuration), the
 * time, mistakes and hints come from that configuration, and finished rows and wins are recorded by
 * useRecordSudokuActions. Saves stay per account on this device (useSudokuStore).
 */
export default function SudokuGame() {
	const allowed = useRequireLogin();
	const { push } = useRouter();
	const scheme = useResolvedScheme();
	const game = useSudoku();
	const { isMediumUnlocked, isHardUnlocked, getCompletionCounts } = useSudokuStore();
	const { data: costData, refetch: refetchCost } = useGetPlayCost({ gameName: "sudoku" });
	const { chargeAsync, isCharging } = useChargeGamePlay();
	const [level, setLevel] = useState<Difficulty>("easy");
	const [confirm, setConfirm] = useState<Confirm>("");
	// A charge on its way (start or continue): the buttons that would replace the board wait.
	const [paying, setPaying] = useState(false);
	const [pendingLevel, setPendingLevel] = useState<Difficulty | null>(null);
	const [noteMode, setNoteMode] = useState(false);
	const [help, setHelp] = useState(false);
	const [sound, setSound] = useState(true);
	const [problem, setProblem] = useState<string | null>(null);
	const [live, setLive] = useState("");
	const [hidden, setHidden] = useState(false);
	const busy = useRef(false);
	const interacted = useRef(false);
	const music = useRef<Soundtrack | null>(null);
	const dialogRef = useRef<HTMLDivElement>(null);
	const cellsRef = useRef<HTMLDivElement>(null);

	const playCost = costData?.result?.play_cost;
	const points = costData?.result?.current_amount;
	const unlockedLevel = (d: Difficulty) => d === "easy" || (d === "medium" && isMediumUnlocked()) || (d === "hard" && isHardUnlocked());
	const completions = getCompletionCounts();
	const { board, status, selectedCell, conflicts, numberProgress } = game;
	const playing = status === "playing" && board.length > 0;
	const modal: Modal = confirm || (status === "menu" || !board.length ? "ready" : status === "won" ? "won" : status === "lost" ? "lost" : game.paused ? "pause" : "");
	// Android Back: closes the open question, asks «از بازی خارج شوی؟» mid-game, else leaves (as the
	// header's exit button does).
	// A charge on its way (start/continue) holds Back: leaving now would lose what is being paid for.
	useBackHandler(true, () => (busy.current ? undefined : confirm ? setConfirm("") : playing ? setConfirm("exit") : push(R.games)));

	// ── music: one switch for music and effects; never in a hidden tab or behind a dialog ──
	useEffect(() => {
		music.current = createSoundtrack();
		const onVisible = () => setHidden(document.hidden);
		// Leaving the tab pauses the game (the clock and the music stop, as in the design).
		const pauseOnHide = () => document.hidden && pauseRef.current();
		document.addEventListener("visibilitychange", pauseOnHide);
		document.addEventListener("visibilitychange", onVisible);
		return () => {
			document.removeEventListener("visibilitychange", onVisible);
			document.removeEventListener("visibilitychange", pauseOnHide);
			music.current?.destroy();
		};
	}, []);
	const pauseRef = useRef(() => undefined as void);
	pauseRef.current = () => {
		if (game.status === "playing" && !game.paused) game.pause();
	};
	useEffect(() => {
		if (sound && playing && !modal && !hidden && interacted.current) music.current?.start();
		else music.current?.stop();
	}, [sound, playing, modal, hidden]);

	useEffect(() => {
		if (game.difficulty) setLevel(game.difficulty);
	}, [game.difficulty]);
	useEffect(() => {
		if (modal) dialogRef.current?.querySelector<HTMLButtonElement>("button:not(:disabled)")?.focus({ preventScroll: true });
	}, [modal]);
	useEffect(() => {
		if (status === "won") setLive("جدول کامل شد");
		if (status === "lost") setLive("این بار تمام شد");
	}, [status]);

	/** Level checked on the server, the game paid for, then a new board (one at a time). */
	const start = useCallback(
		async (difficulty: Difficulty) => {
			if (busy.current) return;
			busy.current = true;
			setProblem(null);
			let config: GameConfig | undefined;
			try {
				const { data } = await fetchWithAuth(`${GAME_URLS.CONFIG}?difficulty_level=${difficulty}&game_name=sudoku`, {});
				config = (data as { result?: GameConfig })?.result;
				if (!config) throw new Error("no config");
			} catch {
				setProblem("این سطح در دسترس نیست.");
				busy.current = false;
				return;
			}
			setPaying(true);
			try {
				await chargeAsync({ game_name: "sudoku" });
				void refetchCost();
				setNoteMode(false);
				setConfirm("");
				// The configuration checked before paying: no second request after the charge.
				game.startWithConfig(difficulty, config);
			} catch (e) {
				setProblem(gameErrorMessage(e));
			} finally {
				busy.current = false;
				setPaying(false);
			}
		},
		[chargeAsync, refetchCost, game],
	);

	/** After a loss: pay again and carry on with the same board (mistakes reset, as before). */
	const continueAfterLoss = async () => {
		if (busy.current) return;
		busy.current = true;
		setPaying(true);
		setProblem(null);
		try {
			await chargeAsync({ game_name: "sudoku" });
			void refetchCost();
			game.continueAfterLoss();
		} catch (e) {
			setProblem(gameErrorMessage(e));
		} finally {
			busy.current = false;
			setPaying(false);
		}
	};

	const toMenu = () => {
		// Not while a payment is on its way: a paid continuation would land on an empty menu.
		if (busy.current) return;
		game.exitToMenu();
		setConfirm("");
		setProblem(null);
		setNoteMode(false);
	};

	const sel = selectedCell;
	const selCell = sel ? board[sel.x]?.[sel.y] : null;
	const fixed = !sel || !!selCell?.prefilled;
	const selValue = selCell?.value ?? null;

	const enter = (n: CellValue) => {
		if (!playing || modal || fixed) return;
		interacted.current = true;
		if (noteMode) {
			if (!selCell?.value) game.toggleNote(n);
			return;
		}
		game.fillCell(n);
		if (sound) music.current?.effect();
	};
	const move = (dx: number, dy: number) => {
		const x = Math.max(0, Math.min(8, (sel?.x ?? 0) + dx)) as Index;
		const y = Math.max(0, Math.min(8, (sel?.y ?? 0) + dy)) as Index;
		game.selectCell(x, y);
		cellsRef.current?.querySelector<HTMLButtonElement>(`[data-cell="${x}-${y}"]`)?.focus({ preventScroll: true });
	};

	const onKey = (e: KeyboardEvent<HTMLElement>) => {
		if (modal) {
			if (e.key === "Escape" && confirm) {
				e.preventDefault();
				setConfirm("");
			}
			if (e.key === "Tab" && dialogRef.current) {
				const buttons = [...dialogRef.current.querySelectorAll<HTMLButtonElement>("button:not(:disabled)")];
				const first = buttons[0];
				const last = buttons[buttons.length - 1];
				if (e.shiftKey && document.activeElement === first) {
					e.preventDefault();
					last?.focus();
				} else if (!e.shiftKey && document.activeElement === last) {
					e.preventDefault();
					first?.focus();
				}
			}
			return;
		}
		if (!playing || (e.target as HTMLElement).closest("select")) return;
		interacted.current = true;
		const n = DIGITS.indexOf(e.key) + 1 || "123456789".indexOf(e.key) + 1;
		if (n) {
			e.preventDefault();
			enter(n as CellValue);
			return;
		}
		if (["Delete", "Backspace", "0", "۰"].includes(e.key)) {
			e.preventDefault();
			if (!fixed) game.eraseCell();
			return;
		}
		if (e.key.toLowerCase() === "n") {
			e.preventDefault();
			setNoteMode((v) => !v);
			return;
		}
		if (e.key.toLowerCase() === "z" && (e.ctrlKey || e.metaKey)) {
			e.preventDefault();
			game.undo();
			return;
		}
		// The board is drawn left-to-right: the arrows move physically.
		const d = { ArrowUp: [-1, 0], ArrowDown: [1, 0], ArrowLeft: [0, -1], ArrowRight: [0, 1] }[e.key];
		if (d) {
			e.preventDefault();
			move(d[0], d[1]);
		}
	};

	if (!allowed) return null;

	const lives = Math.max(0, game.maxMistakes - game.mistakes);
	const canHint = playing && game.remainingHints > 0 && !fixed && !selValue;
	const unlockText =
		completions.easy < 1
			? "با یک برد آسان، سطح متوسط باز می‌شود."
			: completions.medium < 2
				? `برای سطح سخت: ${fa(Math.min(2, completions.medium))} از ۲ برد متوسط.`
				: "هر سه سطح باز است.";
	const selectionText = !playing
		? "برای شروع، سطح را انتخاب کن."
		: !sel
			? "یک خانه را انتخاب کن."
			: fixed
				? "این عدد ثابت است؛ یک خانهٔ خالی را انتخاب کن."
				: noteMode
					? "یادداشت روشن است؛ عددهای احتمالی را انتخاب کن."
					: `سطر ${fa(sel.x + 1)}، ستون ${fa(sel.y + 1)} · عدد دلخواه را وارد کن.`;
	const dialog: Record<string, [string, string]> = {
		ready: ["یک جدول، یک ذهن آرام", playCost !== undefined ? `هر بازی ${fa(playCost)} امتیاز${points !== undefined ? ` · موجودی تو ${fa(points)} امتیاز` : ""}` : "هزینهٔ بازی در حال دریافت است…"],
		won: ["عالی بود، جدول کامل شد!", `${fa(game.mistakes)} خطا · ${fa(game.maxHints - game.remainingHints)} کمک · ${unlockText}`],
		lost: [
			"این بار تمام شد",
			`${game.mistakes >= game.maxMistakes ? "همهٔ فرصت‌ها استفاده شد." : "زمان تمام شد."}${playCost !== undefined ? ` ادامهٔ همین جدول ${fa(playCost)} امتیاز است.` : ""}`,
		],
		new: ["یک جدول تازه؟", "پیشرفت این جدول از بین می‌رود و بازی تازه دوباره امتیاز می‌گیرد."],
		level: ["سطح را عوض کنیم؟", `این جدول کنار گذاشته می‌شود و در سطح ${label(pendingLevel)} بازی تازه شروع می‌کنی.`],
		exit: ["از بازی خارج شوی؟", "بازی متوقف و روی همین دستگاه نگه داشته می‌شود؛ هر وقت برگردی ادامه می‌دهی."],
		pause: ["کمی استراحت", "زمان و موسیقی متوقف شده‌اند؛ جدول تا ادامهٔ بازی پنهان است."],
	};

	return (
		<div className="bd-game-page">
			<article className={`sd sd-brutal ${scheme === "dark" ? "sd-dark" : ""} ${game.paused ? "sd-paused" : ""}`} dir="rtl" aria-label="بازی سودوکو" onKeyDown={onKey}>
				<header className="sd-header" {...inertIf(!!modal && modal !== "pause")}>
					<div className="sd-brand">
						<span className="sd-mark" aria-hidden="true">
							{[1, 0, 3, 0, 5, 0, 7, 0, 9].map((n, i) => (
								<b key={i}>{n ? fa(n) : ""}</b>
							))}
						</span>
						<div>
							<span className="sd-eyebrow">بردینو / بازی‌های فکری</span>
							<h2 id="game-title" tabIndex={-1}>
								سودوکو<span>.</span>
							</h2>
						</div>
					</div>
					<div className="sd-header-tools">
						<button type="button" className="sd-icon" aria-label={sound ? "قطع موسیقی و افکت‌ها" : "پخش موسیقی و افکت‌ها"} aria-pressed={sound} onClick={() => { interacted.current = true; setSound(!sound); }}>
							<Icon name={sound ? "volume-2" : "volume-x"} />
						</button>
						<button type="button" className="sd-icon" aria-label="راهنمای بازی" aria-expanded={help} onClick={() => setHelp(!help)}>
							<Icon name="circle-help" />
						</button>
						<button type="button" className="sd-icon" aria-label="خروج از بازی" disabled={paying} onClick={() => (playing ? setConfirm("exit") : push(R.games))}>
							<Icon name="arrow-right" />
						</button>
					</div>
				</header>
				<section className="sd-help" hidden={!help}>
					<b>هر عدد، فقط یک‌بار</b>
					<p>هر سطر، ستون و مربع ۳×۳ باید عددهای ۱ تا ۹ را بدون تکرار داشته باشد. یک خانه را انتخاب کن و عدد را بزن. در حالت یادداشت، عددهای احتمالی را علامت بزن.</p>
					<small>
						هر بازی امتیاز می‌گیرد؛ زمان، تعداد فرصت و کمک را تنظیمات بازی در سرور تعیین می‌کند. با یک برد آسان، متوسط و با دو برد متوسط، سخت باز می‌شود. صفحه‌کلید: ۱ تا ۹، جهت‌نما، Delete و N برای یادداشت.
					</small>
				</section>
				<main className="sd-main">
					<div className="sd-meta" {...inertIf(!!modal)}>
						<div className="sd-time-box">
							<span>زمان باقی‌مانده</span>
							<strong>{game.maxTime > 0 ? clock(Math.max(0, game.timeRemaining)) : "—"}</strong>
							<button type="button" className="sd-icon" aria-label="مکث بازی" disabled={!playing || game.paused} onClick={() => game.pause()}>
								<Icon name="pause" />
							</button>
						</div>
						<div>
							<span>فرصت باقی‌مانده</span>
							<strong className="sd-lives" aria-label={`${fa(lives)} فرصت باقی‌مانده`}>
								{Array.from({ length: game.maxMistakes || 3 }, (_, i) => (i < lives ? "♥" : "♡")).join(" ")}
							</strong>
						</div>
					</div>
					<div className="sd-board-wrap">
						<div className="sd-board" ref={cellsRef} role="group" aria-label="جدول سودوکو؛ ۹ سطر و ۹ ستون" dir="ltr" {...inertIf(!!modal)}>
							{(board.length ? board : Array.from({ length: 9 }, () => Array.from({ length: 9 }, () => null))).map((row, x) =>
								row.map((cell, y) => {
									const value = cell?.value ?? null;
									const given = !!cell?.prefilled;
									const wrong = !!value && !given && !!conflicts[x]?.[y];
									const selected = sel?.x === x && sel?.y === y;
									const notes = cell?.notes ? [...cell.notes] : [];
									const cls = [
										"sd-cell",
										given ? "sd-given" : "sd-entry",
										peers(sel, x, y) ? "sd-peer" : "",
										selValue && value === selValue ? "sd-same" : "",
										selected ? "sd-selected" : "",
										wrong ? "sd-wrong" : "",
										y === 2 || y === 5 ? "sd-box-right" : "",
										x === 2 || x === 5 ? "sd-box-bottom" : "",
									].join(" ");
									return (
										<button
											key={`${x}-${y}`}
											type="button"
											className={cls}
											data-cell={`${x}-${y}`}
											aria-pressed={selected}
											aria-label={`سطر ${fa(x + 1)}، ستون ${fa(y + 1)}؛ ${value ? `${fa(value)}${given ? "، ثابت" : wrong ? "، تکراری" : ""}` : notes.length ? `خالی، یادداشت ${notes.map((n) => fa(n)).join("، ")}` : "خالی"}`}
											onClick={() => {
												interacted.current = true;
												if (playing) game.selectCell(x as Index, y as Index);
											}}
										>
											{value ? (
												<span>{fa(value)}</span>
											) : notes.length ? (
												<span className="sd-notes" aria-hidden="true">
													{Array.from({ length: 9 }, (_, n) => (
														<i key={n}>{notes.includes((n + 1) as CellValue) ? fa(n + 1) : ""}</i>
													))}
												</span>
											) : null}
										</button>
									);
								}),
							)}
						</div>
						{modal ? (
							<div className="sd-overlay">
								<section className="sd-dialog" ref={dialogRef} role="dialog" aria-modal="true" aria-label="وضعیت سودوکو">
									<span className="sd-dialog-symbol" aria-hidden="true">
										۹ × ۹
									</span>
									<h3>{dialog[modal][0]}</h3>
									<p>{dialog[modal][1]}</p>
									{problem ? (
										<p className="sd-problem" role="alert">
											{problem}
										</p>
									) : null}
									<div className="sd-dialog-actions">
										{modal === "ready" ? (
											<>
												<div className="sd-level-choice" role="radiogroup" aria-label="سطح بازی">
													{LEVELS.map(([key, name]) => (
														<button key={key} type="button" className="sd-secondary" role="radio" aria-checked={level === key} disabled={!unlockedLevel(key)} onClick={() => setLevel(key)}>
															{name}
															{unlockedLevel(key) ? "" : " · قفل"}
														</button>
													))}
												</div>
												<button type="button" className="sd-primary" disabled={isCharging || game.isLoadingConfig} onClick={() => { interacted.current = true; void start(level); }}>
													{isCharging || game.isLoadingConfig ? "در حال شروع…" : `شروع بازی · ${label(level)}`}
												</button>
											</>
										) : modal === "pause" ? (
											<button type="button" className="sd-primary" onClick={() => { interacted.current = true; game.resume(); }}>
												ادامهٔ بازی
											</button>
										) : modal === "won" ? (
											<button type="button" className="sd-primary" onClick={toMenu}>
												جدول بعدی
											</button>
										) : modal === "lost" ? (
											<>
												<button type="button" className="sd-primary" disabled={isCharging} onClick={() => void continueAfterLoss()}>
													{isCharging ? "در حال پرداخت…" : "ادامهٔ همین جدول"}
												</button>
												<button type="button" className="sd-secondary" disabled={paying} onClick={toMenu}>
													جدول تازه
												</button>
											</>
										) : (
											<>
												<button
													type="button"
													className="sd-primary"
													onClick={() => {
														if (modal === "exit") {
															music.current?.stop();
															setConfirm("");
															game.pause();
															push(R.games);
														} else {
															if (modal === "level" && pendingLevel) setLevel(pendingLevel);
															setPendingLevel(null);
															toMenu();
														}
													}}
												>
													{modal === "exit" ? "خروج" : modal === "level" ? "تغییر سطح" : "شروع دوباره"}
												</button>
												<button type="button" className="sd-secondary" onClick={() => { setPendingLevel(null); setConfirm(""); }}>
													ادامهٔ همین جدول
												</button>
											</>
										)}
									</div>
								</section>
							</div>
						) : null}
					</div>
					<p className="sd-selection" aria-live="polite">
						{game.hintBlocked ? "با عددهایی که گذاشته‌ای هیچ جواب درستی ممکن نیست؛ یکی را پاک کن، بعد دوباره «کمک» بزن." : selectionText}
					</p>
					<div className="sd-toolbox" aria-label="ابزار بازی" {...inertIf(!!modal)}>
						<button type="button" disabled={!playing || !game.canUndo} onClick={game.undo}>
							<Icon name="undo-2" />
							<span>برگشت</span>
						</button>
						<button type="button" disabled={!playing || fixed || (!selValue && !selCell?.notes)} onClick={game.eraseCell}>
							<Icon name="eraser" />
							<span>پاک‌کردن</span>
						</button>
						<button type="button" aria-pressed={noteMode} disabled={!playing} onClick={() => setNoteMode(!noteMode)}>
							<Icon name="pencil" />
							<span>یادداشت</span>
						</button>
						<button type="button" disabled={!canHint} onClick={() => { game.hint(); if (sound) music.current?.effect(); }}>
							<Icon name="lightbulb" />
							<span>کمک · {fa(game.remainingHints)}</span>
						</button>
					</div>
					<div className="sd-keypad" dir="ltr" aria-label="انتخاب عدد" {...inertIf(!!modal)}>
						{Array.from({ length: 9 }, (_, i) => {
							const n = (i + 1) as CellValue;
							const left = Math.max(0, 9 - (numberProgress[n] ?? 0));
							return (
								<button key={n} type="button" aria-label={`عدد ${fa(n)}`} disabled={!playing || fixed} className={left === 0 ? "sd-digit-complete" : ""} onClick={() => enter(n)}>
									<b>{fa(n)}</b>
									<small>{fa(left)} مانده</small>
								</button>
							);
						})}
					</div>
					<div className="sd-actions" {...inertIf(!!modal)}>
						<button type="button" className="sd-primary" disabled={!playing} onClick={() => setConfirm("new")}>
							<Icon name="rotate-cw" />
							بازی تازه
						</button>
						<label className="sd-level">
							<span>سطح بازی</span>
							<select
								aria-label="سطح بازی"
								value={level}
								onChange={(e) => {
									const next = e.target.value as Difficulty;
									if (!unlockedLevel(next)) return;
									if (playing && next !== game.difficulty) {
										setPendingLevel(next);
										setConfirm("level");
									} else setLevel(next);
								}}
							>
								{LEVELS.map(([key, name]) => (
									<option key={key} value={key} disabled={!unlockedLevel(key)}>
										{name}
										{unlockedLevel(key) ? "" : " · قفل"}
									</option>
								))}
							</select>
						</label>
					</div>
					<p className="sd-unlock">{unlockText}</p>
					<footer className="sd-footer">
						<span>{status === "won" ? "جدول کامل شد" : `${label(game.difficulty ?? level)} · ${noteMode ? "حالت یادداشت" : "حالت عدد"}`}</span>
						<span>{playCost !== undefined ? `هر بازی ${fa(playCost)} امتیاز` : ""}</span>
					</footer>
				</main>
				<p className="sd-sr" aria-live="polite">
					{live}
				</p>
			</article>
		</div>
	);
}
