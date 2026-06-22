"use client";

import { useCallback, useState } from "react";
import type { WheelDataType } from "react-custom-roulette";

import dynamic from "next/dynamic";

import Box from "@libs/components/atoms/Box";
import Button from "@libs/components/atoms/Button";
import Typography from "@libs/components/atoms/Typography";

import styled from "@/libs/styles/styled";

const Wheel = dynamic(
	() => import("react-custom-roulette").then((mod) => mod.Wheel),
	{ ssr: false },
);

interface RouletteConfig {
	outerBorderWidth?: number;
	outerBorderColor?: string;
	innerRadius?: number;
	innerBorderWidth?: number;
	radiusLineWidth?: number;
	radiusLineColor?: string;
	textDistance?: number;
	fontSize?: number;
	fontWeight?: number;
	perpendicularText?: boolean;
	spinDuration?: number;
}

interface Props {
	items: WheelDataType[];
	onStopSpinning?: () => void;
	handleWin?: (prize: string) => void;
	wheelBackgroundColors?: string[];
	title?: string;
	buttonLabel?: string;
	showTicketBadge?: boolean;
	ticketBadgeLabel?: string;
	ticketBadgeCount?: number;
	config?: RouletteConfig;
	emptyPrizeLabel?: string;
	emptyPrizeMessage?: string;
	winMessage?: string;
}

const defaultConfig: RouletteConfig = {
	outerBorderWidth: 5,
	outerBorderColor: "#FFD700",
	innerRadius: 20,
	innerBorderWidth: 0,
	radiusLineWidth: 2,
	radiusLineColor: "#FFD700",
	textDistance: 95,
	fontSize: 12,
	fontWeight: 700,
	perpendicularText: false,
	spinDuration: 0.8,
};

export default function LuckyWheel({
	items,
	onStopSpinning,
	handleWin,
	wheelBackgroundColors = [
		"#FF4444",
		"#3366FF",
		"#FF1493",
		"#00FF66",
		"#FFD700",
		"#FF0066",
	],
	title = "چرخونه شانسی",
	buttonLabel = "بگردون!",
	showTicketBadge = true,
	ticketBadgeLabel = "اعتبار",
	ticketBadgeCount,
	config = {},
	emptyPrizeLabel = "پوچ",
	emptyPrizeMessage = "متاسفانه این دفعه شانس با شما یار نبود",
	winMessage = "تبریک! شما برنده شدید",
}: Readonly<Props>) {
	const [mustSpin, setMustSpin] = useState(false);
	const [prizeNumber, setPrizeNumber] = useState(0);
	const [winner, setWinner] = useState<string | null>(null);
	const [isSpinning, setIsSpinning] = useState(false);

	const finalConfig = { ...defaultConfig, ...config };

	const handleSpinClick = () => {
		if (!isSpinning && items.length > 0) {
			const newPrizeNumber = Math.floor(Math.random() * items.length);
			setPrizeNumber(newPrizeNumber);
			setMustSpin(true);
			setWinner(null);
			setIsSpinning(true);
		}
	};

	const handleWinner = useCallback(
		async (prize: string) => {
			setWinner(prize);
			setIsSpinning(false);

			if (prize !== emptyPrizeLabel) {
				if (typeof window !== "undefined") {
					const confetti = (await import("canvas-confetti")).default;
					await confetti({
						particleCount: 150,
						spread: 80,
						origin: { y: 0.6 },
						colors: ["#FFD700", "#FF1493", "#00FF66", "#3366FF"],
					});
				}
				handleWin?.(prize);
			}
		},
		[handleWin, emptyPrizeLabel],
	);

	return (
		<RouletteContainer>
			<HeaderSection>
				<TitleWrapper>
					<Typography variant="20-bold" color="common.white">
						{title}
					</Typography>
				</TitleWrapper>
				{showTicketBadge && (
					<TicketBadge>
						<Typography variant="12-medium">
							{ticketBadgeLabel}
							{ticketBadgeCount !== undefined && `: ${ticketBadgeCount}`}
						</Typography>
					</TicketBadge>
				)}
			</HeaderSection>

			<WheelSection>
				<WheelWrapper>
					<Wheel
						mustStartSpinning={mustSpin}
						prizeNumber={prizeNumber}
						outerBorderWidth={finalConfig.outerBorderWidth}
						outerBorderColor={finalConfig.outerBorderColor}
						innerRadius={finalConfig.innerRadius}
						innerBorderWidth={finalConfig.innerBorderWidth}
						radiusLineWidth={finalConfig.radiusLineWidth}
						radiusLineColor={finalConfig.radiusLineColor}
						textDistance={finalConfig.textDistance}
						perpendicularText={finalConfig.perpendicularText}
						spinDuration={finalConfig.spinDuration}
						data={items}
						backgroundColors={wheelBackgroundColors}
						textColors={["#ffffff"]}
						fontSize={finalConfig.fontSize}
						fontWeight={finalConfig.fontWeight}
						onStopSpinning={() => {
							setMustSpin(false);
							const prize = items[prizeNumber]?.option ?? "";
							handleWinner(prize);
							onStopSpinning?.();
						}}
					/>
				</WheelWrapper>
			</WheelSection>

			<ActionSection>
				{winner && (
					<WinnerMessage
						className={winner !== emptyPrizeLabel ? "win" : "lose"}
					>
						<Typography variant="14-medium" color="common.white">
							{winner === emptyPrizeLabel
								? emptyPrizeMessage
								: `${winMessage}: ${winner}`}
						</Typography>
					</WinnerMessage>
				)}

				<SpinButton
					onClick={handleSpinClick}
					disabled={isSpinning || items.length === 0}
					variant="contained"
				>
					{isSpinning ? "در حال چرخش..." : buttonLabel}
				</SpinButton>
			</ActionSection>
		</RouletteContainer>
	);
}

