"use client";

import { useContext } from "react";

import Box from "@mui/material/Box";
import Typography from "@mui/material/Typography";

import { GameContext } from "@/libs/context/2048/GameProvider";

export default function Timer() {
	const game = useContext(GameContext);
	if (!game) throw new Error("Timer must be used within GameProvider");

	const { timeRemaining } = game;

	const minutes = Math.floor(timeRemaining / 60);
	const seconds = timeRemaining % 60;
	const formatted = `${minutes}:${seconds.toString().padStart(2, "0")}`;

	return (
		<Box sx={{ textAlign: "center", mr: 2 }}>
			<Typography variant="body2" color="text.secondary">
				Time
			</Typography>
			<Typography variant="h6" component="div" fontWeight="bold">
				{formatted}
			</Typography>
		</Box>
	);
}
