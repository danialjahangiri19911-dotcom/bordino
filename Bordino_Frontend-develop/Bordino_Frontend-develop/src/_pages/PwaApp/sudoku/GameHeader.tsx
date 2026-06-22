import React from "react";

import { ExitButton, Header } from "./styles";
import HomeIcon from "@mui/icons-material/Home";
import Box from "@mui/material/Box";
import Typography from "@mui/material/Typography";

import { DeepOrange600 } from "@/libs/games/sudoku/theme";

interface GameHeaderProps {
	timeRemaining: number;
	mistakes: number;
	maxMistakes: number;
	onExitClick: () => void;
}

export function GameHeader({
	timeRemaining,
	mistakes,
	maxMistakes,
	onExitClick,
}: GameHeaderProps) {
	const formatTime = (seconds: number): string => {
		// If seconds <= 0, treat as unlimited (show --:--)
		if (seconds <= 0) return "--:--";
		const mins = Math.floor(seconds / 60);
		const secs = seconds % 60;
		return `${mins.toString().padStart(2, "0")}:${secs.toString().padStart(2, "0")}`;
	};

	// Only highlight when timer is finite and low
	const timerColor =
		timeRemaining > 0 && timeRemaining < 60 ? DeepOrange600 : "inherit";

	const mistakeIcons = Array.from({ length: maxMistakes }, (_, i) => (
		<span
			key={i}
			style={{
				color: i < mistakes ? DeepOrange600 : "#ccc",
				fontSize: "1.5rem",
			}}
		>
			✕
		</span>
	));

	return (
		<Header>
			<ExitButton onClick={onExitClick}>
				<HomeIcon />
				<div style={{ marginLeft: "0.2rem" }}>Exit</div>
			</ExitButton>
			<Box sx={{ display: "flex", alignItems: "center", gap: 2 }}>
				<Typography variant="h6" sx={{ color: timerColor }}>
					{formatTime(timeRemaining)}
				</Typography>
				<Box sx={{ display: "flex", gap: 0.5 }}>{mistakeIcons}</Box>
			</Box>
		</Header>
	);
}
