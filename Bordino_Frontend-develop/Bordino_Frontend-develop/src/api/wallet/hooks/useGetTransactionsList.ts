import type { TransactionsListApiResponse } from "@api/wallet/types/getTransactionsListType";

import { WALLET } from "@/api/urls";
import type { ExtendableOptions } from "@/libs/http/interfaces";
import useQuery from "@/libs/http/query";

export default function useGetTransactionsList(
	props: ExtendableOptions<TransactionsListApiResponse> = {},
) {
	const { data, isLoading, error, refetch } =
		useQuery<TransactionsListApiResponse>({
			url: WALLET.GET_TRANSACTIONS_LIST,
			headers: true,
			...props,
		});
	return { data, isLoading, error, refetch };
}
