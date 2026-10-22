import React, { useCallback, useState } from "react";

import { useRouter } from "next/navigation";

import ImageBox from "@libs/components/ImageBox";
import Box from "@libs/components/atoms/Box";
import Button from "@libs/components/atoms/Button";
import InputAdornment from "@libs/components/atoms/InputAdornment";
import TextFieldAtom from "@libs/components/atoms/TextField";
import Typography from "@libs/components/atoms/Typography";
import styled from "@libs/styles/styled";
// eslint-disable-next-line no-restricted-imports
import { Divider } from "@mui/material";

import type { WalletSchema } from "@/api/wallet/types/getPointsSummaryType";
import { HINT_STAR, SCORE_FULL, TICKET_V2 } from "@/constants/imagePaths";
import { BUY_TICKET } from "@/constants/routes";
import type { BaseDrawerModalProps } from "@/libs/components/Drawer/BaseDrawer";
import BaseDrawer from "@/libs/components/Drawer/BaseDrawer";
import { addSearchParamsToUrl } from "@/libs/utils/urls";

interface Props extends Omit<BaseDrawerModalProps, "children"> {
	metaData: WalletSchema;
	ticketPrice: number | string;
	/** The lottery whose price is shown: the purchase is bound to this offer. */
	lotteryId?: string;
}

export default function ExchangeDrawer({
	open,
	sx,
	metaData,
	ticketPrice,
	lotteryId,
	...restProps
}: Readonly<Props>) {
	const [ticketCount, setTicketCount] = useState(1);
	const { push } = useRouter();

	const numericPoints = Number(metaData.amount) || 0;
	const numericTicketPrice = Number(ticketPrice) || 0;
	const totalNeededPoints = ticketCount * numericTicketPrice;
	const hasEnoughPoints = numericPoints >= totalNeededPoints;

	const maxPossibleTickets =
		numericTicketPrice > 0 ? Math.floor(numericPoints / numericTicketPrice) : 0;

	const handleTicketCountChange = useCallback(
		(e: React.ChangeEvent<HTMLInputElement>) => {
			const inputValue = e.target.value;

			if (inputValue === "") {
				setTicketCount(0);
				return;
			}

			let value = Number(inputValue);

			value = Math.max(0, value);

			if (maxPossibleTickets > 0 && value > maxPossibleTickets) {
				setTicketCount(maxPossibleTickets);
			} else {
				setTicketCount(value);
			}
		},
		[maxPossibleTickets],
	);

	const handleBuyTicketClick = useCallback(() => {
		if (hasEnoughPoints && ticketCount > 0) {
			// No ticket is created here. We only carry the desired count to the
			// number-selection page; each ticket is created (and paid for) when its
			// numbers are submitted there.
			if (restProps.onClose) {
				restProps.onClose();
			}
			push(
				addSearchParamsToUrl(BUY_TICKET.path, {
					count: String(ticketCount),
					// The offer accepted here (lottery + price shown): every ticket of this purchase
					// is bought at it, or refused if it changed.
					...(lotteryId ? { lottery: lotteryId, price: String(numericTicketPrice) } : {}),
				}),
			);
		}
	}, [hasEnoughPoints, ticketCount, push, restProps, lotteryId, numericTicketPrice]);

	return (
		<BaseDrawer
			open={open}
			title="تبدیل امتیاز به بلیط"
			titleVariant="20-bold"
			sx={{
				"& .MuiDrawer-paper": (theme) => ({
					borderTopLeftRadius: theme.shape.borderRadius * 6,
					borderTopRightRadius: theme.shape.borderRadius * 6,
				}),
				...sx,
			}}
			{...restProps}
		>
			<DrawerContent>
				<Box display="flex" flexDirection="column" gap={3}>
					{/* Current Balances */}
					<Box display="flex" flexDirection="column" gap={1.5}>
						<BalanceRow>
							<ImageBox src={SCORE_FULL} width={16} height={16} />
							<Typography variant="14-regular" color="text.primary">
								امتیازات شما : {metaData.amount} امتیاز
							</Typography>
							<Divider orientation="vertical" sx={{ height: 16 }} />
							<ImageBox src={TICKET_V2} width={16} height={16} />
							<Typography variant="14-regular" color="text.primary">
								بلیط های شما : {metaData.total_tickets}
							</Typography>
						</BalanceRow>
					</Box>

					<Box display="flex" flexDirection="column" gap={2}>
						<Box>
							<Typography
								variant="12-regular"
								color="text.secondary"
								sx={{ mb: 1 }}
							>
								تعداد بلیط
							</Typography>
							<TextFieldAtom
								type="number"
								value={ticketCount}
								onChange={handleTicketCountChange}
								inputProps={{
									min: 0,
									max: maxPossibleTickets,
									step: 1,
								}}
								InputProps={{
									endAdornment: (
										<InputAdornment position="end">
											<TicketButton>
												<ImageBox src={TICKET_V2} width={16} height={16} />
												<Typography variant="12-regular" color="text.primary">
													بلیط
												</Typography>
											</TicketButton>
										</InputAdornment>
									),
								}}
							/>
						</Box>
						<Box>
							<Typography
								variant="12-regular"
								color="text.secondary"
								sx={{ mb: 1 }}
							>
								تعداد امتیاز
							</Typography>
							<TextFieldAtom
								disabled
								value={totalNeededPoints}
								InputProps={{
									endAdornment: (
										<InputAdornment position="end">
											<PointsButton>
												<ImageBox src={SCORE_FULL} width={16} height={16} />
												<Typography variant="12-regular" color="text.primary">
													امتیازها
												</Typography>
											</PointsButton>
										</InputAdornment>
									),
								}}
							/>
						</Box>
					</Box>

					<HintWrapper>
						<ImageBox src={HINT_STAR} width={20} height={20} />
						<Typography variant="14-medium" color="text.primary">
							بعد از دریافت بلیط، امکان عودت امتیاز وجود ندارد!
						</Typography>
					</HintWrapper>

					<StyledButton
						onClick={handleBuyTicketClick}
						disabled={!hasEnoughPoints || ticketCount <= 0}
						fullWidth
					>
						<Typography variant="14-medium" color="text.primary">
							خرید بلیط
						</Typography>
					</StyledButton>
				</Box>
			</DrawerContent>
		</BaseDrawer>
	);
}

