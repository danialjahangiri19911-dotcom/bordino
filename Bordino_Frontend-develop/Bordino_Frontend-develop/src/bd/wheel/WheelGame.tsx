"use client";

import { type CSSProperties, useCallback, useEffect, useMemo, useRef, useState } from "react";

import { useRouter, useSearchParams } from "next/navigation";

import Icon from "../Icon";
import { useResolvedScheme } from "../appearance";
import { GameBar } from "../autoHide";
import { useBackHandler } from "../back";
import { fa } from "../format";
import { R, usePoints, useRequireLogin } from "../ui";
import { labelPoint, landingRotation, prizeLabel, sliceAt, slicesFor, spinEasing, wedgePath } from "../wheelMath";
import { type Soundtrack, createSoundtrack } from "./soundtrack";
import "./wheel.css";

import { gameErrorMessage } from "@/api/games/request";
import useGetWheel from "@/api/lottery/hooks/useGetWheel";
import useSpinWheel from "@/api/lottery/hooks/useSpinWheel";

// The wheel made by `manage.py seed_wheel`; another one can be opened with ?wheel=<id>.
const DEFAULT_WHEEL_ID = "11111111-1111-1111-1111-111111111111";
const MULTIPLIERS = [1, 2, 3, 4, 5];
const SPIN_MS = 5200;
const REDUCED_MS = 650;
const BULBS = 24;
const CONFETTI = 18;
const HISTORY = 5;
const SOUND_KEY = "bd-wheel-sound";

type Phase = "ready" | "spinning" | "result";
interface Outcome {
	won: boolean;
	text: string;
	short: string;
	slice: number | null;
}

const reducedMotion = () => typeof window !== "undefined" && !!window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;

/**
 * «گردونه» in the Bordino-Wheel-Game-Design look (neobrutalism), driven by the server: the prizes,
 * the cost, the multiplier's effect and every spin's result come from it; the wheel only shows them
 * (each slice as large as its real chance) and lands on the slice the server chose.
 */
