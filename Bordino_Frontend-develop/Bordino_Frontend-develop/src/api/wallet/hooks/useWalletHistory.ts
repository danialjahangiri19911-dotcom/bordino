import { useInfiniteQuery } from "@tanstack/react-query";

import { WALLET } from "@/api/urls";
import type {
	WalletHistoryApiResponse,
	WalletHistoryPage,
} from "@/api/wallet/types/walletHistoryType";
import { fetchWithAuth } from "@/libs/http/query";
import { addSearchParamsToUrl } from "@/libs/utils/urls";

/**
 * A wallet's history, page by page (20 rows each, newest first): `fetchNextPage` loads the
 * next one while the server says there is one. Points or currency, for one account.
 */
export default function useWalletHistory(kind: "points" | "currency", accountId?: string | number) {
	const url = kind === "points" ? WALLET.GET_POINTS_TRANSACTIONS : WALLET.GET_CURRENCY_TRANSACTIONS;
	const param = kind === "points" ? "token_wallet_account_id" : "currency_wallet_account_id";
	return useInfiniteQuery({
		queryKey: [url, "history", String(accountId ?? "")],
		enabled: !!accountId,
		initialPageParam: 1,
		queryFn: async ({ pageParam }: { pageParam: number }): Promise<WalletHistoryPage> => {
			const { data } = await fetchWithAuth(
				addSearchParamsToUrl(url, { [param]: String(accountId), page: String(pageParam) }),
				{},
			);
			return (data as WalletHistoryApiResponse).result;
		},
		getNextPageParam: (last: WalletHistoryPage | undefined) =>
			last?.next ? last.current_page + 1 : undefined,
	});
}
