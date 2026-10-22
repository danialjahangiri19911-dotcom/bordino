import type { ReactNode } from "react";
import { Fragment, useEffect, useState } from "react";

import useShowRemainingTime from "@/libs/components/common/BigLotteryCountdown/ShowRemainingTime/useShowRemainingTime";
import type { BoxProps } from "@libs/components/atoms/Box";
import Box from "@libs/components/atoms/Box";
import Divider from "@libs/components/atoms/Divider";
import Typography from "@libs/components/atoms/Typography";
import styled from "@libs/styles/styled";

interface Props {
	giftPrice: number;
	remainingTime: number;
	title?: string;
	onShowDetails?: () => void;
	sx?: BoxProps["sx"];
	extraContent?: ReactNode;
	/** Is a lottery running? Without one there is no prize or time to show (not "0 تومان, 00:00"). */
	active?: boolean;
}

export default function HomeBigLotteryCountdown({
	giftPrice,
	remainingTime,
	title = "قرعه‌کشی بزرگ 💸",
	onShowDetails,
	sx,
	extraContent,
	active = true,
}: Readonly<Props>) {
	const [count, setCount] = useState<number>(remainingTime);

	// Counted down to a fixed moment, not one second per tick: a phone that slept or a tab in
	// the background shows the right time again as soon as it is back.
	useEffect(() => {
		const deadline = Date.now() + remainingTime * 1000;
		const tick = () => setCount(Math.max(0, Math.round((deadline - Date.now()) / 1000)));
		tick();
		const interval = setInterval(tick, 1000);
		document.addEventListener("visibilitychange", tick);
		return () => {
			clearInterval(interval);
			document.removeEventListener("visibilitychange", tick);
		};
	}, [remainingTime]);

	const formatTime = useShowRemainingTime({ seconds: count });

	return (
		<Wrapper sx={sx}>
			<Box display="flex" justifyContent="space-between" alignItems="center">
				<Typography variant="12-medium" sx={{ color: "#404040" }}>
					{title}
				</Typography>
				{onShowDetails && (
					<Typography
						variant="12-medium"
						color="secondary.600"
						sx={{ cursor: "pointer" }}
						onClick={onShowDetails}
					>
						توضیحات
					</Typography>
				)}
			</Box>

			<Box display="flex" flexDirection="column" alignItems="center">
				<Banner sx={{ width: "100%" }}>
					<Box
						component="img"
						src="/media/App/main/bigLottery/loon-left.png"
						alt=""
						sx={{ ...mascotSx, left: "-60px", top: "20px" }}
					/>
					<Box
						component="img"
						src="/media/App/main/bigLottery/loon-right.png"
						alt=""
						sx={{ ...mascotSx, right: "-27px", top: "-35px" }}
					/>

					{!active ? (
						<Content>
							<Typography variant="14-bold" sx={{ color: "#F9F9F9", textAlign: "center" }}>
								قرعه‌کشی فعالی در حال حاضر نیست
							</Typography>
							<Typography variant="12-regular" sx={{ color: "#EDEDED", textAlign: "center" }}>
								قرعه‌کشی بعدی به‌زودی اعلام می‌شود.
							</Typography>
						</Content>
					) : (
					<Content>
						<Box display="flex" flexDirection="row" alignItems="center" gap="4px">
							<Typography variant="14-medium" sx={{ color: "#EDEDED" }}>
								مبلغ جایزه:
							</Typography>
							<Typography variant="14-bold" sx={{ color: "#F9F9F9" }}>
								{giftPrice.toLocaleString("fa-IR")} تومان
							</Typography>
						</Box>

						{count <= 0 ? (
							// Sales closed; the server draws the numbers within a few minutes.
							<Typography variant="14-medium" sx={{ color: "#F9F9F9" }} role="status">
								زمان خرید بلیط تمام شد؛ نتیجه به‌زودی اعلام می‌شود.
							</Typography>
						) : (
						<TimerRow>
							{Object.entries(formatTime).map(([label, value], index, arr) => (
								<Fragment key={label}>
									<Unit>
										<Typography variant="11-medium" sx={{ color: "#EDEDED" }}>
											{label}
										</Typography>
										<DigitBox>
											<Typography
												variant="14-medium"
												sx={{
													color: "#404040",
													fontVariantNumeric: "tabular-nums",
												}}
											>
												{String(value).padStart(2, "0")}
											</Typography>
										</DigitBox>
									</Unit>
									{index < arr.length - 1 && (
										<Divider
											orientation="vertical"
											flexItem
											sx={{ height: "32px", borderColor: "#CBCBCB" }}
										/>
									)}
								</Fragment>
							))}
						</TimerRow>
						)}
					</Content>
					)}
				</Banner>
				{extraContent}
			</Box>
		</Wrapper>
	);
}

const Wrapper = styled(Box)(({ theme }) => ({
	display: "flex",
	flexDirection: "column",
	gap: theme.spacing(1),
}));

const Banner = styled(Box)(({ theme }) => ({
	position: "relative",
	overflow: "hidden",
	minHeight: "75px",
	borderRadius: "16px",
	backgroundColor: theme.palette.primary[500],
	border: "1px solid #FBE2E6",
	display: "flex",
	alignItems: "center",
	justifyContent: "center",
}));

const mascotSx: BoxProps["sx"] = {
	position: "absolute",
	width: "96px",
	height: "72px",
	objectFit: "contain",
	zIndex: 0,
	pointerEvents: "none",
};

const Content = styled(Box)(({ theme }) => ({
	position: "relative",
	zIndex: 1,
	display: "flex",
	flexDirection: "column",
	alignItems: "center",
	justifyContent: "center",
	gap: theme.spacing(1),
	padding: theme.spacing(1, 0),
}));

const TimerRow = styled(Box)(({ theme }) => ({
	display: "flex",
	flexDirection: "row-reverse",
	alignItems: "center",
	gap: theme.spacing(1),
}));

const Unit = styled(Box)(({ theme }) => ({
	display: "flex",
	flexDirection: "row-reverse",
	alignItems: "center",
	gap: theme.spacing(0.5),
}));

const DigitBox = styled(Box)(({ theme }) => ({
	width: "30px",
	height: "31px",
	flexShrink: 0,
	boxSizing: "border-box",
	display: "flex",
	alignItems: "center",
	justifyContent: "center",
	borderRadius: "4px",
	border: `1px solid ${theme.palette.primary[100]}`,
	backgroundColor: theme.palette.common.white,
}));
