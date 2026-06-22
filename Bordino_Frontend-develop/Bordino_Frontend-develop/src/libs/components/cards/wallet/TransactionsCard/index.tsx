import { memo } from "react";

import Box from "@libs/components/atoms/Box";
import Typography from "@libs/components/atoms/Typography";
import styled from "@libs/styles/styled";

import ImageBox from "@/libs/components/ImageBox";
import AddIcon from "@/libs/components/icons/components/Pluse";
import RemoveIcon from "@/libs/components/icons/components/Remove";

interface Props {
	title: string;
	date: string;
	amount: number;
	image: string;
}

function TransactionsCard({ date, title, amount, image }: Readonly<Props>) {
	const isPositive = amount > 0;

	return (
		<TransactionsCardWrapper>
			<ImageBox
				src={image}
				alt="Transaction-image"
				width={64}
				sx={{ borderRadius: 1, border: `1px solid #B4ABAB` }}
			/>
			<Box display="flex" flexDirection="column" gap={1} flexGrow={1}>
				<DetailWrapper>
					<Box display="flex" flexDirection="column" gap={0.5}>
						<Typography variant="14-regular" color="#2F2F2F">
							{title}
						</Typography>
						<Typography variant="12-medium" color="#878686">
							{date}
						</Typography>
					</Box>
					<AmountWrapper isPositive={isPositive}>
						{isPositive ? (
							<AddIcon color={isPositive ? "success" : "error"} />
						) : (
							<RemoveIcon color={isPositive ? "success" : "error"} />
						)}
						<Typography
							variant="14-medium"
							color={isPositive ? "success.main" : "error.main"}
						>
							{Math.abs(amount)} امتیاز
						</Typography>
					</AmountWrapper>
				</DetailWrapper>
			</Box>
		</TransactionsCardWrapper>
	);
}

export default memo(TransactionsCard);

const TransactionsCardWrapper = styled(Box)(({ theme }) => ({
	display: "flex",
	gap: theme.spacing(2),
	alignItems: "center",
	justifyContent: "space-between",
}));

const DetailWrapper = styled(Box)(() => ({
	display: "flex",
	alignItems: "center",
	justifyContent: "space-between",
	width: "100%",
}));

const AmountWrapper = styled(Box, {
	shouldForwardProp: (prop) => prop !== "isPositive",
})<{ isPositive: boolean }>(({ theme, isPositive }) => ({
	padding: theme.spacing(1, 2),
	borderRadius: theme.shape.borderRadius * 4,
	backgroundColor: isPositive ? "#EAFFF6" : "#FFF2F4",
	display: "flex",
	alignItems: "center",
	justifyContent: "center",
}));
