import { useMemo } from "react";

import useGetLotteryList from "@/api/lottery/hooks/useGetLotteryList";
import { getRemainingSeconds } from "@/libs/utils/date";

export default function useExtractLotteries() {
	const { data: lotteries } = useGetLotteryList();

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
