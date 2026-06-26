import { Fragment } from "react";

import useGetLotteryWinner from "@/api/lottery/hooks/useGetLotteryWinner";
import BilliardBall from "@/_pages/PwaApp/Lottery/components/BilliardBall";
import { DEFAULT_IMAGE } from "@/constants/imagePaths";
import ImageBox from "@/libs/components/ImageBox";
import type { BaseDrawerModalProps } from "@/libs/components/Drawer/BaseDrawer";
import BaseDrawer from "@/libs/components/Drawer/BaseDrawer";
import Box from "@/libs/components/atoms/Box";
import Button from "@/libs/components/atoms/Button";
import Typography from "@/libs/components/atoms/Typography";
import styled from "@/libs/styles/styled";
import { toPersianDigits } from "@/libs/utils/persianNumberConverter";

interface Props extends Omit<BaseDrawerModalProps, "children"> {
	lotteryId?: string;
	winnerId?: string;
	onViewProfile?: () => void;
}

const ACCENT = "#235789";

export default function WinnerDetailDrawer({
	open,
	onClose,
	lotteryId,
	winnerId,
	onViewProfile,
	...rest
}: Readonly<Props>) {
	const { data, isLoading } = useGetLotteryWinner({
		lotteryId,
		winnerId,
		enabled: open && !!lotteryId && !!winnerId,
	});

	const winningNumbers = new Set(data?.lottery_numbers ?? []);
	const tickets = data?.tickets ?? [];

	return (
		<BaseDrawer
			open={open}
			onClose={onClose}
			title="جزییات برنده"
			titleVariant="20-bold"
			{...rest}
		>
			<Box display="flex" flexDirection="column" gap={3} px={2} pb={3}>
				{isLoading || !data ? (
					<Typography
						color="text.secondary"
						textAlign="center"
						sx={{ py: 4, fontSize: 14 }}
					>
						در حال بارگذاری…
					</Typography>
				) : (
					<>
						{/* هدر: راست = آواتار + نام، چپ = مبلغ جایزه */}
						<HeaderRow>
							<Identity>
								<ImageBox
									src={data.avatar || DEFAULT_IMAGE}
									alt={data.username || ""}
									width={32}
									height={32}
									sx={{ borderRadius: "50%", flexShrink: 0 }}
								/>
								<Typography variant="14-medium" color="#3C3C3C">
									{data.username || "—"}
								</Typography>
							</Identity>
							<Typography variant="14-bold" color="#3C3C3C">
								{Number(data.total_prize_amount || 0).toLocaleString("en-US")} تومان
							</Typography>
						</HeaderRow>

						{/* بلیط‌های برنده */}
						<Box display="flex" flexDirection="column" gap={2.5}>
							{tickets.map((ticket, idx) => (
								<Box
									key={ticket.id ?? idx}
									display="flex"
									flexDirection="column"
									gap={1}
								>
									<Typography variant="12-regular" color="#3F3F3F">
										بلیط شماره {toPersianDigits(idx + 1)}
									</Typography>
									<BallsCard>
										{ticket.numbers.map((number, ballIdx) => (
											<Fragment key={`${number}-${ballIdx}`}>
												<BilliardBall
													num={number}
													matched={winningNumbers.has(number)}
												/>
												{ballIdx < ticket.numbers.length - 1 && <BallDivider />}
											</Fragment>
										))}
									</BallsCard>
								</Box>
							))}
						</Box>

						{/* دکمه‌ها */}
						<Box display="flex" gap={2.5}>
							<Button
								fullWidth
								variant="outlined"
								onClick={onClose}
								sx={{
									borderColor: ACCENT,
									color: ACCENT,
									"&:hover": { borderColor: ACCENT },
								}}
							>
								<Typography variant="16-medium" color={ACCENT}>
									بستن
								</Typography>
							</Button>
							<Button
								fullWidth
								variant="contained"
								onClick={onViewProfile}
								sx={{
									backgroundColor: ACCENT,
									"&:hover": { backgroundColor: ACCENT },
								}}
							>
								<Typography variant="16-medium" color="common.white">
									مشاهده پروفایل
								</Typography>
							</Button>
						</Box>
					</>
				)}
			</Box>
		</BaseDrawer>
	);
}

const HeaderRow = styled(Box)({
	display: "flex",
	flexDirection: "row",
	alignItems: "center",
	justifyContent: "space-between",
});

const Identity = styled(Box)(({ theme }) => ({
	display: "flex",
	flexDirection: "row",
	alignItems: "center",
	gap: theme.spacing(1),
}));

const BallsCard = styled(Box)({
	display: "flex",
	flexDirection: "row",
	alignItems: "center",
	justifyContent: "space-between",
	backgroundColor: "#fff",
	border: "1px solid #E5E5E5",
	borderRadius: 8,
	padding: 12,
});

const BallDivider = styled(Box)({
	width: "1px",
	height: 19,
	backgroundColor: "#D4D4D4",
	flexShrink: 0,
});
