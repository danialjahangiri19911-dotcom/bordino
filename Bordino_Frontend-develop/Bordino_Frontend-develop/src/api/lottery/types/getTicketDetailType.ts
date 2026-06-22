import type { ResponseApiData } from "@/libs/http/interfaces";

export interface TicketDetail {
	customer: string;
	id: string;
	numbers: number[];
	name: string;
	update_time: string;
	ticket_count: number;
	reference: string;
}

export type TicketDetailApiResponse = ResponseApiData<TicketDetail>;
