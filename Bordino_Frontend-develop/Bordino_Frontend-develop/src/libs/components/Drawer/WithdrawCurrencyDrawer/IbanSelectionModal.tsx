import { memo, useCallback } from "react";

import Box from "@libs/components/atoms/Box";
import Button from "@libs/components/atoms/Button";
import Typography from "@libs/components/atoms/Typography";
import styled from "@libs/styles/styled";
import Radio from "@mui/material/Radio";

import type { BankAccount } from "@/api/wallet/types/getBankAccountsType";
import BaseDrawer from "@/libs/components/Drawer/BaseDrawer";
import ImageBox from "@/libs/components/ImageBox";

interface Props {
	open: boolean;
	onClose: () => void;
	bankAccounts: BankAccount[];
	selectedIbanId: string;
	onSelectIban: (ibanId: string) => void;
	onAddIban?: () => void;
}

function IbanSelectionModal({
	open,
	onClose,
	bankAccounts,
	selectedIbanId,
	onSelectIban,
	onAddIban,
}: Readonly<Props>) {
	const handleIbanClick = useCallback(
		(ibanId: string) => {
			onSelectIban(ibanId);
		},
		[onSelectIban],
	);

	const handleConfirm = useCallback(() => {
		onClose();
	}, [onClose]);

	return (
		<BaseDrawer
			open={open}
			onClose={onClose}
			title="انتخاب شماره شبا"
			titleVariant="20-bold"
			sx={{
				"& .MuiDrawer-paper": (theme) => ({
					borderTopLeftRadius: theme.shape.borderRadius * 6,
					borderTopRightRadius: theme.shape.borderRadius * 6,
				}),
			}}
		>
			<ModalContent>
				<Box display="flex" flexDirection="column" gap={3} mt={4}>
					{/* IBANs List */}
					<Box display="flex" flexDirection="column" gap={1.5}>
						{bankAccounts
							.filter((item) => item.status === "approved")
							.map((account) => (
								<IbanItem
									key={account.id}
									onClick={() => handleIbanClick(account.id)}
									selected={selectedIbanId === account.id}
								>
									<Box display="flex" alignItems="center" gap={1.5} flex={1}>
										{account.bank.icon && (
											<ImageBox
												src={account.bank.icon}
												alt={account.bank.name}
												width={40}
												height={40}
												sx={{ borderRadius: "50%" }}
											/>
										)}
										<Typography variant="14-medium" color="text.primary">
											{account.bank.name}
										</Typography>
									</Box>
									<Box display="flex" alignItems="center" gap={1}>
										{account.iban && (
											<Typography variant="14-regular" color="text.secondary">
												{account.iban}
											</Typography>
										)}
										<Radio
											checked={selectedIbanId === account.id}
											sx={{
												padding: 0,
												"&.Mui-checked": {
													color: "#235789",
												},
											}}
										/>
									</Box>
								</IbanItem>
							))}
					</Box>

					{onAddIban && (
						<Box>
							<Button
								variant="text"
								onClick={() => {
									onAddIban();
									onClose();
								}}
								sx={{
									color: "error.main",
									padding: 0,
									minWidth: "auto",
									textTransform: "none",
									"&:hover": {
										backgroundColor: "transparent",
										textDecoration: "underline",
									},
								}}
							>
								<Typography variant="12-regular" color="error.main">
									+ افزودن شماره شبا
								</Typography>
							</Button>
						</Box>
					)}

					<Button
						onClick={handleConfirm}
						disabled={!selectedIbanId}
						sx={(theme) => ({
							backgroundColor: "#235789",
							color: "common.white",
							borderRadius: "8px",
							padding: theme.spacing(1.5, 2),
							"&:hover": {
								backgroundColor: "#1a4470",
							},
							"&:disabled": {
								backgroundColor: theme.palette.grey[300],
								color: theme.palette.grey[500],
							},
						})}
						fullWidth
					>
						<Typography variant="14-medium" color="inherit">
							تایید و ادامه
						</Typography>
					</Button>
				</Box>
			</ModalContent>
		</BaseDrawer>
	);
}

export default memo(IbanSelectionModal);

const ModalContent = styled(Box)(({ theme }) => ({
	padding: theme.spacing(3, 2),
	paddingBottom: theme.spacing(4),
	display: "flex",
	flexDirection: "column",
	gap: theme.spacing(2),
	position: "relative",
}));

const IbanItem = styled(Box, {
	shouldForwardProp: (prop) => prop !== "selected",
})<{ selected: boolean }>(({ theme, selected }) => ({
	display: "flex",
	alignItems: "center",
	justifyContent: "space-between",
	padding: theme.spacing(1.5),
	borderRadius: theme.shape.borderRadius * 2,
	border: `1px solid ${selected ? "#235789" : theme.palette.grey[200]}`,
	backgroundColor: selected ? "#F0F7FF" : theme.palette.common.white,
	cursor: "pointer",
	transition: "all 0.2s ease",
	"&:hover": {
		borderColor: "#235789",
		backgroundColor: "#F0F7FF",
	},
}));
