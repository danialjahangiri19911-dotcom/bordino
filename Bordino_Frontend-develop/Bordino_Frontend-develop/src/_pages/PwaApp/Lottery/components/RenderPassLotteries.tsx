import React, { Fragment } from "react";

import Box from "@libs/components/atoms/Box";

import useExtractLotteries from "@/api/lottery/utils/useExtractLotteries";
import { DEFAULT_IMAGE } from "@/constants/imagePaths";
import Divider from "@/libs/components/atoms/Divider";
import LotteryCard from "@/libs/components/cards/wallet/LotteryCard";
import { isoStringToString } from "@/libs/utils/date";

export default function RenderPassLotteries() {
	const { notActiveLotteries } = useExtractLotteries();

	return (
		<Box display="flex" flexDirection="column" gap={2}>
			{notActiveLotteries.map((lottery, index) => (
				<Fragment key={lottery.id}>
					<LotteryCard
						image={DEFAULT_IMAGE}
						title={lottery.name}
						date={isoStringToString(lottery.end_date)}
						onAction={() => alert("hi")}
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
		</Box>
	);
}
