import { Fragment, useCallback, useMemo, useState } from "react";

import { useRouter } from "next/navigation";

import Box from "@libs/components/atoms/Box";
import Divider from "@libs/components/atoms/Divider";
import Stack from "@mui/material/Stack";
import Typography from "@mui/material/Typography";
import { useQueryClient } from "@tanstack/react-query";

import useExtractLotteries from "@/api/lottery/utils/useExtractLotteries";
import useExtractLotteryDetail from "@/api/lottery/utils/useExtractLotteryDetail";
import { WALLET } from "@/api/urls";
import useGetBankAccounts from "@/api/wallet/hooks/useGetBankAccounts";
import useGetCurrencySummary from "@/api/wallet/hooks/useGetCurrencySummary";
import useGetCurrencyTransactions from "@/api/wallet/hooks/useGetCurrencyTransactions";
import useGetPointsSummary from "@/api/wallet/hooks/useGetPointsSummary";
import useGetPointsTransactions from "@/api/wallet/hooks/useGetPointsTransactions";
import type {
	CreateBankAccountApiResponse,
	CreateBankAccountRequest,
} from "@/api/wallet/types/createBankAccountType";
import type { CurrecncyWalletSchema } from "@/api/wallet/types/getCurrencySummaryType";
import type { WalletSchema } from "@/api/wallet/types/getPointsSummaryType";
import type {
	WithdrawCurrencyApiResponse,
	WithdrawCurrencyRequest,
} from "@/api/wallet/types/withdrawCurrencyType";
import { DEFAULT_IMAGE } from "@/constants/imagePaths";
import { BUY_TICKET, LOTTERY_DETAIL, MAIN_APP } from "@/constants/routes";
import Button from "@/libs/components/atoms/Button";
import BankAccountCard from "@/libs/components/cards/wallet/BankAccountCard";
import CurrencyTransactionCard from "@/libs/components/cards/wallet/CurrencyTransactionCard";
import LotteryCard from "@/libs/components/cards/wallet/LotteryCard";
import TransactionsCard from "@/libs/components/cards/wallet/TransactionsCard";
import AddIcon from "@/libs/components/icons/components/Pluse";
import useMutate from "@/libs/http/useMutate";
import { isoStringToString } from "@/libs/utils/date";
import { parseAmount } from "@/libs/utils/persianNumberConverter";
import { addParamsToUrl, addSearchParamsToUrl } from "@/libs/utils/urls";

interface UseWalletProps {
	activeSlideIndex?: number;
}

