import type { ResponseApiData } from "@/libs/http/interfaces";

export interface Transaction {
	action_label: string;
	amount_sum: string;
	create_time: string;
	txn_count: string;
}

interface TransactionsListResponse {
	results: Transaction[];
}

export type TransactionsListApiResponse =
	ResponseApiData<TransactionsListResponse>;
