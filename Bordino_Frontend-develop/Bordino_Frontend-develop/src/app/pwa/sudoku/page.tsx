"use client";

import React, { useEffect, useRef, useState } from "react";
import { toast } from "react-toastify";

import Container from "@mui/material/Container";

import useChargeGamePlay from "@/api/games/useChargeGamePlay";
import useGetPlayCost from "@/api/games/useGetPlayCost";
import { GAME_URLS } from "@/api/urls";
import { ActionButtons } from "@/_pages/PwaApp/sudoku/ActionButtons";
import { ExitConfirmDialog, VictoryMessage } from "@/_pages/PwaApp/sudoku/Dialogs";
import { GameBoard } from "@/_pages/PwaApp/sudoku/GameBoard";
import { GameHeader } from "@/_pages/PwaApp/sudoku/GameHeader";
import { MenuScreen } from "@/_pages/PwaApp/sudoku/MenuScreen";
import { NumberPad } from "@/_pages/PwaApp/sudoku/NumberPad";
import LostDialog from "@/libs/components/games/LostDialog";
import PageLoading from "@/libs/components/loading/PageLoading";
import { fetchWithAuth } from "@/libs/http/query";
import { useSudokuStore } from "@/libs/games/sudoku/storage";
import type { Difficulty, Index } from "@/libs/games/sudoku/types";
import { useSudoku } from "@/libs/hooks/useSudoku";
import { toPersianDigits } from "@/libs/utils/persianNumberConverter";

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
		continueAfterLoss,
	} = useSudoku();

	const { isHardUnlocked, isMediumUnlocked, getCompletionCounts } =
		useSudokuStore();

	const { data: costData, refetch: refetchCost } = useGetPlayCost({
		gameName: "sudoku",
	});
	const { chargeAsync, isCharging } = useChargeGamePlay();
	const playCost = costData?.result?.play_cost ?? 0;
	const currentPoints = costData?.result?.current_amount ?? 0;

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

	// شروعِ بازیِ جدید با کسرِ امتیاز (هر بار بازی کردنِ سودوکو). One start at a time (a double
	// tap must not charge twice), and the level is checked before paying for it.
	const startingRef = useRef(false);
	const [starting, setStarting] = useState(false);
	const handleSelectDifficulty = async (difficulty: Difficulty) => {
		if (startingRef.current) return;
		startingRef.current = true;
		setStarting(true);
		try {
			await fetchWithAuth(
				`${GAME_URLS.CONFIG}?difficulty_level=${difficulty}&game_name=sudoku`,
				{},
			);
		} catch {
			toast.error("این سطح در دسترس نیست.");
			startingRef.current = false;
			setStarting(false);
			return;
		}
		try {
			await chargeAsync({ game_name: "sudoku" });
			void refetchCost();
			generateGame(difficulty);
		} catch {
			// خطا (امتیازِ ناکافی) با toastِ سراسری نمایش داده می‌شود
		} finally {
			startingRef.current = false;
			setStarting(false);
		}
	};

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
				onSelectDifficulty={handleSelectDifficulty}
				busy={starting}
				cost={costData ? playCost : undefined}
				points={costData ? currentPoints : undefined}
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

	const handleGameOverExit = () => {
		setGameOverDialogOpen(false);
		exitToMenu();
	};
	// ادامهٔ بازی با کسرِ امتیاز: اشتباه‌ها صفر و همان پازل ادامه می‌یابد
	const handleGameOverContinue = async () => {
		if (startingRef.current) return;
		startingRef.current = true;
		try {
			await chargeAsync({ game_name: "sudoku" });
			void refetchCost();
			continueAfterLoss();
			setGameOverDialogOpen(false);
		} catch {
			// خطا (امتیازِ ناکافی) با toastِ سراسری نمایش داده می‌شود
		} finally {
			startingRef.current = false;
		}
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

			<LostDialog
				open={gameOverDialogOpen}
				description={
					mistakes >= maxMistakes
						? `تو ${toPersianDigits(mistakes)} تا اشتباه داشتی و بازی رو باختی.`
						: "زمان تمام شد و بازی رو باختی."
				}
				points={currentPoints}
				cost={playCost}
				loading={isCharging}
				onContinue={handleGameOverContinue}
				onCancel={handleGameOverExit}
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
