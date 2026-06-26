"use client";

import { useState } from "react";

import { useRouter } from "next/navigation";

import useGetTarotReading from "@/api/entertainment/hooks/useGetTarotReading";
import type { TarotSpread } from "@/api/entertainment/types/tarotType";
import Box from "@/libs/components/atoms/Box";
import Button from "@/libs/components/atoms/Button";
import CircularProgress from "@/libs/components/atoms/CircularProgress";
import Typography from "@/libs/components/atoms/Typography";
import PwaAppPageLayout from "@/libs/components/layouts/PwaAppLayout";
import Back from "@/libs/components/layouts/PwaAppLayout/customRightActions/Back";
import styled from "@/libs/styles/styled";

const GOLD = "#E7C873";

// برچسبِ جایگاهِ هر کارت بر اساسِ نوعِ فال (به‌ترتیبِ کشیده‌شدن)
const POSITION_LABELS: Record<number, string[]> = {
	3: ["گذشته", "حال", "آینده"],
	5: ["وضعیت کنونی", "چالش / مانع", "گذشته", "آینده‌ی نزدیک", "نتیجه"],
};

export default function Tarot() {
	const { back } = useRouter();
	const [spread, setSpread] = useState<TarotSpread | null>(null);
	const { cards, loading, error, fetchTarot } = useGetTarotReading();

	const labels = POSITION_LABELS[spread ?? 3] ?? [];

	const choose = (count: TarotSpread) => {
		setSpread(count);
		void fetchTarot(count);
	};

	return (
		<PwaAppPageLayout rightAction={<Back handleBack={back} />} sx={{ gap: 2 }}>
			<Typography variant="20-medium" textAlign="center" color="text.primary">
				🔮 فال تاروت
			</Typography>

			{!spread ? (
				<Box display="flex" flexDirection="column" gap={2} mt={1}>
					<Typography
						variant="14-regular"
						color="text.secondary"
						textAlign="center"
					>
						نوعِ فالت را انتخاب کن
					</Typography>
					<Box display="flex" gap={2}>
						<ChoiceCard onClick={() => choose(3)}>
							<ChoiceIcon>🃏</ChoiceIcon>
							<Typography variant="16-medium" color="text.primary">
								فال ۳ کارتی
							</Typography>
							<Typography variant="12-regular" color="text.secondary">
								گذشته، حال، آینده
							</Typography>
						</ChoiceCard>
						<ChoiceCard onClick={() => choose(5)}>
							<ChoiceIcon>🪬</ChoiceIcon>
							<Typography variant="16-medium" color="text.primary">
								فال ۵ کارتی
							</Typography>
							<Typography variant="12-regular" color="text.secondary">
								تحلیلِ کامل‌تر
							</Typography>
						</ChoiceCard>
					</Box>
				</Box>
			) : loading ? (
				<Center>
					<CircularProgress color="error" />
					<Typography variant="12-regular" color="text.secondary">
						در حال کشیدنِ کارت‌ها…
					</Typography>
				</Center>
			) : error ? (
				<Center>
					<Typography variant="14-regular" color="text.secondary">
						خطا در گرفتنِ فال. دوباره تلاش کن.
					</Typography>
					<Button variant="contained" onClick={() => void fetchTarot(spread)}>
						تلاش دوباره
					</Button>
				</Center>
			) : (
				<Box display="flex" flexDirection="column" gap={3}>
					{/* ردیفِ کارت‌های کشیده‌شده */}
					<CardsRow>
						{cards?.map((card, index) => (
							<CardSlot key={card.order}>
								<PositionLabel>{labels[index] ?? ""}</PositionLabel>
								<CardFace>
									<FaceSymbol>{card.symbol}</FaceSymbol>
									<FaceName>{card.name}</FaceName>
								</CardFace>
							</CardSlot>
						))}
					</CardsRow>

					{/* تفسیرِ هر کارت */}
					<Box display="flex" flexDirection="column" gap={1.5}>
						{cards?.map((card, index) => (
							<InterpRow key={card.order}>
								<MiniCard>{card.symbol}</MiniCard>
								<Box display="flex" flexDirection="column" gap={0.5} flex={1}>
									{labels[index] && (
										<Typography variant="12-medium" color="error.main">
											{labels[index]}
										</Typography>
									)}
									<Typography variant="14-medium" color="text.primary">
										{card.name}
									</Typography>
									<Typography variant="12-regular" color="text.secondary">
										{card.interpretation}
									</Typography>
								</Box>
							</InterpRow>
						))}
					</Box>

					<Box display="flex" gap={2}>
						<Button
							fullWidth
							variant="contained"
							color="error"
							onClick={() => void fetchTarot(spread)}
						>
							<Typography variant="14-medium" color="common.white">
								فالِ دوباره
							</Typography>
						</Button>
						<Button
							fullWidth
							variant="outlined"
							color="error"
							onClick={() => setSpread(null)}
						>
							<Typography variant="14-medium" color="error.main">
								تغییرِ نوعِ فال
							</Typography>
						</Button>
					</Box>
				</Box>
			)}
		</PwaAppPageLayout>
	);
}

