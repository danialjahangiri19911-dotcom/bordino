import useExtractLotteries from "./useExtractLotteries";

import useGetLotteryTickets from "@/api/lottery/hooks/useGetLotteryTickets";

export default function useExtractLotteryTickets() {
	const { activeLotteries } = useExtractLotteries();

	const { data: lotteryTickets } = useGetLotteryTickets({
		id: activeLotteries?.id,
	});

	return {
		lotteryTickets,
	};
}
