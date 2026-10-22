import React, { Fragment } from "react";

import { useRouter } from "next/navigation";

import Box from "@libs/components/atoms/Box";

import usePastLotteries from "@/api/lottery/hooks/usePastLotteries";
import type { Lottery } from "@/api/lottery/types/getLotteryListType";
import { DEFAULT_IMAGE } from "@/constants/imagePaths";
import { LOTTERY_DETAIL } from "@/constants/routes";
import Button from "@/libs/components/atoms/Button";
import Divider from "@/libs/components/atoms/Divider";
import Typography from "@/libs/components/atoms/Typography";
import LotteryCard from "@/libs/components/cards/wallet/LotteryCard";
import LoadState from "@/libs/components/common/LoadState";
import { isoStringToString } from "@/libs/utils/date";
import { addParamsToUrl } from "@/libs/utils/urls";

export default function RenderPassLotteries() {
	// Its own paged list (all completed lotteries, 20 at a time), not the first page of the mixed list.
	const past = usePastLotteries();
	const notActiveLotteries: Lottery[] = (past.data?.pages ?? []).flatMap(
		(page: { results: Lottery[] } | undefined) => page?.results ?? [],
	);
	const { push } = useRouter();

	if (past.isLoading || past.isError) {
		return <LoadState loading={past.isLoading} error={past.error} onRetry={() => past.refetch()} />;
	}

	if (!notActiveLotteries.length) {
		return (
			<Typography variant="14-regular" color="text.secondary" textAlign="center" sx={{ py: 4 }}>
				هنوز قرعه‌کشی‌ای برگزار نشده است.
			</Typography>
		);
	}

	return (
		<Box display="flex" flexDirection="column" gap={2}>
			{notActiveLotteries.map((lottery, index) => (
				<Fragment key={lottery.id}>
					<LotteryCard
						image={DEFAULT_IMAGE}
						title={lottery.name}
						date={isoStringToString(lottery.end_date)}
						deprecated={lottery.status !== "active"}
						onAction={() =>
							push(addParamsToUrl(LOTTERY_DETAIL.path, { id: lottery.id }))
						}
						key={lottery.id}
					/>
					{index < notActiveLotteries.length - 1 && (
						<Divider
							sx={{
								borderStyle: "dotted",
								borderColor: "#E0E0E0",
								borderWidth: "2px 2px 0 2px",
								width: "100%",
								my: 1,
							}}
						/>
					)}
				</Fragment>
			))}
			{past.hasNextPage && (
				<Button
					variant="outlined"
					onClick={() => past.fetchNextPage()}
					disabled={past.isFetchingNextPage}
					sx={{ alignSelf: "center" }}
				>
					{past.isFetchingNextPage ? "در حال بارگذاری…" : "نمایش بیشتر"}
				</Button>
			)}
		</Box>
	);
}
