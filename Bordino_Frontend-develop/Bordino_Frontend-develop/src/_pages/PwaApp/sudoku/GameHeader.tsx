import React from "react";

import { Header } from "./styles";
import FavoriteIcon from "@mui/icons-material/Favorite";
import Box from "@mui/material/Box";
import Typography from "@mui/material/Typography";

import { toFa } from "@/libs/games/sudoku/faDigits";
import { DeepOrange600 } from "@/libs/games/sudoku/theme";
import type { Difficulty } from "@/libs/games/sudoku/types";

interface GameHeaderProps {
	timeRemaining: number;
	mistakes: number;
	maxMistakes: number;
	difficulty: Difficulty | null;
	onExitClick: () => void;
}

const DIFFICULTY_FA: Record<Difficulty, string> = {
	easy: "آسان",
	medium: "متوسط",
	hard: "سخت",
};

const HEART_RED = "#E64056";
const HEART_GRAY = "#D0D0D0";
const BACK_COLOR = "#3C3C3C";

export function GameHeader({
	timeRemaining,
	mistakes,
	maxMistakes,
	difficulty,
	onExitClick,
}: GameHeaderProps) {
	const formatTime = (seconds: number): string => {
		if (seconds <= 0) return "--:--";
		const mins = Math.floor(seconds / 60);
		const secs = seconds % 60;
		const text = `${mins.toString().padStart(2, "0")}:${secs.toString().padStart(2, "0")}`;
		return toFa(text);
	};

	const timerColor =
		timeRemaining > 0 && timeRemaining < 60 ? DeepOrange600 : "inherit";

	// قلب‌ها = جان‌ها؛ با هر اشتباه یکی خاکستری می‌شود
	const hearts = Array.from({ length: maxMistakes }, (_, i) => (
		<FavoriteIcon
			key={i}
			sx={{ color: i < mistakes ? HEART_GRAY : HEART_RED, fontSize: "1.3rem" }}
		/>
	));

	return (
		<Header style={{ alignItems: "center" }}>
			{/* راست: فلش بازگشت + سطح بازی */}
			<Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
				<Box
					onClick={onExitClick}
					sx={{ cursor: "pointer", display: "inline-flex", alignItems: "center" }}
				>
					<svg width="24" height="24" viewBox="0 0 24 24" fill="none">
						<path
							d="M9 18L15 12L9 6"
							stroke={BACK_COLOR}
							strokeWidth="2"
							strokeLinecap="round"
							strokeLinejoin="round"
						/>
					</svg>
				</Box>
				{difficulty && (
					<Typography variant="body2" fontWeight={700}>
						{DIFFICULTY_FA[difficulty]}
					</Typography>
				)}
			</Box>

			{/* وسط: شمارش معکوس */}
			<Typography variant="h6" sx={{ color: timerColor }}>
				{formatTime(timeRemaining)}
			</Typography>

			{/* چپ: قلب‌ها (جان) */}
			<Box sx={{ display: "flex", gap: 0.5 }}>{hearts}</Box>
		</Header>
	);
}
