"use client";

import { useContext } from "react";

import Box from "@mui/material/Box";
import Typography from "@mui/material/Typography";

import { GameContext } from "@/libs/context/2048/GameProvider";

export default function MoveCounter() {
	const game = useContext(GameContext);
	if (!game) throw new Error("MoveCounter must be used within GameProvider");

	return (
		<Box sx={{ textAlign: "center", minWidth: 60 }}>
			<Typography variant="body2" color="text.secondary">
				Moves
			</Typography>
			<Typography variant="h6" component="div" fontWeight="bold">
				{game.moveCount}
			</Typography>
		</Box>
	);
}
