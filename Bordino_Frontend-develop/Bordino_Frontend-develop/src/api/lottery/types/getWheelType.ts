import type { ResponseApiData } from "@/libs/http/interfaces";

export interface WheelPrize {
	id: number;
	name: string;
	/** DecimalField → به‌صورت رشته */
	prize_amount: string;
	prize_type: "cash" | "recharge" | "empty";
}

export interface Wheel {
	name: string;
	owner: string;
	cost_per_spin: string;
	max_spins_per_customer: number;
	lottery_wheel_prizes: WheelPrize[];
}

export type WheelApiResponse = ResponseApiData<Wheel>;
