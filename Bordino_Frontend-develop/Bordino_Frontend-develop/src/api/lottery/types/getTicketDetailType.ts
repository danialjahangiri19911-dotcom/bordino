import type { ResponseApiData } from "@/libs/http/interfaces";

export interface TicketDetail {
	customer: string;
	id: string;
	numbers: number[];
	name: string;
	update_time: string;
	ticket_count: number;
	reference: string;
	/** وضعیتِ قرعه‌کشی این بلیط */
	lottery_status?: "draft" | "active" | "completed" | "cancelled";
	/** شماره‌های برندهٔ قرعه‌کشی (برای سبزکردنِ توپ‌های منطبق؛ فقط وقتی برگزار شده) */
	winning_numbers?: number[];
	/** تعداد توپ‌های منطبق با نتیجه (فقط وقتی برگزار شده) */
	matched_count?: number | null;
}

export type TicketDetailApiResponse = ResponseApiData<TicketDetail>;
