import React from "react";

import { Action, ActionsContainer } from "./styles";
import DeleteIcon from "@mui/icons-material/Delete";
import SearchIcon from "@mui/icons-material/Search";
import UndoIcon from "@mui/icons-material/Undo";

import { toFa } from "@/libs/games/sudoku/faDigits";

interface ActionButtonsProps {
	canUndo: boolean;
	status: string;
	selectedCoords: { x: number; y: number } | null;
	remainingHints: number;
	board: any;
	onUndo: () => void;
	onErase: () => void;
	onHint: () => void;
}

export function ActionButtons({
	canUndo,
	status,
	remainingHints,
	selectedCoords,
	board,
	onUndo,
	onErase,
	onHint,
}: ActionButtonsProps) {
	const isPlaying = status === "playing";
	const hasSelection = selectedCoords !== null;
	const selectedCell = hasSelection
		? board[selectedCoords.x][selectedCoords.y]
		: null;
	const isPrefilled = selectedCell?.prefilled;

	const eraseDisabled = !hasSelection || isPrefilled || !isPlaying;
	const hintDisabled =
		!hasSelection || isPrefilled || !isPlaying || remainingHints <= 0;

	return (
		<ActionsContainer>
			<Action
				onClick={canUndo && isPlaying ? onUndo : undefined}
				style={{ opacity: canUndo && isPlaying ? 1 : 0.5 }}
			>
				<UndoIcon />
				<div>برگشت</div>
			</Action>
			<Action
				onClick={!eraseDisabled ? onErase : undefined}
				style={{ opacity: eraseDisabled ? 0.5 : 1 }}
			>
				<DeleteIcon />
				<div>پاک کردن</div>
			</Action>
			<Action
				onClick={!hintDisabled ? onHint : undefined}
				style={{ opacity: hintDisabled ? 0.5 : 1 }}
			>
				{/* تعداد کمک‌های باقی‌مانده — بالای آیکون */}
				<div
					style={{
						minWidth: "1.1rem",
						height: "1.1rem",
						lineHeight: "1.1rem",
						borderRadius: "0.55rem",
						background: "#235789",
						color: "#fff",
						fontSize: ".7rem",
						fontWeight: 700,
						textAlign: "center",
						marginBottom: "2px",
					}}
				>
					{toFa(remainingHints)}
				</div>
				<SearchIcon />
				<div>کمک</div>
			</Action>
		</ActionsContainer>
	);
}
