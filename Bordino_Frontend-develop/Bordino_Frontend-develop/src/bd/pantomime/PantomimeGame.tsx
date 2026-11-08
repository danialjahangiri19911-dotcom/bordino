"use client";

import { type ReactNode, useEffect, useMemo, useReducer, useRef, useState } from "react";

import { useRouter } from "next/navigation";

import Icon, { type IconName } from "../Icon";
import { gameStyleClass, useBdStyle } from "../appearance";
import { GameBar } from "../autoHide";
import { askLeave, useBackHandler, useBrowserBackGuard } from "../back";
import { fa, faDate } from "../format";
import { ICONS } from "../icons";
import { R, useRequireLogin } from "../ui";
import { type PantomimeConfig, type Topic, gameReport, saveGame, usePantomimeConfig, useRecentGames } from "./api";
import { type Format, Game, type Limits, type Mode, type Phase, playerName, pointsFor, teamName } from "./engine";
import { type Effect, type PantomimeSound, createSound } from "./sound";
import "./pantomime.css";

import { gameErrorMessage } from "@/api/games/request";
import { currentUserId } from "@/libs/stores/authStore";

const SECONDS = [30, 60, 90, 120, 180, 240, 300, 600, 900];
// The player's sound choice, kept like the other games' (on unless turned off).
const SOUND_KEY = "bd-pantomime-sound";
// The last seconds of a turn ticked louder (the same ten the design shows as urgent).
const URGENT_SECONDS = 10;
const LEVELS = ["ترکیبی", "آسان", "متوسط", "سخت"];
const FORMAT_NAME: Record<Format, string> = { challenge: "چالش با کارت‌های خودتان", duel: "تک‌کلمه‌ای نوبتی", marathon: "رکورد در زمان" };
const LEAVE = {
	title: "از پانتومیم خارج می‌شوی؟",
	text: "بازی این دست و امتیازهایش پاک می‌شود؛ نام تیم‌ها و بازیکن‌ها برای دست بعد می‌ماند.",
	yes: "خروج",
	no: "ادامهٔ بازی",
};

type Dialog = "" | "help" | "reset";
type Save = "" | "saving" | "saved" | "failed";

/**
 * A game left without «خروج» (the browser's history menu can skip the question, and a browser lets a
 * page stop that only once per tap): kept here, paused, for as long as the app is open, and picked up
 * again when pantomime opens. Leaving by «خروج» or returning to the settings drops it.
 */
interface Parked {
	/** Whose it is: another account signed in on this device never gets it. */
	user: string;
	game: Game;
	id: string;
	topics: Topic[];
	settings: Settings;
}
let parked: Parked | null = null;

interface Settings {
	teams: string[];
	members: string[][];
	seconds: number;
	rounds: number;
	difficulty: number;
	mode: Mode;
	format: Format;
	categories: string[];
}

const iconOf = (name: string): IconName => (name in ICONS ? (name as IconName) : "drama");
const timeLabel = (n: number) => (n < 60 ? fa(n) + " ثانیه" : n % 60 === 0 ? fa(n / 60) + " دقیقه" : fa(n) + " ثانیه");
const formatElapsed = (ms: number) => (ms / 1000).toLocaleString("fa-IR", { minimumFractionDigits: 3, maximumFractionDigits: 3 }) + " ثانیه";
const range = (from: number, to: number) => Array.from({ length: Math.max(0, to - from + 1) }, (_, i) => from + i);
const newId = () => (typeof crypto !== "undefined" && crypto.randomUUID ? crypto.randomUUID() : `${Date.now()}-${Math.random().toString(36).slice(2)}`);
const limitsOf = (c: PantomimeConfig): Limits => ({
	turnSeconds: c.limits.turn_seconds,
	challengeSeconds: c.limits.challenge_seconds,
	maxRounds: c.limits.max_rounds,
	maxTeams: c.limits.max_teams,
	maxMembers: c.limits.max_members,
});

/**
 * «پانتومیم» in the Bordino-Pantomime-Game-Design look (neobrutalism), on one phone passed around the
 * room. The rules are the design's (engine.ts); the clues, their topics' weights and the limits come
 * from the server (the admin edits them), and each finished game is recorded in the player's
 * account. Nothing here moves points: the scores are the players' own taps.
 */
