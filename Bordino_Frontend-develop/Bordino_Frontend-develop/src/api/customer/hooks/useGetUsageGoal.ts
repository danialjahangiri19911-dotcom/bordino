import type { UsageGoaApiResponse } from "@api/customer/types/getUsageGoalTypes";

import { CUSTOMER_URLS } from "@/api/urls";
import type { ExtendableOptions } from "@/libs/http/interfaces";
import useQuery from "@/libs/http/query";

export default function useGetUsageGoal(
	props: ExtendableOptions<UsageGoaApiResponse> = {},
) {
	const { data, isLoading, error, refetch } = useQuery<UsageGoaApiResponse>({
		url: CUSTOMER_URLS.USAGE_GOAL,
		headers: true,
		enabled: true,
		retry: false,
		staleTime: Infinity,
		...props,
	});
	return { data, isLoading, error, refetch };
}
