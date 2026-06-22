import { memo, useCallback } from "react";

import Box from "@libs/components/atoms/Box";
import Button from "@libs/components/atoms/Button";
import LinearProgress from "@libs/components/atoms/LinearProgress";
import Typography from "@libs/components/atoms/Typography";
import styled from "@libs/styles/styled";
import Checkbox from "@mui/material/Checkbox";

import type { Bank } from "@/api/wallet/types/getBanksType";
import BaseDrawer from "@/libs/components/Drawer/BaseDrawer";
import ImageBox from "@/libs/components/ImageBox";
import BackIcon from "@/libs/components/icons/components/Back";

interface Props {
	open: boolean;
	onClose: () => void;
	banks: Bank[];
	selectedBank: string;
	onSelectBank: (bankId: string) => void;
	isLoading?: boolean;
}

function BankSelectionModal({
	open,
	onClose,
	banks,
	selectedBank,
	onSelectBank,
	isLoading = false,
}: Readonly<Props>) {
	const handleBankClick = useCallback(
		(bankId: string) => {
			onSelectBank(bankId);
		},
		[onSelectBank],
	);

	const handleConfirm = useCallback(() => {
		onClose();
	}, [onClose]);

	return (
		<BaseDrawer
			open={open}
			onClose={onClose}
			title="بانک مورد نظر را وارد کنید"
			titleVariant="20-bold"
			sx={{
				"& .MuiDrawer-paper": (theme) => ({
					borderTopLeftRadius: theme.shape.borderRadius * 6,
					borderTopRightRadius: theme.shape.borderRadius * 6,
					maxWidth: "100%",
					margin: 0,
					height: "100%",
				}),
			}}
		>
			<ModalContent>
				<Button
					variant="text"
					color="primary"
					sx={{ placeSelf: "end", position: "absolute", top: 20, right: 20 }}
					endIcon={<BackIcon />}
					onClick={onClose}
				>
					بازگشت
				</Button>
				<Box display="flex" flexDirection="column" gap={3}>
					{isLoading ? (
						<Box display="flex" justifyContent="center" py={4}>
							<LinearProgress sx={{ width: "100%" }} />
						</Box>
					) : (
						<>
							{/* Bank Grid */}
							<BankGrid>
								{banks.map((bank) => (
									<BankItem
										key={bank.id}
										onClick={() => handleBankClick(bank.id)}
										selected={selectedBank === bank.id}
									>
										{bank.icon && (
											<ImageBox
												src={bank.icon}
												alt={bank.name}
												width={40}
												height={40}
												sx={{ borderRadius: "50%" }}
											/>
										)}
										<Typography variant="12-regular" color="text.primary">
											{bank.name}
										</Typography>
										<Checkbox
											checked={selectedBank === bank.id}
											sx={{
												padding: 0,
												"&.Mui-checked": {
													color: "#235789",
												},
											}}
										/>
									</BankItem>
								))}
							</BankGrid>
						</>
					)}

					{/* Confirm Button */}
					{!isLoading && (
						<Button
							onClick={handleConfirm}
							disabled={!selectedBank}
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
					)}
				</Box>
			</ModalContent>
		</BaseDrawer>
	);
}

export default memo(BankSelectionModal);

const ModalContent = styled(Box)(({ theme }) => ({
	padding: theme.spacing(3, 2),
	paddingBottom: theme.spacing(4),
	display: "flex",
	flexDirection: "column",
	gap: theme.spacing(2),
}));

const BankGrid = styled(Box)(({ theme }) => ({
	display: "grid",
	gridTemplateColumns: "repeat(2, 1fr)",
	gap: theme.spacing(2),
}));

const BankItem = styled(Box, {
	shouldForwardProp: (prop) => prop !== "selected",
})<{ selected: boolean }>(({ theme, selected }) => ({
	display: "flex",
	flexDirection: "column",
	alignItems: "center",
	gap: theme.spacing(1),
	padding: theme.spacing(2),
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
