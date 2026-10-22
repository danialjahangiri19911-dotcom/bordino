import type { LotteryListApiResponse } from "@/api/lottery/types/getLotteryListType";
import { LOTTERY } from "@/api/urls";
import type { ExtendableOptions } from "@/libs/http/interfaces";
import useQuery from "@/libs/http/query";

export default function useGetLotteryList(
	props: ExtendableOptions<LotteryListApiResponse> = {},
) {
	const { data, isLoading, error, refetch } = useQuery<LotteryListApiResponse>({
		// Every lottery (the server's maximum page), not the first 20: older results stay reachable.
		url: `${LOTTERY.GET_LOTTERY_LIST}?page_size=100`,
		headers: true,
		...props,
	});
	return { data, isLoading, error, refetch };
}
