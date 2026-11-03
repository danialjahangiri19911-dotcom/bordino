/**
 * The pantomime game's rules (Bordino-Pantomime-Game-Design 1.3.2, source/engine.js), ported as they
 * are: phases, turns, roles, timing, scoring and ranking. What the design fixed in code comes from
 * the server here: the topics' score weights and the limits the admin sets (defaults: the design's).
 *
 * Phases: challenge proposal → approval → handoff → playing ↔ paused → summary → … → finished;
 * duel choice → handoff → …; marathon handoff → …. Times are a monotonic clock (performance.now()).
 */

export type Format = "challenge" | "duel" | "marathon";
export type Mode = "classic" | "reverse";
export type Phase = "proposal" | "approval" | "choice" | "handoff" | "playing" | "paused" | "summary" | "finished";
export type Result = "correct" | "pass" | "timeout";

export interface Card {
	id: string;
	category: string;
	difficulty: number;
	text: string;
}

export interface Limits {
	turnSeconds: [number, number];
	challengeSeconds: [number, number];
	maxRounds: number;
	maxTeams: number;
	maxMembers: number;
}

export const DEFAULT_LIMITS: Limits = { turnSeconds: [30, 900], challengeSeconds: [10, 900], maxRounds: 10, maxTeams: 6, maxMembers: 12 };

export interface Config {
	teams: string[];
	members?: string[][];
	seconds: number;
	rounds: number;
	format?: Format;
	mode?: Mode;
}

export interface Score {
	base: number;
	bonus: number;
	points: number;
}

export interface Played extends Card, Score {
	result: Result;
	elapsedMs: number;
}

export interface Turn {
	team: number;
	round: number;
	player: string;
	seconds: number;
	proposer: number | null;
	selection: { category: string; difficulty: number } | null;
	cards: Played[];
	unanswered: string | null;
	points: number;
}

export interface Rank {
	team: number;
	name: string;
	score: number;
	correct: number;
	correctElapsedMs: number;
	rank: number;
}

const BASE: Record<number, number> = { 1: 100, 2: 200, 3: 300 };
const faDigits = (n: number | string) => String(n).replace(/\d/g, (d) => "۰۱۲۳۴۵۶۷۸۹"[Number(d)]);
export const teamName = (i: number) => "تیم " + String.fromCharCode(65 + i);
export const playerName = (i: number) => "بازیکن " + faDigits(i + 1);

/** A duel answer's points: base = level × the topic's weight, plus up to as much again for speed. */
export function pointsFor(weight: number, difficulty: number, remaining: number, total: number): Score {
	const base = Math.round(BASE[difficulty] * (weight || 1));
	const bonus = Math.round(base * Math.max(0, Math.min(1, remaining / total)));
	return { base, bonus, points: base + bonus };
}

export class Game {
	readonly config: Required<Config> & { members: string[][] };
	readonly limits: Limits;
	readonly cards: Card[];
	readonly weights: Record<string, number>;
	scores: number[];
	turn = 0;
	phase: Phase;
	history: Turn[] = [];
	log: Played[] = [];
	remaining: number;
	deadline = 0;
	current: Card | null = null;
	selection: { category: string; difficulty: number } | null = null;
	proposal: { text: string; seconds: number; proposer: number; accepted: boolean } | null = null;
	private used = new Set<string>();
	private random: () => number;

