import React from "react";

import Divider from "@libs/components/atoms/Divider";

import BallWithContainer from "@/_pages/PwaApp/Lottery/components/BallWithContainer";
import Box from "@/libs/components/atoms/Box";
import Typography from "@/libs/components/atoms/Typography";
import styled from "@/libs/styles/styled";
import { isoStringToString } from "@/libs/utils/date";

interface Props {
	total_prize_pool: number;
	name: string;
	end_date: string;
	winnerBall?: number[];
}

export default function Information({
	total_prize_pool,
	name,
	end_date,
	winnerBall,
}: Props) {
	const detailItems = [
		{
			label: "عنوان مسابقه:",
			value: name,
		},
		{
			label: "تاریخ برگزاری:",
			value: isoStringToString(end_date, true, true),
		},
		{
			label: "مبلغ جایزه:",
			value: `${total_prize_pool.toLocaleString("fa-IR")} تومان`,
		},
	];

	return (
		<Box display="flex" flexDirection="column" gap={3}>
			<Box display="flex" flexDirection="column" gap={1}>
				<Typography variant="12-regular" color="rgba(63, 63, 63, 1)">
					جزئیات
				</Typography>
				<DetailCard>
					{detailItems.map((item, index) => (
						<React.Fragment key={index}>
							<DetailRow>
								<Typography variant="12-regular" color="grey.600">
									{item.label}
								</Typography>
								<Typography variant="12-medium" color="grey.900">
									{item.value}
								</Typography>
							</DetailRow>
							{index < detailItems.length - 1 && <Divider />}
						</React.Fragment>
					))}
				</DetailCard>
			</Box>
			<BallWithContainer
				ballBackgroundColor="primary.main"
				ballNumbers={winnerBall || []}
			/>
		</Box>
	);
}

const DetailCard = styled(Box)(({ theme }) => ({
	backgroundColor: theme.palette.common.white,
	borderRadius: "12px",
	padding: theme.spacing(2),
	display: "flex",
	flexDirection: "column",
	gap: theme.spacing(1),
	border: "1px solid rgba(229, 229, 229, 1)",
}));

const DetailRow = styled(Box)(({ theme }) => ({
	display: "flex",
	justifyContent: "space-between",
	alignItems: "center",
	gap: theme.spacing(2),
}));
