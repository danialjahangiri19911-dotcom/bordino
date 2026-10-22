import { useMemo } from "react";

import RenderActiveTickets from "./components/RenderActiveTickets";
import RenderPassLotteries from "./components/RenderPassLotteries";

import useExtractLotteries from "@/api/lottery/utils/useExtractLotteries";
import useExtractLotteryTickets from "@/api/lottery/utils/useExtractLotteryTickets";
import useExtractWallets from "@/api/wallet/utils/useExtractWallets";

export default function useLottery() {
	const { tokenWalletData } = useExtractWallets();
	const { remainingTime, activeLotteries } = useExtractLotteries();
	const { lotteryTickets } = useExtractLotteryTickets();

	const hasBall = useMemo(
		() => lotteryTickets?.result.filter((item) => item.numbers),
		[lotteryTickets?.result],
	);

	const lotteryTabs = [
		{
			label: "بلیط‌های من",
			content: <RenderActiveTickets data={lotteryTickets} noLottery={!activeLotteries} />,
		},
		{
			label: "قرعه‌کشی‌های قبلی",
			content: <RenderPassLotteries />,
		},
	];

	return {
		amount: tokenWalletData?.amount,
		lotteryTabs,
		remainingTime,
		hasBallLength: hasBall?.length ?? 0,
		allTicket: lotteryTickets?.result.length,
		activeLotteries,
	};
}
