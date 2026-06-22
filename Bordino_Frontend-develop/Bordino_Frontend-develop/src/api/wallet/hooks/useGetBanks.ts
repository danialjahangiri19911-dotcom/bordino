import { WALLET } from "@/api/urls";
import type { BanksApiResponse } from "@/api/wallet/types/getBanksType";
import type { ExtendableOptions } from "@/libs/http/interfaces";
import useQuery from "@/libs/http/query";

export default function useGetBanks(
	props: ExtendableOptions<BanksApiResponse> = {},
) {
	const { data, isLoading, error, refetch } = useQuery<BanksApiResponse>({
		url: WALLET.GET_BANKS,
		headers: true,
		...props,
	});
	return { data, isLoading, error, refetch };
}
