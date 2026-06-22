import type { ResponseApiData } from "@/libs/http/interfaces";

export interface CurrencyTransaction {
	id: number;
	create_time: string;
	amount: string;
	destination_name: string;
	type: string;
	is_positive: boolean;
	icon: string | null;
}

interface PaginatedResponse {
	count: number;
	page_size: number;
	total_pages: number;
	current_page: number;
	next: string | null;
	previous: string | null;
	results: CurrencyTransaction[];
}

export type CurrencyTransactionsApiResponse =
	ResponseApiData<PaginatedResponse>;
