import type { LotteryTicketsApiResponse } from "@/api/lottery/types/getLotteryTickets";
import { LOTTERY } from "@/api/urls";
import type { ExtendableOptions } from "@/libs/http/interfaces";
import useQuery from "@/libs/http/query";
import { addParamsToUrl } from "@/libs/utils/urls";

interface Props extends ExtendableOptions<LotteryTicketsApiResponse> {
	id?: string;
}

export default function useGetLotteryTickets({ id, ...restProps }: Props) {
	const { data, isLoading, error, refetch } =
		useQuery<LotteryTicketsApiResponse>({
			url: addParamsToUrl(LOTTERY.GET_LOTTERY_TICKETS, { id: id ?? "" }),
			enabled: !!id,
			headers: true,
			...restProps,
		});

	return { data, isLoading, error, refetch };
}
