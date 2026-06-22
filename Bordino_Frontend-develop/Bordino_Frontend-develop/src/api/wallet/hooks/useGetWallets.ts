import { WALLET } from "@/api/urls";
import type { WalletsApiResponse } from "@/api/wallet/types/getWalletsTypes";
import type { ExtendableOptions } from "@/libs/http/interfaces";
import useQuery from "@/libs/http/query";
import { addParamsToUrl } from "@/libs/utils/urls";

interface Props extends ExtendableOptions<WalletsApiResponse> {
	id?: string;
}

export default function useGetWallets({ id, ...props }: Props) {
	const { data, isLoading, error, refetch } = useQuery<WalletsApiResponse>({
		url: addParamsToUrl(WALLET.GET_WALLETS_LIST, { id: id ?? "" }),
		headers: true,
		enabled: !!id,
		...props,
	});
	return { data, isLoading, error, refetch };
}
