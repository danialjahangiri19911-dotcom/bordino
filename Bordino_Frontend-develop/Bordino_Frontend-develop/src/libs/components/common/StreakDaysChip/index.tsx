"use client";

import Box from "@libs/components/atoms/Box";
import Typography from "@libs/components/atoms/Typography";
import styled from "@libs/styles/styled";

import useGetCustomerProfile from "@/api/customer/hooks/useGetCustomerProfile";

/**
 * Streak chip shown in the home header (top-right, left of the points chip).
 * Displays the number of consecutive days the user has opened the app
 * (`consecutive_active_days` from the customer profile), matching the
 * Figma "Main Page" design.
 */
export default function StreakDaysChip() {
	const { data: profile } = useGetCustomerProfile();

	const days = Number(profile?.result?.consecutive_active_days ?? 0);

	return (
		<Chip>
			<span aria-hidden>❄️</span>
			<Typography variant="12-medium" color="common.white">
				{days.toLocaleString()} روز
			</Typography>
		</Chip>
	);
}

const Chip = styled(Box)(({ theme }) => ({
	display: "flex",
	alignItems: "center",
	gap: theme.spacing(0.25),
	padding: theme.spacing(0.75),
	borderRadius: 32,
	backgroundColor: theme.palette.secondary[600],
	whiteSpace: "nowrap",
	fontSize: 14,
	lineHeight: 1,
}));
