"use client";

import React, { useEffect, useState } from "react";

import Container from "@mui/material/Container";

import { ActionButtons } from "@/_pages/PwaApp/sudoku/ActionButtons";
import {
	ExitConfirmDialog,
	GameOverDialog,
	VictoryMessage,
} from "@/_pages/PwaApp/sudoku/Dialogs";
import { GameBoard } from "@/_pages/PwaApp/sudoku/GameBoard";
import { GameHeader } from "@/_pages/PwaApp/sudoku/GameHeader";
import { MenuScreen } from "@/_pages/PwaApp/sudoku/MenuScreen";
import { NumberPad } from "@/_pages/PwaApp/sudoku/NumberPad";
import PageLoading from "@/libs/components/loading/PageLoading";
import { useSudokuStore } from "@/libs/games/sudoku/storage";
import type { Index } from "@/libs/games/sudoku/types";
import { useSudoku } from "@/libs/hooks/useSudoku";

export default function SudokuPage() {
	const {
		board,
		selectedCell,
		conflicts,
		numberProgress,
		difficulty,
		status,
		mistakes,
		timeRemaining,
		maxMistakes,
		canUndo,
		isLoadingConfig,
		remainingHints,
		generateGame,
		selectCell,
		fillCell,
		eraseCell,
		toggleNote,
		hint,
		undo,
		exitToMenu,
	} = useSudoku();

	const { isHardUnlocked, isMediumUnlocked, getCompletionCounts } =
		useSudokuStore();

	const [exitDialogOpen, setExitDialogOpen] = useState(false);
	const [gameOverDialogOpen, setGameOverDialogOpen] = useState(false);

	const mediumUnlocked = isMediumUnlocked();
	const hardUnlocked = isHardUnlocked();
	const completions = getCompletionCounts();

	// Show game over dialog when status becomes 'lost'
	useEffect(() => {
		if (status === "lost") {
			setGameOverDialogOpen(true);
		} else {
			setGameOverDialogOpen(false);
		}
	}, [status]);

	// ---------- Loading state (including menu config fetch) ----------
	if (isLoadingConfig) {
		return <PageLoading />;
	}

	// ---------- Menu screen ----------
	if (status === "menu" || board.length === 0) {
		return (
			<MenuScreen
				completions={completions}
				mediumUnlocked={mediumUnlocked}
				hardUnlocked={hardUnlocked}
				onSelectDifficulty={generateGame}
			/>
		);
	}

	// ---------- Active game ----------
	const selectedCoords = selectedCell
		? { x: selectedCell.x, y: selectedCell.y }
		: null;

	const handleCellClick = (x: Index, y: Index) => selectCell(x, y);
	const handleNumberClick = (num: number) => {
		if (selectedCoords) {
			const cell = board[selectedCoords.x][selectedCoords.y];
			if (!cell.prefilled) fillCell(num as any);
		}
	};
	const handleNumberDoubleClick = (num: number) => {
		if (selectedCoords) {
			const cell = board[selectedCoords.x][selectedCoords.y];
			if (!cell.prefilled && !cell.value) toggleNote(num as any);
		}
	};

	const handleExitClick = () => setExitDialogOpen(true);
	const handleExitConfirm = () => {
		exitToMenu();
		setExitDialogOpen(false);
	};
	const handleExitCancel = () => setExitDialogOpen(false);

	const handleGameOverNewGame = () => {
		setGameOverDialogOpen(false);
		exitToMenu();
	};
	const handleGameOverExit = () => {
		setGameOverDialogOpen(false);
		exitToMenu();
	};

	return (
		<Container
			maxWidth={false}
			disableGutters
			sx={{
				display: "flex",
				flexDirection: "column",
				gap: "0.5rem",
				alignItems: "center",
				justifyContent: "center",
				position: "relative",
			}}
		>
			<GameHeader
				timeRemaining={timeRemaining}
				mistakes={mistakes}
				maxMistakes={maxMistakes}
				difficulty={difficulty}
				onExitClick={handleExitClick}
			/>

			<GameBoard
				board={board}
				selectedCell={selectedCell}
				conflicts={conflicts}
				onCellClick={handleCellClick}
			/>

			<NumberPad
				numberProgress={numberProgress}
				selectedCoords={selectedCoords}
				board={board}
				status={status}
				onNumberClick={handleNumberClick}
				onNumberDoubleClick={handleNumberDoubleClick}
			/>

			<ActionButtons
				remainingHints={remainingHints}
				canUndo={canUndo}
				status={status}
				selectedCoords={selectedCoords}
				board={board}
				onUndo={undo}
				onErase={eraseCell}
				onHint={hint}
			/>

			<GameOverDialog
				open={gameOverDialogOpen}
				mistakes={mistakes}
				maxMistakes={maxMistakes}
				onNewGame={handleGameOverNewGame}
				onExit={handleGameOverExit}
			/>

			<ExitConfirmDialog
				open={exitDialogOpen}
				onConfirm={handleExitConfirm}
				onCancel={handleExitCancel}
			/>

			{status === "won" && (
				<VictoryMessage
					difficulty={difficulty}
					mediumUnlocked={mediumUnlocked}
					hardUnlocked={hardUnlocked}
					completions={completions}
					onContinue={handleExitClick}
				/>
			)}
		</Container>
	);
}
