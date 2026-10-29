"use client";

import { useEffect, useRef } from "react";

import { useQueryClient } from "@tanstack/react-query";

import useRecordAction from "@/api/activity/useRecordAction";
import { sudokuApi } from "@/api/games/sudoku/api";
import type {
	BoardWithMeta,
	Difficulty,
	GameStatus,
	GroupCounts,
} from "@/libs/games/sudoku/types";

interface UseRecordSudokuActionsProps {
	/** The server's round: the board rewards are paid there, against its puzzle. */
	roundId: string | null;
	board: BoardWithMeta;
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
	roundId,
	board,
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
	const queryClient = useQueryClient();

	// The board rewards (a finished row or box, the win, the level) are the server's to pay: the
	// board goes there, one report at a time (a newer one waits for the one on its way).
	const reporting = useRef<Promise<unknown>>(Promise.resolve());
	const boardRef = useRef(board);
	boardRef.current = board;
	const reportBoard = () => {
		if (!roundId) return; // a board from before server-judged games: no board rewards
		const id = roundId;
		reporting.current = reporting.current
			.catch(() => undefined)
			.then(async () => {
				const values = boardRef.current.map((row) => row.map((cell) => cell.value ?? 0));
				const answer = await sudokuApi.report(id, values).catch(() => null);
				if (answer?.awarded.length) void queryClient.invalidateQueries();
			});
	};

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

		// A row or box just finished: the server checks it against its solution and pays it.
		const newly =
			currentRow.some((done, i) => done && !prevRowCompleted.current[i]) ||
			currentBox.some((done, i) => done && !prevBoxCompleted.current[i]);
		prevRowCompleted.current = currentRow;
		prevBoxCompleted.current = currentBox;
		if (newly) reportBoard();
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

		// Win: the finished board goes to the server, which pays the win and the level.
		if (status === "won" && !hasRecordedWin.current && difficulty) {
			reportBoard();
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
