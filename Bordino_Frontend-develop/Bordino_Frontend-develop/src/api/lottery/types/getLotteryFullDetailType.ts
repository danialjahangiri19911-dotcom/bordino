import type { ResponseApiData } from "@/libs/http/interfaces";

export interface LotteryWinningTicket {
	numbers: number[];
	matched_count: number;
	prize_amount: number;
	status: string;
}

export interface LotteryWinner {
	customer_id: string;
	username: string | null;
	avatar: string | null;
	prize_amount: number;
	tickets_count: number;
	highest_match: number;
	winning_tickets: LotteryWinningTicket[];
}

export interface LotteryMatchGroup {
	matched_numbers: number;
	winners_count: number;
	total_prize: number;
	average_prize_per_winner: number;
	winners: LotteryWinner[];
}

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
	results_by_match: LotteryMatchGroup[];
}

export type LotteryFullDetailApiResponse = ResponseApiData<LotteryDetail>;
