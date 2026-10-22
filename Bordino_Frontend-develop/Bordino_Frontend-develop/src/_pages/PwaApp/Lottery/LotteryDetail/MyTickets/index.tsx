"use client";

import React, { Fragment } from "react";

import { useRouter } from "next/navigation";

import useGetLotteryTickets from "@/api/lottery/hooks/useGetLotteryTickets";
import BilliardBall from "@/_pages/PwaApp/Lottery/components/BilliardBall";
import { TICKET_DETAIL } from "@/constants/routes";
import Box from "@/libs/components/atoms/Box";
import Typography from "@/libs/components/atoms/Typography";
import ArrowBackIo from "@/libs/components/icons/components/ArrowBackIo";
import styled from "@/libs/styles/styled";
import { toPersianDigits } from "@/libs/utils/persianNumberConverter";
import LoadState from "@/libs/components/common/LoadState";
import { addParamsToUrl, addSearchParamsToUrl } from "@/libs/utils/urls";

interface Props {
	lotteryId: string;
	/** شماره‌های برندهٔ قرعه‌کشی (برای سبزکردنِ توپ‌های منطبق؛ برای قرعه‌کشیِ فعال خالی) */
	winningNumbers?: number[];
}

export default function MyTickets({ lotteryId, winningNumbers = [] }: Props) {
	const { push } = useRouter();
	const { data, isLoading, error, refetch } = useGetLotteryTickets({ id: lotteryId });
	const tickets = data?.result ?? [];

	// A failed load is not "you have no tickets".
	if (isLoading || error) {
		return <LoadState loading={isLoading} error={error} onRetry={() => refetch()} />;
	}

	if (tickets.length === 0) {
		return (
			<Typography
				color="text.secondary"
				textAlign="center"
				sx={{ py: 4, fontSize: 14 }}
			>
				برای این قرعه‌کشی بلیطی نداری.
			</Typography>
		);
	}

	return (
		<Box display="flex" flexDirection="column" gap={3}>
			{tickets.map((ticket, index) => {
				const numbers = ticket.numbers ?? [];
				return (
					<Box key={ticket.id} display="flex" flexDirection="column" gap={1}>
						<Box
							display="flex"
							justifyContent="space-between"
							alignItems="center"
						>
							<Typography variant="12-regular" color="#3F3F3F">
								بلیط شماره {toPersianDigits(index + 1)}
							</Typography>
							<Box
								role="button"
								onClick={() =>
									push(
										addSearchParamsToUrl(
											addParamsToUrl(TICKET_DETAIL.path, { id: ticket.id }),
											{ n: String(index + 1) },
										),
									)
								}
								sx={{
									display: "flex",
									alignItems: "center",
									gap: 0.5,
									cursor: "pointer",
									color: "#AD3041",
								}}
							>
								<Typography variant="12-medium" color="#AD3041">
									جزئیات
								</Typography>
								<ArrowBackIo sx={{ fontSize: 14 }} />
							</Box>
						</Box>

						<BallsCard>
							{numbers.map((number, ballIndex) => (
								<Fragment key={`${number}-${ballIndex}`}>
									<BilliardBall
										num={number}
										matched={winningNumbers.includes(number)}
									/>
									{ballIndex < numbers.length - 1 && <BallDivider />}
								</Fragment>
							))}
						</BallsCard>
					</Box>
				);
			})}
		</Box>
	);
}

const BallsCard = styled(Box)({
	display: "flex",
	flexDirection: "row",
	alignItems: "center",
	justifyContent: "space-between",
	backgroundColor: "#fff",
	border: "1px solid #E5E5E5",
	borderRadius: 8,
	padding: 12,
});

const BallDivider = styled(Box)({
	width: "1px",
	height: 19,
	backgroundColor: "#D4D4D4",
	flexShrink: 0,
});
