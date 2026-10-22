import { Fragment, useCallback, useMemo, useState } from "react";
import { toast } from "react-toastify";

import { useRouter } from "next/navigation";

import Box from "@libs/components/atoms/Box";
import Divider from "@libs/components/atoms/Divider";
import Stack from "@mui/material/Stack";
import Typography from "@mui/material/Typography";
import { useQueryClient } from "@tanstack/react-query";

import { gameErrorMessage } from "@/api/games/request";
import useExtractLotteries from "@/api/lottery/utils/useExtractLotteries";
import useExtractLotteryDetail from "@/api/lottery/utils/useExtractLotteryDetail";
import { WALLET } from "@/api/urls";
import useGetBankAccounts from "@/api/wallet/hooks/useGetBankAccounts";
import useGetCurrencySummary from "@/api/wallet/hooks/useGetCurrencySummary";
import useGetPointsSummary from "@/api/wallet/hooks/useGetPointsSummary";
import useWalletHistory from "@/api/wallet/hooks/useWalletHistory";
import type { WalletHistoryPage } from "@/api/wallet/types/walletHistoryType";
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
import { normalizeIban } from "@/libs/components/Drawer/AddBankAccountDrawer/validations";
import AddIcon from "@/libs/components/icons/components/Pluse";
import useMutate from "@/libs/http/useMutate";
import { formatTehranDateTime, isoStringToString } from "@/libs/utils/date";
import { parseAmount } from "@/libs/utils/persianNumberConverter";
import { addParamsToUrl, addSearchParamsToUrl } from "@/libs/utils/urls";

interface UseWalletProps {
	activeSlideIndex?: number;
}

export default function useWallet({
	activeSlideIndex = 0,
}: UseWalletProps = {}) {
	const {
		data: pointsSummary,
		isLoading: isLoadingPoints,
		error: pointsError,
		refetch: refetchPointsSummary,
	} = useGetPointsSummary();
	const {
		data: currencySummary,
		refetch: refetchCurrencySummary,
		isLoading: isLoadingCurrency,
		error: currencyError,
	} = useGetCurrencySummary();

	const isWalletsLoading = isLoadingPoints || isLoadingCurrency;
	// A failed load is not "no wallet": the page says it failed and offers to try again.
	const walletsFailed = !isWalletsLoading && !!(pointsError || currencyError);
	const retryWallets = useCallback(() => {
		refetchPointsSummary();
		refetchCurrencySummary();
	}, [refetchPointsSummary, refetchCurrencySummary]);
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

	// Every page loaded so far ("نمایش بیشتر" asks for the next one), newest first.
	const pointsHistory = useWalletHistory("points", pointsWalletId);
	const currencyHistory = useWalletHistory("currency", currencyWalletId);

	const pointsTransactionsData = useMemo(
		() =>
			(pointsHistory.data?.pages ?? [])
				.flatMap((page: WalletHistoryPage | undefined) => page?.results ?? [])
				.map((transaction) => ({
					id: transaction.id,
					title: transaction.title,
					date: formatTehranDateTime(transaction.date),
					amount: transaction.is_positive
						? Number(transaction.amount)
						: -Number(transaction.amount),
					image: transaction.icon || DEFAULT_IMAGE,
				})),
		[pointsHistory.data],
	);

	const currencyTransactionsData = useMemo(
		() =>
			(currencyHistory.data?.pages ?? [])
				.flatMap((page: WalletHistoryPage | undefined) => page?.results ?? [])
				.map((transaction) => ({
					id: transaction.id,
					title: transaction.title,
					date: formatTehranDateTime(transaction.date),
					amount: transaction.amount,
					positive: transaction.is_positive,
					statusLabel: transaction.status_label,
					failed:
						transaction.status === "failed" || transaction.status === "cancelled",
					destination: transaction.destination_name ?? undefined,
					reference: transaction.reference,
				})),
		[currencyHistory.data],
	);

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

	// This page shows its own errors (requester does not toast on /pwa/wallet): say what failed;
	// the drawer stays open with what was typed.
	const { submitHandler: createBankAccount, isSending: isCreatingBankAccount } =
		useMutate<CreateBankAccountApiResponse, CreateBankAccountRequest>({
			url: WALLET.CREATE_BANK_ACCOUNT,
			method: "POST",
			onSuccess: handleAddAccountSuccess,
			onError: (error) => toast.error(gameErrorMessage(error)),
		});

	const handleAddAccount = useCallback(
		(data: { iban: string; bank: string; accountHolder: string }) => {
			createBankAccount({
				iban: normalizeIban(data.iban),
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
			onError: (error) => toast.error(gameErrorMessage(error)),
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
						<Fragment key={transaction.id}>
							<TransactionsCard
								title={transaction.title}
								date={transaction.date}
								amount={transaction.amount}
								image={transaction.image}
							/>
							{index < array.length - 1 && <Divider />}
						</Fragment>
					))}
					<HistoryFooter history={pointsHistory} empty={!pointsTransactionsData.length} />
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
						<Fragment key={transaction.id}>
							<CurrencyTransactionCard
								title={transaction.title}
								date={transaction.date}
								amount={transaction.amount}
								positive={transaction.positive}
								statusLabel={transaction.statusLabel ?? undefined}
								failed={transaction.failed}
								destination={transaction.destination}
								identifierNumber={transaction.reference}
							/>
							{index < array.length - 1 && <Divider />}
						</Fragment>
					))}
					<HistoryFooter
						history={currencyHistory}
						empty={!currencyTransactionsData.length}
					/>
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
		walletsFailed,
		retryWallets,
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

/** Under a history list: loading, its error with a retry, "nothing yet", or "show more". */
function HistoryFooter({
	history,
	empty,
}: {
	history: ReturnType<typeof useWalletHistory>;
	empty: boolean;
}) {
	if (history.isLoading) {
		return (
			<Typography color="text.secondary" textAlign="center" sx={{ py: 2, fontSize: 13 }}>
				در حال بارگذاری…
			</Typography>
		);
	}
	if (history.isError) {
		return (
			<Box display="flex" flexDirection="column" alignItems="center" gap={1} sx={{ py: 2 }} role="alert">
				<Typography color="error" sx={{ fontSize: 13 }}>
					تراکنش‌ها بارگذاری نشد.
				</Typography>
				<Button variant="outlined" size="small" onClick={() => history.refetch()}>
					دوباره تلاش کن
				</Button>
			</Box>
		);
	}
	if (empty) {
		return (
			<Typography color="text.secondary" textAlign="center" sx={{ py: 4, fontSize: 14 }}>
				هنوز تراکنشی ثبت نشده است.
			</Typography>
		);
	}
	if (!history.hasNextPage) return null;
	return (
		<Button
			variant="outlined"
			onClick={() => history.fetchNextPage()}
			disabled={history.isFetchingNextPage}
			sx={{ alignSelf: "center" }}
		>
			{history.isFetchingNextPage ? "در حال بارگذاری…" : "نمایش بیشتر"}
		</Button>
	);
}