export default function PantomimeGame() {
	const allowed = useRequireLogin();
	const bdStyle = useBdStyle();
	const { push } = useRouter();
	const configQuery = usePantomimeConfig();
	const config = configQuery.data?.result;
	const recent = useRecentGames();

	// A game set aside when the page went away mid-game comes back as it was (paused).
	const [restored] = useState<Parked | null>(() => (parked && parked.user === currentUserId() ? parked : null));
	const [settings, setSettings] = useState<Settings>(() => restored?.settings ?? {
		teams: ["", ""],
		members: [
			["", ""],
			["", ""],
		],
		seconds: 90,
		rounds: 3,
		difficulty: 0,
		mode: "classic",
		format: "challenge",
		categories: [],
	});
	const settingsRef = useRef(settings);
	settingsRef.current = settings;
	const leaving = useRef(false);
	const [setupStep, setSetupStep] = useState<1 | 2>(1);
	const [setupError, setSetupError] = useState("");
	const [choice, setChoice] = useState({ category: "", difficulty: 1 });
	const choices = useRef<{ category: string; difficulty: number }[]>([]);
	const [proposalText, setProposalText] = useState("");
	const [proposalSeconds, setProposalSeconds] = useState("90");
	const [proposalError, setProposalError] = useState("");
	const [dialog, setDialog] = useState<Dialog>("");
	const [muted, setMuted] = useState(false);
	const [announcement, setAnnouncement] = useState("");
	const [save, setSave] = useState<Save>("");
	const [, rerender] = useReducer((n: number) => n + 1, 0);

	const gameRef = useRef<Game | null>(restored?.game ?? null);
	const gameId = useRef(restored?.id ?? "");
	const savedFor = useRef("");
	const audio = useRef<PantomimeSound | null>(null);
	const soundBusy = useRef(false);
	const lastClick = useRef(-Infinity);
	const lastTick = useRef(-1);
	// Whether audio was started by a tap yet (browsers allow it only then).
	const unlocked = useRef(false);
	const focusNext = useRef<string | null>(null);
	const mainRef = useRef<HTMLElement>(null);
	const headerRef = useRef<HTMLElement>(null);
	const modalRef = useRef<HTMLDivElement>(null);
	const configured = useRef(false);

	const game = gameRef.current;
	const limits = useMemo(() => (config ? limitsOf(config) : null), [config]);
	const liveTopics = useMemo(() => config?.categories ?? [], [config]);
	// A game keeps the topics it started with: the admin's later edits apply to the next game.
	const gameTopics = useRef<Topic[]>(restored?.topics ?? []);

	// Taken up: no longer set aside (a new one is kept if this page goes away mid-game again).
	useEffect(() => {
		if (restored) {
			parked = null;
			configured.current = true; // its settings are the game's own
			announce("بازی قبلی همان‌جا که مانده بود ادامه دارد.");
		} else if (parked) {
			parked = null; // another account's game: never shown here
		}
		return () => {
			const g = gameRef.current;
			if (!g || g.phase === "finished" || leaving.current) return;
			if (g.phase === "playing") g.pause(performance.now());
			parked = { user: currentUserId(), game: g, id: gameId.current, topics: gameTopics.current, settings: settingsRef.current };
		};
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, []);
	const topics = game ? gameTopics.current : liveTopics;
	const weights = useMemo(() => Object.fromEntries(liveTopics.map((t) => [t.id, t.weight])), [liveTopics]);
	const topic = (id: string): Topic | undefined => topics.find((t) => t.id === id);
	const categoryName = (id: string) => topic(id)?.label ?? (id === "challenge" ? "چالش پیشنهادی" : "کارت");

	if (!audio.current && typeof window !== "undefined") audio.current = createSound();

	// The settings follow the server's limits and topics once they are known.
	useEffect(() => {
		if (!config || !limits || configured.current) return;
		configured.current = true;
		const allowedSeconds = SECONDS.filter((s) => s >= limits.turnSeconds[0] && s <= limits.turnSeconds[1]);
		setSettings((s) => ({
			...s,
			categories: config.categories.map((c) => c.id),
			seconds: allowedSeconds.includes(s.seconds) ? s.seconds : (allowedSeconds[0] ?? limits.turnSeconds[0]),
			rounds: Math.min(s.rounds, limits.maxRounds),
		}));
		setProposalSeconds(String(Math.min(Math.max(90, limits.challengeSeconds[0]), limits.challengeSeconds[1])));
	}, [config, limits]);

	const defaultProposalSeconds = () =>
		limits ? String(Math.min(Math.max(90, limits.challengeSeconds[0]), limits.challengeSeconds[1])) : "90";

	const announce = (text: string) => setAnnouncement(text);
	const focusAct = (act: string) => {
		focusNext.current = act;
	};

	// After each render: the button the design moves focus to.
	useEffect(() => {
		const act = focusNext.current;
		if (!act) return;
		focusNext.current = null;
		const root = mainRef.current;
		const target = act.startsWith("[")
			? root?.querySelector<HTMLElement>(act)
			: root?.querySelector<HTMLElement>(`[data-act="${act}"]`);
		target?.focus();
	});

	// The dialog: everything under it is inert; focus starts on its first button and returns after.
	useEffect(() => {
		const main = mainRef.current;
		const header = headerRef.current;
		if (main) main.inert = !!dialog;
		if (header) header.inert = !!dialog;
		if (dialog) modalRef.current?.querySelector<HTMLButtonElement>("button")?.focus();
	}, [dialog]);

	const stopMusicSoon = () => {
		window.setTimeout(() => {
			if (gameRef.current?.phase !== "playing") audio.current?.music(false);
		}, 650);
	};
	const endSound = (kind: Effect) => {
		audio.current?.effect(kind);
		stopMusicSoon();
	};

	// The clock: the design's 100 ms tick; a hidden page pauses the turn.
	useEffect(() => {
		const timer = window.setInterval(() => {
			const g = gameRef.current;
			if (!g || g.phase !== "playing") return;
			if (document.hidden) {
				g.pause(performance.now());
				audio.current?.music(false);
				rerender();
				return;
			}
			g.tick(performance.now());
			// (tick() can end the turn: the phase is read again)
			if ((g.phase as Phase) === "summary") {
				endSound("end");
				focusAct("next");
				announce("زمان تمام شد");
			} else {
				// A tick as each second goes (not at the turn's very start).
				const seconds = Math.ceil(g.remaining / 1000);
				if (seconds !== lastTick.current) {
					if (lastTick.current !== -1) audio.current?.effect(seconds <= URGENT_SECONDS ? "urgent" : "tick");
					lastTick.current = seconds;
				}
			}
			rerender();
		}, 100);
		const onHidden = () => {
			if (!document.hidden) return;
			const g = gameRef.current;
			if (g?.phase === "playing") {
				g.pause(performance.now());
				rerender();
			}
			audio.current?.music(false);
		};
		document.addEventListener("visibilitychange", onHidden);
		return () => {
			window.clearInterval(timer);
			document.removeEventListener("visibilitychange", onHidden);
		};
	}, []);

	useEffect(
		() => () => {
			audio.current?.destroy();
			audio.current = null;
		},
		[],
	);

	// A finished game is recorded once (its id makes a retry the same game).
	const record = () => {
		const g = gameRef.current;
		const id = gameId.current;
		if (!g || g.phase !== "finished" || !id) return;
		savedFor.current = id;
		setSave("saving");
		// The answer is shown only while its game is still on screen (a rematch has its own).
		saveGame(gameReport(id, g.result()))
			.then(() => {
				if (gameId.current === id) setSave("saved");
				void recent.refetch();
			})
			.catch(() => {
				if (gameId.current === id) setSave("failed");
			});
	};
	useEffect(() => {
		if (game?.phase === "finished" && savedFor.current !== gameId.current) record();
	});

	const go = () => {
		leaving.current = true;
		parked = null;
		audio.current?.music(false);
		push(R.games);
	};
	const leave = () => {
		const g = gameRef.current;
		if (!g || g.phase === "finished") {
			go();
			return;
		}
		const wasPlaying = g.phase === "playing";
		if (wasPlaying) {
			g.pause(performance.now());
			audio.current?.music(false);
			rerender();
		}
		askLeave(LEAVE, go, () => {
			if (wasPlaying && gameRef.current?.phase === "paused") {
				gameRef.current.resume(performance.now());
				audio.current?.music(!muted);
				rerender();
			}
		});
	};
	const closeDialog = () => {
		setDialog("");
		window.setTimeout(() => headerRef.current?.querySelector<HTMLElement>('[data-act="help"]')?.focus(), 0);
	};
	useBackHandler(true, () => (dialog ? closeDialog() : leave()));
	// The browser's own Back during a game asks too (the Android app's Back is the handler above).
	useBrowserBackGuard(!!game && game.phase !== "finished", leave);

	const openDialog = (type: Exclude<Dialog, "">) => {
		const g = gameRef.current;
		if (g?.phase === "playing") {
			g.pause(performance.now());
			audio.current?.music(false);
			rerender();
		}
		setDialog(type);
	};

	// The saved choice (after the first render: the server's page has no storage).
	useEffect(() => {
		try {
			setMuted(localStorage.getItem(SOUND_KEY) === "off");
		} catch {
			// no storage: sound stays on
		}
	}, []);

	/** The first tap in the game starts the audio (when sound is on): a browser allows it only then. */
	const unlockAudio = () => {
		if (unlocked.current || muted || !audio.current) return;
		unlocked.current = true;
		void audio.current.enable(true).then((ok) => {
			if (!ok) unlocked.current = false;
			else if (gameRef.current?.phase === "playing" && !document.hidden) audio.current?.music(true);
		});
	};

	const toggleSound = async () => {
		if (soundBusy.current || !audio.current) return;
		soundBusy.current = true;
		const requested = muted;
		const ok = await audio.current.enable(requested);
		soundBusy.current = false;
		if (!audio.current) return;
		unlocked.current = ok;
		setMuted(!ok);
		try {
			localStorage.setItem(SOUND_KEY, ok ? "on" : "off");
		} catch {
			// not remembered
		}
		audio.current.music(ok && gameRef.current?.phase === "playing" && !document.hidden);
		if (!ok && requested) announce("صدا در این مرورگر در دسترس نیست.");
	};

	// ── setup ──
	const setTeamCount = (count: number) =>
		setSettings((s) => ({
			...s,
			teams: Array.from({ length: count }, (_, i) => s.teams[i] ?? ""),
			members: Array.from({ length: count }, (_, i) => s.members[i] ?? ["", ""]),
		}));
	const setMemberCount = (team: number, count: number) =>
		setSettings((s) => ({
			...s,
			members: s.members.map((list, i) => (i === team ? Array.from({ length: count }, (_, j) => list[j] ?? "") : list)),
		}));

	const startGame = () => {
		if (!config || !limits) return;
		// Switched off in the admin meanwhile: no new game (or rematch); the page says so.
		if (!config.enabled) {
			gameRef.current = null;
			setSetupStep(1);
			rerender();
			return;
		}
		const deck =
			settings.format === "challenge"
				? []
				: settings.format === "duel"
					? config.cards
					: config.cards.filter((c) => settings.categories.includes(c.category) && (!settings.difficulty || c.difficulty === settings.difficulty));
		try {
			gameRef.current = new Game(settings, deck, { limits, weights });
			gameTopics.current = config.categories;
			gameId.current = newId();
			setSave("");
			setProposalText("");
			setProposalSeconds(defaultProposalSeconds());
			setProposalError("");
			setSetupError("");
			choices.current = [];
			setChoice({ category: config.categories[0]?.id ?? "", difficulty: 1 });
			lastTick.current = -1;
			rerender();
			announce("بازی آماده است؛ نوبت " + gameRef.current.config.teams[0]);
			const first = gameRef.current.phase;
			focusAct(first === "proposal" ? '[data-proposal="text"]' : first === "choice" ? "choose" : "reveal");
		} catch (err) {
			gameRef.current = null;
			setSetupStep(2);
			setSetupError(err instanceof Error ? err.message : String(err));
		}
	};

	const beginTurn = (now: number) => {
		const g = gameRef.current;
		if (!g || !g.start(now)) return;
		lastClick.current = now;
		lastTick.current = -1;
		audio.current?.music(!muted);
		rerender();
		focusAct("correct");
		announce("نوبت شروع شد");
	};

	const answer = (kind: "correct" | "pass") => {
		const g = gameRef.current;
		const now = performance.now();
		if (!g || now - lastClick.current < 300) return;
		lastClick.current = now;
		const accepted = g.answer(kind, now);
		if (g.phase === "summary") endSound(accepted ? kind : "end");
		else if (accepted) audio.current?.effect(kind);
		rerender();
		focusAct(g.phase === "summary" ? "next" : kind);
	};

	const togglePause = () => {
		const g = gameRef.current;
		if (!g) return;
		const now = performance.now();
		if (g.phase === "playing") {
			g.pause(now);
			audio.current?.music(false);
		} else if (g.phase === "paused") {
			g.resume(now);
			audio.current?.music(!muted);
		}
		rerender();
		focusAct(g.phase === "playing" ? "correct" : "pause");
	};

	const nextTurn = () => {
		const g = gameRef.current;
		if (!g) return;
		g.next();
		setProposalText("");
		setProposalSeconds(defaultProposalSeconds());
		setProposalError("");
		setChoice({ ...(choices.current[g.team] ?? { category: topics[0]?.id ?? "", difficulty: 1 }) });
		rerender();
		focusAct(g.phase === "proposal" ? '[data-proposal="text"]' : g.phase === "choice" ? "choose" : g.phase === "handoff" ? "reveal" : "rematch");
	};

	const backToSettings = () => {
		parked = null;
		gameRef.current = null;
		setSetupStep(1);
		audio.current?.music(false);
		setDialog("");
		rerender();
	};

	// ── pieces of the design's markup ──
	const button = (label: ReactNode, act: string, onClick: () => void, cls = "pm-secondary", extra: { disabled?: boolean } = {}) => (
		<button type="button" className={cls} data-act={act} onClick={onClick} disabled={extra.disabled}>
			{label}
		</button>
	);
	const stat = (name: string, value: ReactNode) => (
		<div className="pm-stat" key={name}>
			<span>{name}</span>
			<strong>{value}</strong>
		</div>
	);
	const option = (value: string | number, label: string) => (
		<option key={value} value={value}>
			{label}
		</option>
	);

	const steps = (
		<nav className="pm-steps" aria-label="مراحل آماده‌سازی">
			<span aria-current={setupStep === 1 ? "step" : undefined}>
				<b>۱</b> تیم‌ها و بازیکن‌ها
			</span>
			<span aria-current={setupStep === 2 ? "step" : undefined}>
				<b>۲</b> روش و قوانین
			</span>
		</nav>
	);

	const challengeRules = (
		<div className="pm-rule-note">
			<p>
				هر نوبت، تیم قبلی برای تیمی که باید بازی کند یک لغت یا جمله و زمان پیشنهادی می‌نویسد. عبارت و زمان در صفحهٔ تأیید مشخص‌اند؛ فقط
				اجراکنندهٔ تیم مقابل صفحه را ببیند و تأیید کند یا برای اصلاح برگرداند. حدس‌زن‌ها نباید عبارت را ببینند. در روش معکوس، فقط
				اجراکنندگان تأیید می‌کنند و حدس‌زن صفحه را نمی‌بیند.
			</p>
			<p>راهنمای زمان: پیشنهاد معمول این بازی ۶۰ ثانیه به‌ازای هر کلمه است؛ مثلاً ۲ کلمه، ۱۲۰ ثانیه. زمان نهایی با توافق دو طرف تعیین می‌شود.</p>
			<p>
				هر پاسخ درست ۱ امتیاز؛ ناموفق یا پایان زمان صفر. در تساوی امتیاز، مجموع زمان صرف‌شده برای پاسخ‌های درست کمتر برنده است. زمان
				نوبت‌های ناموفق در شکستن تساوی حساب نمی‌شود.
			</p>
			<p>برای بیش از دو تیم، پیشنهادها چرخشی‌اند: هر تیم برای تیم بعد کارت می‌سازد. همه در هر دور یک نوبت پاسخ دارند.</p>
		</div>
	);

	// The design's example (jobs, medium, half the time left) with the topic weights the admin set.
	const example = topics.find((t) => t.id === "jobs") ?? topics.find((t) => t.weight !== 1) ?? topics[0];
	const exampleScore = example ? pointsFor(example.weight, 2, 45000, 90000) : null;
	const scoreRules = (
		<details className="pm-details pm-scoring">
			<summary>
				<Icon name="calculator" /> امتیاز چطور حساب می‌شود؟
			</summary>
			<div className="pm-rule-note">
				<p>امتیاز سختی: آسان ۱۰۰، متوسط ۲۰۰، سخت ۳۰۰.</p>
				<p>ضریب موضوع: {topics.map((t) => `${t.label} ${fa(t.weight, 1)}`).join("؛ ")}.</p>
				<p>امتیاز پایه = امتیاز سختی × ضریب موضوع. پاداش سرعت = امتیاز پایه × نسبت زمان باقی‌مانده؛ گرد شده به نزدیک‌ترین عدد صحیح.</p>
				{example && exampleScore ? (
					<p>
						مثال: {example.label}، متوسط، نیمی از زمان باقی: {fa(exampleScore.base)} پایه + {fa(exampleScore.bonus)} سرعت ={" "}
						{fa(exampleScore.points)} امتیاز. پاسخ ناموفق یا پایان زمان: صفر. امتیاز مساوی، رتبهٔ مشترک دارد.
					</p>
				) : null}
			</div>
		</details>
	);

	const recentGames =
		recent.data?.result && recent.data.result.total > 0 ? (
			<details className="pm-details pm-recent">
				<summary>
					<Icon name="history" /> بازی‌های اخیر شما ({fa(recent.data.result.total)}) <Icon name="chevron-down" />
				</summary>
				<ul className="pm-review">
					{recent.data.result.results.slice(0, 10).map((g) => (
						<li key={g.id}>
							<span>
								{FORMAT_NAME[g.format]} · {faDate(g.played_at)}
							</span>
							<b>{g.winners || "—"}</b>
						</li>
					))}
				</ul>
			</details>
		) : null;

	const renderTeams = () => (
		<>
			{steps}
			<div className="pm-setup-heading">
				<span className="pm-kicker">اول هم‌تیمی‌ها رو جمع کن</span>
				<h3>چه کسایی بازی می‌کنن؟</h3>
				<p>اسم‌ها اختیاری‌اند؛ خالی بمانند خودمان نام می‌گذاریم.</p>
			</div>
			<label className="pm-count-label">
				تعداد تیم‌ها
				<select data-setting="teamCount" value={settings.teams.length} onChange={(e) => setTeamCount(Number(e.target.value))}>
					{range(2, limits?.maxTeams ?? 6).map((n) => option(n, fa(n) + " تیم"))}
				</select>
			</label>
			<div className="pm-roster">
				{settings.teams.map((name, i) => (
					<section className="pm-roster-team" aria-label={teamName(i)} key={i}>
						<div className="pm-roster-title">
							<span className="pm-letter" aria-hidden="true">
								{String.fromCharCode(65 + i)}
							</span>
							<label>
								نام تیم {String.fromCharCode(65 + i)}
								<input
									data-team={i}
									maxLength={24}
									value={name}
									placeholder={teamName(i)}
									autoComplete="off"
									onChange={(e) => setSettings((s) => ({ ...s, teams: s.teams.map((t, k) => (k === i ? e.target.value : t)) }))}
								/>
							</label>
							<label>
								تعداد نفرات
								<select data-count={i} value={settings.members[i].length} onChange={(e) => setMemberCount(i, Number(e.target.value))}>
									{range(2, limits?.maxMembers ?? 12).map((n) => option(n, fa(n) + " نفر"))}
								</select>
							</label>
						</div>
						<div className="pm-members">
							{settings.members[i].map((member, j) => (
								<label key={j}>
									{playerName(j)}
									<input
										data-member={`${i}:${j}`}
										maxLength={24}
										value={member}
										placeholder={playerName(j)}
										autoComplete="off"
										onChange={(e) =>
											setSettings((s) => ({
												...s,
												members: s.members.map((list, k) => (k === i ? list.map((m, l) => (l === j ? e.target.value : m)) : list)),
											}))
										}
									/>
								</label>
							))}
						</div>
					</section>
				))}
			</div>
			<p className="pm-note pm-roster-note">نقش اجراکننده در هر دور بین اعضای تیم می‌چرخد.</p>
			{button(
				<>
					ادامه؛ انتخاب روش بازی <Icon name="arrow-left" />
				</>,
				"setup-next",
				() => {
					setSetupStep(2);
					focusAct("start");
				},
				"pm-primary",
			)}
			{recentGames}
		</>
	);

	const modeButtons = (
		<div className="pm-mode-options">
			{(
				[
					["challenge", "swords", "لغت یا جمله و زمان را پیشنهاد بدهید؛ فقط اجراکنندهٔ تیم مقابل تأیید کند. هر جواب درست ۱ امتیاز."],
					["duel", "swords", "هر نوبت یک کلمه؛ انتخاب موضوع و سختی با خود تیم. جواب سریع‌تر، امتیاز بیشتر."],
					["marathon", "timer", "در زمان مشخص تا می‌توانید کلمه حدس بزنید. موضوع و سختی برای همه یکسان است."],
				] as [Format, IconName, string][]
			).map(([id, icon, desc]) => (
				<button
					type="button"
					data-format={id}
					aria-pressed={settings.format === id}
					key={id}
					onClick={() => {
						setSettings((s) => ({ ...s, format: id }));
						setSetupError("");
					}}
				>
					<Icon name={icon} />
					<strong>{FORMAT_NAME[id]}</strong>
					<span>{desc}</span>
				</button>
			))}
		</div>
	);

	const categoriesPicker = (
		<>
			<div className="pm-section-title">
				<h4>موضوع‌های مشترک</h4>
				<span>{fa(config?.cards.length ?? 0)} کارت فارسی</span>
			</div>
			<div className="pm-categories">
				{topics.map((c) => (
					<button
						type="button"
						data-category={c.id}
						aria-pressed={settings.categories.includes(c.id)}
						key={c.id}
						onClick={() =>
							setSettings((s) => ({
								...s,
								categories: s.categories.includes(c.id) ? s.categories.filter((x) => x !== c.id) : s.categories.concat(c.id),
							}))
						}
					>
						<Icon name={iconOf(c.icon)} />
						<span>{c.label}</span>
						<small>{fa(c.count)} کارت</small>
					</button>
				))}
			</div>
			<label>
				سختی مشترک
				<select data-setting="difficulty" value={settings.difficulty} onChange={(e) => setSettings((s) => ({ ...s, difficulty: Number(e.target.value) }))}>
					{[0, 1, 2, 3].map((i) => option(i, LEVELS[i]))}
				</select>
			</label>
		</>
	);

	const renderRules = () => {
		const seconds = limits ? SECONDS.filter((s) => s >= limits.turnSeconds[0] && s <= limits.turnSeconds[1]) : SECONDS;
		return (
			<>
				{steps}
				<div className="pm-setup-heading">
					<span className="pm-kicker">{fa(settings.teams.length)} تیم آمادهٔ رقابت</span>
					<h3>چطور بازی کنیم؟</h3>
				</div>
				{modeButtons}
				<div className="pm-config">
					<label hidden={settings.format === "challenge"}>
						زمان هر نوبت
						<select data-setting="seconds" value={settings.seconds} onChange={(e) => setSettings((s) => ({ ...s, seconds: Number(e.target.value) }))}>
							{seconds.map((n) => option(n, timeLabel(n)))}
						</select>
					</label>
					<label>
						تعداد دورها
						<select data-setting="rounds" value={settings.rounds} onChange={(e) => setSettings((s) => ({ ...s, rounds: Number(e.target.value) }))}>
							{range(1, limits?.maxRounds ?? 10).map((n) => option(n, fa(n) + " دور"))}
						</select>
					</label>
				</div>
				<label className="pm-acting-label">
					روش اجرا
					<select data-setting="mode" value={settings.mode} onChange={(e) => setSettings((s) => ({ ...s, mode: e.target.value as Mode }))}>
						{option("classic", "یک نفر اجرا کند؛ تیم حدس بزند")}
						{option("reverse", "همه اجرا کنند؛ یک نفر حدس بزند")}
					</select>
				</label>
				{settings.format === "challenge" ? (
					challengeRules
				) : settings.format === "marathon" ? (
					categoriesPicker
				) : (
					<>
						<p className="pm-rule-note">
							هر تیم قبل از دیدن کلمه، موضوع و سختی همان نوبت را انتخاب می‌کند. جواب درست، ناموفق یا پایان زمان، نوبت را تمام می‌کند.
						</p>
						{scoreRules}
					</>
				)}
				<p className="pm-error" role="alert">
					{setupError}
				</p>
				{button(
					<>
						شروع بازی <Icon name="arrow-left" />
					</>,
					"start",
					startGame,
					"pm-primary",
				)}
				{button(
					"بازگشت به تیم‌ها",
					"setup-back",
					() => {
						setSetupStep(1);
						focusAct('[data-setting="teamCount"]');
					},
					"pm-quiet",
				)}
				<p className="pm-note">
					{settings.format === "challenge"
						? "هر پاسخ درست ۱ امتیاز؛ در تساوی، زمان کمتر برنده است"
						: settings.format === "duel"
							? "فرصت برابر برای همه؛ یک نوبت برای هر تیم در هر دور"
							: "هر جواب درست ۱ امتیاز · رد کردن بدون جریمه"}
				</p>
			</>
		);
	};

	const renderGame = (g: Game) => {
		const name = g.config.teams[g.team];
		const reverse = g.config.mode === "reverse";
		const turnHeading = (
			<>
				<div className="pm-turn">
					<span>
						دور {fa(g.round)} از {fa(g.config.rounds)}
					</span>
					<b>نوبت {name}</b>
				</div>
				<p className="pm-player-role">
					{reverse ? "حدس‌زن" : "اجراکننده"}: <strong>{g.player}</strong>
				</p>
			</>
		);
		const scoreboard = (
			<div className="pm-scoreboard">
				{g.config.teams.map((n, i) => (
					<div className={`pm-team ${i === g.team ? "pm-active" : ""}`} key={i}>
						<span>{n}</span>
						<b>{fa(g.scores[i])}</b>
					</div>
				))}
			</div>
		);
		let body: ReactNode = null;
		if (g.phase === "proposal") {
			const [minS, maxS] = g.limits.challengeSeconds;
			body = (
				<>
					{turnHeading}
					<div className="pm-setup-heading">
						<span className="pm-kicker">گوشی دست {g.config.teams[g.proposer]}</span>
						<h3>چالش تیم مقابل را بسازید</h3>
						<p>
							کارت را بنویسید؛ سپس گوشی را فقط به اجراکنندهٔ تیم مقابل بدهید. عبارت در صفحهٔ تأیید معلوم است؛ حدس‌زن‌ها نباید آن را
							ببینند.
						</p>
					</div>
					<div className="pm-proposal-editor">
						<label>
							لغت یا جملهٔ پیشنهادی
							<textarea
								data-proposal="text"
								maxLength={120}
								rows={3}
								placeholder="مثلاً: راه رفتن روی ماه"
								value={proposalText}
								onChange={(e) => setProposalText(e.target.value)}
							/>
						</label>
						<label>
							زمان پیشنهادی (ثانیه)
							<input
								data-proposal="seconds"
								type="number"
								min={minS}
								max={maxS}
								step={1}
								inputMode="numeric"
								value={proposalSeconds}
								onChange={(e) => setProposalSeconds(e.target.value)}
							/>
							<small>
								{fa(minS)} تا {fa(maxS)} ثانیه؛ اجراکنندهٔ تیم مقابل باید تأیید کند.
							</small>
						</label>
						<p className="pm-rule-note">
							راهنمای زمان: پیشنهاد معمول این بازی ۶۰ ثانیه به‌ازای هر کلمه است؛ مثلاً ۲ کلمه = ۱۲۰ ثانیه و ۳ کلمه = ۱۸۰ ثانیه. با توجه به
							سختی عبارت، زمان را با توافق تغییر دهید.
						</p>
					</div>
					<p className="pm-error" role="alert">
						{proposalError}
					</p>
					{button(
						<>
							ارسال برای تأیید <Icon name="arrow-left" />
						</>,
						"propose",
						() => {
							try {
								g.propose(proposalText, proposalSeconds.trim() === "" ? NaN : Number(proposalSeconds));
								setProposalError("");
								rerender();
								focusAct("approve");
							} catch (err) {
								setProposalError(err instanceof Error ? err.message : String(err));
							}
						},
						"pm-primary",
					)}
				</>
			);
		} else if (g.phase === "approval" && g.proposal) {
			const members = g.config.members[g.team];
			const viewers = reverse ? members.filter((_, i) => i !== (g.round - 1) % members.length).join("، ") : g.player;
			body = (
				<>
					{turnHeading}
					<div className="pm-rule-note pm-approval-notice">
						<strong>{reverse ? "فقط اجراکنندگان تیم مقابل تأیید کنند" : "فقط اجراکنندهٔ تیم مقابل تأیید کند"}</strong>
						<p>
							گوشی فقط دست {viewers} از {name} باشد. عبارت روی این صفحه مشخص است؛{" "}
							{reverse ? "حدس‌زن نباید آن را ببیند." : "بقیهٔ اعضای تیم نباید آن را ببینند."}
						</p>
					</div>
					<div className="pm-stage">
						<span className="pm-stage-icon">
							<Icon name="handshake" />
						</span>
						<span className="pm-kicker">پیشنهاد {g.config.teams[g.proposer]}</span>
						<h3 className="pm-approval-word">{g.proposal.text}</h3>
						<div className="pm-tags">
							<span>زمان پیشنهادی: {fa(g.proposal.seconds)} ثانیه</span>
							<span>پاسخ درست: ۱ امتیاز</span>
						</div>
						<p>با این عبارت و زمان موافقید؟ با زدن «تأیید و شروع چالش»، کارت نمایش داده می‌شود و شمارش معکوس بلافاصله شروع می‌شود.</p>
					</div>
					{button(
						<>
							تأیید و شروع چالش <Icon name="check" />
						</>,
						"approve",
						() => {
							const now = performance.now();
							if (!g.approve()) return;
							setProposalText("");
							beginTurn(now);
						},
						"pm-primary",
					)}
					{button("برگردان برای تغییر زمان یا عبارت", "reject", () => {
						if (!g.reject() || !g.proposal) return;
						setProposalText(g.proposal.text);
						setProposalSeconds(String(g.proposal.seconds));
						rerender();
						focusAct('[data-proposal="seconds"]');
					})}
				</>
			);
		} else if (g.phase === "choice") {
			const cats = topics.filter((c) => g.cards.some((x) => x.category === c.id));
			const category = cats.some((c) => c.id === choice.category) ? choice.category : (cats[0]?.id ?? "");
			const levels = [1, 2, 3].filter((d) => g.cards.some((c) => c.category === category && c.difficulty === d));
			const difficulty = levels.includes(choice.difficulty) ? choice.difficulty : (levels[0] ?? 1);
			const score = pointsFor(g.weight(category), difficulty, g.turnSeconds * 1000, g.turnSeconds * 1000);
			body = (
				<>
					{turnHeading}
					<div className="pm-choice-heading">
						<h3>چالش این نوبت رو انتخاب کن</h3>
						<p>کلمه بعد از تأیید و شروع زمان نمایش داده می‌شود.</p>
					</div>
					<div className="pm-config">
						<label>
							موضوع این نوبت
							<select data-choice="category" value={category} onChange={(e) => setChoice({ category: e.target.value, difficulty })}>
								{cats.map((c) => option(c.id, c.label))}
							</select>
						</label>
						<label>
							سختی این نوبت
							<select data-choice="difficulty" value={difficulty} onChange={(e) => setChoice({ category, difficulty: Number(e.target.value) })}>
								{levels.map((d) => option(d, LEVELS[d]))}
							</select>
						</label>
					</div>
					<div className="pm-potential">
						<span>
							<Icon name="zap" /> امتیاز این چالش
						</span>
						<strong>
							{fa(score.base)} تا {fa(score.points)}
						</strong>
						<small>
							{fa(score.base)} پایه + تا {fa(score.bonus)} پاداش سرعت · {timeLabel(g.turnSeconds)}
						</small>
					</div>
					{scoreRules}
					{button(
						<>
							تأیید چالش <Icon name="arrow-left" />
						</>,
						"choose",
						() => {
							try {
								g.choose(category, difficulty);
								choices.current[g.team] = { category, difficulty };
								rerender();
								focusAct("reveal");
							} catch (err) {
								announce(err instanceof Error ? err.message : String(err));
							}
						},
						"pm-primary",
					)}
				</>
			);
		} else if (g.phase === "handoff") {
			body = (
				<>
					{turnHeading}
					<div className="pm-stage pm-handoff">
						<span className="pm-stage-icon">
							<Icon name={reverse ? "users" : "hand"} />
						</span>
						<span className="pm-kicker">آمادهٔ اجرا؟</span>
						<h3>{reverse ? "همه روی صحنه!" : "گوشی دست " + g.player}</h3>
						<p>
							{reverse
								? "همهٔ اعضای تیم به‌جز " + g.player + " صفحه را ببینند و اجرا کنند."
								: g.player + " صفحه را ببیند؛ بقیهٔ تیم باید کلمه را حدس بزنند."}
						</p>
						<div className="pm-tags">
							<span>{timeLabel(g.turnSeconds)}</span>
							<span>
								{g.isChallenge
									? "چالش تأییدشده · ۱ امتیاز"
									: g.isDuel && g.selection
										? categoryName(g.selection.category) + " · " + LEVELS[g.selection.difficulty]
										: "رکورد در زمان"}
							</span>
						</div>
					</div>
					{button(
						<>
							آماده‌ام؛ نمایش کارت <Icon name="play" />
						</>,
						"reveal",
						() => beginTurn(performance.now()),
						"pm-primary",
					)}
					{g.isDuel
						? button(
								"تغییر موضوع یا سختی",
								"revise",
								() => {
									g.revise();
									rerender();
								},
								"pm-quiet",
							)
						: null}
				</>
			);
		} else if ((g.phase === "playing" || g.phase === "paused") && g.current) {
			const paused = g.phase === "paused";
			const cat = topic(g.current.category);
			const correct = g.log.filter((x) => x.result === "correct").length;
			body = (
				<>
					<div className="pm-turn">
						<span>
							دور {fa(g.round)} · {name}
						</span>
						<button className="pm-icon" type="button" data-act="pause" aria-label={paused ? "ادامه بازی" : "توقف بازی"} onClick={togglePause}>
							<Icon name={paused ? "play" : "pause"} />
						</button>
					</div>
					<p className="pm-player-role">
						{reverse ? "حدس‌زن" : "اجراکننده"}: <strong>{g.player}</strong>
					</p>
					<div className="pm-clock-row">
						<span>زمان باقی‌مانده</span>
						<strong className="pm-time">
							{fa(Math.ceil(g.remaining / 1000))}
							<small> ثانیه</small>
						</strong>
					</div>
					<div className="pm-timer-track">
						<div className="pm-timer-bar" style={{ width: `${(100 * g.remaining) / (g.turnSeconds * 1000)}%` }} />
					</div>
					<div className={`pm-stage pm-word-stage ${paused ? "pm-paused" : ""}`}>
						<span className="pm-kicker">
							{paused
								? "یک نفس تازه کن"
								: g.isChallenge
									? "چالش تأییدشده · پاسخ درست ۱ امتیاز"
									: categoryName(g.current.category) + " · " + LEVELS[g.current.difficulty]}
						</span>
						<span className="pm-stage-icon">
							<Icon name={paused ? "pause" : iconOf(cat?.icon ?? "drama")} />
						</span>
						<h3 className="pm-word">{paused ? "بازی متوقف شد" : g.current.text}</h3>
						<p>{paused ? "کلمه پنهان است؛ هر وقت آماده بودید ادامه دهید." : reverse ? "همه اجرا کنید؛ یک نفر حدس بزند." : "بدون حرف و بدون اشاره به نوشته‌ها!"}</p>
					</div>
					{g.isDuel ? (
						<p className="pm-live-points">
							اگر الان درست بگویید:{" "}
							<strong>{fa(pointsFor(g.weight(g.current.category), g.current.difficulty, g.remaining, g.turnSeconds * 1000).points)}</strong> امتیاز
						</p>
					) : null}
					{paused ? (
						button(
							<>
								ادامهٔ نوبت <Icon name="play" />
							</>,
							"pause",
							togglePause,
							"pm-primary",
						)
					) : (
						<div className="pm-answer-actions">
							{button(
								<>
									<Icon name="check" /> درست گفتن
								</>,
								"correct",
								() => answer("correct"),
								"pm-primary",
							)}
							{button(
								<>
									<Icon name="skip-forward" /> {g.isSingle ? "نتونستیم" : "رد کن"}
								</>,
								"pass",
								() => answer("pass"),
							)}
						</div>
					)}
					{g.isSingle ? null : (
						<div className="pm-round-status">
							<span>{fa(correct)} درست</span>
							<span>{fa(g.log.length - correct)} ردشده</span>
						</div>
					)}
				</>
			);
		} else if (g.phase === "summary") {
			const count = g.log.filter((x) => x.result === "correct").length;
			const h = g.history[g.history.length - 1];
			const entry = g.log[0];
			const elapsed = entry ? Math.round(entry.elapsedMs / 100) / 10 : 0;
			const last = g.turn + 1 >= g.config.rounds * g.scores.length;
			body = (
				<>
					<div className={`pm-stage pm-summary ${g.isChallenge ? "pm-challenge-summary" : ""}`}>
						<span className="pm-stage-icon">
							<Icon name={count ? "party-popper" : "flag"} />
						</span>
						<span className="pm-kicker">نوبت {name} تمام شد</span>
						<h3>
							{g.isSingle ? (count ? "درست و به‌موقع!" : entry?.result === "timeout" ? "زمان تمام شد" : "این بار نشد!") : "خسته نباشید، هنرمندا!"}
						</h3>
						{g.isSingle && entry ? (
							<>
								<p className="pm-answer-word">{entry.text}</p>
								<p>
									{g.isChallenge
										? "زمان پاسخ: " + formatElapsed(entry.elapsedMs)
										: categoryName(entry.category) + " · " + LEVELS[entry.difficulty] + " · " + fa(elapsed) + " ثانیه"}
								</p>
							</>
						) : null}
						<div className="pm-stats">
							{g.isChallenge
								? [stat("نتیجه", count ? "درست" : "ناموفق"), stat("زمان درست", count && entry ? formatElapsed(entry.elapsedMs) : "—")]
								: g.isDuel && entry
									? [stat("امتیاز پایه", fa(entry.base)), stat("پاداش سرعت", fa(entry.bonus))]
									: [stat("درست", fa(count)), stat("ردشده", fa(g.log.length - count))]}
							{stat("امتیاز نوبت", "+" + fa(h?.points ?? 0))}
						</div>
					</div>
					{g.isSingle ? null : (
						<details className="pm-details">
							<summary>
								مرور کارت‌های این نوبت <Icon name="chevron-down" />
							</summary>
							<ul className="pm-review">
								{g.log.map((c, i) => (
									<li key={i}>
										<span>{c.text}</span>
										<b>{c.result === "correct" ? "درست" : "ردشده"}</b>
									</li>
								))}
								{h?.unanswered ? (
									<li>
										<span>{h.unanswered}</span>
										<b>بی‌پاسخ</b>
									</li>
								) : null}
							</ul>
						</details>
					)}
					{button(
						last ? (
							<>
								رتبه‌بندی نهایی <Icon name="trophy" />
							</>
						) : (
							<>
								نوبت تیم بعد <Icon name="arrow-left" />
							</>
						),
						"next",
						nextTurn,
						"pm-primary",
					)}
				</>
			);
		} else if (g.phase === "finished") {
			const ranking = g.ranking();
			const winners = ranking.filter((r) => r.rank === 1);
			body = (
				<>
					<div className="pm-stage pm-winner">
						<span className="pm-stage-icon">
							<Icon name="trophy" />
						</span>
						<span className="pm-kicker">{winners.length > 1 ? "چه رقابت نزدیکی!" : "ستاره‌های این دورهمی"}</span>
						<h3>{winners.map((r) => r.name).join(" و ")}</h3>
						<p>
							{winners.length > 1 ? "رتبهٔ اول مشترک" : "برندهٔ بازی"} · {fa(winners[0].score)} امتیاز
						</p>
					</div>
					<div className="pm-ranking">
						<h3>رتبه‌بندی نهایی</h3>
						<table>
							<thead>
								<tr>
									<th scope="col">رتبه</th>
									<th scope="col">تیم</th>
									<th scope="col">{g.isChallenge ? "زمان درست‌ها" : "درست"}</th>
									<th scope="col">امتیاز</th>
								</tr>
							</thead>
							<tbody>
								{ranking.map((r) => (
									<tr className={r.rank === 1 ? "pm-rank-first" : undefined} key={r.team}>
										<td>{fa(r.rank)}</td>
										<th scope="row">{r.name}</th>
										<td>{g.isChallenge ? formatElapsed(r.correctElapsedMs) : fa(r.correct)}</td>
										<td>
											<strong>{fa(r.score)}</strong>
										</td>
									</tr>
								))}
							</tbody>
						</table>
						<p className="pm-note">
							{g.isChallenge
								? "ابتدا امتیاز بیشتر؛ سپس مجموع زمان پاسخ‌های درست کمتر. تساوی کامل، رتبهٔ مشترک دارد."
								: "تیم‌های هم‌امتیاز رتبهٔ مشترک دارند."}
						</p>
					</div>
					{button(
						<>
							یه دست دیگه <Icon name="rotate-ccw" />
						</>,
						"rematch",
						startGame,
						"pm-primary",
					)}
					{button("تغییر تیم‌ها و قوانین", "settings", backToSettings)}
					<p className="pm-note pm-saved" role="status">
						{save === "saving" ? "در حال ثبت در «بازی‌های اخیر»…" : save === "saved" ? "در «بازی‌های اخیر» شما ثبت شد." : null}
						{save === "failed" ? (
							<>
								ثبت این بازی انجام نشد.{" "}
								<button type="button" className="pm-quiet pm-inline" data-act="save-retry" onClick={record}>
									دوباره امتحان کن
								</button>
							</>
						) : null}
					</p>
				</>
			);
		}
		return (
			<>
				{g.phase === "finished" ? null : scoreboard}
				{body}
				{g.phase !== "finished" ? button("بازگشت به تنظیمات", "reset", () => openDialog("reset"), "pm-quiet") : null}
			</>
		);
	};

	if (!allowed) return null;

	const urgent = !!game && game.phase === "playing" && game.remaining <= 10000;
	let content: ReactNode;
	if (configQuery.isLoading && !config) {
		content = (
			<div className="pm-stage pm-state" role="status">
				<span className="pm-stage-icon">
					<Icon name="loader-circle" className="bd-spin" />
				</span>
				<h3>در حال آماده‌سازی…</h3>
			</div>
		);
	} else if (!config) {
		content = (
			<div className="pm-stage pm-state" role="alert">
				<span className="pm-stage-icon">
					<Icon name="circle-alert" />
				</span>
				<h3>بازی بارگذاری نشد</h3>
				<p>{configQuery.error ? gameErrorMessage(configQuery.error) : "ارتباط با سرور برقرار نشد."}</p>
				{button("دوباره امتحان کن", "retry", () => void configQuery.refetch(), "pm-primary")}
			</div>
		);
	} else if (!config.enabled && !game) {
		content = (
			<div className="pm-stage pm-state" role="status">
				<span className="pm-stage-icon">
					<Icon name="drama" />
				</span>
				<h3>پانتومیم فعلاً در دسترس نیست</h3>
				<p>به‌زودی دوباره باز می‌شود؛ تا آن موقع بقیهٔ بازی‌های گیمنت را امتحان کن.</p>
				{button("بازگشت به گیمنت", "games", go, "pm-primary")}
			</div>
		);
	} else if (game) {
		content = renderGame(game);
	} else {
		content = setupStep === 1 ? renderTeams() : renderRules();
	}

	return (
		<div className="bd-pm-page">
			<article
				className={`pm ${gameStyleClass("pm", bdStyle)} ${urgent ? "pm-urgent" : ""}`}
				dir="rtl"
				aria-label="پانتومیم"
				data-pantomime
				onPointerDownCapture={unlockAudio}
				onKeyDownCapture={unlockAudio}
			>
				<GameBar playing={game?.phase === "playing"}>
					<header className="pm-header" ref={headerRef}>
						<div className="pm-brand">
							<span className="pm-logo">
								<Icon name="drama" />
							</span>
							<div>
								<small>بردینو / دورهمی</small>
								<h2>
									پانتومیم<span>.</span>
								</h2>
							</div>
						</div>
						<div className="pm-tools">
							<button
								type="button"
								className="pm-icon"
								data-act="sound"
								aria-label={muted ? "روشن کردن صدا" : "قطع موسیقی و افکت"}
								aria-pressed={!muted}
								onClick={() => void toggleSound()}
							>
								<Icon name={muted ? "volume-x" : "volume-2"} />
							</button>
							<button type="button" className="pm-icon" data-act="help" aria-label="راهنمای بازی" onClick={() => openDialog("help")}>
								<Icon name="circle-help" />
							</button>
							<button type="button" className="pm-icon" data-act="exit" aria-label="خروج از بازی" onClick={leave}>
								<Icon name="arrow-right" />
							</button>
						</div>
					</header>
				</GameBar>
				<main className="pm-main" ref={mainRef}>
					{content}
				</main>
				<div className="pm-announcement" aria-live="polite">
					{announcement}
				</div>
				<div
					className="pm-modal"
					hidden={!dialog}
					ref={modalRef}
					onKeyDown={(e) => {
						if (e.key === "Escape") closeDialog();
						if (e.key !== "Tab") return;
						const buttons = [...(modalRef.current?.querySelectorAll<HTMLButtonElement>("button") ?? [])];
						if (e.shiftKey && document.activeElement === buttons[0]) {
							e.preventDefault();
							buttons[buttons.length - 1]?.focus();
						} else if (!e.shiftKey && document.activeElement === buttons[buttons.length - 1]) {
							e.preventDefault();
							buttons[0]?.focus();
						}
					}}
				>
					{dialog === "help" ? (
						<div className="pm-dialog" role="dialog" aria-modal="true" aria-label="راهنمای پانتومیم">
							<h3>فقط با حرکت!</h3>
							{challengeRules}
							<p>
								در حالت تک‌کلمه‌ای، هر تیم موضوع و سختی نوبت خودش را انتخاب می‌کند؛ یک کلمه می‌گیرد و با جواب درست، ناموفق یا پایان زمان نوبتش
								تمام می‌شود. سختی بیشتر، موضوع با ضریب بالاتر و پاسخ سریع‌تر امتیاز بیشتری دارند.
							</p>
							<p>در حالت رکورد در زمان، دسته‌ها و سختی برای همه یکسان‌اند. هر پاسخ درست یک امتیاز دارد. رد کردن بدون جریمه است.</p>
							<p>
								روش اجرای کلاسیک یا معکوس برای هر دو حالت قابل انتخاب است. در معکوس همه اجرا می‌کنند و یک نفر حدس می‌زند. نقش اصلی هر دور بین
								اعضا می‌چرخد. در حالت‌های کارت آماده، مجموع امتیاز رتبه را تعیین می‌کند و تساوی رتبهٔ مشترک دارد.
							</p>
							<p>امتیازهای پانتومیم فقط برای همین دورهمی است و به کیف امتیاز بردینو اضافه نمی‌شود.</p>
							{button("فهمیدم", "close", closeDialog, "pm-primary")}
						</div>
					) : dialog === "reset" ? (
						<div className="pm-dialog" role="dialog" aria-modal="true" aria-label="بازی تازه">
							<h3>این بازی تمام شود؟</h3>
							<p>امتیازهای این دست پاک می‌شوند. نام تیم‌ها و اعضا باقی می‌مانند.</p>
							{button("ادامهٔ همین بازی", "close", closeDialog, "pm-primary")}
							{button("بله، تنظیمات بازی", "confirm-reset", backToSettings)}
						</div>
					) : null}
				</div>
				<footer className="pm-footer">
					<span>بدون حرف، پر از خنده</span>
					<span>
						با هم بازی کنیم <Icon name="sparkles" />
					</span>
				</footer>
			</article>
		</div>
	);
}
