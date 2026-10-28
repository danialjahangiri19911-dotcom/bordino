"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import { useRouter } from "next/navigation";

import Icon from "../Icon";
import { useResolvedScheme } from "../appearance";
import { useBackHandler } from "../back";
import { fa } from "../format";
import { R, useRequireLogin } from "../ui";
import "./crash.css";
import { type AutoRun, type CrashForm, DEFAULT_FORM, afterAutoRound, autoCashout, num, plot, validate } from "./logic";
import { type Soundtrack, createSoundtrack } from "./soundtrack";

import useCrashGame from "@/_pages/PwaApp/Crash/useCrashGame";
import { multiplierAt, profitOnWin, verifyCrashPoint } from "@/_pages/PwaApp/Crash/utils";

const SETTINGS_KEY = "bordino-crash-settings-v1";
const SOUND_KEY = "bordino-crash-sound";
const AUTO_PAUSE_MS = 1800;
/** Grace after the highest possible crash before the page says the connection is lost. */
const RECONNECT_GRACE_MS = 3000;
const HISTORY_SHOWN = 12;

type Phase = "ready" | "waiting" | "running" | "crashed";

/** «۲٫۴۵» — always two decimals, like the design's multiplier. */
const fa2 = (n: number | string) => Number(n).toLocaleString("fa-IR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

function readSettings(): CrashForm {
	try {
		const saved = JSON.parse(localStorage.getItem(SETTINGS_KEY) ?? "null") as Partial<CrashForm> | null;
		if (saved && typeof saved === "object") {
			const form = { ...DEFAULT_FORM };
			for (const key of Object.keys(DEFAULT_FORM) as (keyof CrashForm)[]) {
				if (typeof saved[key] === typeof DEFAULT_FORM[key]) (form as Record<string, unknown>)[key] = saved[key];
			}
			return form;
		}
	} catch {
		// private mode or bad data: the defaults
	}
	return DEFAULT_FORM;
}

/** Re-render every animation frame while `active` (4 times a second with reduced motion). */
function useFrameClock(active: boolean) {
	const [, setNow] = useState(0);
	useEffect(() => {
		if (!active) return undefined;
		if (window.matchMedia?.("(prefers-reduced-motion: reduce)").matches) {
			const timer = window.setInterval(() => setNow(Date.now()), 250);
			return () => window.clearInterval(timer);
		}
		let frame = 0;
		const tick = () => {
			setNow(Date.now());
			frame = requestAnimationFrame(tick);
		};
		frame = requestAnimationFrame(tick);
		return () => cancelAnimationFrame(frame);
	}, [active]);
}

/**
 * «انفجار» in the Bordino-Crash-Game-Design look (neobrutalism, like the rest of the app), driven by
 * the server's rounds (apps/crash): the bet, the cash-out and the crash point are the server's; the
 * page only animates the curve the server's clock describes. Automatic play is a series of ordinary
 * server bets, adjusted by the player's rules between rounds.
 */
export default function CrashGame() {
	const allowed = useRequireLogin();
	const { push } = useRouter();
	const scheme = useResolvedScheme();
	const game = useCrashGame();
	const { config, balance, round, history, busy } = game;

	const stage = useRef<HTMLDivElement>(null);
	const music = useRef<Soundtrack | null>(null);
	const [size, setSize] = useState({ width: 600, height: 320 });
	const [mode, setMode] = useState<"manual" | "auto">("manual");
	const [form, setForm] = useState<CrashForm>(DEFAULT_FORM);
	const [panel, setPanel] = useState<"" | "help" | "fair" | "exit">("");
	const [sound, setSound] = useState(true);
	const [unlocked, setUnlocked] = useState(false);
	const [hidden, setHidden] = useState(false);
	const [online, setOnline] = useState(true);
	const [notice, setNotice] = useState("");
	const [autoRunning, setAutoRunning] = useState(false);
	const [autoRun, setAutoRun] = useState<AutoRun | null>(null);
	const [seed, setSeed] = useState("");
	const [verify, setVerify] = useState("");

	// ── saved settings and sound switch (this browser only) ──
	useEffect(() => {
		setForm(readSettings());
		try {
			setSound(localStorage.getItem(SOUND_KEY) !== "off");
		} catch {
			// default on
		}
	}, []);
	const update = (change: Partial<CrashForm>) =>
		setForm((prev) => {
			const next = { ...prev, ...change };
			try {
				localStorage.setItem(SETTINGS_KEY, JSON.stringify(next));
			} catch {
				// not saved; still used
			}
			return next;
		});

	// ── the page: visibility, connection, stage size ──
	useEffect(() => {
		const onVisible = () => setHidden(document.hidden);
		const onOnline = () => setOnline(navigator.onLine);
		setOnline(navigator.onLine);
		document.addEventListener("visibilitychange", onVisible);
		window.addEventListener("online", onOnline);
		window.addEventListener("offline", onOnline);
		return () => {
			document.removeEventListener("visibilitychange", onVisible);
			window.removeEventListener("online", onOnline);
			window.removeEventListener("offline", onOnline);
		};
	}, []);
	useEffect(() => {
		const el = stage.current;
		if (!el || typeof ResizeObserver === "undefined") return undefined;
		const observer = new ResizeObserver(([entry]) =>
			setSize({ width: Math.max(260, entry.contentRect.width || 600), height: Math.max(260, entry.contentRect.height || 320) }),
		);
		observer.observe(el);
		return () => observer.disconnect();
	}, [allowed]);

	// ── the round on screen, from the server's clock ──
	const live = !!round && !round.revealed;
	useFrameClock(live && !hidden);
	const growth = config?.growth_per_ms ?? 0.00006;
	const rawElapsed = round ? game.serverNow() - Date.parse(round.started_at) : 0;
	// No round outlives its multiplier cap: past it the answer is only late, so the curve stops there.
	const capMs = round ? Math.log(Number(round.max_multiplier) || 1000) / growth : Infinity;
	const elapsed = Math.min(rawElapsed, capMs);
	const reconnecting = live && rawElapsed > capMs + RECONNECT_GRACE_MS;
	const crashPoint = round?.revealed && round.crash_point ? Number(round.crash_point) : null;
	let phase: Phase = "ready";
	if (round?.revealed) phase = "crashed";
	else if (round) phase = elapsed < 0 ? "waiting" : "running";
	const multiplier = phase === "running" ? multiplierAt(elapsed, growth) : phase === "crashed" ? (crashPoint ?? 1) : 1;
	const cashedAt = round?.status === "won" && round.cashout_multiplier ? Number(round.cashout_multiplier) : 0;
	const target = round?.auto_cashout ? Number(round.auto_cashout) : null;
	// Passing the target on screen is not a win yet: the server confirms it (the long-poll answers then).
	const autoPending = phase === "running" && round?.status === "active" && !!target && multiplier >= target;
	const flying = phase === "waiting" || phase === "running";
	const flightSec =
		phase === "running" ? elapsed / 1000 : phase === "crashed" && crashPoint ? Math.log(crashPoint) / (growth * 1000) : 0;
	const chart = plot(flightSec, growth * 1000, multiplier, size.width, size.height);

	const limits = useMemo(
		() => ({
			minBet: config?.min_bet ?? 1,
			maxBet: config?.max_bet ?? 1,
			balance,
			maxMultiplier: Math.min(1000, Number(config?.max_multiplier) || 100),
		}),
		[config, balance],
	);
	const problem = config ? (config.enabled ? validate(form, limits, mode === "auto") : "بازی انفجار فعلاً غیرفعال است.") : "";
	const locked = flying || autoRunning || busy;

	// ── sound: music while a round flies, an effect on cash-out and on the crash ──
	useEffect(() => {
		music.current = createSoundtrack();
		return () => music.current?.destroy();
	}, []);
	useEffect(() => {
		if (sound && unlocked && flying && !hidden) music.current?.start();
		else music.current?.stop();
	}, [sound, unlocked, flying, hidden]);
	// One cash effect when the server confirms a cash-out, one crash effect when the round ends (as in
	// the design); nothing for the round that was already on screen when the page opened.
	const sounded = useRef<{ id: string; cash: boolean; crash: boolean } | null>(null);
	useEffect(() => {
		if (!round) return;
		const seen = sounded.current;
		if (!seen) {
			sounded.current = { id: round.id, cash: round.status === "won", crash: round.revealed };
			return;
		}
		if (seen.id !== round.id) sounded.current = { id: round.id, cash: false, crash: false };
		const now = sounded.current!;
		const audible = sound && unlocked;
		if (round.status === "won" && !now.cash) {
			now.cash = true;
			if (audible) music.current?.effect("cash");
		}
		if (round.revealed && !now.crash) {
			now.crash = true;
			if (audible) music.current?.effect("crash");
		}
	}, [round, sound, unlocked]);

	// ── betting ──
	const { placeBet } = game;
	const bet = useCallback((stake: number, auto: boolean) => placeBet(stake, autoCashout(form, auto)), [placeBet, form]);

	const autoTimer = useRef<number | null>(null);
	const counted = useRef("");
	const stopAuto = useCallback((why: string) => {
		setAutoRunning(false);
		if (autoTimer.current) window.clearTimeout(autoTimer.current);
		autoTimer.current = null;
		setNotice(why);
	}, []);
	useEffect(() => () => {
		if (autoTimer.current) window.clearTimeout(autoTimer.current);
	}, []);
	// Hidden page: the round on the server goes on, but no new automatic bet starts unseen.
	useEffect(() => {
		if (hidden && autoRunning) stopAuto(flying ? "تکرار خودکار متوقف شد؛ این دور روی سرور ادامه دارد." : "اجرای خودکار متوقف شد.");
	}, [hidden, autoRunning, flying, stopAuto]);

	const startAuto = async () => {
		const stake = num(form.stake);
		// The round on screen is the last manual one: it must not count as the first automatic result.
		counted.current = round?.id ?? "";
		setAutoRun({ base: stake, stake, played: 0, net: 0 });
		setAutoRunning(true);
		setNotice("");
		if (!(await bet(stake, true))) setAutoRunning(false);
	};

	useEffect(() => {
		if (!autoRunning || !autoRun || !round?.revealed || counted.current === round.id) return;
		counted.current = round.id;
		const { next, stop } = afterAutoRound(autoRun, round, form, limits);
		setAutoRun(next);
		if (stop) {
			stopAuto(stop);
			return;
		}
		autoTimer.current = window.setTimeout(async () => {
			autoTimer.current = null;
			if (!(await bet(next.stake, true))) setAutoRunning(false);
		}, AUTO_PAUSE_MS);
	}, [autoRunning, autoRun, round, form, limits, bet, stopAuto]);

	// ── the main button ──
	let main: { label: string; disabled: boolean; cash?: boolean; run: () => void } = {
		label: mode === "auto" ? "شروع دورهای خودکار" : "شروع دور",
		disabled: !config || !!problem || busy || !online || game.loading,
		run: () => (mode === "auto" ? void startAuto() : void bet(num(form.stake), false)),
	};
	if (phase === "waiting") main = { label: "شروع دور…", disabled: true, run: () => undefined };
	else if (phase === "running") {
		if (reconnecting || !online) main = { label: "در حال اتصال دوباره…", disabled: true, run: () => undefined };
		else if (cashedAt) main = { label: "برداشت شد؛ منتظر پایان دور", disabled: true, run: () => undefined };
		else if (autoPending) main = { label: `در انتظار تأیید ${fa2(target ?? 0)}×…`, disabled: true, run: () => undefined };
		else if (round)
			main = { label: `برداشت ${fa(Math.floor(round.bet * multiplier))}`, disabled: busy, cash: true, run: () => void game.cashOut() };
	} else if (autoRunning) main = { label: "دور بعدی به‌زودی…", disabled: true, run: () => undefined };

	// Space = the main button, when not typing in a field.
	useEffect(() => {
		const onKey = (event: KeyboardEvent) => {
			if (event.code !== "Space" || event.repeat) return;
			const tag = (event.target as HTMLElement | null)?.tagName;
			if (tag === "INPUT" || tag === "TEXTAREA" || tag === "BUTTON" || tag === "SELECT") return;
			event.preventDefault();
			setUnlocked(true);
			if (!main.disabled) main.run();
		};
		window.addEventListener("keydown", onKey);
		return () => window.removeEventListener("keydown", onKey);
	});

	// ── leaving: the round goes on at the server, so ask first while one is in play ──
	const leave = () => {
		try {
			music.current?.stop();
		} finally {
			push(R.games);
		}
	};
	const inPlay = flying || autoRunning || busy;
	useBackHandler(true, () => (panel ? setPanel("") : inPlay ? setPanel("exit") : leave()));

	if (!allowed) return null;

	const stake = num(form.stake);
	const stakeOk = Number.isFinite(stake);
	const stepStake = (delta: number) =>
		update({ stake: String(Math.max(limits.minBet, Math.min(limits.maxBet, (stakeOk ? stake : limits.minBet) + delta))) });
	const stepTarget = (delta: number) => {
		const current = num(form.target);
		const value = Math.max(1.01, Math.min(limits.maxMultiplier, (Number.isFinite(current) ? current : 2) + delta));
		update({ target: (Math.round(value * 100) / 100).toFixed(2) });
	};
	const targetOn = form.autoCash || mode === "auto";
	const lastFinished = round?.revealed ? round : history[0] ?? null;

	const status = {
		ready: "آمادهٔ شروع",
		waiting: `شروع تا ${fa(Math.max(1, Math.ceil(-elapsed / 1000)))} ثانیه`,
		running: cashedAt ? "برداشت انجام شد" : "در حال پرواز",
		crashed: "پایان دور",
	}[phase];
	const caption = {
		ready: "برای شروع یک دور آماده‌ای؟",
		waiting: "آمادهٔ پرواز",
		running: cashedAt ? `برداشت در ضریب ${fa2(cashedAt)}` : "ضریب در حال افزایش است",
		crashed: cashedAt ? `برداشت در ضریب ${fa2(cashedAt)}؛ انفجار در ${fa2(crashPoint ?? 0)}` : "منفجر شد",
	}[phase];
	const resultText =
		round && cashedAt
			? `برداشت ${fa(round.payout)} امتیاز`
			: phase === "crashed" && round
				? `نتیجهٔ دور: ${fa(round.payout - round.bet)} امتیاز`
				: "";
	const announcement =
		phase === "crashed" && round ? (cashedAt ? `برد! ${fa(round.payout)} امتیاز با ضریب ${fa2(cashedAt)}` : `انفجار در ${fa2(crashPoint ?? 0)}`) : "";

	return (
		<div
			className="bd-crash-page"
			onPointerDown={() => {
				setUnlocked(true);
				if (sound) music.current?.prime();
			}}
		>
			<article className={`cr cr-brutal ${scheme === "dark" ? "cr-dark" : ""}`} data-style-name="brutal" dir="rtl" aria-label="بازی انفجار">
				<header className="cr-header">
					<div className="cr-brand">
						<span className="cr-mark">
							<Icon name="rocket" />
						</span>
						<div>
							<small>بردینو / بازی‌ها</small>
							<h2>
								انفجار<span>.</span>
							</h2>
						</div>
					</div>
					<div className="cr-tools">
						<button
							type="button"
							className="cr-icon"
							aria-label={sound ? "قطع موسیقی و افکت‌ها" : "پخش موسیقی و افکت‌ها"}
							aria-pressed={sound}
							onClick={() => {
								const next = !sound;
								setSound(next);
								try {
									localStorage.setItem(SOUND_KEY, next ? "on" : "off");
								} catch {
									// not remembered
								}
							}}
						>
							<Icon name={sound ? "volume-2" : "volume-x"} />
						</button>
						<button type="button" className="cr-icon" aria-label="اطلاعات بازی" aria-expanded={panel === "help"} onClick={() => setPanel(panel === "help" ? "" : "help")}>
							<Icon name="circle-help" />
						</button>
						<button type="button" className="cr-icon" aria-label="خروج از بازی" onClick={() => (inPlay ? setPanel("exit") : leave())}>
							<Icon name="arrow-right" />
						</button>
					</div>
				</header>

				{panel === "help" ? (
					<section className="cr-help">
						<b>ضریب و برداشت</b>
						<p>پیش از شروع دور امتیاز شرط را انتخاب کن. ضریب از ۱٫۰۰ بالا می‌رود؛ قبل از انفجار برداشت کن تا شرط × ضریب را ببری. اگر پیش از برداشت منفجر شود، امتیاز همان دور از دست می‌رود.</p>
						<p>با «برداشت در ضریب» روشن، سرور در همان ضریب خودکار برداشت می‌کند. در حالت خودکار، دورها پشت سر هم با قوانینی که تعیین می‌کنی بازی می‌شوند.</p>
						<p>
							نقطهٔ انفجار را سرور پیش از دور تعیین می‌کند و بعد از دور قابل بررسی است (بخش «شفافیت»). شرط {fa(limits.minBet)} تا {fa(limits.maxBet)} امتیاز
							{config ? `، حداکثر برد هر دور ${fa(config.max_payout)} امتیاز` : ""}.
						</p>
					</section>
				) : null}
				{panel === "exit" ? (
					<section className="cr-help" role="alertdialog" aria-label="خروج از بازی">
						<b>از بازی خارج می‌شوی؟</b>
						<p>
							{flying
								? round?.auto_cashout
									? `دور جاری روی سرور ادامه دارد؛ اگر ضریب به ${fa2(round.auto_cashout)} برسد خودکار برداشت می‌شود.`
									: "دور جاری روی سرور ادامه دارد و بدون برداشت، با انفجار امتیاز شرط از دست می‌رود."
								: "اجرای خودکار متوقف می‌شود."}
						</p>
						<div className="cr-panel-actions">
							<button type="button" autoFocus onClick={() => setPanel("")}>
								ادامهٔ بازی
							</button>
							<button type="button" className="cr-leave" onClick={leave}>
								خروج
							</button>
						</div>
					</section>
				) : null}

				<main className="cr-main">
					<div className="cr-recent">
						<span>دورهای اخیر</span>
						<div className="cr-history" aria-label="نتایج دورهای اخیر تو">
							{history.length ? (
								history.slice(0, HISTORY_SHOWN).map((r) => {
									const point = Number(r.crash_point);
									return (
										<span key={r.id} className={point >= 2 ? "cr-high" : ""} title={r.status === "won" ? `برداشت در ${fa2(r.cashout_multiplier ?? 0)}` : "باخت"}>
											{fa2(point)}×
										</span>
									);
								})
							) : (
								<small>هنوز دوری اجرا نشده</small>
							)}
						</div>
						<button
							type="button"
							aria-label="شفافیت"
							aria-expanded={panel === "fair"}
							onClick={() => {
								setSeed(config?.client_seed ?? "");
								setVerify("");
								setPanel(panel === "fair" ? "" : "fair");
							}}
						>
							<Icon name="shield-check" />
							<span>شفافیت</span>
						</button>
					</div>

					{panel === "fair" ? (
						<section className="cr-fair-panel">
							<b>شفافیت و بررسی دور</b>
							<p>نقطهٔ انفجار هر دور پیش از شرط با «بذر سرور» تعیین می‌شود و هش آن از همان لحظه دیده می‌شود. پس از پایان دور خود بذر نمایش داده می‌شود تا نتیجه را دوباره حساب کنی:</p>
							<p className="cr-formula">
								HMAC_SHA256(server_seed, client_seed:nonce) → x = first 4 bytes
								<br />
								crash = max(1, floor(2³² × (1 − edge) / (x + 1) × 100) / 100)
							</p>
							{round && !round.revealed ? (
								<dl>
									<dt>هش بذر سرور این دور</dt>
									<dd>{round.server_seed_hash}</dd>
								</dl>
							) : null}
							<label className="cr-field">
								<span>بذر تو (client seed)، مشترک در همهٔ بازی‌ها</span>
								<span className="cr-seed">
									<input value={seed} dir="ltr" aria-label="بذر تو" disabled={locked} onChange={(e) => setSeed(e.target.value.replace(/[^A-Za-z0-9_-]/g, "").slice(0, 64))} />
									<button type="button" disabled={locked || !seed || seed === config?.client_seed} onClick={() => void game.changeSeed(seed)}>
										ذخیره
									</button>
								</span>
							</label>
							<dl>
								<dt>شمارهٔ دور بعدی (nonce)</dt>
								<dd>{config?.next_nonce ?? "—"}</dd>
							</dl>
							{lastFinished ? (
								<>
									<b>آخرین دور ({fa2(lastFinished.crash_point ?? 0)}×)</b>
									<dl>
										<dt>هش بذر سرور</dt>
										<dd>{lastFinished.server_seed_hash}</dd>
										<dt>بذر سرور</dt>
										<dd>{lastFinished.server_seed ?? "—"}</dd>
										<dt>بذر : nonce</dt>
										<dd>
											{lastFinished.client_seed}:{lastFinished.nonce}
										</dd>
									</dl>
									{lastFinished.server_seed ? (
										<p>
											<button
												type="button"
												className="cr-verify"
												onClick={async () => {
													const result = await verifyCrashPoint(
														lastFinished.server_seed ?? "",
														lastFinished.client_seed,
														lastFinished.nonce,
														lastFinished.house_edge,
														lastFinished.max_multiplier,
													);
													setVerify(
														result === null
															? "بررسی در مرورگر فقط روی نشانی https کار می‌کند."
															: result === lastFinished.crash_point
																? `✓ درست است: ${fa2(result)}×`
																: `✗ نتیجهٔ محاسبه ${fa2(result)}× است.`,
													);
												}}
											>
												بررسی این دور
											</button>{" "}
											<span aria-live="polite">{verify}</span>
										</p>
									) : null}
								</>
							) : null}
						</section>
					) : null}

					<div ref={stage} className={`cr-stage ${cashedAt ? "cr-cashed" : ""}`} data-phase={phase}>
						<div className="cr-stage-top">
							<span>{status}</span>
							<small>{round ? `شرط ${fa(round.bet)} امتیاز` : `کمینهٔ شرط ${fa(limits.minBet)}`}</small>
						</div>
						<div className="cr-multiplier">
							<strong dir="ltr">
								{fa2(multiplier)}
								<span>×</span>
							</strong>
							<span>{caption}</span>
						</div>
						<svg
							className="cr-chart"
							viewBox={`0 0 ${size.width} ${size.height}`}
							role="img"
							aria-label={`نمودار ضریب؛ ضریب ${fa2(multiplier)}؛ زمان ${fa(flightSec, 1)} ثانیه`}
						>
							<g className="cr-grid">
								{chart.grid.map((y) => (
									<line key={y} x1={35} x2={size.width - 32} y1={y} y2={y} />
								))}
							</g>
							<path className="cr-area" d={chart.area} />
							<path className="cr-line" fill="none" d={chart.line} />
							<g className="cr-axis">
								{chart.labels.map((l) => (
									<text key={`${l.anchor}${l.x}${l.y}`} x={l.x} y={l.y} textAnchor={l.anchor}>
										{l.text}
									</text>
								))}
							</g>
						</svg>
						<span className="cr-rocket" aria-hidden="true" style={{ left: `${(chart.tip[0] / size.width) * 100}%`, top: `${(chart.tip[1] / size.height) * 100}%` }}>
							<Icon name="rocket" />
						</span>
						<span className="cr-burst" aria-hidden="true" style={{ left: `${(chart.tip[0] / size.width) * 100}%`, top: `${(chart.tip[1] / size.height) * 100}%` }}>
							<Icon name="zap" />
						</span>
						<span className="cr-result">{resultText}</span>
						{reconnecting || (!online && live) ? (
							<div className="cr-pause">
								<span>در حال اتصال دوباره…</span>
								<p>دور روی سرور ادامه دارد؛ نتیجه پس از اتصال نمایش داده می‌شود.</p>
							</div>
						) : null}
					</div>
					<p className="cr-sr" aria-live="polite">
						{announcement}
					</p>

					<div className="cr-controls">
						<div className="cr-mode" role="group" aria-label="حالت بازی">
							{(
								[
									["manual", "hand", "دستی"],
									["auto", "repeat-2", "خودکار"],
								] as const
							).map(([key, icon, label]) => (
								<button key={key} type="button" aria-pressed={mode === key} disabled={locked} onClick={() => setMode(key)}>
									<Icon name={icon} />
									{label}
								</button>
							))}
						</div>
						<fieldset className="cr-settings" disabled={locked}>
							<legend className="cr-sr">تنظیمات دور</legend>
							<div className="cr-input-row">
								<label className="cr-field">
									<span>امتیاز هر شرط</span>
									<span className="cr-stepper">
										<button type="button" aria-label="کم کردن امتیاز" onClick={() => stepStake(-1)}>
											<Icon name="minus" />
										</button>
										<input
											type="text"
											inputMode="numeric"
											aria-label="امتیاز هر شرط"
											value={form.stake}
											onChange={(e) => update({ stake: e.target.value.replace(/[^0-9۰-۹٠-٩]/g, "").slice(0, 9) })}
										/>
										<button type="button" aria-label="زیاد کردن امتیاز" onClick={() => stepStake(1)}>
											<Icon name="plus" />
										</button>
									</span>
								</label>
								<label className="cr-field">
									<span className="cr-cash-label">
										<span>برداشت در ضریب</span>
										<input
											type="checkbox"
											aria-label="برداشت خودکار در این ضریب"
											checked={targetOn}
											disabled={mode === "auto"}
											onChange={(e) => update({ autoCash: e.target.checked })}
										/>
									</span>
									<span className="cr-stepper">
										<button type="button" aria-label="کم کردن ضریب" disabled={!targetOn} onClick={() => stepTarget(-0.1)}>
											<Icon name="minus" />
										</button>
										<input
											type="text"
											inputMode="decimal"
											aria-label="ضریب برداشت خودکار"
											value={form.target}
											disabled={!targetOn}
											onChange={(e) => update({ target: e.target.value.replace(/[^0-9۰-۹٠-٩.٫]/g, "").slice(0, 7) })}
										/>
										<button type="button" aria-label="زیاد کردن ضریب" disabled={!targetOn} onClick={() => stepTarget(0.1)}>
											<Icon name="plus" />
										</button>
									</span>
								</label>
							</div>
							{mode === "auto" ? (
								<div className="cr-auto-settings">
									<div className="cr-auto-limits">
										{(
											[
												["count", "تعداد دور (۰ = نامحدود)"],
												["profitLimit", "توقف با سود"],
												["lossLimit", "توقف با ضرر"],
											] as const
										).map(([key, label]) => (
											<label key={key} className="cr-field">
												<span>{label}</span>
												<input
													type="text"
													inputMode="numeric"
													aria-label={label}
													value={form[key]}
													onChange={(e) => update({ [key]: e.target.value.replace(/[^0-9۰-۹٠-٩]/g, "").slice(0, 8) })}
												/>
											</label>
										))}
									</div>
									<div className="cr-auto-response">
										{(
											[
												["win", "برد"],
												["loss", "باخت"],
											] as const
										).map(([key, label]) => {
											const modeKey = `${key}Mode` as const;
											const pctKey = `${key}Percent` as const;
											return (
												<div key={key} className="cr-response">
													<label>
														<span>در صورت {label}</span>
														<select aria-label={`رفتار پس از ${label}`} value={form[modeKey]} onChange={(e) => update({ [modeKey]: e.target.value as "reset" | "increase" })}>
															<option value="reset">بازگشت به پایه</option>
															<option value="increase">افزایش درصدی</option>
														</select>
													</label>
													<label>
														<input
															type="text"
															inputMode="numeric"
															aria-label={`درصد افزایش پس از ${label}`}
															value={form[pctKey]}
															disabled={form[modeKey] !== "increase"}
															onChange={(e) => update({ [pctKey]: e.target.value.replace(/[^0-9۰-۹٠-٩]/g, "").slice(0, 4) })}
														/>
														<span>٪</span>
													</label>
												</div>
											);
										})}
									</div>
									<small>صفر در حد سود یا ضرر، آن محدودیت را غیرفعال می‌کند.</small>
								</div>
							) : null}
						</fieldset>
						<p className="cr-error" role="alert">
							{game.error ?? (!flying && !autoRunning && !game.loading ? problem : "")}
						</p>
						<div className="cr-actions">
							<button
								type="button"
								className={`cr-primary ${main.cash ? "cr-cash-button" : ""}`}
								disabled={main.disabled}
								onClick={() => {
									setUnlocked(true);
									game.setError(null);
									main.run();
								}}
							>
								{main.label}
							</button>
							{autoRunning ? (
								<button type="button" className="cr-stop" onClick={() => stopAuto(flying ? "تکرار متوقف شد؛ این دور ادامه دارد." : "اجرای خودکار متوقف شد.")}>
									توقف خودکار
								</button>
							) : null}
						</div>
						<div className="cr-account">
							<span>
								موجودی <strong>{config ? fa(balance) : "…"}</strong>
							</span>
							{autoRun && (autoRunning || autoRun.played > 0) ? (
								<span>
									نتیجهٔ اجرا <b>{fa(autoRun.net)}</b>
								</span>
							) : (
								<span>
									سود در ضریب انتخابی <b>{targetOn && stakeOk ? `+${fa(profitOnWin(stake, num(form.target), config?.max_payout))}` : "—"}</b>
								</span>
							)}
						</div>
						<p className="cr-notice" aria-live="polite">
							{!online ? "در انتظار اتصال…" : notice}
						</p>
					</div>
				</main>
				<footer className="cr-footer">
					<span>{autoRun && autoRunning ? `خودکار: ${fa(autoRun.played)} دور کامل شده` : "نقطهٔ انفجار را سرور پیش از دور تعیین می‌کند"}</span>
					<span>{config ? `حداکثر برد هر دور ${fa(config.max_payout)}` : ""}</span>
				</footer>
			</article>
		</div>
	);
}