const RouletteContainer = styled(Box)(({ theme }) => ({
	display: "flex",
	flexDirection: "column",
	alignItems: "center",
	justifyContent: "space-between",
	gap: theme.spacing(1.5),
	padding: theme.spacing(1.5, 1.5),
	background: "linear-gradient(135deg, #3D1F5C 0%, #1A0B2E 50%, #2D1B4E 100%)",
	borderRadius: "28px",
	position: "relative",
	overflow: "hidden",
	height: "100vh",
	maxHeight: "100dvh",
	boxSizing: "border-box",

	[theme.breakpoints.up("sm")]: {
		padding: theme.spacing(2, 2.5),
		gap: theme.spacing(2),
		borderRadius: "32px",
		height: "auto",
		minHeight: "600px",
		maxHeight: "none",
	},

	"&::before": {
		content: '""',
		position: "absolute",
		top: 0,
		left: 0,
		right: 0,
		bottom: 0,
		background:
			"radial-gradient(circle at 20% 30%, rgba(255, 50, 150, 0.08) 0%, transparent 40%), radial-gradient(circle at 80% 70%, rgba(100, 50, 200, 0.06) 0%, transparent 40%)",
		pointerEvents: "none",
		zIndex: 1,
	},
}));

const HeaderSection = styled(Box)(({ theme }) => ({
	display: "flex",
	alignItems: "center",
	justifyContent: "space-between",
	width: "100%",
	gap: theme.spacing(1.5),
	position: "relative",
	zIndex: 3,
	flexWrap: "nowrap",
	flexShrink: 0,

	[theme.breakpoints.up("sm")]: {
		gap: theme.spacing(2),
	},
}));

const TitleWrapper = styled(Box)(() => ({
	flex: 1,
	textAlign: "left",

	"& .MuiTypography-root": {
		fontSize: "16px",
		lineHeight: "24px",
	},
}));

const TicketBadge = styled(Box)(({ theme }) => ({
	display: "flex",
	alignItems: "center",
	justifyContent: "center",
	backgroundColor: "#FF4081",
	borderRadius: "12px",
	padding: theme.spacing(0.4, 1.2),
	minWidth: "50px",
	textAlign: "center",
	boxShadow: "0 2px 8px rgba(255, 64, 129, 0.35)",
	transition: "transform 0.2s ease",

	[theme.breakpoints.up("sm")]: {
		borderRadius: "16px",
		padding: theme.spacing(0.5, 1.5),
		minWidth: "60px",
	},

	"&:hover": {
		transform: "scale(1.05)",
	},

	"& .MuiTypography-root": {
		color: "#ffffff",
		fontSize: "11px",
		lineHeight: "16.5px",

		[theme.breakpoints.up("sm")]: {
			fontSize: "12px",
			lineHeight: "18px",
		},
	},
}));

