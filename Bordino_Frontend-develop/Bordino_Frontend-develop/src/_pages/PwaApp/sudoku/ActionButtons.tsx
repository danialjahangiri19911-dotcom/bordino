import React from "react";

import { Action, ActionsContainer, RedoAction } from "./styles";
import DeleteIcon from "@mui/icons-material/Delete";
import SearchIcon from "@mui/icons-material/Search";
import UndoIcon from "@mui/icons-material/Undo";

interface ActionButtonsProps {
	canUndo: boolean;
	canRedo: boolean;
	status: string;
	selectedCoords: { x: number; y: number } | null;
	remainingHints: number;
	board: any;
	onUndo: () => void;
	onRedo: () => void;
	onErase: () => void;
	onHint: () => void;
}

export function ActionButtons({
	canUndo,
	canRedo,
	status,
	remainingHints,
	selectedCoords,
	board,
	onUndo,
	onRedo,
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
				<div>Undo</div>
			</Action>
			<RedoAction
				onClick={canRedo && isPlaying ? onRedo : undefined}
				style={{ opacity: canRedo && isPlaying ? 1 : 0.5 }}
			>
				<UndoIcon />
				<div>Redo</div>
			</RedoAction>
			<Action
				onClick={!eraseDisabled ? onErase : undefined}
				style={{ opacity: eraseDisabled ? 0.5 : 1 }}
			>
				<DeleteIcon />
				<div>Erase</div>
			</Action>
			<Action
				onClick={!hintDisabled ? onHint : undefined}
				style={{ opacity: hintDisabled ? 0.5 : 1 }}
			>
				<SearchIcon />
				<div>Hint</div>
			</Action>
		</ActionsContainer>
	);
}
