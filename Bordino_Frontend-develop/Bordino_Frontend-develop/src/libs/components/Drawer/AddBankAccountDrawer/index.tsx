import React, { useCallback, useEffect, useMemo, useState } from "react";
import type { SubmitHandler } from "react-hook-form";

import BankSelectionModal from "./BankSelectionModal";
import useAddBankAccountForm from "./useForm";
import type { AddBankAccountFormValue } from "./validations";
import Box from "@libs/components/atoms/Box";
import Button from "@libs/components/atoms/Button";
import TextFieldAtom from "@libs/components/atoms/TextField";
import Typography from "@libs/components/atoms/Typography";
import TextField from "@libs/components/fields/Textfield";
import styled from "@libs/styles/styled";

import useGetBanks from "@/api/wallet/hooks/useGetBanks";
import type { BaseDrawerModalProps } from "@/libs/components/Drawer/BaseDrawer";
import BaseDrawer from "@/libs/components/Drawer/BaseDrawer";

interface Props extends Omit<BaseDrawerModalProps, "children"> {
	onAddAccount?: (data: {
		iban: string;
		bank: string;
		accountHolder: string;
	}) => void;
	isCreating?: boolean;
}

export default function AddBankAccountDrawer({
	open,
	sx,
	onAddAccount,
	isCreating = false,
	...restProps
}: Readonly<Props>) {
	const form = useAddBankAccountForm();
	const { data: banksData, isLoading: isLoadingBanks } = useGetBanks();
	const [showBankSelection, setShowBankSelection] = useState(false);

	const activeBanks = useMemo(() => {
		if (!banksData?.result?.results) return [];
		return banksData.result.results.filter((bank) => bank.is_active);
	}, [banksData]);

	const selectedBank = form.watch("bank");
	const selectedBankName =
		activeBanks.find((b) => b.id === selectedBank)?.name || "";

	const handleBankSelect = useCallback(
		(bankId: string) => {
			form.setValue("bank", bankId, { shouldValidate: true });
			setShowBankSelection(false);
		},
		[form],
	);

	const handleIbanChange = useCallback(
		(e: React.ChangeEvent<HTMLInputElement>) => {
			const value = e.target.value;
			// Remove spaces and convert to uppercase
			const cleaned = value.replace(/\s/g, "").toUpperCase();
			form.setValue("iban", cleaned, { shouldValidate: true });
		},
		[form],
	);

	const onSubmit: SubmitHandler<AddBankAccountFormValue> = useCallback(
		(data) => {
			if (onAddAccount) {
				// Clean IBAN: remove spaces and convert to uppercase
				const cleanedIban = data.iban.replace(/\s/g, "").toUpperCase();
				onAddAccount({
					iban: cleanedIban,
					bank: data.bank,
					accountHolder: data.accountHolder,
				});
			}
		},
		[onAddAccount],
	);

	// Reset form when drawer closes
	useEffect(() => {
		if (!open) {
			form.reset();
			setShowBankSelection(false);
		}
	}, [open, form]);

	return (
		<>
			<BaseDrawer
				open={open && !showBankSelection}
				title="اضافه کردن حساب"
				titleVariant="20-bold"
				sx={{
					"& .MuiDrawer-paper": (theme) => ({
						borderTopLeftRadius: theme.shape.borderRadius * 6,
						borderTopRightRadius: theme.shape.borderRadius * 6,
					}),
					zIndex: 12001,
					...sx,
				}}
				{...restProps}
			>
				<DrawerContent>
					<Box
						component="form"
						display="flex"
						flexDirection="column"
						gap={3}
						onSubmit={form.handleSubmit(onSubmit)}
					>
						{/* IBAN Field */}
						<TextField
							form={form}
							name="iban"
							label="شماره شبا"
							placeholder="IR123456789012345678901234"
							required
							maxLen={26}
							onChange={handleIbanChange}
						/>

						{/* Bank Selection Field */}
						<Box>
							<TextFieldAtom
								value={selectedBankName}
								placeholder="انتخاب بانک"
								label="بانک"
								required
								onClick={() => setShowBankSelection(true)}
								fullWidth
								error={!!form.formState.errors.bank}
								helperText={form.formState.errors.bank?.message}
								sx={{
									cursor: "pointer",
									"& .MuiInputBase-input": {
										cursor: "pointer",
									},
								}}
							/>
						</Box>

						{/* Account Holder Field */}
						<TextField
							form={form}
							name="accountHolder"
							label="نام کامل صاحب حساب"
							required
						/>

						{/* Add Account Button */}
						<Button
							type="submit"
							disabled={isCreating || form.formState.isSubmitting}
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
								{isCreating ? "در حال افزودن..." : "افزودن حساب"}
							</Typography>
						</Button>
					</Box>
				</DrawerContent>
			</BaseDrawer>

			{/* Bank Selection Modal */}
			<BankSelectionModal
				open={showBankSelection}
				onClose={() => setShowBankSelection(false)}
				banks={activeBanks}
				selectedBank={selectedBank || ""}
				onSelectBank={handleBankSelect}
				isLoading={isLoadingBanks}
			/>
		</>
	);
}

const DrawerContent = styled(Box)(({ theme }) => ({
	padding: theme.spacing(3, 2),
	paddingBottom: theme.spacing(4),
	display: "flex",
	flexDirection: "column",
	gap: theme.spacing(2),
}));
