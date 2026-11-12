"use client";

import { CASH_WALLET_VISIBLE } from "../features";
import { type CSSProperties, useCallback, useEffect, useMemo, useRef, useState } from "react";

import { useRouter, useSearchParams } from "next/navigation";

import Icon from "../Icon";
import { gameStyleClass, useBdStyle, useResolvedScheme } from "../appearance";
import GameSettings, { GameSettingsButton } from "../GameSettings";
import { GameBar } from "../autoHide";
import { askLeave, PLAIN_LEAVE, useBackHandler } from "../back";
import { BetFeeNote, goBuyCoins } from "../entryFee";
import { fa } from "../format";
import { persianNumberConverter } from "@/libs/utils/persianNumberConverter";
import { R, usePoints, useRequireLogin } from "../ui";
import { type Slice, labelPoint, landingRotation, prizeLabel, sliceAt, slicesFor, spinEasing, wedgePath } from "../wheelMath";
import { type Soundtrack, createSoundtrack } from "./soundtrack";
import "./wheel.css";

import { gameErrorMessage } from "@/api/games/request";
import useGetWheel from "@/api/lottery/hooks/useGetWheel";
import useSpinWheel from "@/api/lottery/hooks/useSpinWheel";

// The wheel made by `manage.py seed_wheel`; another one can be opened with ?wheel=<id>.
const DEFAULT_WHEEL_ID = "11111111-1111-1111-1111-111111111111";
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
 * the bet range, the prizes (× bet / cost) and every spin's result come from it; the wheel only shows them
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
	const bdStyle = useBdStyle();

	// The player's bet, like crash and chicken (typed or −/+); null until the wheel tells its range.
	const [betText, setBetText] = useState<string | null>(null);
	const [phase, setPhase] = useState<Phase>("ready");
	const [requesting, setRequesting] = useState(false);
	const [paused, setPaused] = useState(false);
	const [outcome, setOutcome] = useState<Outcome | null>(null);
	const [history, setHistory] = useState<Outcome[]>([]);
	const [rounds, setRounds] = useState(0);
	const [error, setError] = useState<string | null>(null);
	const [help, setHelp] = useState(false);
	const [sound, setSound] = useState(true);
	const [showSettings, setShowSettings] = useState(false);
	const [celebrate, setCelebrate] = useState(false);
	// The wheel as it was when the spin began: a refetch (new odds, new prizes) never moves the
	// slices under a spin or under its shown result; the live wheel returns at the next change.
	const [frozen, setFrozen] = useState<Slice[] | null>(null);

	const rotor = useRef<HTMLDivElement>(null);
	const angle = useRef(0);
	const anim = useRef({ from: 0, to: 0, elapsed: 0, duration: SPIN_MS, last: 0, sector: -1, lastTick: -Infinity });
	const frame = useRef(0);
	const pending = useRef<Outcome | null>(null);
	const music = useRef<Soundtrack | null>(null);
	const unlocked = useRef(false);
	const busy = useRef(false);
	const mounted = useRef(true);
	const soundOn = useRef(true);
	const reduced = useRef(false);
	const spinSlices = useRef<Slice[]>([]);
	const celebrateTimer = useRef(0);

	const prizes = useMemo(() => wheel?.lottery_wheel_prizes ?? [], [wheel?.lottery_wheel_prizes]);
	const base = Number(wheel?.cost_per_spin ?? 0);
	const minBet = wheel?.min_bet ?? base;
	const maxBet = wheel?.max_bet ?? base;
	const step = Math.max(1, base || 1);
	// A free wheel (cost 0) takes no bet: spun as it is, nothing charged.
	const free = !!wheel && base === 0;
	const bet = Number(persianNumberConverter(betText ?? String(minBet)));
	const betOk = free || (Number.isInteger(bet) && bet >= minBet && bet <= maxBet);
	// Each slice's chance stays; what it pays grows with the bet (× bet / cost_per_spin).
	const scale = base && betOk ? bet / base : 1;
	const live = useMemo(() => slicesFor(prizes, 1, scale), [prizes, scale]);
	const slices = frozen ?? live;
	const cost = free ? 0 : betOk ? bet : minBet;
	const balance = points.points ?? 0;
	const enough = points.points !== null && balance >= cost;
	const betProblem = !free && betText !== null && !betOk ? `شرط باید بین ${fa(minBet)} و ${fa(maxBet)} سکه باشد.` : null;
	const setBet = (value: number | string) => {
		setBetText(String(value));
		setOutcome(null);
		setFrozen(null);
		setPhase("ready");
	};
	const spinning = phase === "spinning" || requesting;

	// ── sound: one switch for the music and the effects, remembered on this device ──
	useEffect(() => {
		try {
			setSound(localStorage.getItem(SOUND_KEY) !== "off");
		} catch {
			// storage blocked: sound stays on
		}
		music.current = createSoundtrack();
		mounted.current = true;
		return () => {
			mounted.current = false;
			window.cancelAnimationFrame(frame.current);
			frame.current = 0;
			window.clearTimeout(celebrateTimer.current);
			music.current?.destroy();
		};
	}, []);
	useEffect(() => {
		soundOn.current = sound;
	}, [sound]);
	const visible = () => typeof document !== "undefined" && !document.hidden;
	const syncMusic = useCallback(
		(on = sound, isPaused = paused) => {
			if (on && unlocked.current && !isPaused && visible()) music.current?.start();
			else music.current?.stop();
		},
		[sound, paused],
	);
	// Read at the moment of the sound (a mute during a spin silences the rest of it).
	const effect = (kind: "tick" | "win" | "lose") => {
		if (soundOn.current && unlocked.current && visible()) music.current?.effect(kind);
	};

	// ── the turning: one animation frame loop while a spin runs ──
	const draw = () => {
		if (rotor.current) rotor.current.style.transform = `rotate(${angle.current}deg)`;
	};
	const finish = useCallback(() => {
		const result = pending.current;
		pending.current = null;
		busy.current = false;
		if (!mounted.current) return;
		setPhase("result");
		if (!result) return;
		setOutcome(result);
		setHistory((h) => [result, ...h].slice(0, HISTORY));
		setRounds((n) => n + 1);
		effect(result.won ? "win" : "lose");
		if (result.won && !reducedMotion()) {
			setCelebrate(true);
			window.clearTimeout(celebrateTimer.current);
			celebrateTimer.current = window.setTimeout(() => setCelebrate(false), 1700);
		}
		void points.refetch();
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, [points.refetch]);

	const loop = useCallback(
		(now: number) => {
			if (!mounted.current) return;
			const a = anim.current;
			const dt = a.last ? Math.max(0, now - a.last) : 0;
			a.last = now;
			a.elapsed = Math.min(a.duration, a.elapsed + dt);
			// Reduced motion: the wheel holds still, then shows where it stopped (no fast turning).
			angle.current = reduced.current
				? a.elapsed >= a.duration
					? a.to
					: a.from
				: a.from + (a.to - a.from) * spinEasing(a.elapsed / a.duration);
			draw();
			const sector = sliceAt(spinSlices.current, angle.current);
			if (sector !== a.sector && now - a.lastTick > 35 && !reduced.current) {
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
		[finish],
	);
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
		if (frame.current) return;
		unlocked.current = true;
		setPaused(false);
		anim.current.last = 0;
		frame.current = window.requestAnimationFrame(loop);
		syncMusic(sound, false);
	};

	const spin = async () => {
		if (busy.current || !points.account || !enough || !betOk || !live.length) return;
		busy.current = true;
		unlocked.current = true;
		const snapshot = live;
		spinSlices.current = snapshot;
		setFrozen(snapshot);
		syncMusic(sound, false);
		setRequesting(true);
		setOutcome(null);
		setError(null);
		setCelebrate(false);
		try {
			const answer = await spinAsync({ lottery_wheel: wheelId, token_wallet_account: points.account.id, ...(free ? {} : { bet }) });
			if (!mounted.current) return;
			const won = answer.result?.prize;
			// What was won comes from the server's answer (its amount is already × bet / cost); the
			// wheel only has to find the slice to land on.
			const amount = Number(won?.prize_amount || 0);
			const empty = !won || won.prize_type === "empty" || amount <= 0;
			// A slice to land on: the prize's, if this page draws it at all (a 0% slice has no room).
			const index = won ? snapshot.findIndex((s) => s.prize.id === won.id && s.end - s.start > 0) : -1;
			const result: Outcome = !won
				? { won: false, text: "نتیجه رسید؛ کیف‌پول را ببین.", short: "؟", slice: null }
				: empty
					? { won: false, text: "", short: "پوچ", slice: index < 0 ? null : index }
					: {
							won: true,
							text: prizeLabel(amount, won.prize_type),
							short: `${fa(amount)}${won.prize_type === "cash" && CASH_WALLET_VISIBLE ? " ت" : ""}`,
							slice: index < 0 ? null : index,
						};
			if (index < 0) {
				// A prize this page does not know or draw (the wheel changed): shown as it is, no landing.
				pending.current = result;
				setFrozen(null);
				void wheelQuery.refetch();
				finish();
				return;
			}
			pending.current = result;
			const slice = snapshot[index];
			// Anywhere inside the chosen slice (not on its edge), after five turns.
			const span = slice.end - slice.start;
			const target = slice.start + span / 2 + (Math.random() - 0.5) * span * 0.6;
			reduced.current = reducedMotion();
			const duration = reduced.current ? REDUCED_MS : SPIN_MS;
			anim.current = { from: angle.current, to: landingRotation(angle.current, target), elapsed: 0, duration, last: 0, sector: sliceAt(snapshot, angle.current), lastTick: -Infinity };
			setPhase("spinning");
			setPaused(false);
			frame.current = window.requestAnimationFrame(loop);
		} catch (e) {
			busy.current = false;
			if (!mounted.current) return;
			setError(gameErrorMessage(e));
			setPhase("ready");
			setFrozen(null);
			void points.refetch();
		} finally {
			if (mounted.current) setRequesting(false);
		}
	};

	const leave = () => {
		music.current?.stop();
		push(R.home);
	};
	const quit = () => askLeave(PLAIN_LEAVE, leave);
	useBackHandler(true, () => (help ? setHelp(false) : spinning ? undefined : quit()));

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
				className={`wh ${gameStyleClass("wh", bdStyle)} ${scheme === "dark" ? "wh-dark" : ""} ${celebrate ? "wh-celebrate" : ""}`}
				data-wh-style={bdStyle}
				data-phase={phase === "spinning" ? "spinning" : phase}
				data-paused={String(paused)}
				dir="rtl"
				aria-label="گردونه شانس"
			>
				<GameSettings open={showSettings} onClose={() => setShowSettings(false)} game="گردونه" look={bdStyle} dark={scheme === "dark"} rows={[
					{ kind: "toggle", id: "sound", label: "موسیقی و افکت‌ها", on: sound, onChange: (on) => { setSound(on); unlocked.current = true; syncMusic(on); try { localStorage.setItem(SOUND_KEY, on ? "on" : "off"); } catch { /* not remembered */ } } },
				]} />
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
							<GameSettingsButton className="wh-icon" open={showSettings} onClick={() => setShowSettings((v) => !v)} />
							<button type="button" className="wh-icon" aria-label="راهنمای گردونه" aria-expanded={help} onClick={() => setHelp(!help)}>
								<Icon name="circle-help" />
							</button>
							<button type="button" className="wh-icon" aria-label="خروج از گردونه" disabled={spinning} onClick={quit}>
								<Icon name="arrow-left" />
							</button>
						</div>
					</header>
				</GameBar>
				<section className="wh-help" hidden={!help}>
					<b>یک چرخش، یک شانس تازه</b>
					<BetFeeNote minBet={free ? 0 : minBet} />
					<p>شرط هر چرخش را خودت انتخاب می‌کن{minBet ? `ی (${fa(minBet)} تا ${fa(maxBet)} سکه)` : "ی"} و همان از کیف کم می‌شود. جایزه را سرور انتخاب می‌کند و گردونه روی همان خانه می‌ایستد؛ اندازهٔ هر خانه همان شانس واقعی آن است.</p>
					<p>جایزهٔ هر خانه به نسبت شرط بزرگ‌تر می‌شود{base ? `: شرط ${fa(base * 2)} یعنی دو برابرِ جایزه‌های شرط ${fa(base)}` : ""}؛ شانس‌ها ثابت می‌مانند. {CASH_WALLET_VISIBLE ? "جایزهٔ سکه‌ای به کیف و جایزهٔ نقدی («ت» یعنی تومان) به کیف نقدی می‌رود." : "همهٔ جایزه‌ها به‌صورت سکه به کیف تو اضافه می‌شوند."}</p>
				</section>
				<main className="wh-main">
					<div className="wh-topline">
						<span className="wh-balance">
							<Icon name="coins" />
							<span>
								موجودی <b>{points.points === null ? "…" : fa(balance)}</b>
							</span>
						</span>
						<span className="wh-demo">{free ? "چرخش رایگان" : cost ? `شرط ${fa(cost)} سکه` : "گردونهٔ بردینو"}</span>
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
								<div className="wh-cost" hidden={free}>
									<span>
										شرط هر چرخش <small>سکه</small>
									</span>
									<div className="wh-stepper" dir="ltr">
										<button
											type="button"
											aria-label="کم کردن شرط"
											disabled={spinning || !betOk || bet <= minBet}
											onClick={() => setBet(Math.max(minBet, (Math.ceil(bet / step) - 1) * step))}
										>
											<Icon name="minus" />
										</button>
										<input
											className="wh-bet"
											type="text"
											inputMode="numeric"
											aria-label="شرط هر چرخش"
											aria-invalid={!!betProblem}
											value={betText ?? String(minBet || "")}
											disabled={spinning}
											onChange={(e) => setBet(e.target.value.replace(/[^0-9۰-۹٠-٩]/g, "").slice(0, 7))}
										/>
										<button
											type="button"
											aria-label="زیاد کردن شرط"
											disabled={spinning || (betOk && bet >= maxBet)}
											onClick={() => setBet(betOk ? Math.min(maxBet, (Math.floor(bet / step) + 1) * step) : minBet)}
										>
											<Icon name="plus" />
										</button>
									</div>
								</div>
								<button type="button" className="wh-spin" disabled={spinning || !enough || !betOk || !points.account} onClick={() => void spin()}>
									<Icon name={spinning ? "loader-circle" : "rotate-cw"} className={requesting ? "bd-spin" : undefined} />
									<span>{spinning ? "داره می‌چرخه…" : "بگردون"}</span>
								</button>
								<p className="wh-error" role="alert" hidden={!error && !betProblem && (points.points === null || enough || spinning)}>
									{error ?? betProblem ?? `سکهٔ کافی نیست؛ شرط این چرخش ${fa(cost)} سکه است.`}
								</p>
								{points.points !== null && !enough && !spinning ? (
									<button type="button" className="bd-buy-coins" onClick={() => goBuyCoins(push)}>
								<Icon name="coins" /> خرید سکه
							</button>
								) : null}
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
