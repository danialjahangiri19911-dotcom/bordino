"use client";

import { useCallback, useEffect, useState } from "react";
import type { WheelDataType } from "react-custom-roulette";

import dynamic from "next/dynamic";

import Box from "@libs/components/atoms/Box";
import Button from "@libs/components/atoms/Button";
import Typography from "@libs/components/atoms/Typography";

import WinDialog from "./WinDialog";
import PointsChip from "@/libs/components/common/PointsChip";
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
	config?: RouletteConfig;
	emptyPrizeLabel?: string;
	onBack?: () => void;
	/** بازگشت به خانه از مودالِ برد */
	onHome?: () => void;
	/** ضریب انتخابی به‌والد گزارش می‌شود (مثلاً "5x") */
	onMultiplierChange?: (multiplier: string) => void;
	defaultMultiplier?: string;
	/**
	 * چرخشِ سرور-محور: با کلیک «بگردون!» صدا زده می‌شود و باید اندیسِ اسلایسِ
	 * برنده را برگرداند (Promise). در نبودش، انتخابِ تصادفیِ کلاینت (حالتِ دمو).
	 */
	onSpinRequest?: () => Promise<number>;
}

const defaultConfig: RouletteConfig = {
	outerBorderWidth: 10,
	outerBorderColor: "#F0AC46",
	innerRadius: 15,
	innerBorderWidth: 0,
	radiusLineWidth: 2,
	radiusLineColor: "#D69136",
	textDistance: 75,
	fontSize: 18,
	fontWeight: 700,
	perpendicularText: false,
	spinDuration: 0.8,
};

/**
 * مرکز هر سلولِ ضریب به‌صورت درصدِ تصویرِ بنر (از مختصات Figma استخراج شده).
 * badgeW = عرضِ badge طلایی برای آن سلول، به‌صورت درصد عرض بنر.
 * badgeImg = تصویرِ بیک‌شدهٔ Figma برای حالتِ انتخاب‌شده؛ نبود → fallback (badge خالی + عدد).
 */
interface MultiplierCell {
	value: string;
	cx: number;
	cy: number;
	badgeW: number;
	/** تصویرِ بیک‌شدهٔ Figma برای حالتِ انتخاب‌شده */
	badgeImg?: string;
	/** آیا عدد داخل تصویر بیک شده؟ اگر نه، عدد را با کد روی badge می‌گذاریم */
	bakedNumber?: boolean;
}

const MULTIPLIERS: MultiplierCell[] = [
	{ value: "5x", cx: 14.7, cy: 25.6, badgeW: 33.0 },
	{
		value: "4x",
		cx: 36.3,
		cy: 28.8,
		badgeW: 28.4,
		badgeImg: "/media/App/wheel/badge-4x.png",
		bakedNumber: true,
	},
	{
		value: "3x",
		cx: 55.3,
		cy: 38.7,
		badgeW: 35.3,
		badgeImg: "/media/App/wheel/badge-3x.png",
		bakedNumber: true,
	},
	{
		value: "2x",
		cx: 70.7,
		cy: 54.4,
		badgeW: 37.6,
		badgeImg: "/media/App/wheel/badge-2x.png",
	},
	{
		value: "1x",
		cx: 84.7,
		cy: 80.3,
		badgeW: 30.3,
		badgeImg: "/media/App/wheel/badge-1x.png",
	},
];

/* موقعیت overlayها نسبت به قطر گردونه (از Figma) */
const RIBBON = { left: 44.4, top: -21.5, width: 58.6 };
const POINTER = { left: 50, top: -1, width: 7 };

const LED_COUNT = 16;
const LED_RADIUS_PCT = 46;

function LedRing({ isSpinning }: Readonly<{ isSpinning: boolean }>) {
	const [activeIdx, setActiveIdx] = useState(0);

	useEffect(() => {
		const ms = isSpinning ? 70 : 280;
		const id = setInterval(
			() => setActiveIdx((p) => (p + 1) % LED_COUNT),
			ms,
		);
		return () => clearInterval(id);
	}, [isSpinning]);

	return (
		<>
			{Array.from({ length: LED_COUNT }).map((_, i) => {
				const rad = (i * 2 * Math.PI) / LED_COUNT - Math.PI / 2;
				const left = 50 + LED_RADIUS_PCT * Math.cos(rad);
				const top = 50 + LED_RADIUS_PCT * Math.sin(rad);
				const isOn =
					i === activeIdx ||
					i === (activeIdx + LED_COUNT / 2) % LED_COUNT;
				return (
					<Led
						key={i}
						style={{
							left: `${left}%`,
							top: `${top}%`,
							transform: "translate(-50%, -50%)",
							background: isOn ? "#F9D55F" : "#8D5808",
							boxShadow: isOn
								? "0 0 6px #F9D55F, 0 0 12px #F0AC46"
								: "none",
						}}
					/>
				);
			})}
		</>
	);
}

