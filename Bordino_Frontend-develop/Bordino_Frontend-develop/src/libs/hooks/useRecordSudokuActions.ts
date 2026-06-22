"use client";

import { useEffect, useRef } from "react";

import useRecordAction from "@/api/activity/useRecordAction";
import type {
	Difficulty,
	GameStatus,
	GroupCounts,
} from "@/libs/games/sudoku/types";

interface UseRecordSudokuActionsProps {
	status: GameStatus;
	difficulty: Difficulty | null;
	mistakes: number;
	maxMistakes: number;
	remainingHints: number;
	rowCounts: GroupCounts;
	squareCounts: GroupCounts;
	isFreshGame: React.MutableRefObject<boolean>;
}

export function useRecordSudokuActions({
	status,
	difficulty,
	mistakes,
	maxMistakes,
	remainingHints,
	rowCounts,
	squareCounts,
	isFreshGame,
}: UseRecordSudokuActionsProps) {
	const { submitHandler } = useRecordAction();

	// Refs to prevent duplicate recordings
	const hasRecordedWin = useRef(false);
	const hasRecordedLoss = useRef(false);
	const prevRemainingHints = useRef(remainingHints);

	// Refs for row/box completion tracking
	const prevRowCompleted = useRef<boolean[]>(Array(9).fill(false));
	const prevBoxCompleted = useRef<boolean[]>(Array(9).fill(false));

	// Helper to send action
	const recordAction = (
		actionType: string,
		metadata?: Record<string, any>,
		description?: string,
	) => {
		submitHandler({
			section: "sudoku",
			action_type: actionType,
			metadata: metadata || {},
			description: description || "",
		});
	};

	// Completion detection helpers
	const getRowCompletion = (): boolean[] => {
		return rowCounts.map((row) => {
			for (let n = 1; n <= 9; n++) {
				if (row[n] !== 1) return false;
			}
			return true;
		});
	};

	const getBoxCompletion = (): boolean[] => {
		return squareCounts.map((box) => {
			for (let n = 1; n <= 9; n++) {
				if (box[n] !== 1) return false;
			}
			return true;
		});
	};

	// Check and record row/box completions
	const checkCompletions = () => {
		if (status !== "playing") return;

		const currentRow = getRowCompletion();
		const currentBox = getBoxCompletion();

		// Row completions
		for (let i = 0; i < 9; i++) {
			if (currentRow[i] && !prevRowCompleted.current[i]) {
				recordAction("row_completed", { rowIndex: i });
			}
		}
		prevRowCompleted.current = currentRow;

		// Box completions
		for (let i = 0; i < 9; i++) {
			if (currentBox[i] && !prevBoxCompleted.current[i]) {
				recordAction("box_completed", { boxIndex: i });
			}
		}
		prevBoxCompleted.current = currentBox;
	};

	// Initialize prev completions on mount (for restored games)
	useEffect(() => {
		prevRowCompleted.current = getRowCompletion();
		prevBoxCompleted.current = getBoxCompletion();
	}, []); // eslint-disable-line react-hooks/exhaustive-deps

	// Track game start, win, loss (runs first on updates)
	useEffect(() => {
		// Game start
		if (status === "playing" && isFreshGame.current) {
			recordAction("start_game", { difficulty });
			// Reset completion trackers for the new game
			prevRowCompleted.current = getRowCompletion();
			prevBoxCompleted.current = getBoxCompletion();
			// Reset hint tracker
			prevRemainingHints.current = remainingHints;
			// Reset win/loss flags
			hasRecordedWin.current = false;
			hasRecordedLoss.current = false;
			isFreshGame.current = false;
		}

		// Win
		if (status === "won" && !hasRecordedWin.current && difficulty) {
			recordAction("win_game", { difficulty, mistakes, remainingHints });
			// Level-specific completion
			const levelAction = `${difficulty}_level_completed`;
			recordAction(levelAction, { difficulty, mistakes, remainingHints });
			hasRecordedWin.current = true;
		}

		// Loss
		if (status === "lost" && !hasRecordedLoss.current) {
			const reason = mistakes >= maxMistakes ? "mistakes" : "timeout";
			recordAction("game_over", { reason, mistakes, maxMistakes });
			if (mistakes >= maxMistakes) {
				recordAction("max_mistakes_reached", { mistakes, maxMistakes });
			}
			hasRecordedLoss.current = true;
		}
	}, [status, difficulty, mistakes, maxMistakes, remainingHints, isFreshGame]);

	// Track row/box completions on every relevant state change (runs after status effect)
	useEffect(() => {
		checkCompletions();
	}, [rowCounts, squareCounts]);

	// Track hint usage
	useEffect(() => {
		if (remainingHints < prevRemainingHints.current) {
			// Hints decreased -> a hint was used
			recordAction("hint_used", { remainingHints });
		}
		prevRemainingHints.current = remainingHints;
	}, [remainingHints]);

	return null;
}
