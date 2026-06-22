import type { ResponseApiData } from "@/libs/http/interfaces";

export interface PointsTransaction {
	id: number;
	type: string;
	amount: string;
	is_positive: boolean;
	create_time: string;
	icon: string | null;
	date: string;
	title: string;
}

interface PaginatedResponse {
	count: number;
	page_size: number;
	total_pages: number;
	current_page: number;
	next: string | null;
	previous: string | null;
	results: PointsTransaction[];
}

export type PointsTransactionsApiResponse = ResponseApiData<PaginatedResponse>;
