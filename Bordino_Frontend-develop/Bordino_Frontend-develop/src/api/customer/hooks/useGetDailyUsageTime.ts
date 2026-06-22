import type { DailyUsageTimeApiResponse } from "@api/customer/types/getDailyUsageTimeType";

import { CUSTOMER_URLS } from "@/api/urls";
import type { ExtendableOptions } from "@/libs/http/interfaces";
import useQuery from "@/libs/http/query";

export default function useGetDailyUsageTime(
	props: ExtendableOptions<DailyUsageTimeApiResponse> = {},
) {
	const { data, isLoading, error, refetch } =
		useQuery<DailyUsageTimeApiResponse>({
			url: CUSTOMER_URLS.DAILY_USAGE_TIME,
			headers: true,
			enabled: true,
			retry: false,
			staleTime: Infinity,
			...props,
		});
	return { data, isLoading, error, refetch };
}
