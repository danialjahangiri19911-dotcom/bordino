"use client";

import { useContext } from "react";

import RedoIcon from "@mui/icons-material/Redo";
import UndoIcon from "@mui/icons-material/Undo";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";

import { GameContext } from "@/libs/context/2048/GameProvider";

export default function HistoryControls() {
	const game = useContext(GameContext);
	if (!game)
		throw new Error("HistoryControls must be used within GameProvider");

	const { undo, redo, canUndo, canRedo } = game;

	return (
		<Box sx={{ display: "flex", justifyContent: "center", gap: 2, my: 2 }}>
			<Button
				variant="contained"
				startIcon={<UndoIcon />}
				onClick={undo}
				disabled={!canUndo}
			>
				Undo
			</Button>
			<Button
				variant="contained"
				startIcon={<RedoIcon />}
				onClick={redo}
				disabled={!canRedo}
			>
				Redo
			</Button>
		</Box>
	);
}