export default function LuckyWheel({
	items,
	onStopSpinning,
	handleWin,
	wheelBackgroundColors = [
		"#4459D8",
		"#E64056",
		"#4459D8",
		"#7B3FC0",
		"#4459D8",
		"#E64056",
		"#4459D8",
		"#7B3FC0",
	],
	title = "💫 چرخونه شانسی 💫",
	buttonLabel = "بگردون!",
	showTicketBadge = true,
	config = {},
	emptyPrizeLabel = "پوچ",
	onBack,
	onHome,
	onMultiplierChange,
	defaultMultiplier = "5x",
	onSpinRequest,
}: Readonly<Props>) {
	const [mustSpin, setMustSpin] = useState(false);
	const [prizeNumber, setPrizeNumber] = useState(0);
	const [winner, setWinner] = useState<string | null>(null);
	const [isSpinning, setIsSpinning] = useState(false);
	const [winOpen, setWinOpen] = useState(false);
	const [selectedMultiplier, setSelectedMultiplier] =
		useState(defaultMultiplier);

	const finalConfig = { ...defaultConfig, ...config };

	const handleSelectMultiplier = (value: string) => {
		if (isSpinning) return;
		setSelectedMultiplier(value);
		onMultiplierChange?.(value);
	};

	const handleSpinClick = async () => {
		if (isSpinning || items.length === 0) return;
		setWinner(null);

		if (onSpinRequest) {
			// چرخشِ سرور-محور: اول جایزه را از سرور بگیر، بعد روی همان بایست
			setIsSpinning(true);
			try {
				const idx = await onSpinRequest();
				const safeIdx = idx >= 0 && idx < items.length ? idx : 0;
				setPrizeNumber(safeIdx);
				setMustSpin(true);
			} catch {
				// خطا (امتیاز ناکافی/سقف چرخش) را interceptor سراسری toast می‌کند
				setIsSpinning(false);
			}
			return;
		}

		// حالتِ دمو: انتخابِ تصادفیِ کلاینت
		const newPrizeNumber = Math.floor(Math.random() * items.length);
		setPrizeNumber(newPrizeNumber);
		setMustSpin(true);
		setIsSpinning(true);
	};

	const handleWinner = useCallback(
		async (prize: string) => {
			setWinner(prize);
			setIsSpinning(false);
			setWinOpen(true); // مودال برای برد و پوچ باز می‌شود

			if (prize !== emptyPrizeLabel) {
				if (typeof window !== "undefined") {
					const confetti = (await import("canvas-confetti")).default;
					await confetti({
						particleCount: 150,
						spread: 80,
						origin: { y: 0.6 },
						colors: ["#F0AC46", "#F9D55F", "#D69136", "#DB9E2C"],
					});
				}
				handleWin?.(prize);
			}
		},
		[handleWin, emptyPrizeLabel],
	);

	const handleSpinAgain = () => {
		setWinOpen(false);
		setWinner(null);
		// چرخش مجدد از همان مسیرِ handleSpinClick (سرور-محور یا دمو)
		void handleSpinClick();
	};

	const activeCell = MULTIPLIERS.find((m) => m.value === selectedMultiplier);

	return (
		<PageContainer>
			{/* ─── Header ─── */}
			<HeaderRow>
				{/* امتیاز کیف‌پول — سمت چپ در RTL */}
				<Box>{showTicketBadge && <PointsChip />}</Box>

				{/* عنوان — وسط */}
				<TitleWrapper>
					<Typography
						variant="16-medium"
						sx={{ color: "#F9F9F9", textAlign: "center" }}
					>
						{title}
					</Typography>
				</TitleWrapper>

				{/* بازگشت — سمت راست در RTL */}
				{onBack ? (
					<BackButton onClick={onBack}>
						<Typography variant="16-medium" sx={{ color: "#F9F9F9" }}>
							بازگشت
						</Typography>
						<ChevronLeft viewBox="0 0 16 16">
							<path
								fillRule="evenodd"
								clipRule="evenodd"
								d="M10.6013 3.14624C10.7969 3.34187 10.7969 3.65905 10.6013 3.85468L6.45451 8.00144L10.6013 12.1482C10.7969 12.3438 10.7969 12.661 10.6013 12.8566C10.4056 13.0523 10.0884 13.0523 9.89282 12.8566L5.39179 8.35566C5.19616 8.16003 5.19616 7.84285 5.39179 7.64721L9.89282 3.14624C10.0884 2.9506 10.4056 2.9506 10.6013 3.14624Z"
								fill="#F9F9F9"
							/>
						</ChevronLeft>
					</BackButton>
				) : (
					<PlaceholderBox />
				)}
			</HeaderRow>

			{/* ─── Wheel ─── */}
			<WheelSection>
				{/* بنر قوسی ضریب‌ها (تعاملی): انتخاب هر سلول → طلایی شدن */}
				<RibbonStage
					style={{
						left: `${RIBBON.left}%`,
						top: `${RIBBON.top}%`,
						width: `${RIBBON.width}%`,
					}}
				>
					<RibbonImg
						src="/media/App/wheel/multiplier-ribbon.png"
						alt=""
						draggable={false}
					/>

					{/* badge طلاییِ سلولِ انتخاب‌شده */}
					{activeCell && (
						<BadgeWrap
							style={{
								left: `${activeCell.cx}%`,
								top: `${activeCell.cy}%`,
								width: `${activeCell.badgeW}%`,
								transform: "translate(-50%, -58%)",
							}}
						>
							<img
								src={
									activeCell.badgeImg ??
									"/media/App/wheel/multiplier-badge-blank.png"
								}
								alt={selectedMultiplier}
								draggable={false}
								style={{ width: "100%", display: "block" }}
							/>
							{!activeCell.bakedNumber && (
								<BadgeNumber>{selectedMultiplier}</BadgeNumber>
							)}
						</BadgeWrap>
					)}

					{/* نواحی کلیکِ هر سلول */}
					{MULTIPLIERS.map((m) => (
						<CellHit
							key={m.value}
							aria-label={m.value}
							onClick={() => handleSelectMultiplier(m.value)}
							style={{
								left: `${m.cx}%`,
								top: `${m.cy}%`,
								transform: "translate(-50%, -50%)",
							}}
						/>
					))}
				</RibbonStage>

				<WheelGlow />

				{/* دکورِ گردونه: حلقهٔ طلایی → tire قهوه‌ای → حلقهٔ داخلی → پره‌ها → هاب */}
				<GoldRing>
					<Tire />
					<InnerGold />

					{/*
					 * react-custom-roulette پرهٔ برنده را در ۳۱۷° (۴۷° راستِ بالا، محلِ
					 * سوزنِ پیش‌فرضِ خودش) متوقف می‌کند. دیسک را ۴۷° پادساعتگرد می‌چرخانیم
					 * تا برنده دقیقاً زیرِ سوزنِ بالا-وسطِ ما بایستد. inline تا RTL-plugin فلیپ نکند.
					 */}
					<SliceArea style={{ transform: "rotate(-47deg)" }}>
						{items.length > 0 && (
							<Wheel
								mustStartSpinning={mustSpin}
								prizeNumber={prizeNumber}
								outerBorderWidth={0}
								innerRadius={0}
								innerBorderWidth={0}
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
								pointerProps={{ style: { display: "none" } }}
								onStopSpinning={() => {
									setMustSpin(false);
									const prize = items[prizeNumber]?.option ?? "";
									handleWinner(prize);
									onStopSpinning?.();
								}}
							/>
						)}
					</SliceArea>

					<LedRing isSpinning={isSpinning} />

					{/* هابِ طلاییِ مرکز با آیکون چرخش */}
					<Hub>
						<svg viewBox="0 0 24 24" width="58%" height="58%" aria-hidden>
							<path
								d="M17.65 6.35A7.95 7.95 0 0 0 12 4a8 8 0 1 0 7.73 10h-2.08A6 6 0 1 1 12 6c1.66 0 3.14.69 4.22 1.78L13 11h7V4l-2.35 2.35Z"
								fill="#6E3A12"
							/>
						</svg>
					</Hub>
				</GoldRing>

				{/* سوزن قرمزِ بالای گردونه (روی حلقهٔ بیرونی، رو به پایین) */}
				<Pointer
					viewBox="0 0 24 44"
					aria-hidden
					style={{
						left: `${POINTER.left}%`,
						top: `${POINTER.top}%`,
						width: `${POINTER.width}%`,
						transform: "translateX(-50%)",
					}}
				>
					<path d="M5.5 15 L18.5 15 L12 41 Z" fill="#D9962F" />
					<circle cx="12" cy="12.5" r="11.5" fill="#E8C25E" />
					<circle cx="12" cy="12.5" r="9.3" fill="#C98A2A" />
					<circle cx="12" cy="12.5" r="6.8" fill="#E12D45" />
				</Pointer>
			</WheelSection>

			{/* ─── Action ─── */}
			<ActionSection>
				<SpinButton
					onClick={() => void handleSpinClick()}
					disabled={isSpinning || items.length === 0}
					variant="contained"
				>
					{isSpinning ? "در حال چرخش..." : buttonLabel}
				</SpinButton>
			</ActionSection>

			{/* مودالِ نتیجه (برد یا پوچ) */}
			<WinDialog
				open={winOpen}
				prize={winner ?? ""}
				isEmpty={winner === emptyPrizeLabel}
				onClose={() => setWinOpen(false)}
				onSpinAgain={handleSpinAgain}
				onHome={onHome ?? onBack}
			/>
		</PageContainer>
	);
}