export default function WheelGame() {
	const allowed = useRequireLogin();
	const { push } = useRouter();
	const wheelId = useSearchParams().get("wheel") ?? DEFAULT_WHEEL_ID;
	const wheelQuery = useGetWheel({ id: wheelId });
	const wheel = wheelQuery.data?.result;
	const points = usePoints();
	const { spinAsync } = useSpinWheel();
	const scheme = useResolvedScheme();

	const [multiplier, setMultiplier] = useState(1);
	const [phase, setPhase] = useState<Phase>("ready");
	const [requesting, setRequesting] = useState(false);
	const [paused, setPaused] = useState(false);
	const [outcome, setOutcome] = useState<Outcome | null>(null);
	const [history, setHistory] = useState<Outcome[]>([]);
	const [rounds, setRounds] = useState(0);
	const [error, setError] = useState<string | null>(null);
	const [help, setHelp] = useState(false);
	const [sound, setSound] = useState(true);
	const [celebrate, setCelebrate] = useState(false);

	const rotor = useRef<HTMLDivElement>(null);
	const angle = useRef(0);
	const anim = useRef({ from: 0, to: 0, elapsed: 0, duration: SPIN_MS, last: 0, sector: -1, lastTick: -Infinity });
	const frame = useRef(0);
	const pending = useRef<Outcome | null>(null);
	const music = useRef<Soundtrack | null>(null);
	const unlocked = useRef(false);
	const busy = useRef(false);

	const prizes = useMemo(() => wheel?.lottery_wheel_prizes ?? [], [wheel?.lottery_wheel_prizes]);
	const slices = useMemo(() => slicesFor(prizes, multiplier), [prizes, multiplier]);
	const cost = Number(wheel?.cost_per_spin ?? 0);
	const balance = points.points ?? 0;
	const enough = points.points !== null && balance >= cost;
	const spinning = phase === "spinning" || requesting;

	// ── sound: one switch for the music and the effects, remembered on this device ──
	useEffect(() => {
		try {
			setSound(localStorage.getItem(SOUND_KEY) !== "off");
		} catch {
			// storage blocked: sound stays on
		}
		music.current = createSoundtrack();
		return () => music.current?.destroy();
	}, []);
	const visible = () => typeof document !== "undefined" && !document.hidden;
	const syncMusic = useCallback(
		(on = sound, isPaused = paused) => {
			if (on && unlocked.current && !isPaused && visible()) music.current?.start();
			else music.current?.stop();
		},
		[sound, paused],
	);
	const effect = (kind: "tick" | "win" | "lose") => {
		if (sound && unlocked.current && visible()) music.current?.effect(kind);
	};

	// ── the turning: one animation frame loop while a spin runs ──
	const draw = () => {
		if (rotor.current) rotor.current.style.transform = `rotate(${angle.current}deg)`;
	};
	const finish = useCallback(() => {
		const result = pending.current;
		pending.current = null;
		busy.current = false;
		setPhase("result");
		if (!result) return;
		setOutcome(result);
		setHistory((h) => [result, ...h].slice(0, HISTORY));
		setRounds((n) => n + 1);
		if (sound && unlocked.current && visible()) music.current?.effect(result.won ? "win" : "lose");
		if (result.won && !reducedMotion()) {
			setCelebrate(true);
			window.setTimeout(() => setCelebrate(false), 1700);
		}
		void points.refetch();
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, [sound, points.refetch]);

	const loop = useCallback(
		(now: number) => {
			const a = anim.current;
			const dt = a.last ? Math.max(0, now - a.last) : 0;
			a.last = now;
			a.elapsed = Math.min(a.duration, a.elapsed + dt);
			angle.current = a.from + (a.to - a.from) * spinEasing(a.elapsed / a.duration);
			draw();
			const sector = sliceAt(slices, angle.current);
			if (sector !== a.sector && now - a.lastTick > 35 && a.duration > REDUCED_MS) {
				effect("tick");
				a.lastTick = now;
			}
			a.sector = sector;
			if (a.elapsed >= a.duration) {
				frame.current = 0;
				finish();
				return;
			}
			frame.current = window.requestAnimationFrame(loop);
		},
		// eslint-disable-next-line react-hooks/exhaustive-deps
		[slices, finish, sound],
	);
	useEffect(() => () => window.cancelAnimationFrame(frame.current), []);
	useEffect(draw);

	// Away (another app or tab): the turning waits, the sound stops; «ادامهٔ چرخش» carries on.
	useEffect(() => {
		const onVisibility = () => {
			if (!document.hidden) return;
			if (frame.current) {
				window.cancelAnimationFrame(frame.current);
				frame.current = 0;
				setPaused(true);
			}
			unlocked.current = false;
			music.current?.stop();
		};
		document.addEventListener("visibilitychange", onVisibility);
		return () => document.removeEventListener("visibilitychange", onVisibility);
	}, []);
	const resume = () => {
		unlocked.current = true;
		setPaused(false);
		anim.current.last = 0;
		frame.current = window.requestAnimationFrame(loop);
		syncMusic(sound, false);
	};

	const spin = async () => {
		if (busy.current || !points.account || !enough || !slices.length) return;
		busy.current = true;
		unlocked.current = true;
		syncMusic(sound, false);
		setRequesting(true);
		setOutcome(null);
		setError(null);
		setCelebrate(false);
		try {
			const answer = await spinAsync({ lottery_wheel: wheelId, token_wallet_account: points.account.id, multiplier });
			const won = answer.result?.prize;
			const index = won ? slices.findIndex((s) => s.prize.id === won.id) : -1;
			if (!won || index < 0) {
				// The wheel changed on the server: show what it says, then draw the wheel again.
				pending.current = null;
				busy.current = false;
				setOutcome({ won: false, text: "نتیجه رسید؛ گردونه به‌روز می‌شود. کیف‌پول را ببین.", short: "؟", slice: null });
				void wheelQuery.refetch();
				void points.refetch();
				setPhase("result");
				return;
			}
			const slice = slices[index];
			const amount = Number(won.prize_amount || 0);
			pending.current =
				won.prize_type === "empty" || amount <= 0
					? { won: false, text: "", short: "پوچ", slice: index }
					: { won: true, text: prizeLabel(amount, won.prize_type), short: slice.short, slice: index };
			// Anywhere inside the chosen slice (not on its edge), after five turns.
			const span = slice.end - slice.start;
			const target = slice.start + span / 2 + (Math.random() - 0.5) * span * 0.6;
			const duration = reducedMotion() ? REDUCED_MS : SPIN_MS;
			anim.current = { from: angle.current, to: landingRotation(angle.current, target), elapsed: 0, duration, last: 0, sector: sliceAt(slices, angle.current), lastTick: -Infinity };
			setPhase("spinning");
			setPaused(false);
			frame.current = window.requestAnimationFrame(loop);
		} catch (e) {
			busy.current = false;
			setError(gameErrorMessage(e));
			setPhase("ready");
			void points.refetch();
		} finally {
			setRequesting(false);
		}
	};

	const leave = () => {
		music.current?.stop();
		push(R.home);
	};
	useBackHandler(true, () => (help ? setHelp(false) : spinning ? undefined : leave()));

	if (!allowed) return null;

	const resultLabel = spinning
		? "ببین کجا می‌ایسته…"
		: phase === "result" && outcome
			? outcome.won
				? "جایزهٔ این چرخش"
				: outcome.slice === null
					? "نتیجهٔ این چرخش"
					: "این بار جایزه‌ای نبود"
			: "جایزهٔ بعدی منتظرته";
	const resultText = spinning
		? "شانست در حرکته"
		: phase === "result" && outcome
			? outcome.won
				? outcome.text
				: outcome.text || "شانس بعدی منتظرته"
			: "بچرخون و ببین!";
	const footer = paused ? "چرخش متوقف شده" : spinning ? "در حال چرخش" : phase === "result" ? `دور ${fa(rounds)} تمام شد` : "آمادهٔ چرخش";

	return (
		<div className="bd-wheel-page">
			<article
				className={`wh wh-brutal ${scheme === "dark" ? "wh-dark" : ""} ${celebrate ? "wh-celebrate" : ""}`}
				data-wh-style="brutal"
				data-phase={phase === "spinning" ? "spinning" : phase}
				data-paused={String(paused)}
				dir="rtl"
				aria-label="گردونه شانس"
			>
				<GameBar playing={phase === "spinning" && !paused}>
					<header className="wh-header">
						<div>
							<small className="wh-eyebrow">بردینو / {wheel?.name || "گردونه شانس"}</small>
							<h2>
								وقتِ شانسته<span>!</span>
							</h2>
						</div>
						<div className="wh-tools">
							<button
								type="button"
								className="wh-icon"
								aria-label={sound ? "قطع موسیقی و افکت‌ها" : "پخش موسیقی و افکت‌ها"}
								aria-pressed={sound}
								onClick={() => {
									const on = !sound;
									setSound(on);
									unlocked.current = true;
									syncMusic(on);
									try {
										localStorage.setItem(SOUND_KEY, on ? "on" : "off");
									} catch {
										// not remembered
									}
								}}
							>
								<Icon name={sound ? "volume-2" : "volume-x"} />
							</button>
							<button type="button" className="wh-icon" aria-label="راهنمای گردونه" aria-expanded={help} onClick={() => setHelp(!help)}>
								<Icon name="circle-help" />
							</button>
							<button type="button" className="wh-icon" aria-label="خروج از گردونه" disabled={spinning} onClick={leave}>
								<Icon name="arrow-right" />
							</button>
						</div>
					</header>
				</GameBar>
				<section className="wh-help" hidden={!help}>
					<b>یک چرخش، یک شانس تازه</b>
					<p>هر چرخش {cost ? `${fa(cost)} امتیاز` : "به اندازهٔ هزینهٔ گردونه"} از کیف امتیاز کم می‌کند. جایزه را سرور انتخاب می‌کند و گردونه روی همان خانه می‌ایستد؛ اندازهٔ هر خانه همان شانس واقعی آن است.</p>
					<p>ضریب ×۲ تا ×۵ جایزه را چند برابر و شانس بردنش را به همان نسبت کمتر می‌کند؛ هزینهٔ چرخش ثابت است. جایزهٔ امتیازی به کیف امتیاز و جایزهٔ نقدی («ت» یعنی تومان) به کیف نقدی می‌رود.</p>
				</section>
				<main className="wh-main">
					<div className="wh-topline">
						<span className="wh-balance">
							<Icon name="coins" />
							<span>
								موجودی <b>{points.points === null ? "…" : fa(balance)}</b>
							</span>
						</span>
						<span className="wh-demo">{cost ? `هر چرخش ${fa(cost)} امتیاز` : "گردونهٔ بردینو"}</span>
					</div>
					{!slices.length ? (
						<div className="wh-state" role="status">
							{wheelQuery.isLoading ? (
								<strong>در حال آماده‌سازی گردونه…</strong>
							) : wheelQuery.error ? (
								<>
									<strong>گردونه بارگذاری نشد</strong>
									<span>اتصال را بررسی کن و دوباره تلاش کن.</span>
									<button type="button" className="wh-reset" onClick={() => void wheelQuery.refetch()}>
										تلاش دوباره
									</button>
								</>
							) : (
								<>
									<strong>گردونهٔ فعالی در حال حاضر نیست</strong>
									<span>به‌زودی دوباره سر بزن.</span>
								</>
							)}
						</div>
					) : (
						<>
							<div className="wh-stage">
								<div className="wh-halo" aria-hidden="true" />
								<div className="wh-rim">
									{Array.from({ length: BULBS }, (_, i) => (
										<i key={i} className="wh-bulb" style={{ "--i": i } as CSSProperties} aria-hidden="true" />
									))}
									<div ref={rotor} className="wh-rotor">
										<svg
											className="wh-disc"
											viewBox="0 0 400 400"
											role="img"
											aria-label={`گردونه با ${fa(slices.length)} خانه: ${slices.map((s) => s.label).join("، ")}`}
										>
											{slices.map((s, i) => {
												const span = s.end - s.start;
												const [x, y] = labelPoint(s.start, s.end);
												const mid = (s.start + s.end) / 2;
												const size = s.short.length > 6 ? "wh-tiny" : s.short.length > 4 ? "wh-small" : "";
												return (
													<g key={s.prize.id} className={phase === "result" && outcome?.slice === i ? "wh-selected" : ""}>
														<path className={`wh-wedge wh-wedge-${s.prize.prize_type === "empty" ? 3 : i % 3}`} d={wedgePath(s.start, s.end)} />
														{span >= 14 ? (
															<text x={x} y={y} className={size} transform={`rotate(${mid} ${x} ${y})`} textAnchor="middle" dominantBaseline="middle">
																{s.short}
															</text>
														) : null}
													</g>
												);
											})}
										</svg>
									</div>
									<div className="wh-hub" aria-hidden="true">
										<Icon name="sparkles" />
										<span>BORDINO</span>
									</div>
									<div className="wh-pointer" aria-hidden="true" />
								</div>
								<div className="wh-confetti" aria-hidden="true">
									{Array.from({ length: CONFETTI }, (_, i) => (
										<i key={i} style={{ "--n": i } as CSSProperties} />
									))}
								</div>
								<div className="wh-paused" hidden={!paused}>
									<button type="button" className="wh-resume" onClick={resume}>
										<Icon name="play" />
										ادامهٔ چرخش
									</button>
								</div>
							</div>
							<div className="wh-result" role="status" aria-live="polite">
								<span>{resultLabel}</span>
								<strong>{resultText}</strong>
							</div>
							<section className="wh-controls" aria-label="کنترل گردونه">
								<div className="wh-cost">
									<span>
										ضریب جایزه <small>هزینه ثابت</small>
									</span>
									<div className="wh-stepper" dir="ltr">
										<button
											type="button"
											aria-label="کاهش ضریب جایزه"
											disabled={spinning || multiplier <= MULTIPLIERS[0]}
											onClick={() => {
												setMultiplier((m) => Math.max(MULTIPLIERS[0], m - 1));
												setOutcome(null);
												setPhase("ready");
											}}
										>
											<Icon name="minus" />
										</button>
										<output aria-live="polite">
											<bdi dir="ltr">{fa(multiplier)}×</bdi>
										</output>
										<button
											type="button"
											aria-label="افزایش ضریب جایزه"
											disabled={spinning || multiplier >= MULTIPLIERS[MULTIPLIERS.length - 1]}
											onClick={() => {
												setMultiplier((m) => Math.min(MULTIPLIERS[MULTIPLIERS.length - 1], m + 1));
												setOutcome(null);
												setPhase("ready");
											}}
										>
											<Icon name="plus" />
										</button>
									</div>
								</div>
								<button type="button" className="wh-spin" disabled={spinning || !enough || !points.account} onClick={() => void spin()}>
									<Icon name={spinning ? "loader-circle" : "rotate-cw"} className={requesting ? "bd-spin" : undefined} />
									<span>{spinning ? "داره می‌چرخه…" : "بگردون"}</span>
								</button>
								<p className="wh-error" role="alert" hidden={!error && (points.points === null || enough || spinning)}>
									{error ?? `امتیاز کافی نیست؛ هر چرخش ${fa(cost)} امتیاز است.`}
								</p>
							</section>
							<div className="wh-history">
								<span>چرخش‌های اخیر</span>
								<div>
									{history.length
										? history.map((h, i) => (
												<span key={i} className="wh-chip" aria-label={h.won ? `جایزه ${h.text}` : "پوچ"}>
													{h.short}
												</span>
											))
										: "هنوز نچرخوندی"}
								</div>
							</div>
						</>
					)}
					<footer className="wh-footer">
						<span>{footer}</span>
						<span>نتیجه را سرور انتخاب می‌کند</span>
					</footer>
				</main>
			</article>
		</div>
	);
}
