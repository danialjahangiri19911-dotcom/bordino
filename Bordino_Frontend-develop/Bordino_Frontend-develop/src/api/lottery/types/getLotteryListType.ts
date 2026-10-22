import type { ResponseApiData } from "@/libs/http/interfaces";

export interface Lottery {
	id: string;
	name: string;
	end_date: string;
	status: string;
	/** کیفِ امتیازی که این قرعه‌کشی با آن قابلِ انجام است (`Token` id). */
	token: string;
	/** «مبلغ جایزه» (۲ × امتیازهای خرج‌شده برای خرید بلیط) به تومان */
	balance_in_money: string;
	/** Points per ticket (sent back with a purchase: a changed price is refused, not charged). */
	ticket_price: string;
	/** Toman per ticket for each number of matching balls (6 = jackpot, shared remainder). */
	prize_rules: { match_count: number; prize_amount: string }[];
}

interface LotteryListResponse {
	results: Lottery[];
}

export type LotteryListApiResponse = ResponseApiData<LotteryListResponse>;
