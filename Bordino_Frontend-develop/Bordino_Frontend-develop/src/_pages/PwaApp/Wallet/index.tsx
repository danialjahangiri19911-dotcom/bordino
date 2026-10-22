"use client";

import { useState } from "react";

import useWallet from "./useWallet";
import Box from "@libs/components/atoms/Box";
import Button from "@libs/components/atoms/Button";
import CircularProgress from "@libs/components/atoms/CircularProgress";
import Divider from "@libs/components/atoms/Divider";
import LinearProgress from "@libs/components/atoms/LinearProgress";
import Typography from "@libs/components/atoms/Typography";
import styled from "@libs/styles/styled";
import "swiper/css";
import "swiper/css/navigation";
import "swiper/css/pagination";
import { Navigation } from "swiper/modules";
import { Swiper, SwiperSlide } from "swiper/react";

import type { CurrecncyWalletSchema } from "@/api/wallet/types/getCurrencySummaryType";
import type { WalletSchema } from "@/api/wallet/types/getPointsSummaryType";
import { SCORE_FULL, TICKET_V2 } from "@/constants/imagePaths";
import { QUESTION_ICON } from "@/constants/imagePaths";
import AddBankAccountDrawer from "@/libs/components/Drawer/AddBankAccountDrawer";
import ExchangeDrawer from "@/libs/components/Drawer/ExchangeDrawer";
import WithdrawCurrencyDrawer from "@/libs/components/Drawer/WithdrawCurrencyDrawer";
import ImageBox from "@/libs/components/ImageBox";
import BasicTabs from "@/libs/components/Tabs";
import PwaAppPageLayout from "@/libs/components/layouts/PwaAppLayout";
import Back from "@/libs/components/layouts/PwaAppLayout/customRightActions/Back";
import { isoStringToString } from "@/libs/utils/date";

