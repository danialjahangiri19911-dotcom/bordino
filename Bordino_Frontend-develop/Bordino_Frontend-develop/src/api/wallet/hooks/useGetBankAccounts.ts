import { WALLET } from "@/api/urls";
import type { BankAccountsApiResponse } from "@/api/wallet/types/getBankAccountsType";
import type { ExtendableOptions } from "@/libs/http/interfaces";
import useQuery from "@/libs/http/query";

export default function useGetBankAccounts(
	props: ExtendableOptions<BankAccountsApiResponse> = {},
) {
	const { data, isLoading, error, refetch } = useQuery<BankAccountsApiResponse>(
		{
			url: WALLET.GET_BANK_ACCOUNTS,
			headers: true,
			...props,
		},
	);
	return { data, isLoading, error, refetch };
}
