import type { ResponseApiData } from "@/libs/http/interfaces";

export interface WinnerTicket {
	id?: string;
	name: string;
	numbers: number[];
}

export interface LotteryWinnerDetail {
	lottery_id: string;
	/** شماره‌های برندهٔ قرعه‌کشی (برای سبزکردنِ توپ‌های منطبق) */
	lottery_numbers: number[];
	/** بلیط‌های برنده‌ی این کاربر در این قرعه‌کشی */
	tickets: WinnerTicket[];
	total_prize_amount: number | null;
	username: string | null;
	/** عکسِ پروفایلِ برنده */
	avatar: string | null;
}

export type LotteryWinnerApiResponse = ResponseApiData<LotteryWinnerDetail>;