const Center = styled(Box)(({ theme }) => ({
	display: "flex",
	flexDirection: "column",
	alignItems: "center",
	justifyContent: "center",
	gap: theme.spacing(2),
	minHeight: 200,
}));

const ChoiceCard = styled(Box)(({ theme }) => ({
	flex: 1,
	display: "flex",
	flexDirection: "column",
	alignItems: "center",
	gap: theme.spacing(0.5),
	padding: theme.spacing(2.5, 1.5),
	borderRadius: 16,
	backgroundColor: theme.palette.common.white,
	border: "1px solid",
	borderColor: theme.palette.grey[200],
	boxShadow: theme.shadows[2],
	cursor: "pointer",
	textAlign: "center",
	transition: "transform 0.15s, box-shadow 0.15s",
	"&:hover": { transform: "translateY(-2px)", boxShadow: theme.shadows[4] },
}));

const ChoiceIcon = styled("span")({
	fontSize: 38,
	lineHeight: 1,
	marginBottom: 4,
});

const CardsRow = styled(Box)(({ theme }) => ({
	display: "flex",
	flexWrap: "wrap",
	justifyContent: "center",
	gap: theme.spacing(1.5),
}));

const CardSlot = styled(Box)(({ theme }) => ({
	display: "flex",
	flexDirection: "column",
	alignItems: "center",
	gap: theme.spacing(0.75),
}));

const PositionLabel = styled("span")(({ theme }) => ({
	fontSize: 11,
	fontWeight: 700,
	color: theme.palette.error.main,
	textAlign: "center",
	maxWidth: 92,
}));

const CardFace = styled(Box)({
	width: 92,
	aspectRatio: "0.62",
	flexShrink: 0,
	borderRadius: 12,
	background: "linear-gradient(160deg, #4B2E83 0%, #241247 100%)",
	border: `2px solid ${GOLD}`,
	boxShadow:
		"0 6px 16px rgba(36,18,71,0.35), inset 0 0 0 4px rgba(231,200,115,0.18)",
	display: "flex",
	flexDirection: "column",
	alignItems: "center",
	justifyContent: "center",
	gap: 8,
	padding: 8,
});

const FaceSymbol = styled("span")({
	fontSize: 34,
	lineHeight: 1,
});

const FaceName = styled("span")({
	color: "#F3E6C0",
	fontSize: 12,
	fontWeight: 700,
	textAlign: "center",
});

const InterpRow = styled(Box)(({ theme }) => ({
	display: "flex",
	flexDirection: "row",
	alignItems: "flex-start",
	gap: theme.spacing(1.5),
	padding: theme.spacing(1.5),
	borderRadius: 12,
	backgroundColor: theme.palette.common.white,
	border: "1px solid",
	borderColor: theme.palette.grey[200],
}));

const MiniCard = styled(Box)({
	width: 44,
	aspectRatio: "0.62",
	flexShrink: 0,
	borderRadius: 8,
	background: "linear-gradient(160deg, #4B2E83 0%, #241247 100%)",
	border: `1.5px solid ${GOLD}`,
	display: "flex",
	alignItems: "center",
	justifyContent: "center",
	fontSize: 22,
});
