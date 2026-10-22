import { WALLET } from "@/api/urls";
import type { BankAccountsApiResponse } from "@/api/wallet/types/getBankAccountsType";
import type { ExtendableOptions } from "@/libs/http/interfaces";
import useQuery from "@/libs/http/query";

export default function useGetBankAccounts(
	props: ExtendableOptions<BankAccountsApiResponse> = {},
) {
	const { data, isLoading, error, refetch } = useQuery<BankAccountsApiResponse>(
		{
			// All of them (the server's maximum page), not the first 20: the withdrawal picker
			// would otherwise miss an approved account behind newer pending ones.
			url: `${WALLET.GET_BANK_ACCOUNTS}?page_size=100`,
			headers: true,
			...props,
		},
	);
	return { data, isLoading, error, refetch };
}
