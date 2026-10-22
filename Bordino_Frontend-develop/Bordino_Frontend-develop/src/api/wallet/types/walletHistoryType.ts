import type { ResponseApiData } from "@/libs/http/interfaces";

/** One row of either wallet history (points or currency), as the API sends it. */
export interface WalletHistoryRow {
	id: string;
	type: string;
	title: string;
	amount: string;
	is_positive: boolean;
	/** ISO date-time with time zone. */
	date: string;
	icon: string | null;
	reference: string;
	/** Withdrawals: "pending" | "completed" | "failed" | "cancelled"; otherwise null. */
	status: string | null;
	status_label: string | null;
	destination_name: string | null;
}

export interface WalletHistoryPage {
	count: number;
	current_page: number;
	next: string | null;
	results: WalletHistoryRow[];
}

export type WalletHistoryApiResponse = ResponseApiData<WalletHistoryPage>;