const WheelSection = styled(Box)(({ theme }) => ({
	position: "relative",
	display: "flex",
	alignItems: "center",
	justifyContent: "center",
	width: "100%",
	maxWidth: "min(85vw, 450px)",
	aspectRatio: "1",
	margin: "0 auto",
	zIndex: 2,
	flex: "1 1 auto",
	minHeight: 0,

	[theme.breakpoints.up("sm")]: {
		maxWidth: "500px",
	},

	[theme.breakpoints.down("sm")]: {
		maxWidth: "min(85vw, 340px)",
	},
}));

const WheelWrapper = styled(Box)(({ theme: _theme }) => ({
	width: "100%",
	height: "100%",
	display: "flex",
	alignItems: "center",
	justifyContent: "center",
	filter: "drop-shadow(0 0 40px rgba(255, 215, 0, 0.4))",
	transition: "filter 0.3s ease",

	"&:hover": {
		filter: "drop-shadow(0 0 50px rgba(255, 215, 0, 0.5))",
	},

	"& > div": {
		width: "100% !important",
		height: "100% !important",
	},

	"& canvas": {
		maxWidth: "100% !important",
		maxHeight: "100% !important",
		width: "100% !important",
		height: "auto !important",
	},
}));

const ActionSection = styled(Box)(({ theme }) => ({
	display: "flex",
	flexDirection: "column",
	alignItems: "center",
	gap: theme.spacing(1.5),
	width: "100%",
	maxWidth: "350px",
	position: "relative",
	zIndex: 3,
	padding: theme.spacing(0, 1),
	flexShrink: 0,

	[theme.breakpoints.up("sm")]: {
		maxWidth: "400px",
		gap: theme.spacing(2),
	},
}));

const WinnerMessage = styled(Box)(({ theme }) => ({
	backgroundColor: "rgba(255, 255, 255, 0.1)",
	borderRadius: "14px",
	padding: theme.spacing(1.2, 1.5),
	backdropFilter: "blur(10px)",
	border: "1px solid rgba(255, 255, 255, 0.2)",
	textAlign: "center",
	width: "100%",
	animation: "slideUp 0.4s ease-out",

	"&.win": {
		backgroundColor: "rgba(76, 175, 80, 0.15)",
		border: "1px solid rgba(76, 175, 80, 0.4)",
		boxShadow: "0 4px 12px rgba(76, 175, 80, 0.2)",
	},

	"@keyframes slideUp": {
		from: {
			opacity: 0,
			transform: "translateY(15px)",
		},
		to: {
			opacity: 1,
			transform: "translateY(0)",
		},
	},

	"& .MuiTypography-root": {
		lineHeight: 1.5,
		fontSize: "13px",
	},

	[theme.breakpoints.up("sm")]: {
		padding: theme.spacing(1.5, 2),
		borderRadius: "16px",

		"& .MuiTypography-root": {
			fontSize: "14px",
			lineHeight: 1.6,
		},
	},
}));

const SpinButton = styled(Button)(({ theme }) => ({
	borderRadius: "20px",
	padding: "10px 32px",
	fontSize: "14px",
	fontWeight: 700,
	textTransform: "none",
	minWidth: "130px",
	minHeight: "44px",
	backgroundColor: "#FF4081",
	color: "#ffffff",
	transition: "all 0.25s cubic-bezier(0.4, 0, 0.2, 1)",
	boxShadow: "0 4px 14px rgba(255, 64, 129, 0.4)",
	position: "relative",
	overflow: "hidden",

	"&::before": {
		content: '""',
		position: "absolute",
		top: "50%",
		left: "50%",
		width: "0",
		height: "0",
		borderRadius: "50%",
		background: "rgba(255, 255, 255, 0.3)",
		transform: "translate(-50%, -50%)",
		transition: "width 0.6s, height 0.6s",
	},

	"&:hover:not(:disabled)": {
		backgroundColor: "#FF1493",
		boxShadow: "0 6px 20px rgba(255, 64, 129, 0.6)",
		transform: "translateY(-3px) scale(1.02)",

		"&::before": {
			width: "300px",
			height: "300px",
		},
	},

	"&:active:not(:disabled)": {
		transform: "translateY(-1px) scale(0.98)",
		boxShadow: "0 4px 12px rgba(255, 64, 129, 0.5)",
	},

	"&:disabled": {
		backgroundColor: "#999",
		opacity: 0.6,
		cursor: "not-allowed",
		boxShadow: "none",
	},

	[theme.breakpoints.up("sm")]: {
		padding: "12px 40px",
		fontSize: "15px",
		minWidth: "150px",
		minHeight: "48px",
		borderRadius: "22px",
	},
}));