	constructor(
		config: Config,
		cards: Card[],
		options: { random?: () => number; limits?: Limits; weights?: Record<string, number> } = {},
	) {
		const limits = options.limits ?? DEFAULT_LIMITS;
		const format: Format = config.format === "duel" || config.format === "challenge" ? config.format : "marathon";
		if (!Array.isArray(config.teams) || config.teams.length < 2 || config.teams.length > limits.maxTeams)
			throw Error(`۲ تا ${faDigits(limits.maxTeams)} تیم انتخاب کنید.`);
		const [minSeconds, maxSeconds] = limits.turnSeconds;
		if (
			!Number.isInteger(config.seconds) ||
			config.seconds < minSeconds ||
			config.seconds > maxSeconds ||
			!Number.isInteger(config.rounds) ||
			config.rounds < 1 ||
			config.rounds > limits.maxRounds
		)
			throw Error(
				`زمان باید ${faDigits(minSeconds)} تا ${faDigits(maxSeconds)} ثانیه و تعداد دور ۱ تا ${faDigits(limits.maxRounds)} باشد.`,
			);
		if (format !== "challenge" && !cards.length) throw Error("حداقل یک موضوع با کارت انتخاب کنید.");
		this.limits = limits;
		this.config = {
			...config,
			format,
			mode: config.mode === "reverse" ? "reverse" : "classic",
			teams: config.teams.map((n, i) => String(n).trim().slice(0, 24) || teamName(i)),
			members: config.teams.map((_, i) => {
				const list = config.members?.[i] ?? ["", ""];
				if (!Array.isArray(list) || list.length < 2 || list.length > limits.maxMembers)
					throw Error(`هر تیم باید ۲ تا ${faDigits(limits.maxMembers)} بازیکن داشته باشد.`);
				return list.map((n, j) => String(n).trim().slice(0, 24) || playerName(j));
			}),
		};
		this.cards = cards.map((c) => ({ ...c }));
		this.weights = options.weights ?? {};
		this.random = options.random ?? Math.random;
		this.scores = config.teams.map(() => 0);
		this.phase = this.initialPhase;
		this.remaining = config.seconds * 1000;
	}

	get isChallenge() {
		return this.config.format === "challenge";
	}
	get isDuel() {
		return this.config.format === "duel";
	}
	get isSingle() {
		return this.isDuel || this.isChallenge;
	}
	get initialPhase(): Phase {
		return this.isChallenge ? "proposal" : this.isDuel ? "choice" : "handoff";
	}
	/** The team that writes this turn's challenge: the one before (each team, one card per round). */
	get proposer() {
		return (this.team + this.scores.length - 1) % this.scores.length;
	}
	get turnSeconds() {
		return this.isChallenge && this.proposal?.accepted ? this.proposal.seconds : this.config.seconds;
	}
	get team() {
		return this.turn % this.scores.length;
	}
	get round() {
		return Math.floor(this.turn / this.scores.length) + 1;
	}
	get player() {
		const list = this.config.members[this.team];
		return list[(this.round - 1) % list.length];
	}

	weight(category: string) {
		return this.weights[category] ?? 1;
	}

	propose(text: string, seconds: number | string) {
		if (this.phase !== "proposal") return false;
		const clue = String(text).trim();
		const s = Number(seconds);
		const [min, max] = this.limits.challengeSeconds;
		if (!clue || clue.length > 120) throw Error("یک لغت یا جملهٔ حداکثر ۱۲۰ نویسه‌ای بنویسید.");
		if (!Number.isInteger(s) || s < min || s > max)
			throw Error(`زمان پیشنهادی باید عدد صحیح بین ${faDigits(min)} تا ${faDigits(max)} ثانیه باشد.`);
		this.proposal = { text: clue, seconds: s, proposer: this.proposer, accepted: false };
		this.phase = "approval";
		return true;
	}
	approve() {
		if (this.phase !== "approval" || !this.proposal) return false;
		this.proposal.accepted = true;
		this.remaining = this.proposal.seconds * 1000;
		this.phase = "handoff";
		return true;
	}
	reject() {
		if (this.phase !== "approval" || !this.proposal) return false;
		this.proposal.accepted = false;
		this.phase = "proposal";
		return true;
	}

