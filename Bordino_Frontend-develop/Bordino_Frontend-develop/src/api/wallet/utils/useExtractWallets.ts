import { useMemo } from "react";

import useGetPointsSummary from "@/api/wallet/hooks/useGetPointsSummary";

export default function useExtractWallets() {
	const { data: pointsSummary } = useGetPointsSummary();

	const tokenWalletData = useMemo(() => {
		return pointsSummary?.result?.token_wallet_accounts?.[0];
	}, [pointsSummary]);

	const wallets = useMemo(() => {
		return pointsSummary?.result;
	}, [pointsSummary]);

	return { wallets, tokenWalletData };
}
