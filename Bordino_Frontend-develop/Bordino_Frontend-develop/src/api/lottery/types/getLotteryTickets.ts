import type { ResponseApiData } from "@/libs/http/interfaces";

export interface Lottery {
	id: string;
	name: string;
	numbers: number[];
}

export type LotteryTicketsApiResponse = ResponseApiData<Lottery[]>;
