import { useMemo } from "react";

import useGetLotteryList from "@/api/lottery/hooks/useGetLotteryList";
import type { Lottery, LotteryListApiResponse } from "@/api/lottery/types/getLotteryListType";
import type { Res } from "@/libs/http/query";
import { getRemainingSeconds } from "@/libs/utils/date";

export default function useExtractLotteries() {
	// While a lottery runs, ask again every minute (so an open page notices its end by itself),
	// and every 30 s once sales closed and the draw is pending, so the result shows up.
	const { data: lotteries } = useGetLotteryList({
		refetchInterval: (query: { state: { data?: Res<LotteryListApiResponse> } }) => {
			const active = query.state.data?.data?.result?.results?.find(
				(lottery: Lottery) => lottery.status === "active",
			);
			if (!active) return false;
			return new Date(active.end_date).getTime() <= Date.now() ? 30_000 : 60_000;
		},
	});

	const lotteryData = useMemo(() => {
		if (!lotteries?.result.results) return [];
		return lotteries.result.results.sort((a, b) => {
			if (a.status === "active" && b.status !== "active") return -1;
			if (a.status !== "active" && b.status === "active") return 1;
			return 0;
		});
	}, [lotteries]);

	const activeLotteries = useMemo(() => {
		return lotteryData.find((lottery) => lottery.status === "active");
	}, [lotteryData]);

	const remainingTime = useMemo(() => {
		if (activeLotteries?.end_date) {
			return getRemainingSeconds(activeLotteries.end_date);
		}
		return 0;
	}, [activeLotteries?.end_date]);

	const notActiveLotteries = useMemo(() => {
		return lotteryData.filter((lottery) => lottery.status !== "active");
	}, [lotteryData]);

	return { lotteryData, activeLotteries, remainingTime, notActiveLotteries };
}
