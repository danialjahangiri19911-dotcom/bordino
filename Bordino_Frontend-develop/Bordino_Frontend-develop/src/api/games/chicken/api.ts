import type {
	ChickenConfig,
	ChickenDifficulty,
	ChickenRound,
	ChickenRoundState,
} from "./types";

import { call } from "@/api/games/request";
import { CHICKEN } from "@/api/urls";

const withId = (url: string, id: string) => url.replace(":id", id);

export const chickenApi = {
	config: () => call<ChickenConfig>("get", CHICKEN.CONFIG),
	history: () => call<{ results: ChickenRound[] }>("get", CHICKEN.ROUNDS),
	bet: (bet: number, difficulty: ChickenDifficulty) =>
		call<ChickenRoundState>("post", CHICKEN.ROUNDS, { bet, difficulty }),
	/** One lane, or with `to` up to that lane and cash out there (Go Max = last lane). */
	step: (id: string, to?: number) =>
		call<ChickenRoundState>("post", withId(CHICKEN.STEP, id), to ? { to } : {}),
	cashOut: (id: string) =>
		call<ChickenRoundState>("post", withId(CHICKEN.CASHOUT, id)),
};
