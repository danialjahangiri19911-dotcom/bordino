import { WALLET } from "@/api/urls";
import type { BanksApiResponse } from "@/api/wallet/types/getBanksType";
import type { ExtendableOptions } from "@/libs/http/interfaces";
import useQuery from "@/libs/http/query";

export default function useGetBanks(
	props: ExtendableOptions<BanksApiResponse> = {},
) {
	const { data, isLoading, error, refetch } = useQuery<BanksApiResponse>({
		// Every bank on one page (the default page is 20; there are about 30 banks).
		url: `${WALLET.GET_BANKS}?page_size=100`,
		headers: true,
		...props,
	});
	return { data, isLoading, error, refetch };
}
