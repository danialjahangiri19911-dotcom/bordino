import type { WheelPrize } from "./getWheelType";
import type { ResponseApiData } from "@/libs/http/interfaces";

export interface SpinWheelRequest {
	lottery_wheel: string;
	token_wallet_account: string;
}

export interface SpinWheelResult {
	lottery_wheel: string;
	prize: WheelPrize;
	count: number;
}

export type SpinWheelApiResponse = ResponseApiData<SpinWheelResult>;
