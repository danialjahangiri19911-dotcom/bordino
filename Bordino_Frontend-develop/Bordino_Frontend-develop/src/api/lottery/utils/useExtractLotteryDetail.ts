import useExtractLotteries from "./useExtractLotteries";

import useGetLotteryDetail from "@/api/lottery/hooks/useGetLotteryDetail";

export default function useExtractLotteryDetail() {
	const { activeLotteries } = useExtractLotteries();

	const { data: lotteryDetail } = useGetLotteryDetail({
		id: activeLotteries?.id,
	});

	return {
		lotteryDetail,
	};
}
