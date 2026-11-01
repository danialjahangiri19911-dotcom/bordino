import type { WheelPrize } from "./getWheelType";
import type { ResponseApiData } from "@/libs/http/interfaces";

export interface SpinWheelRequest {
	lottery_wheel: string;
	token_wallet_account: string;
	/** ضریبِ انتخابی (۱ تا ۵) */
	multiplier?: number;
	/** The player's bet (the wheel's min_bet…max_bet); prizes are paid × bet / cost_per_spin. */
	bet?: number;
}

export interface SpinWheelResult {
	lottery_wheel: string;
	prize: WheelPrize;
	count: number;
}

export type SpinWheelApiResponse = ResponseApiData<SpinWheelResult>;
