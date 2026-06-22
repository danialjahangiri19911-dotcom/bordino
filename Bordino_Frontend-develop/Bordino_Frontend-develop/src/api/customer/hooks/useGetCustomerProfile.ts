import type { CustomerProfileApiData } from "@api/customer/types/getCustomerProfileType";

import { CUSTOMER_URLS } from "@/api/urls";
import type { ExtendableOptions } from "@/libs/http/interfaces";
import useQuery from "@/libs/http/query";
import useAuthStore from "@/libs/stores/authStore";

export default function useGetCustomerProfile(
	props: ExtendableOptions<CustomerProfileApiData> = {},
) {
	const { accessToken } = useAuthStore();
	const { data, isLoading, error, refetch } = useQuery<CustomerProfileApiData>({
		url: CUSTOMER_URLS.PROFILE,
		headers: true,
		enabled: !!accessToken,
		retry: false,
		staleTime: Infinity,
		...props,
	});
	return { data, isLoading, error, refetch };
}
