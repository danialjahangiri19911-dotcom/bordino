import type { ResponseApiData } from "@/libs/http/interfaces";

export interface Lottery {
	id: string;
	name: string;
	end_date: string;
	status: string;
}

interface LotteryDetailResponse {
	/** موجودیِ جایزه به تومان (balance × قیمتِ token) */
	balance_in_money: string;
	end_date: string;
	id: string;
	name: string;
	owner: string;
	start_date: string;
	status: "active" | "completed";
	ticket_price: string;
	token: string;
}
export type LotteryDetailApiResponse = ResponseApiData<LotteryDetailResponse>;
