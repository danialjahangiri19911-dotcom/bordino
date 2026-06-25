import type { WheelApiResponse } from "@/api/lottery/types/getWheelType";
import { LOTTERY_WHEEL } from "@/api/urls";
import type { ExtendableOptions } from "@/libs/http/interfaces";
import useQuery from "@/libs/http/query";
import { addParamsToUrl } from "@/libs/utils/urls";

interface Props extends ExtendableOptions<WheelApiResponse> {
	id?: string;
}

export default function useGetWheel({ id, ...restProps }: Props) {
	const { data, isLoading, error, refetch } = useQuery<WheelApiResponse>({
		url: addParamsToUrl(LOTTERY_WHEEL.GET_WHEEL, { id: id ?? "" }),
		headers: true,
		enabled: !!id,
		...restProps,
	});
	return { data, isLoading, error, refetch };
}
