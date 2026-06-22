import type { TicketDetailApiResponse } from "@/api/lottery/types/getTicketDetailType";
import { LOTTERY } from "@/api/urls";
import type { ExtendableOptions } from "@/libs/http/interfaces";
import useQuery from "@/libs/http/query";
import { addParamsToUrl } from "@/libs/utils/urls";

interface Props extends ExtendableOptions<TicketDetailApiResponse> {
	id?: string;
}

export default function useGetTicketDetail({ id, ...restProps }: Props) {
	const { data, isLoading, error, refetch } = useQuery<TicketDetailApiResponse>(
		{
			url: addParamsToUrl(LOTTERY.GET_TICKET_DETAIL, { id: id ?? "" }),
			enabled: !!id,
			headers: true,
			...restProps,
		},
	);

	return { data, isLoading, error, refetch };
}
