"use client";

import { type CSSProperties, useCallback, useEffect, useMemo, useRef, useState } from "react";

import { useRouter } from "next/navigation";

import Icon from "../Icon";
import { useResolvedScheme } from "../appearance";
import { fa } from "../format";
import { useBackHandler } from "../back";
import { R, useRequireLogin } from "../ui";
import "./chicken.css";
import { type ChickenMesh, createChickenMesh } from "./mesh";

import { verifyHitLane } from "@/_pages/PwaApp/Chicken/utils";
import useChickenGame from "@/_pages/PwaApp/Chicken/useChickenGame";
import type { ChickenDifficulty, ChickenRound } from "@/api/games/chicken/types";
import { persianNumberConverter } from "@/libs/utils/persianNumberConverter";

const ART = "/bd/chicken/chicken-brutal.webp";
const SPRITE = "/bd/chicken/chicken-brutal-sprite.webp";
const AUDIO = "/bd/chicken/audio/";
const JUMP_MS = 640;
const COLLISION_MS = 1000;
const TRAFFIC_S = 2.8;
const VEHICLES = ["sedan", "ambulance", "police", "taxi", "bus", "delivery"] as const;
const LEVELS: [ChickenDifficulty, string][] = [
	["easy", "آسان"],
	["medium", "متوسط"],
	["hard", "سخت"],
];

type Phase = "loading" | "ready" | "playing" | "jumping" | "colliding" | "won" | "lost";
interface View {
	phase: Phase;
	lane: number;
	target: number;
	secured: number;
	landed: boolean;
}
const READY: View = { phase: "ready", lane: 0, target: 0, secured: 0, landed: false };

const mult = (n: number | string) => (
	<bdi dir="ltr">{Number(n).toFixed(2)}×</bdi>
);
const laneCount = (width: number) => (width < 440 ? 4 : width < 760 ? 6 : 9);

function viewOf(round: ChickenRound): View {
	if (round.status === "active") return { phase: "playing", lane: round.step, target: round.step, secured: round.step, landed: false };
	if (round.status === "won") return { phase: "won", lane: round.step, target: round.step, secured: round.step, landed: false };
	return { phase: "lost", lane: round.step, target: round.step, secured: Math.max(0, round.step - 1), landed: false };
}

function Vehicle({ type, extra, delay = 0 }: { type: string; extra: string; delay?: number }) {
	return (
		<div className={`ck-car ck-vehicle ck-${type} ${extra}`} style={{ "--ck-delay": `${delay}s`, "--ck-traffic-duration": `${TRAFFIC_S}s` } as CSSProperties} aria-hidden="true">
			<span className="ck-roof" />
			<span className="ck-vehicle-mark">{type === "ambulance" ? "+" : type === "police" ? "★" : type === "taxi" ? "TAXI" : type === "delivery" ? "▧" : ""}</span>
			<span className="ck-lightbar" />
			<span className="ck-tail-lights" />
			<span className="ck-headlight-beams" />
		</div>
	);
}

/**
 * «مرغ فراری» in the Chicken-Game-Design look, driven by the server's rounds: the bet, every lane
 * and the cash-out are server calls (apps/crash chicken), which decide the outcome; the board only
 * animates what the server answered.
 */
