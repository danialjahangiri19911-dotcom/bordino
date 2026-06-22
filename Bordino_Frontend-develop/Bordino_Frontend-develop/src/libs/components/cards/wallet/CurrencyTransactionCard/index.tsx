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
}

function CurrencyTransactionCard({
	title,
	date,
	amount,
	destination,
	identifierNumber,
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
					<Typography variant="14-medium" color="text.primary">
						{formatAmount(amount)} ریال
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
