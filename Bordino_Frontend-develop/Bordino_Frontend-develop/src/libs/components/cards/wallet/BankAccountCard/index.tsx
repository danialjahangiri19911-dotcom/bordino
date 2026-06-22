import { memo, useCallback, useState } from "react";

import Image from "next/image";

import Box from "@libs/components/atoms/Box";
import IconButton from "@libs/components/atoms/IconButton";
import Typography from "@libs/components/atoms/Typography";
import styled from "@libs/styles/styled";
import ContentCopy from "@mui/icons-material/ContentCopy";
import Modal from "@mui/material/Modal";
import Stack from "@mui/material/Stack";

import Button from "@/libs/components/atoms/Button";
import Snackbar from "@/libs/components/atoms/Snackbar";
import useCopyToClipboard from "@/libs/uiHooks/copyToClipboard/useCopyToClipboard";

interface Props {
	bankName: string;
	bankLogo?: string;
	iban?: string;
	status: "valid" | "invalid" | "pending" | string;
}

const BANK_IMAGE_PLACEHOLDER = "/media/round-placeholder.png";

function BankAccountCard({
	bankName,
	bankLogo,
	iban,
	status,
}: Readonly<Props>) {
	const { copyToClipboard } = useCopyToClipboard();
	const [bankImageSource, setBankImageSource] = useState(bankLogo);
	const [deleteModalOpen, setDeleteModalOpen] = useState(false);
	const [copySnackbarOpen, setCopySnackbarOpen] = useState(false);

	const getStatusConfig = () => {
		switch (status) {
			case "approved":
				return {
					label: "تایید شده",
					bgColor: "#EAFFF6",
					textColor: "#00A86B",
				};
			case "pending":
				return {
					label: "در انتظار تایید",
					bgColor: "#FFF4E6",
					textColor: "#FF8A00",
				};
			default:
				return {
					label: "در انتظار تایید",
					bgColor: "#FFF4E6",
					textColor: "#FF8A00",
				};
		}
	};

	const statusConfig = getStatusConfig();

	const handleOpenDeleteModal = () => {
		setDeleteModalOpen(true);
	};

	const handleCloseDeleteModal = () => {
		setDeleteModalOpen(false);
	};

	const handleCloseCopySnackbar = () => {
		setCopySnackbarOpen(false);
	};

	const handleOpenCopySnackbar = () => {
		setCopySnackbarOpen(true);
	};

	const handleCopyIban = useCallback(() => {
		if (iban) {
			copyToClipboard(iban);
			handleOpenCopySnackbar();
		}
	}, [iban, copyToClipboard]);

	const onErrorBankImage = () => {
		if (bankImageSource !== BANK_IMAGE_PLACEHOLDER)
			setBankImageSource(BANK_IMAGE_PLACEHOLDER);
	};

	return (
		<BankAccountCardWrapper>
			<Box
				display="flex"
				alignItems="center"
				flexDirection="row-reverse"
				justifyContent="space-between"
				height="fit-content"
			>
				<StatusTag
					sx={{
						backgroundColor: statusConfig.bgColor,
						color: statusConfig.textColor,
					}}
				>
					<Typography variant="12-medium">{statusConfig.label}</Typography>
				</StatusTag>

				<Box
					display="flex"
					alignItems="center"
					gap={2}
					justifyContent="flex-end"
					flexDirection="row-reverse"
				>
					<Stack direction="row" alignItems="center" gap={1}>
						<Typography
							variant="14-medium"
							sx={{
								color: (theme) => theme.bdn?.grey.g650,
							}}
						>
							{bankName}
						</Typography>
						<IconButton
							sx={{
								p: "2px",
							}}
							onClick={handleOpenDeleteModal}
						>
							<Image
								src="/media/App/delete.svg"
								alt="trash"
								height={20}
								width={20}
							/>
						</IconButton>

						<Modal open={deleteModalOpen} onClose={handleCloseDeleteModal}>
							<Stack
								sx={{
									bgcolor: "white",
									borderRadius: "24px",
									maxWidth: "300px",
									minWidth: "300px",
									position: "absolute",
									top: "50%",
									left: "50%",
									transform: "translate(-50%, -50%)",
									p: "18px",
									gap: "16px",
								}}
							>
								<Stack gap="8px">
									<Typography
										sx={{
											fontSize: 14,
											fontWeight: 500,
											color: (theme) => theme.bdn?.grey.g600,
											textAlign: "center",
										}}
									>
										آیا از حذف این بانک اطمینان دارید؟
									</Typography>
									<Stack
										sx={{
											bgcolor: (theme) => theme.bdn?.grey.g25,
											py: "4px",
											px: "12px",
											borderRadius: "8px",
											gap: "4px",
										}}
									>
										<Stack direction="row" alignItems="center" gap="8px">
											{bankImageSource && (
												<Image
													src={bankImageSource}
													alt={bankName}
													height={16}
													width={16}
													onError={onErrorBankImage}
												/>
											)}
											<Typography
												sx={{
													fontSize: 12,
													fontWeight: 500,
													lineHeight: "20px",
													color: (theme) => theme.bdn?.grey.g650,
												}}
											>
												{bankName}
											</Typography>
										</Stack>
										{iban && (
											<Typography
												sx={{
													fontSize: 12,
													lineHeight: "20px",
													textAlign: "end",
												}}
											>
												{iban.replace("IR", "IR ")}
											</Typography>
										)}
									</Stack>
								</Stack>
								<Stack direction="row" justifyContent="center" gap="12px">
									<DeleteModalButton
										onClick={() => {
											alert("pending api completion to integrate delete");
										}}
									>
										تایید
									</DeleteModalButton>
									<DeleteModalButton
										variant="outlined"
										onClick={handleCloseDeleteModal}
									>
										بازگشت
									</DeleteModalButton>
								</Stack>
							</Stack>
						</Modal>
					</Stack>

					{bankImageSource && (
						<Image
							src={bankImageSource}
							alt={bankName}
							height={36}
							width={36}
							onError={onErrorBankImage}
						/>
					)}
				</Box>
			</Box>

			{iban && (
				<Box
					display="flex"
					alignItems="center"
					justifyContent="space-between"
					p="12px"
				>
					<Typography
						variant="14-regular"
						sx={{
							color: (theme) => theme.bdn?.grey.g650,
						}}
					>
						{iban.replace("IR", "IR ")}
					</Typography>
					<IconButton
						onClick={handleCopyIban}
						sx={{
							padding: 0.5,
							"&:hover": {
								backgroundColor: "grey.100",
							},
						}}
					>
						<ContentCopy sx={{ fontSize: 18, color: "grey.600" }} />
					</IconButton>
					<Snackbar
						open={copySnackbarOpen}
						onClose={handleCloseCopySnackbar}
						message="شماره شبا کپی شد."
					/>
				</Box>
			)}
		</BankAccountCardWrapper>
	);
}

export default memo(BankAccountCard);

const BankAccountCardWrapper = styled(Box)(({ theme }) => ({
	display: "flex",
	flexDirection: "column",
	padding: "12px",
	borderRadius: theme.shape.borderRadius * 2,
	backgroundColor: theme.bdn?.grey.g25,
	border: "1px solid",
	borderColor: "#EEEEEE",
	rowGap: "16px",
}));

const StatusTag = styled(Box)(({ theme }) => ({
	padding: theme.spacing(0.5, 1.5),
	borderRadius: theme.shape.borderRadius * 4,
	display: "flex",
	alignItems: "center",
	justifyContent: "center",
	minWidth: "fit-content",
}));

const DeleteModalButton = styled(Button)(() => ({
	borderRadius: "8px",
	height: "32px",
}));