export default function ChickenGame() {
	const allowed = useRequireLogin();
	const { push } = useRouter();
	const game = useChickenGame();
	const scheme = useResolvedScheme();
	const root = useRef<HTMLElement>(null);
	const canvas = useRef<HTMLCanvasElement>(null);
	const mesh = useRef<ChickenMesh | null>(null);
	const animating = useRef(false);
	const acknowledged = useRef<string | null>(null);
	const voices = useRef(new Set<HTMLAudioElement>());
	const music = useRef<HTMLAudioElement | null>(null);
	const timers = useRef<number[]>([]);

	const [view, setView] = useState<View>({ ...READY, phase: "loading" });
	const [level, setLevel] = useState<ChickenDifficulty>("easy");
	const [amountText, setAmountText] = useState("");
	const [dialog, setDialog] = useState<"" | "fair" | "exit">("");
	const [sound, setSound] = useState(false);
	const [motion, setMotion] = useState(true);
	const [online, setOnline] = useState(true);
	const [hidden, setHidden] = useState(false);
	const [count, setCount] = useState(6);
	const [verify, setVerify] = useState<string | null>(null);
	// Bumped after a failed step: re-reads the round the hook fetched back once that has rendered.
	const [resync, setResync] = useState(0);

	const { config, round, balance } = game;
	const minBet = config?.min_bet ?? 1;
	const maxBet = config?.max_bet ?? 1;
	const reduced = useCallback(
		() => !motion || (typeof window !== "undefined" && !!window.matchMedia?.("(prefers-reduced-motion: reduce)").matches),
		[motion],
	);

	// ── sound: one switch for music and effects, silent in a hidden tab ──
	const play = useCallback(
		(name: string, volume = 0.4) => {
			if (!sound || typeof Audio === "undefined" || document.hidden) return;
			const audio = new Audio(`${AUDIO}${name}.mp3`);
			audio.volume = volume;
			voices.current.add(audio);
			audio.onended = () => voices.current.delete(audio);
			audio.play().catch(() => voices.current.delete(audio));
		},
		[sound],
	);
	const stopAudio = useCallback(() => {
		// Never in the way of leaving: some Safari versions throw when a sound that never loaded
		// (iPhone blocks sound until a tap) is paused or rewound.
		try {
			music.current?.pause();
		} catch {
			// ignore
		}
		voices.current.forEach((a) => {
			try {
				a.pause();
				a.currentTime = 0;
			} catch {
				// ignore
			}
		});
		voices.current.clear();
	}, []);
	useEffect(() => {
		if (sound && !hidden) {
			if (!music.current) {
				music.current = new Audio(`${AUDIO}music.mp3`);
				music.current.loop = true;
				music.current.volume = 0.18;
			}
			music.current.play().catch(() => undefined);
		} else stopAudio();
	}, [sound, hidden, stopAudio]);
	useEffect(
		() => () => {
			stopAudio();
			timers.current.forEach((t) => window.clearTimeout(t));
		},
		[stopAudio],
	);
	const later = (fn: () => void, ms: number) => {
		timers.current.push(window.setTimeout(fn, ms));
	};

	// ── the page: visibility, connection, width ──
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
		const el = root.current;
		if (!el || typeof ResizeObserver === "undefined") return;
		const observer = new ResizeObserver((entries) => setCount(laneCount(entries[0].contentRect.width)));
		observer.observe(el);
		return () => observer.disconnect();
	}, [allowed]);

	// ── server state → board (except while a hop or crash is being animated) ──
	useEffect(() => {
		if (!config || animating.current) return;
		if (!amountText) setAmountText(String(Math.max(minBet, Math.min(10, maxBet))));
		if (!round || round.id === acknowledged.current) {
			setView(READY);
			return;
		}
		setLevel(round.difficulty);
		setAmountText(String(round.bet));
		setView(viewOf(round));
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, [config, round, resync]);

	// ── the original artwork, animated (WebGL), or the plain image if that is not possible ──
	useEffect(() => {
		const el = canvas.current;
		if (!el) return;
		if (!mesh.current || mesh.current.canvas !== el) {
			mesh.current?.destroy();
			mesh.current = createChickenMesh(el, SPRITE);
		}
		mesh.current?.update(view.phase === "won" ? "ready" : view.phase, !reduced(), hidden);
	}, [view.phase, hidden, reduced, allowed]);
	useEffect(() => () => mesh.current?.destroy(), []);

	const values = useMemo(() => {
		const list = round && round.id !== acknowledged.current ? round.multipliers : config?.difficulties[level]?.multipliers;
		return (list ?? []).map(Number);
	}, [round, config, level]);

	const amount = Number(persianNumberConverter(amountText));
	const amountError =
		!config || !amountText
			? null
			: !Number.isInteger(amount) || amount < minBet || amount > maxBet
				? `امتیاز باید بین ${fa(minBet)} و ${fa(maxBet)} باشد.`
				: amount > balance
					? "موجودی امتیاز کافی نیست."
					: null;

	// ── actions (each is one server call; the hook runs one at a time) ──
	const start = async () => {
		if (view.phase !== "ready" || amountError || !config?.enabled) return;
		const placed = await game.placeBet(amount, level);
		if (placed) {
			setView({ ...READY, phase: "playing" });
			setVerify(null);
		}
	};
	const hop = async () => {
		if (view.phase !== "playing" || game.busy || !round) return;
		const target = view.lane + 1;
		animating.current = true;
		setView((v) => ({ ...v, phase: "jumping", target, landed: false }));
		play("jump", 0.38);
		const [answer] = await Promise.all([game.step(), new Promise((done) => setTimeout(done, reduced() ? 0 : JUMP_MS))]);
		if (!answer) {
			// The step failed or its answer was lost: the hook read the round back; show that.
			animating.current = false;
			setView((v) => ({ ...v, phase: "playing", target: v.lane }));
			setResync((n) => n + 1);
			return;
		}
		if (answer.status === "lost") {
			setView((v) => ({ ...v, phase: "colliding", lane: answer.step, target: answer.step }));
			if (reduced()) {
				play("impact", 0.5);
				setView(viewOf(answer));
				animating.current = false;
				return;
			}
			later(() => play("impact", 0.5), 380);
			later(() => {
				setView(viewOf(answer));
				animating.current = false;
			}, COLLISION_MS);
			return;
		}
		play("land", 0.25);
		play("brake", 0.52);
		setView({ phase: answer.status === "won" ? "won" : "playing", lane: answer.step, target: answer.step, secured: answer.step, landed: true });
		if (answer.status === "won") play("cash", 0.32);
		animating.current = false;
	};
	const cash = async () => {
		if (view.phase !== "playing" || !view.lane || game.busy) return;
		const done = await game.cashOut();
		if (done?.status === "won") {
			play("cash", 0.32);
			setView(viewOf(done));
		}
	};
	const reset = () => {
		acknowledged.current = round?.id ?? null;
		setView(READY);
	};
	const leave = () => {
		try {
			stopAudio();
		} finally {
			push(R.games);
		}
	};

	// Android Back: closes the open panel, asks before leaving a round in play, else leaves (as the
	// header's exit button does).
	const inRound = (round?.status === "active" && round.id !== acknowledged.current) || view.phase === "jumping" || view.phase === "colliding" || game.busy;
	useBackHandler(true, () => (dialog ? setDialog("") : inRound ? setDialog("exit") : leave()));

	if (!allowed) return null;

	const roundActive = round?.status === "active" && round.id !== acknowledged.current;
	const jump = view.phase === "jumping";
	const hit = view.phase === "colliding";
	const lost = view.phase === "lost";
	const busy = jump || hit || game.busy;
	const locked = busy || roundActive || view.phase === "playing" || !online;
	const current = jump ? view.target : view.lane;
	const reachedValue = view.lane ? values[view.lane - 1] : 1;
	const lanes = Array.from({ length: count + (jump ? 1 : 0) }, (_, i) => view.lane + i);
	const finished = view.phase === "won" || lost;
	const active = view.phase === "playing" || jump || hit;
	const lowBalance = !!config && balance < minBet;
	const shownHistory = jump || hit ? game.history.filter((r) => r.id !== round?.id) : game.history;
	const loadFailed = !config && !game.loading;
	const primaryDisabled = !online || busy || (view.phase === "loading" && !loadFailed) || (!active && !finished && (!!amountError || lowBalance || !config?.enabled));

	const note = !online
		? "در انتظار اتصال… کنترل‌ها تا دریافت وضعیت معتبر قفل‌اند."
		: game.error
			? game.error
			: view.phase === "loading"
				? "در حال دریافت وضعیت بازی…"
				: config && !config.enabled
					? "مرغ فراری فعلاً غیرفعال است."
					: lowBalance && view.phase === "ready"
						? `امتیاز کافی برای شروع نداری (موجودی ${fa(balance)}، کمترین شرط ${fa(minBet)} امتیاز).`
						: amountError && view.phase === "ready"
							? amountError
							: {
									loading: "",
									ready: "امتیاز و سطح را انتخاب کن؛ سپس شروع.",
									playing: view.lane ? "هر پرش موفق، یک خط جلوتر. هر وقت خواستی توقف کن." : "اولین پرش را بزن.",
									jumping: "در حال پرش…",
									colliding: "برخورد!",
									won: "برد ثبت شد و به کیف امتیاز رفت.",
									lost: "برای دور بعد آماده‌ای؟",
								}[view.phase];

	return (
		<div className="bd-chicken-page">
			<article
				ref={root}
				className={`ck-game ck-brutal ${scheme === "dark" ? "ck-dark" : ""} ${motion ? "" : "ck-still"} ${hidden ? "ck-paused" : ""}`}
				style={{ "--ck-sprite": `url("${SPRITE}")` } as CSSProperties}
				dir="rtl"
				aria-label="مرغ فراری"
				onKeyDown={(e) => {
					if (e.key === "Escape" && dialog) setDialog("");
				}}
			>
				<header className="ck-top">
					<div className="ck-heading">
						<img src={ART} alt="" width={48} height={56} />
						<div>
							<div className="ck-kicker">BORDINO / CHICKEN ROAD</div>
							<h1>مرغ فراری</h1>
						</div>
					</div>
					<div className="ck-tools">
						<button className="ck-icon-button" type="button" aria-label="اطلاعات بازی" aria-expanded={dialog === "fair"} onClick={() => setDialog(dialog === "fair" ? "" : "fair")}>
							<Icon name="info" />
						</button>
						<button className="ck-icon-button" type="button" aria-label="خروج از بازی" onClick={() => (roundActive || busy ? setDialog("exit") : leave())}>
							<Icon name="log-out" />
						</button>
					</div>
				</header>
				<div className="ck-dialog" hidden={!dialog} role="dialog" aria-modal="false" aria-label={dialog === "exit" ? "خروج از بازی" : "اطلاعات بازی"}>
					{dialog === "fair" ? (
						<>
							<div className="ck-dialog-head">
								<h2>اطلاعات بازی</h2>
								<button type="button" onClick={() => setDialog("")} autoFocus>
									بستن
								</button>
							</div>
							<p>مرغ از پیاده‌رو روی دایرهٔ خط بعد می‌پرد. هر خط که سالم رد شود، ضریب آن خط به دست می‌آید؛ «توقف و دریافت» شرط × همان ضریب را به کیف امتیاز می‌برد. برخورد با خودرو یعنی باخت شرط.</p>
							<p>
								سطح‌ها: {LEVELS.map(([key, name]) => `${name} ${fa(config?.difficulties[key]?.lanes ?? 0)} خط`).join(" · ")}. حداکثر برد هر دور {fa(config?.max_payout ?? 0)} امتیاز.
							</p>
							<p>
								خط برخورد پیش از شروع دور با سید سرور تعیین می‌شود و هش آن از قبل نمایش داده می‌شود: <bdi dir="ltr" className="ck-hash">{(round?.server_seed_hash ?? "—").slice(0, 24)}…</bdi>
							</p>
							{round?.revealed && round.server_seed ? (
								<p>
									<button
										type="button"
										onClick={async () => {
											const lane = await verifyHitLane(round.server_seed!, round.client_seed, round.nonce, round.lanes, round.hit_chance);
											setVerify(lane === null ? "بررسی در این مرورگر ممکن نیست (فقط روی https)." : lane === (round.hit_lane ?? 0) ? `درست است: خط برخورد ${fa(lane)} بود.` : "نتیجه با سید منتشرشده نمی‌خواند!");
										}}
									>
										بررسی دور قبل با سید منتشرشده
									</button>{" "}
									{verify}
								</p>
							) : null}
							<button type="button" aria-pressed={motion} onClick={() => setMotion(!motion)}>
								حرکت‌ها: {motion ? "روشن" : "خاموش"}
							</button>
						</>
					) : dialog === "exit" ? (
						<>
							<h2>از بازی خارج می‌شوی؟</h2>
							<p>دور تو باز می‌ماند و وقتی برگردی از همین خط ادامه می‌دهی.</p>
							<button type="button" onClick={() => setDialog("")} autoFocus>
								ادامه
							</button>
							<button type="button" onClick={leave}>
								خروج
							</button>
						</>
					) : null}
				</div>
				<div className="ck-body">
					<div className="ck-layout">
						<section className="ck-arena" aria-label="زمین بازی">
							<div className={`ck-board ${motion ? "ck-moving" : ""}`} style={{ "--ck-count": count } as CSSProperties}>
								<div className={`ck-roadgrid ${jump ? "ck-camera-hop" : ""}`} style={{ "--ck-track-count": lanes.length } as CSSProperties}>
									{lanes.map((n) => {
										if (n > values.length) return <div key={`end-${n}`} className="ck-lane ck-road-end" aria-hidden="true" />;
										const safe = n > 0 && n <= view.secured;
										const reached = n > 0 && n <= view.lane;
										const type = VEHICLES[(n - 1 + VEHICLES.length) % VEHICLES.length];
										const fresh = safe && n === view.lane && view.landed;
										return (
											<div key={n} className={`ck-lane ${n === 0 ? "ck-origin" : ""} ${safe ? "ck-safe" : ""} ${n === current ? "ck-current" : ""} ${n === view.lane + 1 ? "ck-next" : ""}`} data-lane={n}>
												{n === 0 ? (
													<div className="ck-sidewalk" aria-label="پیاده‌روی نقطهٔ شروع">
														<span className="ck-shrub ck-shrub-a" />
														<span className="ck-shrub ck-shrub-b" />
														<span className="ck-curb" />
													</div>
												) : (
													<>
														{!reached ? (
															<div className={`ck-lane-multiplier ${values[n - 1] >= 100 ? "ck-large-multiplier" : ""}`} aria-label={`ضریب خط ${fa(n)}: ${values[n - 1]}`}>
																{mult(values[n - 1])}
															</div>
														) : null}
														{safe ? (
															<>
																<Vehicle type={type} extra={`ck-stopped ${fresh ? "ck-braking" : ""}`} />
																<div className={`ck-barrier ${fresh ? "ck-barrier-drop" : ""}`} role="img" aria-label={`مانع خط امن ${fa(n)}`}>
																	<span />
																</div>
															</>
														) : !(n === current && (hit || lost || jump)) ? (
															<Vehicle type={type} extra="ck-traffic" delay={-((n * 0.73) % TRAFFIC_S)} />
														) : null}
														{n === current && hit ? (
															<>
																<Vehicle type={type} extra="ck-impact-vehicle" />
																<span className="ck-impact-dust" aria-hidden="true" />
															</>
														) : null}
														{fresh ? <span className="ck-landing-ring" aria-hidden="true" /> : null}
													</>
												)}
											</div>
										);
									})}
								</div>
								<div
									className={`ck-actor ${jump ? "ck-jumping" : hit ? "ck-colliding" : lost ? "ck-flattened" : "ck-idling"}`}
									style={{ right: 0 }}
									role="img"
									aria-label={lost ? "مرغ کارتونی تخت‌شده با رد لاستیک" : jump ? `مرغ در حال پرش به خط ${fa(current)}` : `مرغ در ${view.lane ? `خط ${fa(view.lane)}` : "پیاده‌رو"}`}
								>
									<span className="ck-bird-shadow" />
									<span className="ck-sprite" aria-hidden="true">
										<span className="ck-original-art" />
										<canvas ref={canvas} className="ck-original-mesh" width={256} height={256} />
									</span>
									{lost ? (
										<span className="ck-dizzy" aria-hidden="true">
											✦ · ✧
										</span>
									) : null}
								</div>
								{view.phase === "won" && round ? (
									<div className="ck-result">
										<strong>توقف در {mult(round.cashout_multiplier ?? reachedValue)}</strong>
										<p>{fa(round.payout)} امتیاز به کیف امتیاز رفت</p>
									</div>
								) : null}
								{lost ? (
									<div className="ck-result ck-result-small">
										<strong>این دور تمام شد</strong>
										<p>دور تازه را از پیاده‌رو شروع کن.</p>
									</div>
								) : null}
								{!online ? (
									<div className="ck-result">
										<strong>در انتظار اتصال</strong>
										<p>کنترل‌ها تا دریافت وضعیت معتبر قفل‌اند.</p>
									</div>
								) : null}
							</div>
							<div className="ck-board-footer">
								<span>
									موجودی: <b>{config ? fa(balance) : "…"}</b> امتیاز
								</span>
								<div className="ck-audio-tools">
									<button type="button" aria-label={sound ? "قطع موسیقی و افکت‌ها" : "پخش موسیقی و افکت‌ها"} aria-pressed={sound} onClick={() => setSound(!sound)}>
										<Icon name={sound ? "volume-2" : "volume-x"} />
									</button>
								</div>
								<span className="ck-demo">{LEVELS.find(([key]) => key === level)?.[1]}</span>
							</div>
						</section>
						<section className="ck-controls" aria-label="کنترل بازی">
							<div className="ck-actions ck-side-deck">
								<div className="ck-action-slot">
									<button type="button" className="ck-primary ck-round" disabled={primaryDisabled} onClick={loadFailed ? () => window.location.reload() : active ? hop : finished ? reset : start}>
										<Icon name={active ? "arrow-left" : finished ? "rotate-ccw" : "play"} />
										<span className="ck-action-label">{loadFailed ? "تلاش دوباره" : active ? "پرش" : finished ? "دور تازه" : game.busy ? "…" : "شروع"}</span>
									</button>
									<small className="ck-action-caption">{active ? `خط بعدی ${fa(view.lane + 1)}` : "شروع از پیاده‌رو"}</small>
								</div>
								<div className="ck-settings">
									<div className="ck-setting">
										<span className="ck-label">امتیاز هر شرط</span>
										<div className="ck-stake-strip" dir="ltr">
											<button type="button" aria-label="کم کردن امتیاز" disabled={locked || amount <= minBet} onClick={() => setAmountText(String(Math.max(minBet, (Number.isFinite(amount) ? amount : minBet) - 1)))}>
												−
											</button>
											<input
												type="text"
												inputMode="numeric"
												aria-label="امتیاز هر شرط"
												value={amountText}
												disabled={locked}
												aria-invalid={!!amountError}
												onChange={(e) => setAmountText(e.target.value.replace(/[^0-9۰-۹٠-٩]/g, "").slice(0, 7))}
											/>
											<button type="button" aria-label="زیاد کردن امتیاز" disabled={locked || amount >= maxBet} onClick={() => setAmountText(String(Math.min(maxBet, (Number.isFinite(amount) ? amount : minBet - 1) + 1)))}>
												+
											</button>
										</div>
									</div>
									<fieldset className="ck-difficulty">
										<legend>سطح دشواری</legend>
										<div className="ck-risk-tabs">
											{LEVELS.map(([key, name]) => (
												<button key={key} type="button" aria-pressed={level === key} disabled={locked} onClick={() => setLevel(key)}>
													{name}
												</button>
											))}
										</div>
									</fieldset>
								</div>
								<div className="ck-action-slot">
									<button type="button" className="ck-secondary ck-round" disabled={view.phase !== "playing" || !view.lane || game.busy || !online} onClick={cash}>
										<Icon name="hand-coins" />
										<span className="ck-action-label">توقف و دریافت</span>
									</button>
									<small className="ck-action-caption">{view.phase === "playing" && view.lane && round ? `${fa(Math.floor(round.bet * (values[view.lane - 1] ?? 1)))} امتیاز` : view.phase === "won" && round ? `${fa(round.payout)} امتیاز گرفتی` : "پس از اولین پرش"}</small>
								</div>
							</div>
							<p className="ck-notice" aria-live="polite" role={game.error || !online ? "alert" : undefined}>
								{note}
							</p>
						</section>
					</div>
					<div className="ck-recent">
						<span>دورهای اخیر تو</span>
						<div className="ck-history">
							{/* The round being animated joins the list once its hop or crash has played out. */}
							{shownHistory.length
								? shownHistory.slice(0, 6).map((r) => (
										<bdi key={r.id} dir="ltr" className={r.status === "won" ? "" : "ck-history-lost"} aria-label={r.status === "won" ? `برد ${Number(r.cashout_multiplier ?? 0).toFixed(2)}×` : "باخت"}>
											{r.status === "won" ? `${Number(r.cashout_multiplier ?? 0).toFixed(2)}×` : "✕"}
										</bdi>
									))
								: "هنوز دوری ثبت نشده"}
						</div>
					</div>
				</div>
			</article>
		</div>
	);
}