export default function useWallet({
	activeSlideIndex = 0,
}: UseWalletProps = {}) {
	const { data: pointsSummary, isLoading: isLoadingPoints } =
		useGetPointsSummary();
	const {
		data: currencySummary,
		refetch: refetchCurrencySummary,
		isLoading: isLoadingCurrency,
	} = useGetCurrencySummary();

	const isWalletsLoading = isLoadingPoints || isLoadingCurrency;
	const { data: bankAccountsData, refetch: refetchBankAccounts } =
		useGetBankAccounts();

	const { lotteryData } = useExtractLotteries();
	const { push } = useRouter();
	const queryClient = useQueryClient();

	const concatWallets = useMemo(() => {
		const pointsAccounts = pointsSummary?.result?.token_wallet_accounts ?? [];
		const currencyAccounts =
			currencySummary?.result?.currency_wallet_accounts ?? [];
		return [...pointsAccounts, ...currencyAccounts];
	}, [
		pointsSummary?.result?.token_wallet_accounts,
		currencySummary?.result?.currency_wallet_accounts,
	]);

	const activeWallet = concatWallets[activeSlideIndex] || null;
	const isPointsWallet = activeWallet && "total_points" in activeWallet;
	const pointsWalletId = isPointsWallet
		? (activeWallet as WalletSchema).id
		: undefined;
	const currencyWalletId =
		!isPointsWallet && activeWallet
			? (activeWallet as CurrecncyWalletSchema).id
			: undefined;

	const { data: pointsTransactions } = useGetPointsTransactions({
		tokenWalletAccountId: pointsWalletId,
	});

	const { data: currencyTransactions } = useGetCurrencyTransactions({
		currencyWalletAccountId: currencyWalletId,
	});

	const pointsTransactionsData = useMemo(() => {
		if (!pointsTransactions?.result.results) return [];
		return pointsTransactions.result.results.map((transaction) => ({
			title: transaction.title,
			date: isoStringToString(transaction.date, true, true),
			amount: transaction.is_positive
				? Number(transaction.amount)
				: -Number(transaction.amount),
			image: transaction.icon || DEFAULT_IMAGE,
		}));
	}, [pointsTransactions]);

	const currencyTransactionsData = useMemo(() => {
		if (!currencyTransactions?.result.results) return [];
		return currencyTransactions.result.results.map((transaction) => {
			const dateWithTime = isoStringToString(
				transaction.create_time,
				true,
				true,
			);
			return {
				id: transaction.id,
				title: transaction.type,
				date: dateWithTime,
				amount: transaction.amount,
				destination: transaction.destination_name,
			};
		});
	}, [currencyTransactions]);

	const [isDrawerOpen, setIsDrawerOpen] = useState(false);
	const [isAddBankAccountDrawerOpen, setIsAddBankAccountDrawerOpen] =
		useState(false);
	const [isWithdrawCurrencyDrawerOpen, setIsWithdrawCurrencyDrawerOpen] =
		useState(false);
	const [selectedCurrencyWallet, setSelectedCurrencyWallet] =
		useState<CurrecncyWalletSchema | null>(null);

	const handleDrawerClose = useCallback(() => setIsDrawerOpen(false), []);

	const handleExchange = useCallback(() => {
		setIsDrawerOpen(true);
	}, []);

	const handleAddBankAccountDrawerOpen = useCallback(() => {
		setIsAddBankAccountDrawerOpen(true);
	}, []);

	const handleAddBankAccountDrawerClose = useCallback(() => {
		setIsAddBankAccountDrawerOpen(false);
	}, []);

	const handleAddAccountSuccess = useCallback(() => {
		setIsAddBankAccountDrawerOpen(false);
		refetchCurrencySummary();
		refetchBankAccounts();
	}, [refetchCurrencySummary, refetchBankAccounts]);

	const { submitHandler: createBankAccount, isSending: isCreatingBankAccount } =
		useMutate<CreateBankAccountApiResponse, CreateBankAccountRequest>({
			url: WALLET.CREATE_BANK_ACCOUNT,
			method: "POST",
			onSuccess: handleAddAccountSuccess,
		});

	const handleAddAccount = useCallback(
		(data: { iban: string; bank: string; accountHolder: string }) => {
			createBankAccount({
				iban: data.iban,
				bank: data.bank,
				account_holder: data.accountHolder,
			});
		},
		[createBankAccount],
	);

	const handleWithdrawCurrencyDrawerOpen = useCallback(
		(wallet: CurrecncyWalletSchema) => {
			setSelectedCurrencyWallet(wallet);
			setIsWithdrawCurrencyDrawerOpen(true);
		},
		[],
	);

	const handleWithdrawCurrencyDrawerClose = useCallback(() => {
		setIsWithdrawCurrencyDrawerOpen(false);
		setSelectedCurrencyWallet(null);
	}, []);

	const handleWithdrawSuccess = useCallback(() => {
		setIsWithdrawCurrencyDrawerOpen(false);
		setSelectedCurrencyWallet(null);
		refetchCurrencySummary();
		queryClient.invalidateQueries();
	}, [queryClient, refetchCurrencySummary]);

	const { submitHandler: withdrawCurrency, isSending: isWithdrawingCurrency } =
		useMutate<WithdrawCurrencyApiResponse, WithdrawCurrencyRequest>({
			url: WALLET.WITHDRAW_CURRENCY,
			method: "POST",
			onSuccess: handleWithdrawSuccess,
		});

	const handleWithdraw = useCallback(
		(data: { amount: string; ibanId: string; requestId: string }) => {
			const numericAmount = parseAmount(data.amount);
			if (numericAmount > 0 && data.ibanId) {
				withdrawCurrency({
					amount: numericAmount,
					bank_account_id: data.ibanId,
					request_id: data.requestId,
				});
			}
		},
		[withdrawCurrency],
	);

	const handleAddIbanFromWithdraw = useCallback(() => {
		setIsAddBankAccountDrawerOpen(true);
	}, []);

	const { lotteryDetail } = useExtractLotteryDetail();

	// فقط قرعه‌کشی‌هایی که با کیفِ امتیازِ فعلی (token) قابلِ انجام‌اند
	const activeTokenId =
		isPointsWallet && activeWallet
			? (activeWallet as WalletSchema).token
			: undefined;

	const walletLotteries = useMemo(() => {
		if (!activeTokenId) return [];
		return lotteryData.filter((lottery) => lottery.token === activeTokenId);
	}, [lotteryData, activeTokenId]);

	const walletTabs = [
		{
			label: "قرعه کشی ها",
			content: (
				<Box display="flex" flexDirection="column" gap={2}>
					{walletLotteries.length > 0 ? (
						walletLotteries.map((item, index, array) => (
							<Fragment key={item.id}>
								<LotteryCard
									image={DEFAULT_IMAGE}
									title={item.name}
									date={isoStringToString(item.end_date)}
									deprecated={item.status !== "active"}
									onAction={() =>
										push(addParamsToUrl(LOTTERY_DETAIL.path, { id: item.id }))
									}
									ticketCount={0}
								/>

								{index < array.length - 1 && <Divider />}
							</Fragment>
						))
					) : (
						<Typography
							color="text.secondary"
							textAlign="center"
							sx={{ py: 4, fontSize: 14, fontWeight: 500 }}
						>
							قرعه‌کشی‌ای برای این کیف‌پول موجود نیست
						</Typography>
					)}
				</Box>
			),
		},
		{
			label: "تراکنش ها",
			content: (
				<Box display="flex" flexDirection="column" gap={2}>
					{pointsTransactionsData.map((transaction, index, array) => (
						<Fragment key={`${transaction.title}-${index}`}>
							<TransactionsCard
								title={transaction.title}
								date={transaction.date}
								amount={transaction.amount}
								image={transaction.image}
							/>
							{index < array.length - 1 && <Divider />}
						</Fragment>
					))}
				</Box>
			),
		},
	];

	const currencyWalletTabs = [
		{
			label: "حسابهای بانکی",
			content: (
				<Box display="flex" flexDirection="column" gap={2}>
					<Stack
						direction="row-reverse"
						alignItems="center"
						justifyContent="space-between"
					>
						<Button
							variant="outlined"
							color="secondary"
							sx={{
								placeSelf: "end",
								fontSize: 12,
								fontWeight: 500,
								py: "4px",
								px: "12px",
							}}
							endIcon={<AddIcon />}
							onClick={handleAddBankAccountDrawerOpen}
						>
							حساب جدید
						</Button>
						<Typography
							sx={{
								fontSize: 14,
								color: (theme) => theme.bdn?.grey.g525,
							}}
						>
							حساب‌های شما
						</Typography>
					</Stack>
					{bankAccountsData?.result?.results?.map((account, index, array) => (
						<Fragment key={account.id}>
							<BankAccountCard
								bankName={account.bank.name}
								bankLogo={account.bank.icon}
								iban={account.iban}
								status={account.status}
							/>
							{index < array.length - 1 && <Divider />}
						</Fragment>
					))}
				</Box>
			),
		},
		{
			label: "تراکنش ها",
			content: (
				<Box display="flex" flexDirection="column" gap={2}>
					{currencyTransactionsData.map((transaction, index, array) => (
						<Fragment key={`${transaction.id}-${index}`}>
							<CurrencyTransactionCard
								title="انتقال وجه"
								date={transaction.date}
								amount={transaction.amount}
								destination={transaction.destination}
								identifierNumber={undefined}
							/>
							{index < array.length - 1 && <Divider />}
						</Fragment>
					))}
				</Box>
			),
		},
	];

	const handleBuyTicket = useCallback(
		(ticketCount: number) => {
			push(
				addSearchParamsToUrl(BUY_TICKET.path, {
					ticketCount: ticketCount.toString(),
				}),
			);
		},
		[push],
	);

	const handleBack = () => {
		push(MAIN_APP.path);
	};

	return {
		pointsSummary: pointsSummary?.result,
		currencySummary: currencySummary?.result,
		bankAccounts: bankAccountsData?.result?.results || [],
		concatWallets,
		isWalletsLoading,
		walletTabs,
		currencyWalletTabs,
		isDrawerOpen,
		handleDrawerClose,
		handleExchange,
		isAddBankAccountDrawerOpen,
		handleAddBankAccountDrawerOpen,
		handleAddBankAccountDrawerClose,
		handleAddAccount,
		isCreatingBankAccount,
		isWithdrawCurrencyDrawerOpen,
		handleWithdrawCurrencyDrawerOpen,
		handleWithdrawCurrencyDrawerClose,
		handleWithdraw,
		isWithdrawingCurrency,
		handleAddIbanFromWithdraw,
		selectedCurrencyWallet,
		ticketPrice: lotteryDetail?.result.ticket_price,
		handleBuyTicket,
		handleBack,
	};
}
