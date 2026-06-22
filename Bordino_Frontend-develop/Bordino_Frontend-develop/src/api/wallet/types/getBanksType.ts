import type { ResponseApiData } from "@/libs/http/interfaces";

export interface Bank {
	id: string;
	name: string;
	code: string;
	icon: string;
	is_active: boolean;
}

interface PaginatedResponse {
	count: number;
	page_size: number;
	total_pages: number;
	current_page: number;
	next: string | null;
	previous: string | null;
	results: Bank[];
}

export type BanksApiResponse = ResponseApiData<PaginatedResponse>;
