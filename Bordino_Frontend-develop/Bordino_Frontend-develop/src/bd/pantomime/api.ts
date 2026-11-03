import type { Card, Format, Mode, Rank, Turn } from "./engine";
import { call } from "@/api/games/request";
import type { ResponseApiData } from "@/libs/http/interfaces";
import useQuery from "@/libs/http/query";

const PANTOMIME = "games/pantomime/";

export interface Topic {
	id: string;
	label: string;
	icon: string;
	weight: number;
	count: number;
}

export interface PantomimeConfig {
	enabled: boolean;
	limits: {
		turn_seconds: [number, number];
		challenge_seconds: [number, number];
		max_rounds: number;
		max_teams: number;
		max_members: number;
	};
	categories: Topic[];
	cards: Card[];
}

export interface SavedGame {
	id: string;
	played_at: string;
	format: Format;
	mode: Mode;
	rounds: number;
	winners: string;
	teams: { name: string; score: number; rank: number }[];
}

export interface GameHistory {
	total: number;
	by_format: Record<Format, number>;
	results: SavedGame[];
}

/** The switch, the admin's limits and the clues (edited in the admin). */
export function usePantomimeConfig() {
	return useQuery<ResponseApiData<PantomimeConfig>>({ url: `${PANTOMIME}config/`, headers: true, staleTime: 5 * 60_000 });
}

export function useRecentGames() {
	return useQuery<ResponseApiData<GameHistory>>({ url: `${PANTOMIME}games/`, headers: true });
}

/** The details the record keeps: up to this many cards a turn, and in all (the count is always true). */
export const REPORT_TURN_CARDS = 200;
export const REPORT_CARDS = 1500;

/**
 * A finished game as the server keeps it (the player's record; nothing is paid for it). Teams stay in
 * the game's order, each with its rank: a turn's `team` is an index into that list.
 */
export function gameReport(
	requestId: string,
	result: { format: Format; mode: Mode; rounds: number; teams: string[]; members: string[][]; ranking: Rank[]; history: Turn[] },
) {
	const byTeam = [...result.ranking].sort((a, b) => a.team - b.team);
	let budget = REPORT_CARDS;
	return {
		request_id: requestId,
		format: result.format,
		mode: result.mode,
		rounds: result.rounds,
		teams: byTeam.map((r) => ({
			name: r.name,
			members: result.members[r.team],
			score: r.score,
			rank: r.rank,
			correct: r.correct,
			correct_elapsed_ms: Math.round(r.correctElapsedMs),
		})),
		turns: result.history.map((h) => {
			const kept = h.cards.slice(0, Math.min(REPORT_TURN_CARDS, budget));
			budget -= kept.length;
			return {
				team: h.team,
				round: h.round,
				player: h.player,
				points: h.points,
				cards_total: h.cards.length,
				cards: kept.map((c) => ({ text: c.text, result: c.result, elapsed_ms: Math.max(0, Math.round(c.elapsedMs)) })),
			};
		}),
	};
}

/** Records it once: the same id sent again (a retry) is the same game. */
export const saveGame = (report: ReturnType<typeof gameReport>) =>
	call<{ game: SavedGame; already_saved: boolean }>("post", `${PANTOMIME}games/`, report);
