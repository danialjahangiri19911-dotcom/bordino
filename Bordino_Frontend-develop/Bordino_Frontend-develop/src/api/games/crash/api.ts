import type {
	CrashConfig,
	CrashHistory,
	CrashRoundState,
	CrashSeed,
} from "./types";

import { call, gameErrorMessage } from "@/api/games/request";
import { CRASH } from "@/api/urls";

/** The server's message for a failed crash call (e.g. «امتیاز کافی برای این شرط نداری.»). */
export const crashErrorMessage = gameErrorMessage;

const withId = (url: string, id: string) => url.replace(":id", id);

export const crashApi = {
	config: () => call<CrashConfig>("get", CRASH.CONFIG),
	history: () => call<CrashHistory>("get", CRASH.ROUNDS),
	bet: (bet: number, autoCashout: string | null) =>
		call<CrashRoundState>("post", CRASH.ROUNDS, {
			bet,
			auto_cashout: autoCashout,
		}),
	cashOut: (id: string) =>
		call<CrashRoundState>("post", withId(CRASH.CASHOUT, id)),
	/** Long-poll: resolves when the round crashes (or after ~20 s with revealed=false). */
	wait: (id: string) => call<CrashRoundState>("get", withId(CRASH.WAIT, id)),
	setSeed: (clientSeed: string) =>
		call<CrashSeed>("post", CRASH.SEED, { client_seed: clientSeed }),
};