/* ─── Styled ─── */

const PageContainer = styled(Box)({
	display: "flex",
	flexDirection: "column",
	alignItems: "center",
	gap: 12,
	padding: "12px 16px 40px",
	background: "#240620",
	position: "relative",
	overflowX: "hidden",
	minHeight: "100vh",
	boxSizing: "border-box",
	direction: "rtl",
});

const HeaderRow = styled(Box)({
	display: "flex",
	alignItems: "center",
	justifyContent: "space-between",
	width: "100%",
	paddingTop: 4,
});

const TitleWrapper = styled(Box)({
	flex: 1,
	textAlign: "center",
	padding: "0 8px",
});

const BackButton = styled(Box)({
	display: "flex",
	alignItems: "center",
	gap: 2,
	cursor: "pointer",
	minWidth: 79,
	justifyContent: "flex-end",
	userSelect: "none",
});

const ChevronLeft = styled("svg")({
	width: 18,
	height: 18,
	flexShrink: 0,
});

const PlaceholderBox = styled(Box)({
	minWidth: 79,
});

const WheelSection = styled(Box)({
	position: "relative",
	width: "100%",
	maxWidth: 340,
	aspectRatio: "1",
	margin: "84px auto 0",
	display: "flex",
	alignItems: "center",
	justifyContent: "center",
});