const DrawerContent = styled(Box)(({ theme }) => ({
	padding: theme.spacing(3, 2),
	paddingBottom: theme.spacing(4),
	display: "flex",
	flexDirection: "column",
	gap: theme.spacing(2),
}));

const BalanceRow = styled(Box)(({ theme }) => ({
	display: "flex",
	alignItems: "center",
	gap: theme.spacing(1),
}));

const TicketButton = styled(Box)(({ theme }) => ({
	display: "flex",
	alignItems: "center",
	gap: theme.spacing(0.5),
	padding: theme.spacing(0.5, 1),
	backgroundColor: theme.palette.grey[100],
	borderRadius: theme.shape.borderRadius,
}));

const PointsButton = styled(Box)(({ theme }) => ({
	display: "flex",
	alignItems: "center",
	gap: theme.spacing(0.5),
	padding: theme.spacing(0.5, 1),
	backgroundColor: theme.palette.grey[100],
	borderRadius: theme.shape.borderRadius,
}));

const HintWrapper = styled(Box)(({ theme }) => ({
	display: "flex",
	alignItems: "center",
	gap: theme.spacing(1),
	padding: theme.spacing(1.5, 2),
	border: "1px solid #C6CBF7",
	backgroundColor: "#EAF3FF",
	borderRadius: theme.shape.borderRadius * 2,
}));

const StyledButton = styled(Button)(({ theme, disabled }) => ({
	backgroundColor: "#FFBA51",
	color: "common.black",
	borderRadius: "8px",
	padding: theme.spacing(1.5, 2),
	backgroundImage: "linear-gradient(180deg, #FFD391 0%, #FFBA51 93.75%)",
	border: "1px solid #EFB763",

	"&:hover": {
		backgroundColor: "#FFBA51",
	},

	...(disabled && {
		opacity: 0.5,
		backgroundColor: "#cccccc",
		backgroundImage: "none",
		border: "1px solid #999999",
		color: "#666666",
		cursor: "not-allowed",

		"&:hover": {
			backgroundColor: "#cccccc",
		},
	}),
}));