	pool(selection = this.selection) {
		return this.isDuel
			? this.cards.filter((c) => c.category === selection?.category && c.difficulty === selection?.difficulty)
			: this.cards;
	}
	choose(category: string, difficulty: number | string) {
		if (this.phase !== "choice") return false;
		const selection = { category, difficulty: Number(difficulty) };
		if (!this.pool(selection).length) throw Error("برای این موضوع و سختی کارتی موجود نیست.");
		this.selection = selection;
		this.phase = "handoff";
		return true;
	}
	revise() {
		if (this.phase === "handoff" && this.isDuel) {
			this.phase = "choice";
			return true;
		}
		return false;
	}
	private draw() {
		if (this.isChallenge) {
			this.current = { id: "challenge-" + this.turn, text: this.proposal?.text ?? "", category: "challenge", difficulty: 1 };
			return;
		}
		const pool = this.pool();
		let available = pool.filter((c) => !this.used.has(c.id));
		if (!available.length) {
			pool.forEach((c) => this.used.delete(c.id));
			available = pool.filter((c) => pool.length === 1 || c.id !== this.current?.id);
		}
		this.current = { ...available[Math.min(available.length - 1, Math.floor(this.random() * available.length))] };
		this.used.add(this.current.id);
	}
	start(now: number) {
		if (this.phase !== "handoff" || (this.isChallenge && !this.proposal?.accepted)) return false;
		this.log = [];
		this.remaining = this.turnSeconds * 1000;
		this.deadline = now + this.remaining;
		this.phase = "playing";
		this.draw();
		return true;
	}
	tick(now: number) {
		if (this.phase === "playing") {
			this.remaining = Math.max(0, this.deadline - now);
			if (!this.remaining) this.finish("timeout");
		}
		return this.remaining;
	}
	answer(kind: "correct" | "pass", now: number) {
		this.tick(now);
		if (this.phase !== "playing" || !this.current || !["correct", "pass"].includes(kind)) return false;
		const score: Score =
			kind === "correct"
				? this.isChallenge
					? { base: 1, bonus: 0, points: 1 }
					: this.isDuel
						? pointsFor(this.weight(this.current.category), this.current.difficulty, this.remaining, this.config.seconds * 1000)
						: { base: 1, bonus: 0, points: 1 }
				: { base: 0, bonus: 0, points: 0 };
		this.log.push({ ...this.current, result: kind, elapsedMs: this.turnSeconds * 1000 - this.remaining, ...score });
		this.scores[this.team] += score.points;
		if (this.isSingle) this.finish(kind);
		else this.draw();
		return true;
	}
	pause(now: number) {
		this.tick(now);
		if (this.phase === "playing") this.phase = "paused";
	}
	resume(now: number) {
		if (this.phase === "paused") {
			this.deadline = now + this.remaining;
			this.phase = "playing";
		}
	}
	finish(reason: "timeout" | "pass" | "correct" | "stopped" = "stopped") {
		if (this.phase !== "playing" && this.phase !== "paused") return;
		if (this.isSingle && !this.log.length && this.current)
			this.log.push({
				...this.current,
				result: reason === "timeout" ? "timeout" : "pass",
				elapsedMs: this.turnSeconds * 1000 - this.remaining,
				base: 0,
				bonus: 0,
				points: 0,
			});
		this.phase = "summary";
		this.history.push({
			team: this.team,
			round: this.round,
			player: this.player,
			seconds: this.turnSeconds,
			proposer: this.isChallenge ? this.proposer : null,
			selection: this.selection ? { ...this.selection } : null,
			cards: this.log.map((x) => ({ ...x })),
			unanswered: this.isSingle ? null : (this.current?.text ?? null),
			points: this.log.reduce((sum, c) => sum + c.points, 0),
		});
	}
	next() {
		if (this.phase !== "summary") return;
		this.turn++;
		this.phase = this.turn >= this.config.rounds * this.scores.length ? "finished" : this.initialPhase;
		this.current = null;
		this.selection = null;
		this.proposal = null;
		this.remaining = this.config.seconds * 1000;
	}
	ranking(): Rank[] {
		const rows = this.config.teams
			.map((name, i) => {
				const correct = this.history
					.filter((h) => h.team === i)
					.flatMap((h) => h.cards)
					.filter((c) => c.result === "correct");
				return { team: i, name, score: this.scores[i], correct: correct.length, correctElapsedMs: correct.reduce((n, c) => n + c.elapsedMs, 0) };
			})
			.sort((a, b) => b.score - a.score || (this.isChallenge ? a.correctElapsedMs - b.correctElapsedMs : 0) || a.team - b.team);
		let rank = 0;
		return rows.map((r, i) => {
			if (!i || r.score !== rows[i - 1].score || (this.isChallenge && r.correctElapsedMs !== rows[i - 1].correctElapsedMs)) rank = i + 1;
			return { ...r, rank };
		});
	}
	result() {
		return {
			teams: this.config.teams.slice(),
			members: this.config.members.map((x) => x.slice()),
			scores: this.scores.slice(),
			rounds: this.config.rounds,
			seconds: this.config.seconds,
			mode: this.config.mode,
			format: this.config.format,
			ranking: this.ranking(),
			history: this.history.map((x) => ({ ...x, selection: x.selection ? { ...x.selection } : null, cards: x.cards.map((c) => ({ ...c })) })),
		};
	}
}