/** ظرفِ بنر — دقیقاً روی تصویرِ بنر می‌نشیند تا overlayها نسبت به همان قاب درصدی شوند */
const RibbonStage = styled(Box)({
	position: "absolute",
	zIndex: 8,
	pointerEvents: "none",
	filter: "drop-shadow(0 4px 6px rgba(0,0,0,0.35))",
});

const RibbonImg = styled("img")({
	width: "100%",
	display: "block",
	pointerEvents: "none",
});

const BadgeWrap = styled(Box)({
	position: "absolute",
	containerType: "inline-size",
	pointerEvents: "none",
	zIndex: 2,
	filter: "drop-shadow(0 3px 4px rgba(0,0,0,0.45))",
});

const BadgeNumber = styled("span")({
	position: "absolute",
	inset: 0,
	display: "flex",
	alignItems: "center",
	justifyContent: "center",
	paddingBottom: "12%",
	color: "#F6C453",
	fontFamily: "'Lobster', 'Georgia', serif",
	fontStyle: "italic",
	fontWeight: 700,
	fontSize: "46cqw",
	lineHeight: 1,
	textShadow: "0 2px 3px rgba(0,0,0,0.45)",
	pointerEvents: "none",
});

const CellHit = styled("button")({
	position: "absolute",
	width: "18%",
	height: "30%",
	padding: 0,
	margin: 0,
	border: "none",
	background: "transparent",
	cursor: "pointer",
	pointerEvents: "auto",
	zIndex: 3,
	borderRadius: "50%",
	WebkitTapHighlightColor: "transparent",
});

