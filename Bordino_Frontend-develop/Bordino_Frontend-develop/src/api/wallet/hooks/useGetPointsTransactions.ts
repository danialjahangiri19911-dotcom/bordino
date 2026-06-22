import { WALLET } from "@/api/urls";
import type { PointsTransactionsApiResponse } from "@/api/wallet/types/getPointsTransactionsType";
import type { ExtendableOptions } from "@/libs/http/interfaces";
import useQuery from "@/libs/http/query";
import { addSearchParamsToUrl } from "@/libs/utils/urls";

interface Props extends ExtendableOptions<PointsTransactionsApiResponse> {
	tokenWalletAccountId?: string | number;
}

export default function useGetPointsTransactions({
	tokenWalletAccountId,
	...props
}: Props = {}) {
	const url = tokenWalletAccountId
		? addSearchParamsToUrl(WALLET.GET_POINTS_TRANSACTIONS, {
				token_wallet_account_id: String(tokenWalletAccountId),
			})
		: WALLET.GET_POINTS_TRANSACTIONS;

	const { data, isLoading, error, refetch } =
		useQuery<PointsTransactionsApiResponse>({
			url,
			headers: true,
			enabled: !!tokenWalletAccountId,
			...props,
		});
	return { data, isLoading, error, refetch };
}
