import type { ReactNode } from "react";
import { useEffect, useState } from "react";

import ShowRemainingTime from "./ShowRemainingTime";
import type { BoxProps } from "@libs/components/atoms/Box";
import Box from "@libs/components/atoms/Box";
import Divider, { type DividerProps } from "@libs/components/atoms/Divider";
import Typography from "@libs/components/atoms/Typography";
import styled from "@libs/styles/styled";

interface Props {
	giftPrice: number;
	remainingTime: number;
	title?: string;
	onShowDetails?: () => void;
	sx?: BoxProps["sx"];
	giftSx?: BoxProps["sx"];
	inputSx?: BoxProps["sx"];
	dividerSx?: DividerProps["sx"];
	extraContent?: ReactNode;
}

export default function BigLotteryCountdown({
	giftPrice,
	remainingTime,
	title = "قرعه‌کشی بزرگ 💸",
	giftSx,
	sx,
	onShowDetails,
	inputSx,
	dividerSx,
	extraContent,
}: Readonly<Props>) {
	const [count, setCount] = useState<number>(0);

	useEffect(() => {
		setCount(remainingTime);
	}, [remainingTime]);

	useEffect(() => {
		const interval = setInterval(() => {
			setCount((prev) => (prev > 0 ? prev - 1 : 0));
		}, 1000);

		return () => clearInterval(interval);
	}, []);

	return (
		<Wrapper sx={sx}>
			<Box display="flex" justifyContent="space-between" alignItems="center">
				<Typography variant="12-regular">{title}</Typography>
				{onShowDetails && (
					<Typography
						variant="12-medium"
						color="secondary.600"
						sx={{ cursor: "pointer" }}
						onClick={onShowDetails}
					>
						توضیحات
					</Typography>
				)}
			</Box>
			<Box display="flex" flexDirection="column" alignItems="center">
				<GiftWrapper sx={{ width: "95%", ...giftSx }}>
					<ShowRemainingTime inputSx={inputSx} seconds={count} />
					<Divider
						orientation="vertical"
						sx={{ height: "100%", ...dividerSx }}
						flexItem
					/>
					<Typography variant="14-regular">
						مبلغ جایزه : {giftPrice.toLocaleString()} تومان
					</Typography>
				</GiftWrapper>{" "}
				{extraContent}
			</Box>
		</Wrapper>
	);
}

const Wrapper = styled(Box)(({ theme }) => ({
	display: "flex",
	flexDirection: "column",
	gap: theme.spacing(1),
}));

const GiftWrapper = styled(Box)(({ theme }) => ({
	padding: theme.spacing(1.5),
	border: `1px solid ${theme.palette.primary[600]}`,
	backgroundColor: theme.palette.primary[50],
	borderRadius: theme.shape.borderRadius * 2,
	display: "flex",
	alignItems: "center",
	gap: theme.spacing(1),
	justifyContent: "space-between",
}));
