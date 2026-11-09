import { call } from "@/api/games/request";
import type { ResponseApiData } from "@/libs/http/interfaces";
import useQuery from "@/libs/http/query";

const DOWR = "games/dowr/";

export interface DowrCard {
	id: string;
	category: string;
	difficulty: 1 | 2;
	text: string;
	forbidden: string[];
}
export interface DowrConfig {
	enabled: boolean;
	limits: { bomb_allowed: boolean; max_rounds: number; max_seconds: number };
	categories: { id: string; label: string; icon: string }[];
	cards: DowrCard[];
}
export interface DowrSaved {
	id: string;
	played_at: string;
	mode: "classic" | "taboo";
	rounds: number;
	seconds: number;
	winners: string;
	teams: { name: string; score: number; rank: number }[];
}

export const useDowrConfig = () => useQuery<ResponseApiData<DowrConfig>>({ url: `${DOWR}config/`, headers: true, staleTime: 5 * 60_000 });
export const useDowrHistory = () => useQuery<ResponseApiData<{ games: DowrSaved[]; total: number }>>({ url: `${DOWR}games/`, headers: true });

/** The design module's result (BordinoDowr onComplete), as much of it as the record keeps. */
export interface DowrResult {
	mode: "classic" | "taboo";
	rounds: number;
	seconds: number;
	teams: { name: string; members: string[] }[];
	bomb?: { enabled: boolean; seconds?: number; penalty?: number; explosions?: number };
	ranking: { team: number; name: string; score: number; correct: number; rank: number }[];
	history: { round: number; log: { team: number; player: string; text: string; kind: string; points: number; elapsedMs?: number }[] }[];
}

const LOG_KEEP = 600;
const cut = (s: unknown, n: number) => String(s ?? "").slice(0, n);

/** The record sent to the server (the same request id when it is sent again after a lost answer). */
export function report(result: DowrResult, requestId: string) {
	const byTeam = new Map(result.ranking.map((r) => [r.team, r]));
	const log = result.history
		.flatMap((h) =>
			h.log.map((e) => ({
				round: h.round,
				team: e.team,
				player: cut(e.player, 24),
				text: cut(e.text, 60),
				kind: e.kind,
				points: e.points,
				elapsed_ms: Math.max(0, Math.round(e.elapsedMs ?? 0)),
			})),
		)
		.slice(0, LOG_KEEP);
	return {
		request_id: requestId,
		mode: result.mode,
		rounds: result.rounds,
		seconds: result.seconds,
		teams: result.teams.map((t, i) => ({
			name: cut(t.name, 24),
			members: [cut(t.members[0], 24), cut(t.members[1], 24)],
			score: byTeam.get(i)?.score ?? 0,
			rank: byTeam.get(i)?.rank ?? result.teams.length,
			correct: byTeam.get(i)?.correct ?? 0,
		})),
		bomb: result.bomb?.enabled ? { enabled: true, seconds: result.bomb.seconds, penalty: result.bomb.penalty, explosions: result.bomb.explosions ?? 0 } : { enabled: false },
		log,
	};
}

export const saveGame = (data: ReturnType<typeof report>) => call<{ game: DowrSaved; already_saved: boolean }>("post", `${DOWR}games/`, data);
