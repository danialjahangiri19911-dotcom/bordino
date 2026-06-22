import type { LotteryFullDetailApiResponse } from "@/api/lottery/types/getLotteryFullDetailType";
import { LOTTERY } from "@/api/urls";
import type { ExtendableOptions } from "@/libs/http/interfaces";
import useQuery from "@/libs/http/query";
import { addParamsToUrl } from "@/libs/utils/urls";

interface Props extends ExtendableOptions<LotteryFullDetailApiResponse> {
	id?: string;
}

export default function useGetLotteryFullDetail(props: Props = {}) {
	const { data, isLoading, error, refetch } =
		useQuery<LotteryFullDetailApiResponse>({
			url: addParamsToUrl(LOTTERY.GET_LOTTERY_FULL_DETAIL, {
				id: props.id ?? "",
			}),
			headers: true,
			enabled: !!props.id,
			...props,
		});
	return { data: data?.result, isLoading, error, refetch };
}
