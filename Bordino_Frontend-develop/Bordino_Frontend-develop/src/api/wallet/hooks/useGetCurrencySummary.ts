import { WALLET } from "@/api/urls";
import type { CurrencySummaryApiResponse } from "@/api/wallet/types/getCurrencySummaryType";
import type { ExtendableOptions } from "@/libs/http/interfaces";
import useQuery from "@/libs/http/query";

export default function useGetCurrencySummary(
	props: ExtendableOptions<CurrencySummaryApiResponse> = {},
) {
	const { data, isLoading, error, refetch } =
		useQuery<CurrencySummaryApiResponse>({
			url: WALLET.GET_CURRENCY_SUMMARY,
			headers: true,
			...props,
		});
	return { data, isLoading, error, refetch };
}
