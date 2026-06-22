import type { ResponseApiData } from "@/libs/http/interfaces";

export interface LotteryDetail {
	id: string;
	name: string;
	status: "completed" | "active";
	end_date: string;
	winning_numbers: number[];
	total_winners: number;
	total_prize_pool: number;
	summary: {
		total_tickets: number;
		winning_tickets_count: number;
		unique_winners_count: number;
		total_prize_amount: number | null;
		highest_prize: number | null;
	};
	results_by_match: [];
}

export type LotteryFullDetailApiResponse = ResponseApiData<LotteryDetail>;
