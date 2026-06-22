import type { CustomerProfileApiData } from "@api/customer/types/getCustomerProfileType";

import { CUSTOMER_URLS } from "@/api/urls";
import type { ExtendableOptions } from "@/libs/http/interfaces";
import useQuery from "@/libs/http/query";

export default function useGetProfileSetup(
	props: ExtendableOptions<CustomerProfileApiData> = {},
) {
	const { data, isLoading, error, refetch } = useQuery<CustomerProfileApiData>({
		url: CUSTOMER_URLS.PROFILE_SETUP,
		headers: true,
		enabled: true,
		retry: false,
		staleTime: Infinity,
		...props,
	});
	return { data, isLoading, error, refetch };
}
