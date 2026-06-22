import React, { useCallback, useEffect, useState } from "react";
import type { SubmitHandler } from "react-hook-form";

import IbanSelectionModal from "./IbanSelectionModal";
import useWithdrawCurrencyForm from "./useForm";
import type { WithdrawCurrencyFormValue } from "./validations";
import Box from "@libs/components/atoms/Box";
import Button from "@libs/components/atoms/Button";
import TextFieldAtom from "@libs/components/atoms/TextField";
import Typography from "@libs/components/atoms/Typography";
import TextField from "@libs/components/fields/Textfield";
import styled from "@libs/styles/styled";

import type { BankAccount } from "@/api/wallet/types/getBankAccountsType";
import type { CurrecncyWalletSchema } from "@/api/wallet/types/getCurrencySummaryType";
import type { BaseDrawerModalProps } from "@/libs/components/Drawer/BaseDrawer";
import BaseDrawer from "@/libs/components/Drawer/BaseDrawer";

interface Props extends Omit<BaseDrawerModalProps, "children"> {
	currencyWallet: CurrecncyWalletSchema;
	bankAccounts?: BankAccount[];
	onWithdraw?: (data: { amount: string; ibanId: string }) => void;
	onAddIban?: () => void;
	isWithdrawing?: boolean;
}

export default function WithdrawCurrencyDrawer({
	open,
	sx,
	currencyWallet,
	bankAccounts = [],
	onWithdraw,
	onAddIban,
	isWithdrawing = false,
	...restProps
}: Readonly<Props>) {
	const availableBalance = Number(currencyWallet.balance) || 0;
	const form = useWithdrawCurrencyForm(availableBalance);
	const [showIbanSelection, setShowIbanSelection] = useState(false);

	const onInventoryWithdrawal = () => {
		form.setValue("amount", availableBalance.toString(), {
			shouldTouch: true,
		});
	};

	const getSelectedIban = useCallback(() => {
		const selectedBankAccountId = form.getValues("bankAccountId");
		return (
			bankAccounts.find((acc) => acc.id === selectedBankAccountId)?.iban || ""
		);
	}, [form, bankAccounts]);

	const handleIbanSelect = useCallback(
		(ibanId: string) => {
			form.setValue("bankAccountId", ibanId, { shouldValidate: false });
			setShowIbanSelection(false);
		},
		[form],
	);

	const onSubmit: SubmitHandler<WithdrawCurrencyFormValue> = useCallback(
		(data) => {
			if (onWithdraw) {
				const numericAmount = data.amount.replace(/[^0-9]/g, "");
				onWithdraw({
					amount: numericAmount,
					ibanId: data.bankAccountId,
				});
			}
		},
		[onWithdraw],
	);

	// Reset form when drawer closes
	useEffect(() => {
		if (!open) {
			form.reset();
			setShowIbanSelection(false);
		}
	}, [open, form]);

	const formatAmount = (amount: string | number) => {
		const numAmount =
			typeof amount === "string"
				? Number(amount.replace(/[^0-9]/g, ""))
				: amount;
		return numAmount.toLocaleString("fa-IR");
	};

	return (
		<>
			<BaseDrawer
				open={open && !showIbanSelection}
				title="برداشت موجودی"
				titleVariant="20-bold"
				sx={{
					"& .MuiDrawer-paper": (theme) => ({
						borderTopLeftRadius: theme.shape.borderRadius * 8,
						borderTopRightRadius: theme.shape.borderRadius * 8,
					}),
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
						{/* Withdrawal Amount Field */}
						<Box>
							<Box
								sx={{
									position: "relative",
								}}
							>
								<TextField
									form={form}
									name="amount"
									label="مبلغ برداشت (تومان)"
									required
									inputType="string"
									sx={{
										borderRadius: "12px",
									}}
								/>
								<Box
									sx={{
										cursor: "pointer",
									}}
									role="button"
								>
									<Typography
										onClick={onInventoryWithdrawal}
										sx={{
											position: "absolute",
											top: -20,
											right: 0,
											color: (theme) => theme.palette.primary.main,
											textDecoration: "underline",
											fontSize: "12px",
											lineHeight: "18px",
										}}
									>
										برداشت موجودی
									</Typography>
								</Box>
							</Box>
							<Typography
								variant="12-regular"
								color="text.secondary"
								sx={{ mt: 1 }}
							>
								موجودی قابل برداشت {formatAmount(availableBalance)} تومان
							</Typography>
						</Box>

						{/* IBAN Selection Field */}
						<Box>
							<TextFieldAtom
								variant="outlined"
								label="شماره شبا"
								placeholder="انتخاب شماره شبا"
								value={getSelectedIban()}
								required
								fullWidth
								error={!!form.formState.errors.bankAccountId}
								helperText={form.formState.errors.bankAccountId?.message}
								InputProps={{
									readOnly: true,
								}}
								onClick={() => setShowIbanSelection(true)}
								sx={{
									"& .MuiOutlinedInput-root": {
										borderRadius: "12px",
										"& fieldset": {
											border: "1px solid #ADADAD",
										},
										"&:hover fieldset": {
											border: "1px solid #ADADAD",
										},
									},
									cursor: "pointer",
									"& .MuiInputBase-input": {
										cursor: "pointer",
									},
								}}
							/>
						</Box>

						{/* Withdrawal Button */}
						<Button
							type="submit"
							disabled={isWithdrawing || form.formState.isSubmitting}
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
								{isWithdrawing ? "در حال برداشت..." : "برداشت موجودی"}
							</Typography>
						</Button>
					</Box>
				</DrawerContent>
			</BaseDrawer>

			{/* IBAN Selection Modal */}
			<IbanSelectionModal
				open={showIbanSelection}
				onClose={() => setShowIbanSelection(false)}
				bankAccounts={bankAccounts}
				selectedIbanId={form.getValues("bankAccountId") || ""}
				onSelectIban={handleIbanSelect}
				onAddIban={onAddIban}
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