export default function Wallet() {
	const [metaData, setMetaData] = useState<WalletSchema>();
	const [activeSlideIndex, setActiveSlideIndex] = useState(0);

	const {
		concatWallets,
		isWalletsLoading,
		walletsFailed,
		retryWallets,
		handleExchange,
		isDrawerOpen,
		handleDrawerClose,
		isAddBankAccountDrawerOpen,
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
		bankAccounts,
		walletTabs,
		currencyWalletTabs,
		ticketPrice,
		handleBack,
	} = useWallet({ activeSlideIndex });

	const renderWalletCard = (
		walletData: WalletSchema | CurrecncyWalletSchema,
		index: number,
	) => {
		const isPointsWallet = "total_points" in walletData;
		if (!isPointsWallet) {
			const currencyWallet = walletData as CurrecncyWalletSchema;
			return (
				<WalletCard
					key={index}
					sx={{ backgroundColor: "#E9EEF3", border: "1px solid #9AB2C9" }}
				>
					<CardHeader>
						<Box display="flex" alignItems="center" gap={1}>
							<ImageBox src="/media/App/wallet/currency.svg" />
							<Typography variant="14-medium" color="text.primary">
								کیف نقدی
							</Typography>
						</Box>
					</CardHeader>
					<CardContent>
						<Box
							display="flex"
							width="100%"
							justifyContent="space-between"
							gap={1.5}
						>
							<Typography variant="14-regular">موجودی:</Typography>
							<Typography variant="14-medium" color="text.primary">
								{Number(currencyWallet.balance || 0).toLocaleString("fa-IR")} تومان
							</Typography>
						</Box>
						{currencyWallet.expire_date && (
							<Box
								display="flex"
								width="100%"
								justifyContent="space-between"
								gap={1.5}
							>
								<Typography variant="14-regular">تاریخ انقضا:</Typography>
								<Typography variant="14-medium" color="text.primary">
									{isoStringToString(currencyWallet.expire_date)}
								</Typography>
							</Box>
						)}

						<Box display="flex" justifyContent="center" pt="14px">
							<Button
								onClick={() => handleWithdrawCurrencyDrawerOpen(currencyWallet)}
								sx={(theme) => ({
									backgroundColor: "#235789",
									borderRadius: "16px 16px 0 0",
									padding: theme.spacing(1, 6),
									border: "1px solid #BBCBDA",
								})}
							>
								<Typography variant="14-medium" color="white">
									برداشت موجودی
								</Typography>
							</Button>
						</Box>
					</CardContent>
				</WalletCard>
			);
		}

		const pointsWallet = walletData as WalletSchema;
		const totalPoints = Number(pointsWallet?.total_points);
		const tickets = pointsWallet?.total_tickets;
		const currentPoints = Number(pointsWallet?.current_points);
		const requiredPoints = Number(pointsWallet?.required_points);
		const remainingPoints = Number(pointsWallet?.remaining_points);
		const expireDate = isoStringToString(pointsWallet?.expire_time, true, false)
			.split("/")
			.slice(0, 2)
			.join(".");

		const progressPercentage =
			requiredPoints > 0
				? Math.min(100, (currentPoints / requiredPoints) * 100)
				: 0;

		return (
			<WalletCard key={index}>
				<CardHeader>
					<Box display="flex" alignItems="center" gap={1}>
						<ImageBox src="/media/App/wallet/point.svg" />
						<Typography variant="14-medium" color="text.primary">
							{pointsWallet.name}
						</Typography>
					</Box>
					<Box
						display="flex"
						alignItems="center"
						gap={1}
						sx={{ marginLeft: "auto" }}
					>
						<Box display="flex" alignItems="center" gap={0.5}>
							<ImageBox
								src={SCORE_FULL}
								sx={{ borderRadius: "50%" }}
								width={14}
								height={14}
							/>
							<Typography variant="12-regular" color="text.primary">
								{totalPoints} امتیاز کل
							</Typography>
						</Box>
						<Divider orientation="vertical" sx={{ height: 16 }} />
						<Box display="flex" alignItems="center" gap={0.5}>
							<ImageBox
								src={TICKET_V2}
								sx={{ borderRadius: "50%" }}
								width={14}
								height={14}
							/>
							<Typography variant="12-regular" color="text.primary">
								{tickets} بلیط
							</Typography>
						</Box>
					</Box>
				</CardHeader>

				<CardContent>
					<Box display="flex" flexDirection="column" gap="6px">
						<Typography
							variant="12-regular"
							color="text.secondary"
							textAlign="end"
						>
							{requiredPoints} امتیاز
						</Typography>
						<Box position="relative" display="flex" alignItems="center">
							<ImageBox
								src={TICKET_V2}
								sx={{
									borderRadius: "50%",
									flexShrink: 0,
									position: "absolute",
									right: 10,
									zIndex: 1000,
								}}
								width={20}
								height={20}
							/>
							<Box
								position="relative"
								sx={{
									flex: 1,
									display: "flex",
									alignItems: "center",
									height: 16,
								}}
							>
								<ProgressBar
									variant="determinate"
									value={progressPercentage}
									sx={{
										width: "100%",
										"& .MuiLinearProgress-bar": {
											borderRadius: "0 8px 8px 0",
										},
									}}
								/>
								{currentPoints > 0 && (
									<Box
										sx={{
											position: "absolute",
											right: `calc(${100 - progressPercentage}% + 8px)`,
											zIndex: 1,
											whiteSpace: "nowrap",
										}}
									>
										<Typography variant="11-medium" color="common.white">
											{currentPoints} امتیاز
										</Typography>
									</Box>
								)}
							</Box>
						</Box>
						<Typography variant="12-regular" color="text.primary" height={12}>
							امتیاز باقیمانده برای گرفتن بلیط : {remainingPoints}
						</Typography>
						<Typography variant="12-regular" color="rgba(113, 113, 113, 1)">
							تاریخ انقصا: {expireDate}
						</Typography>
						<Box display="flex" justifyContent="center">
							<Button
								onClick={() => {
									handleExchange();
									setMetaData(pointsWallet);
								}}
								sx={(theme) => ({
									backgroundColor: "#FFBA51",
									color: "common.black",
									borderRadius: "16px 16px 0 0",
									padding: theme.spacing(1, 6),
									backgroundImage:
										"linear-gradient(180deg, #FFD391 0%, #FFBA51 93.75%)",
									border: "1px solid #EFB763",
									"&:hover": {
										backgroundColor: "#FFBA51",
									},
								})}
							>
								<Typography variant="14-medium" color="text.primary">
									تبدیل امتیاز به بلیط
								</Typography>
							</Button>
						</Box>
					</Box>
				</CardContent>
			</WalletCard>
		);
	};

	const currentWallet = concatWallets && concatWallets[activeSlideIndex];
	const isPointsWallet = currentWallet && "total_points" in currentWallet;
	const tabsData = currentWallet
		? isPointsWallet
			? walletTabs
			: currencyWalletTabs
		: [];
	const hasTabsData = tabsData && tabsData.length > 0;

	return (
		<PwaAppPageLayout
			sx={{
				mx: 0,
				gap: 2,
			}}
			rightAction={<Back handleBack={handleBack} />}
		>
			<SwiperContainer>
				{isWalletsLoading ? (
					<LoadingContainer>
						<CircularProgress color="error" />
					</LoadingContainer>
				) : walletsFailed ? (
					<EmptyStateContainer role="alert">
						<Typography variant="16-medium" color="text.secondary" textAlign="center">
							کیف پول بارگذاری نشد
						</Typography>
						<Typography variant="12-regular" color="text.disabled" textAlign="center">
							اتصال را بررسی کنید و دوباره تلاش کنید.
						</Typography>
						<Button variant="outlined" size="small" onClick={retryWallets}>
							دوباره تلاش کن
						</Button>
					</EmptyStateContainer>
				) : concatWallets && concatWallets.length > 0 ? (
					<Swiper
						modules={[Navigation]}
						slidesPerView={1.1}
						navigation={false}
						centeredSlides
						spaceBetween={8}
						onSlideChange={(swiper) => setActiveSlideIndex(swiper.activeIndex)}
					>
						{concatWallets.map((card, index) => (
							<SwiperSlide key={index}>
								{renderWalletCard(card, index)}
							</SwiperSlide>
						))}
					</Swiper>
				) : (
					<EmptyStateContainer>
						<ImageBox src={QUESTION_ICON} width={64} height={64} />

						<Typography
							variant="16-medium"
							color="text.secondary"
							textAlign="center"
						>
							کیف پولی یافت نشد
						</Typography>
						<Typography
							variant="12-regular"
							color="text.disabled"
							textAlign="center"
						>
							در حال حاضر هیچ کیف پول فعالی ندارید
						</Typography>
					</EmptyStateContainer>
				)}
			</SwiperContainer>

			{/* Tabs */}
			{currentWallet ? (
				hasTabsData ? (
					<BasicTabs
						tabs={tabsData}
						TabSx={{ fontSize: 13, padding: (theme) => theme.spacing(1) }}
						contentSx={(theme) => ({ padding: theme.spacing(3, 2) })}
						indicatorColor="error.main"
						variants="standard"
						headerSx={{
							borderBottom: "1px solid",
							borderColor: "grey.200",
						}}
					/>
				) : (
					<EmptyStateContainer>
						<ImageBox src={QUESTION_ICON} width={64} height={64} />
						<Typography
							variant="14-medium"
							color="text.secondary"
							textAlign="center"
						>
							اطلاعات تراکنشی برای این کیف پول موجود نیست
						</Typography>
					</EmptyStateContainer>
				)
			) : walletsFailed || (concatWallets && concatWallets.length === 0) ? null : (
				<EmptyStateContainer>
					<ImageBox src={QUESTION_ICON} width={64} height={64} />

					<Typography
						variant="16-medium"
						color="text.secondary"
						textAlign="center"
					>
						کیف پولی یافت نشد
					</Typography>
					<Typography
						variant="12-regular"
						color="text.disabled"
						textAlign="center"
					>
						در حال حاضر هیچ کیف پول فعالی ندارید
					</Typography>
				</EmptyStateContainer>
			)}

			{/* Exchange Drawer */}
			{metaData && (
				<ExchangeDrawer
					open={isDrawerOpen}
					onClose={handleDrawerClose}
					title="تبدیل امتیاز به بلیط"
					metaData={metaData as WalletSchema}
					ticketPrice={ticketPrice ?? 0}
				/>
			)}
			{/* Add Bank Account Drawer */}
			<AddBankAccountDrawer
				open={isAddBankAccountDrawerOpen}
				onClose={() => {
					handleAddBankAccountDrawerClose();
					// If withdraw drawer was open, keep it open
					if (isWithdrawCurrencyDrawerOpen && selectedCurrencyWallet) {
						// Don't close withdraw drawer
					}
				}}
				onAddAccount={handleAddAccount}
				isCreating={isCreatingBankAccount}
			/>
			{/* Withdraw Currency Drawer */}
			{selectedCurrencyWallet && (
				<WithdrawCurrencyDrawer
					open={isWithdrawCurrencyDrawerOpen}
					onClose={handleWithdrawCurrencyDrawerClose}
					currencyWallet={selectedCurrencyWallet}
					bankAccounts={bankAccounts}
					onWithdraw={handleWithdraw}
					onAddIban={handleAddIbanFromWithdraw}
					isWithdrawing={isWithdrawingCurrency}
				/>
			)}
		</PwaAppPageLayout>
	);
}

