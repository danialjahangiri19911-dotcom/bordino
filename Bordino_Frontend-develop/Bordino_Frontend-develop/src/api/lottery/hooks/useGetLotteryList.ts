import type { LotteryListApiResponse } from "@/api/lottery/types/getLotteryListType";
import { LOTTERY } from "@/api/urls";
import type { ExtendableOptions } from "@/libs/http/interfaces";
import useQuery from "@/libs/http/query";

export default function useGetLotteryList(
	props: ExtendableOptions<LotteryListApiResponse> = {},
) {
	const { data, isLoading, error, refetch } = useQuery<LotteryListApiResponse>({
		url: LOTTERY.GET_LOTTERY_LIST,
		headers: true,
		...props,
	});
	return { data, isLoading, error, refetch };
}
