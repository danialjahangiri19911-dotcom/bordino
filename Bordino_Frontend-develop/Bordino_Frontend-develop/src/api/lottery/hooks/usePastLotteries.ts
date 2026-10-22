import { useInfiniteQuery } from "@tanstack/react-query";

import type { Lottery } from "@/api/lottery/types/getLotteryListType";
import { LOTTERY } from "@/api/urls";
import { fetchWithAuth } from "@/libs/http/query";

interface Page {
	current_page: number;
	next: string | null;
	results: Lottery[];
}

/** Completed lotteries, newest first, page by page («نمایش بیشتر» loads the next 20). */
export default function usePastLotteries() {
	return useInfiniteQuery({
		queryKey: [LOTTERY.GET_LOTTERY_LIST, "completed"],
		initialPageParam: 1,
		queryFn: async ({ pageParam }: { pageParam: number }): Promise<Page> => {
			const { data } = await fetchWithAuth(
				`${LOTTERY.GET_LOTTERY_LIST}?status=completed&page=${pageParam}`,
				{},
			);
			return (data as { result: Page }).result;
		},
		getNextPageParam: (last: Page | undefined) =>
			last?.next ? last.current_page + 1 : undefined,
	});
}
