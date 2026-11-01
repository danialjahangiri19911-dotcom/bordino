import type { ResponseApiData } from "@/libs/http/interfaces";

export interface WheelPrize {
	id: number;
	name: string;
	/** DecimalField → به‌صورت رشته */
	prize_amount: string;
	prize_type: "cash" | "recharge" | "empty";
	/** احتمالِ این جایزه؛ مبنای اندازه‌ی نسبیِ اسلایسِ گردونه */
	probability: number;
}

export interface Wheel {
	name: string;
	owner: string;
	cost_per_spin: string;
	/** The player's bet per spin (prizes are paid × bet / cost_per_spin). */
	min_bet?: number;
	max_bet?: number;
	max_spins_per_customer: number;
	lottery_wheel_prizes: WheelPrize[];
}

export type WheelApiResponse = ResponseApiData<Wheel>;
