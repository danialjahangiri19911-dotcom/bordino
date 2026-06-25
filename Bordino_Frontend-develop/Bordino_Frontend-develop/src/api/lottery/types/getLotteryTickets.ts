import type { ResponseApiData } from "@/libs/http/interfaces";

/** بلیطِ خریداری‌شدهٔ کاربر برای یک قرعه‌کشی. */
export interface LotteryTicket {
	id: string;
	name: string;
	/** ۶ شمارهٔ انتخاب‌شدهٔ بلیط (ممکن است هنوز ثبت نشده باشد) */
	numbers: number[] | null;
}

export type LotteryTicketsApiResponse = ResponseApiData<LotteryTicket[]>;
