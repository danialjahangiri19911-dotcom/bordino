import React from "react";

import Avatar from "@libs/components/atoms/Avatar";
import Box from "@libs/components/atoms/Box";
import Typography from "@libs/components/atoms/Typography";
import styled from "@libs/styles/styled";

import type { LotteryDetail } from "@/api/lottery/types/getLotteryFullDetailType";
import {
	DEFAULT_LOTTERY_BANNER_IMAGE,
	FLYING_MONEY,
} from "@/constants/imagePaths";
import ImageBox from "@/libs/components/ImageBox";

interface LotteryDetailBannerProps {
	name: string;
	status: LotteryDetail["status"];
	totalPrize: number;
}

export default function LotteryDetailBanner({
	name,
	status,
	totalPrize,
}: Readonly<LotteryDetailBannerProps>) {
	return (
		<BannerWrapper>
			<Box display="flex" justifyContent="space-between" alignItems="center">
				<Box display="flex" alignItems="center" gap={1}>
					<LotteryDetailBannerImageWrapper>
						<Avatar
							src={DEFAULT_LOTTERY_BANNER_IMAGE}
							sx={{ width: 24, height: 24 }}
						/>
					</LotteryDetailBannerImageWrapper>
					<Typography variant="14-bold" color="common.white">
						{name}
					</Typography>
				</Box>
				<StatusBadge>
					{status === "active" ? "درحال برگزاری" : "برگزار شده"}
				</StatusBadge>
			</Box>
			<PrizeBox>
				<ImageBox src={FLYING_MONEY} width={24} height={24} />
				<Typography variant="14-regular" color="common.black">
					مبلغ کل جایزه: {totalPrize.toLocaleString()} تومان
				</Typography>
				<ImageBox src={FLYING_MONEY} width={24} height={24} />
			</PrizeBox>
		</BannerWrapper>
	);
}

const BannerWrapper = styled(Box)(({ theme }) => ({
	background: "#D13A4E ",
	borderBottomLeftRadius: theme.shape.borderRadius * 6,
	borderBottomRightRadius: theme.shape.borderRadius * 6,
	padding: theme.spacing(2),
	display: "flex",
	flexDirection: "column",
	gap: theme.spacing(2),
	position: "relative",
	color: "white",
}));

const StatusBadge = styled(Box)(({ theme }) => ({
	background: "#611B24",
	color: "white",
	borderRadius: 20,
	padding: theme.spacing(0.5, 2),
	fontSize: 13,
	fontWeight: 500,
}));

const PrizeBox = styled(Box)(({ theme }) => ({
	background: "white",
	borderRadius: theme.shape.borderRadius * 2,
	padding: theme.spacing(1, 2),
	display: "flex",
	alignItems: "center",
	justifyContent: "center",
	gap: theme.spacing(1),
}));

const LotteryDetailBannerImageWrapper = styled(Box)(() => ({
	borderRadius: "50%",
	height: 40,
	width: 40,
	border: "1px solid  #F7C4CB",
	background: "white",
	display: "flex",
	alignItems: "center",
	justifyContent: "center",
}));
