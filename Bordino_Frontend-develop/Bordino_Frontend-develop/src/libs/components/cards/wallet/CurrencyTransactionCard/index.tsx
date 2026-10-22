import { memo } from "react";

import Box from "@libs/components/atoms/Box";
import Typography from "@libs/components/atoms/Typography";
import styled from "@libs/styles/styled";

interface Props {
	title: string;
	date: string;
	amount: string;
	destination?: string;
	identifierNumber?: string;
	/** Money in (prize) or out (withdrawal): shown as + / − and colour. */
	positive?: boolean;
	/** A withdrawal's state in Persian («در انتظار واریز», …). */
	statusLabel?: string;
	/** Failed or cancelled: the amount went back, so it is shown struck through. */
	failed?: boolean;
}

function CurrencyTransactionCard({
	title,
	date,
	amount,
	destination,
	identifierNumber,
	positive = false,
	statusLabel,
	failed = false,
}: Readonly<Props>) {
	const formatAmount = (amountStr: string) => {
		const num = Number(amountStr);
		return num.toLocaleString("fa-IR");
	};

	return (
		<TransactionCardWrapper>
			<Box display="flex" flexDirection="column" gap={2}>
				<Box
					display="flex"
					justifyContent="space-between"
					alignItems="flex-start"
				>
					<Typography
						variant="14-medium"
						color={failed ? "text.secondary" : positive ? "success.main" : "error.main"}
						sx={{ textDecoration: failed ? "line-through" : undefined, direction: "ltr" }}
					>
						{/* The sign in an isolated run so it stays on the number's side in RTL. */}
						{"\u2066"}
						{positive ? "+" : "−"}
						{formatAmount(amount)}
						{"\u2069"} تومان
					</Typography>
					<Box
						display="flex"
						flexDirection="column"
						gap={0.5}
						alignItems="flex-end"
					>
						<Typography variant="14-medium" color="text.primary">
							{title}
						</Typography>
						<Typography variant="12-regular" color="text.secondary">
							{date}
						</Typography>
					</Box>
				</Box>

				{statusLabel && (
					<Box display="flex" justifyContent="space-between" alignItems="center">
						<Typography variant="12-regular" color="text.secondary">
							وضعیت
						</Typography>
						<Typography
							variant="12-medium"
							color={failed ? "error.main" : "text.primary"}
						>
							{statusLabel}
						</Typography>
					</Box>
				)}

				{destination && (
					<Box
						display="flex"
						justifyContent="space-between"
						alignItems="center"
					>
						<Typography variant="12-regular" color="text.secondary">
							مقصد
						</Typography>
						<Typography variant="12-medium" color="text.primary">
							{destination}
						</Typography>
					</Box>
				)}

				{identifierNumber && (
					<Box
						display="flex"
						justifyContent="space-between"
						alignItems="center"
					>
						<Typography variant="12-regular" color="text.secondary">
							شماره شناسه
						</Typography>
						<Typography variant="12-medium" color="text.primary">
							{identifierNumber}
						</Typography>
					</Box>
				)}
			</Box>
		</TransactionCardWrapper>
	);
}

export default memo(CurrencyTransactionCard);

const TransactionCardWrapper = styled(Box)(({ theme }) => ({
	display: "flex",
	flexDirection: "column",
	padding: theme.spacing(2),
	borderRadius: theme.shape.borderRadius * 2,
	backgroundColor: theme.palette.common.white,
	border: "1px solid",
	borderColor: theme.palette.grey[200],
}));