const SwiperContainer = styled(Box)(() => ({
	width: "100%",
	"& .swiper-slide": {
		height: "100%",
	},
}));

const WalletCard = styled(Box)(({ theme }) => ({
	display: "flex",
	flexDirection: "column",
	borderRadius: theme.shape.borderRadius * 4,
	backgroundColor: " rgba(255, 251, 251, 1)",
	border: "1px solid #FFC1CC",
	overflow: "hidden",
	boxShadow: theme.shadows[2],
	width: "100%",
}));

const CardHeader = styled(Box)(({ theme }) => ({
	display: "flex",
	alignItems: "center",
	gap: theme.spacing(1),
	padding: theme.spacing(2, 2.5),
	paddingBottom: 14,
}));

const CardContent = styled(Box)(({ theme }) => ({
	display: "flex",
	flexDirection: "column",
	gap: theme.spacing(2),
	paddingInline: theme.spacing(2.5),
	paddingBottom: 0,
	paddingTop: 0,
	overflowY: "auto",
}));

const ProgressBar = styled(LinearProgress)(({ theme }) => ({
	height: 24,
	borderRadius: 8,
	backgroundColor: theme.palette.grey[200],
	"& .MuiLinearProgress-bar": {
		borderRadius: 8,
		backgroundColor: "#E63946",
	},
}));

export const HeaderWrapper = styled(Box)(({ theme }) => ({
	display: "flex",
	justifyContent: "space-between",
	alignItems: "center",
	padding: theme.spacing(2, 1),
	paddingBottom: 0,
	width: "95%",
}));

const EmptyStateContainer = styled(Box)(({ theme }) => ({
	display: "flex",
	flexDirection: "column",
	alignItems: "center",
	justifyContent: "center",
	padding: theme.spacing(6, 2),
	gap: theme.spacing(2),
	backgroundColor: theme.palette.grey[50],
	borderRadius: theme.shape.borderRadius * 2,
	border: `1px dashed ${theme.palette.grey[300]}`,
	margin: theme.spacing(2, 0),
	minHeight: "200px",
}));

const LoadingContainer = styled(Box)(({ theme }) => ({
	display: "flex",
	alignItems: "center",
	justifyContent: "center",
	margin: theme.spacing(2, 0),
	minHeight: "200px",
}));
