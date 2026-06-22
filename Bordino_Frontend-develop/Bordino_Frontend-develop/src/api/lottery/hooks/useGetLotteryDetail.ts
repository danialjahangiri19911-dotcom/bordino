import type { LotteryDetailApiResponse } from "@/api/lottery/types/getLotteryDetailType";
import { LOTTERY } from "@/api/urls";
import type { ExtendableOptions } from "@/libs/http/interfaces";
import useQuery from "@/libs/http/query";
import { addParamsToUrl } from "@/libs/utils/urls";

interface Props extends ExtendableOptions<LotteryDetailApiResponse> {
	id?: string;
}

export default function useGetLotteryDetail({ id, ...restProps }: Props) {
	const { data, isLoading, error, refetch } =
		useQuery<LotteryDetailApiResponse>({
			url: addParamsToUrl(LOTTERY.GET_LOTTERY_DETAIL, { id: id ?? "" }),
			headers: true,
			enabled: !!id,
			...restProps,
		});
	return { data, isLoading, error, refetch };
}
