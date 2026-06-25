import type { ResponseApiData } from "@/libs/http/interfaces";

export interface Lottery {
	id: string;
	name: string;
	end_date: string;
	status: string;
	/** کیفِ امتیازی که این قرعه‌کشی با آن قابلِ انجام است (`Token` id). */
	token: string;
}

interface LotteryListResponse {
	results: Lottery[];
}

export type LotteryListApiResponse = ResponseApiData<LotteryListResponse>;
