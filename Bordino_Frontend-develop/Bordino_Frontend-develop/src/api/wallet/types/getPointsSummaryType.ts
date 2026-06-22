import type { ResponseApiData } from "@/libs/http/interfaces";

export interface PointsSummaryResponse {
	token_wallet_accounts: Array<WalletSchema>;
}
export interface WalletSchema {
	id: string;
	name: string;
	token: string;
	preset_wallet: string;
	wallet_type: "mixed" | "customer";
	status: "valid";
	amount: number;
	total_points: string | number;
	total_tickets: number;
	current_points: string | number;
	required_points: string | number;
	remaining_points: string | number;
	expire_time: string;
}

export type PointsSummaryApiResponse = ResponseApiData<PointsSummaryResponse>;
