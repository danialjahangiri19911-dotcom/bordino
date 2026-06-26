import type { ResponseApiData } from "@/libs/http/interfaces";

export interface TarotCard {
	order: number;
	name: string;
	/** نمادِ کوتاه (اموجی) برای نمایش روی کارت */
	symbol: string;
	interpretation: string;
}

export type TarotReadingResponse = ResponseApiData<TarotCard[]>;

export type TarotSpread = 3 | 5;