const Pointer = styled("svg")({
	position: "absolute",
	zIndex: 9,
	height: "auto",
	pointerEvents: "none",
	filter: "drop-shadow(0 2px 4px rgba(0,0,0,0.45))",
});

const Led = styled(Box)({
	position: "absolute",
	width: "2.6%",
	height: "2.6%",
	borderRadius: "50%",
	transition: "background 0.08s, box-shadow 0.08s",
	zIndex: 5,
	pointerEvents: "none",
});

const WheelGlow = styled(Box)({
	position: "absolute",
	inset: "-6%",
	borderRadius: "50%",
	background:
		"radial-gradient(circle at 50% 50%, rgba(203,48,224,0.30) 0%, rgba(230,64,86,0.18) 45%, transparent 70%)",
	pointerEvents: "none",
	zIndex: 0,
});

/** حلقهٔ طلاییِ بیرونی (کلِ قطرِ گردونه) */
const GoldRing = styled(Box)({
	position: "absolute",
	inset: 0,
	borderRadius: "50%",
	background:
		"radial-gradient(circle at 35% 28%, #FBE48F 0%, #F0AC46 48%, #C8881F 100%)",
	boxShadow:
		"inset 0 0 0 2px #F9D55F, inset 0 -8px 14px rgba(0,0,0,0.35), 0 8px 20px rgba(0,0,0,0.45)",
	zIndex: 1,
});

/** حلقهٔ قهوه‌ایِ tire */
const Tire = styled(Box)({
	position: "absolute",
	inset: "7.5%",
	borderRadius: "50%",
	background: "radial-gradient(circle at 35% 28%, #A9701F 0%, #7A4A07 100%)",
	boxShadow: "inset 0 2px 5px rgba(0,0,0,0.5)",
	zIndex: 2,
});

/** حلقهٔ طلاییِ نازکِ داخلی */
const InnerGold = styled(Box)({
	position: "absolute",
	inset: "10%",
	borderRadius: "50%",
	background: "linear-gradient(180deg, #F9D55F 0%, #D69136 100%)",
	zIndex: 3,
});

/** ناحیهٔ پره‌های چرخان (react-custom-roulette) */
const SliceArea = styled(Box)({
	position: "absolute",
	inset: "11.5%",
	borderRadius: "50%",
	overflow: "hidden",
	display: "flex",
	alignItems: "center",
	justifyContent: "center",
	zIndex: 4,

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
});

/** هابِ طلاییِ مرکز */
const Hub = styled(Box)({
	position: "absolute",
	left: "50%",
	top: "50%",
	width: "17%",
	height: "17%",
	transform: "translate(-50%, -50%)",
	borderRadius: "50%",
	background:
		"radial-gradient(circle at 35% 30%, #FBE48F 0%, #F0AC46 55%, #C8881F 100%)",
	border: "2px solid #F9D55F",
	boxShadow: "0 2px 6px rgba(0,0,0,0.5), inset 0 -2px 4px rgba(0,0,0,0.3)",
	display: "flex",
	alignItems: "center",
	justifyContent: "center",
	zIndex: 6,
});

const ActionSection = styled(Box)({
	display: "flex",
	flexDirection: "column",
	alignItems: "center",
	gap: 16,
	width: "100%",
	marginTop: 24,
	position: "relative",
	zIndex: 3,
});

const SpinButton = styled(Button)({
	borderRadius: 16,
	padding: "6px 42px",
	fontSize: 16,
	fontWeight: 500,
	textTransform: "none",
	minWidth: 135,
	height: 34,
	backgroundColor: "#F9F9F9",
	color: "#240620",
	boxShadow: "0 4px 14px rgba(0,0,0,0.25)",

	"&:hover:not(:disabled)": {
		backgroundColor: "#FFFFFF",
		boxShadow: "0 6px 18px rgba(255,255,255,0.2)",
		transform: "translateY(-1px)",
	},

	"&:active:not(:disabled)": {
		transform: "translateY(0)",
	},

	"&:disabled": {
		backgroundColor: "rgba(249,249,249,0.4)",
		color: "rgba(36,6,32,0.5)",
	},
});
