import type {
	ChickenConfig,
	ChickenDifficulty,
	ChickenRound,
	ChickenRoundState,
} from "./types";

import { call } from "@/api/games/request";
import { CHICKEN } from "@/api/urls";
import { withRequestId } from "@/libs/http/requestId";

const withId = (url: string, id: string) => url.replace(":id", id);

export const chickenApi = {
	config: () => call<ChickenConfig>("get", CHICKEN.CONFIG),
	history: () => call<{ results: ChickenRound[] }>("get", CHICKEN.ROUNDS),
	/** One id per bet (kept while its answer is unknown): a resent bet is the same round. */
	bet: (bet: number, difficulty: ChickenDifficulty) =>
		withRequestId(`chicken:bet:${bet}:${difficulty}`, (requestId) =>
			call<ChickenRoundState>("post", CHICKEN.ROUNDS, { bet, difficulty, request_id: requestId }),
		),
	/**
	 * One lane, or with `to` up to that lane and cash out there (Go Max = last lane).
	 * `fromStep` is the lane on screen; the server refuses (409) if it has moved since.
	 */
	step: (id: string, fromStep: number, to?: number) =>
		call<ChickenRoundState>("post", withId(CHICKEN.STEP, id), {
			from_step: fromStep,
			...(to ? { to } : {}),
		}),
	cashOut: (id: string) =>
		call<ChickenRoundState>("post", withId(CHICKEN.CASHOUT, id)),
};
