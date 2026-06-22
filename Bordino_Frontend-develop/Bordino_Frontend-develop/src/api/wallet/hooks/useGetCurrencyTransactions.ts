import { WALLET } from "@/api/urls";
import type { CurrencyTransactionsApiResponse } from "@/api/wallet/types/getCurrencyTransactionsType";
import type { ExtendableOptions } from "@/libs/http/interfaces";
import useQuery from "@/libs/http/query";
import { addSearchParamsToUrl } from "@/libs/utils/urls";

interface Props extends ExtendableOptions<CurrencyTransactionsApiResponse> {
	currencyWalletAccountId?: string | number;
}

export default function useGetCurrencyTransactions({
	currencyWalletAccountId,
	...props
}: Props = {}) {
	const url = currencyWalletAccountId
		? addSearchParamsToUrl(WALLET.GET_CURRENCY_TRANSACTIONS, {
				currency_wallet_account_id: String(currencyWalletAccountId),
			})
		: WALLET.GET_CURRENCY_TRANSACTIONS;

	const { data, isLoading, error, refetch } =
		useQuery<CurrencyTransactionsApiResponse>({
			url,
			headers: true,
			enabled: !!currencyWalletAccountId,
			...props,
		});
	return { data, isLoading, error, refetch };
}
