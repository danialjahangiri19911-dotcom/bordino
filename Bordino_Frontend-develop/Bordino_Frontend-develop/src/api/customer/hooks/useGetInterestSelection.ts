import type { InterestSectionApiResponse } from "@api/customer/types/getInterestSelection";

import { CUSTOMER_URLS } from "@/api/urls";
import type { ExtendableOptions } from "@/libs/http/interfaces";
import useQuery from "@/libs/http/query";

export default function useGetInterestSelection(
	props: ExtendableOptions<InterestSectionApiResponse> = {},
) {
	const { data, isLoading, error, refetch } =
		useQuery<InterestSectionApiResponse>({
			url: CUSTOMER_URLS.INTEREST_SELECTION,
			headers: true,
			enabled: true,
			retry: false,
			staleTime: Infinity,
			...props,
		});
	return { data, isLoading, error, refetch };
}
