import React, { useMemo } from "react";

import BallComponent from "./Ball";

import Box, { type BoxProps } from "@/libs/components/atoms/Box";
import Typography from "@/libs/components/atoms/Typography";
import styled from "@/libs/styles/styled";

interface BallItem {
	number: number;
	color?: string;
	isActive?: boolean;
}

type BallNumbers = number[] | BallItem[];

interface BallWithContainerProps {
	ballNumbers: BallNumbers;
	ballBackgroundColor?: BoxProps["bgcolor"];
	disableBallColor?: BoxProps["bgcolor"];
	ballSize?: {
		width?: string | number;
		height?: string | number;
	};
	title?: string;
	emptyMessage?: string;
}

export default function BallWithContainer({
	ballNumbers,
	ballBackgroundColor = "rgba(39, 170, 225, 1)",
	disableBallColor = "rgba(200, 200, 200, 0.5)",
	ballSize = { width: "40px", height: "40px" },
	title = "توپ‌های انتخاب‌شده",
	emptyMessage = "توپی انتخاب نشده است.",
}: BallWithContainerProps) {
	const normalizedBalls = useMemo(() => {
		if (!ballNumbers.length) return [];

		return ballNumbers.map((item) => {
			if (typeof item === "number") {
				return {
					number: item,
					color: ballBackgroundColor,
					isActive: true,
				};
			}
			return {
				number: item.number,
				color:
					item.isActive !== false
						? item.color || ballBackgroundColor
						: disableBallColor,
				isActive: item.isActive !== false,
			};
		});
	}, [ballNumbers, ballBackgroundColor, disableBallColor]);

	return (
		<Box display="flex" flexDirection="column" gap={1} justifyContent="center">
			<Typography>{title}</Typography>
			<SelectedBallsRow sx={{ mx: "auto", flexDirection: "row", width: "95%" }}>
				{normalizedBalls.length
					? normalizedBalls.map((ball) => (
							<BallComponent
								key={ball.number}
								num={ball.number}
								ballBackgroundColor={ball.color}
								sx={ballSize}
							/>
						))
					: emptyMessage}
			</SelectedBallsRow>
		</Box>
	);
}

export const SelectedBallsRow = styled(Box)(({ theme }) => ({
	display: "flex",
	alignItems: "center",
	flexDirection: "row-reverse",
	gap: theme.spacing(2),
	justifyContent: "space-between",
	border: "1px solid #6D6E71",
	borderRadius: 16,
	padding: theme.spacing(1.5),
}));
