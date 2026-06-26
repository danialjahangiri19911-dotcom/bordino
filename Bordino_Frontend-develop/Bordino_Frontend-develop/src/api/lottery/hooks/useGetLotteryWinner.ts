import { LOTTERY } from "@/api/urls";
import type { LotteryWinnerApiResponse } from "@/api/lottery/types/getLotteryWinnerType";
import type { ExtendableOptions } from "@/libs/http/interfaces";
import useQuery from "@/libs/http/query";
import { addParamsToUrl } from "@/libs/utils/urls";

interface Props extends ExtendableOptions<LotteryWinnerApiResponse> {
	lotteryId?: string;
	winnerId?: string;
}

export default function useGetLotteryWinner({
	lotteryId,
	winnerId,
	...props
}: Props = {}) {
	const { data, isLoading, error, refetch } =
		useQuery<LotteryWinnerApiResponse>({
			url: addParamsToUrl(LOTTERY.GET_LOTTERY_WINNER, {
				id: lotteryId ?? "",
				winnerId: winnerId ?? "",
			}),
			headers: true,
			enabled: !!lotteryId && !!winnerId,
			...props,
		});
	return { data: data?.result, isLoading, error, refetch };
}
