"use client";

import { useMemo } from "react";

import Box from "@libs/components/atoms/Box";
import Typography from "@libs/components/atoms/Typography";
import styled from "@libs/styles/styled";

import useGetPointsSummary from "@/api/wallet/hooks/useGetPointsSummary";
import { SCORE_COIN } from "@/constants/imagePaths";
import ImageBox from "@/libs/components/ImageBox";

/**
 * Points chip shown in the home header (top-right).
 * Displays the user's main points-wallet balance with the coin icon,
 * matching the Figma "Main Page" design.
 */
export default function PointsChip() {
	const { data: pointsSummary } = useGetPointsSummary();

	const totalPoints = useMemo(() => {
		const mainWallet = pointsSummary?.result?.token_wallet_accounts?.[0];
		return Number(mainWallet?.total_points ?? 0);
	}, [pointsSummary?.result?.token_wallet_accounts]);

	return (
		<Chip>
			<ImageBox src={SCORE_COIN} alt="score" width={16} height={16} />
			<Typography variant="12-medium" color="primary.600">
				{totalPoints.toLocaleString()} امتیاز
			</Typography>
		</Chip>
	);
}

const Chip = styled(Box)(({ theme }) => ({
	display: "flex",
	alignItems: "center",
	gap: theme.spacing(0.5),
	padding: theme.spacing(0.75, 1),
	borderRadius: 32,
	backgroundColor: theme.palette.primary[50],
	whiteSpace: "nowrap",
}));
