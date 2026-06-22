import type { ResponseApiData } from "@/libs/http/interfaces";

export interface Lottery {
	id: string;
	name: string;
	end_date: string;
	status: string;
}

interface LotteryDetailResponse {
	balance: string;
	end_date: string;
	id: string;
	name: string;
	owner: string;
	start_date: string;
	status: string;
	ticket_price: string;
	token: string;
}
export type LotteryDetailApiResponse = ResponseApiData<LotteryDetailResponse>;
