"use client";

import { useCallback, useEffect, useRef, useState } from "react";

// added useRef
import { useHydration } from "./useHydration";
import { useRecordSudokuActions } from "./useRecordSudokuActions";
import { useImmerReducer } from "use-immer";

import useGameConfig from "@/api/game/useGameConfig";
import { toast } from "@/libs/components/atoms/Toast";
import {
	SIZE,
	TARGET_CELLS_BY_DIFFICULTY,
} from "@/libs/games/sudoku/constants";
import { makePuzzle, pluck, solveBoard } from "@/libs/games/sudoku/generation";
import { gameReducer } from "@/libs/games/sudoku/reducer";
import {
	deserializeGameState,
	useSudokuStore,
} from "@/libs/games/sudoku/storage";
import type {
	Board,
	CellValue,
	Difficulty,
	GameConfig,
	GameState,
	Index,
} from "@/libs/games/sudoku/types";
import { currentUserId } from "@/libs/stores/authStore";

// new import

/** A full, valid 9×9 Sudoku grid of 1-9. */
function isValidSolution(solution: unknown): boolean {
	if (!Array.isArray(solution) || solution.length !== 9) return false;
	const ok = (cells: unknown[]) => cells.length === 9 && [...cells].sort().join("") === "123456789";
	for (let i = 0; i < 9; i++) {
		const row = solution[i];
		if (!Array.isArray(row) || !ok(row)) return false;
		if (!ok(solution.map((r: unknown[]) => r[i]))) return false;
		const r0 = Math.floor(i / 3) * 3;
		const c0 = (i % 3) * 3;
		if (!ok([0, 1, 2].flatMap((dr) => [0, 1, 2].map((dc) => solution[r0 + dr][c0 + dc])))) return false;
	}
	return true;
}

/** The save's solution is a real Sudoku and its board agrees with it (givens = the solution). */
function isConsistentSave(game: { solution?: unknown; board?: unknown }): boolean {
	if (!isValidSolution(game.solution)) return false;
	const solution = game.solution as number[][];
	const board = game.board as { value: number | null; prefilled: boolean }[][] | undefined;
	if (!Array.isArray(board) || board.length !== 9) return false;
	return board.every(
		(row, x) =>
			Array.isArray(row) &&
			row.length === 9 &&
			row.every(
				(cell, y) =>
					!!cell &&
					(cell.value === null || (Number.isInteger(cell.value) && cell.value >= 1 && cell.value <= 9)) &&
					(!cell.prefilled || cell.value === solution[x][y]),
			),
	);
}

export function useSudoku() {
	const hydrated = useHydration();
	const {
		gameState: persistedGame,
		saveGame,
		clearGame,
		recordCompletion,
		ensureOwner,
	} = useSudokuStore();

	// A save left by another account on this device is not resumed (nor its unlocks shown).
	useEffect(() => {
		if (hydrated) ensureOwner();
	}, [hydrated, ensureOwner]);

	const [requestedDifficulty, setRequestedDifficulty] =
		useState<Difficulty | null>(null);
	const [isResumeCheckDone, setIsResumeCheckDone] = useState(false);

	const isFreshGame = useRef(false);

	// Reducer with a simple initial menu state
	const [state, dispatch] = useImmerReducer(
		gameReducer,
		null as never,
		() =>
			({
				solution: [],
				board: [],
				selectedCell: null,
				rowCounts: [],
				colCounts: [],
				squareCounts: [],
				history: [],
				historyIndex: 0,
				difficulty: null,
				status: "menu",
				mistakes: 0,
				timeRemaining: 0,
				maxTime: 0,
				maxMistakes: 3,
				maxHints: 0,
				remainingHints: 0,
				conflicts: Array.from({ length: SIZE }, () => Array(SIZE).fill(false)),
				numberProgress: Array(10).fill(0),
			}) as GameState,
	);

	// ----------------------------------------------------------------------
	// RESTORE GAME AFTER HYDRATION
	// ----------------------------------------------------------------------
	useEffect(() => {
		if (!hydrated) return;
		if (state.status !== "menu") return;
		// Only this account's save, read from the store as it is NOW: ensureOwner may just have
		// cleared another account's save that this render still holds in `persistedGame`.
		const { owner, gameState: saved } = useSudokuStore.getState();
		if (!saved || owner !== currentUserId()) return;

		const deserialized = deserializeGameState(saved);
		// A save that is not a consistent game (damaged, or from an incompatible build) is dropped.
		if (!isConsistentSave(deserialized)) {
			clearGame();
			return;
		}
		const persistedGame = saved;

		// Adjust time only if the original game had a positive time limit and was not paused
		// (a paused game's clock was stopped while the player was away).
		if (persistedGame.maxTime > 0 && !persistedGame.paused) {
			const timeElapsed = Math.floor(
				(Date.now() - persistedGame.lastUpdated) / 1000,
			);
			const remaining = Math.max(0, deserialized.timeRemaining - timeElapsed);

			if (remaining <= 0 && deserialized.status === "playing") {
				toast.info("بازی قبلی شما منقضی شد.");
				return;
			}
			deserialized.timeRemaining = remaining;
		} else {
			// Unlimited time – keep the stored value (which should be 0 or negative)
			// No adjustment needed.
		}

		dispatch({ type: "RESTORE_GAME", payload: { savedState: deserialized } });
	}, [hydrated, persistedGame, state.status, dispatch, clearGame]);

	// ----------------------------------------------------------------------
	// NEW GAME CONFIG FETCH
	// ----------------------------------------------------------------------
	const newGameQuery = useGameConfig(requestedDifficulty ?? "", "sudoku", {
		enabled: !!requestedDifficulty,
		retry: false,
	});

	useEffect(() => {
		if (!newGameQuery.config || !requestedDifficulty) return;

		const solution = makePuzzle();
		const targetCells = TARGET_CELLS_BY_DIFFICULTY[requestedDifficulty];
		const { puzzle } = pluck(solution, targetCells);
		dispatch({
			type: "START_GAME",
			payload: {
				puzzle,
				solution,
				difficulty: requestedDifficulty,
				config: newGameQuery.config,
			},
		});
		setRequestedDifficulty(null);
	}, [newGameQuery.config, requestedDifficulty, dispatch]);

	useEffect(() => {
		if (!newGameQuery.error || !requestedDifficulty) return;

		const status = newGameQuery.error.response?.status;
		if (status === 404 || status === 400) {
			toast.error("این سطح در دسترس نیست.");
		} else if (status === 500) {
			toast.error("خطای سرور. لطفاً بعداً دوباره تلاش کنید.");
		} else {
			toast.error("بارگذاری تنظیمات بازی ناموفق بود.");
		}
		setRequestedDifficulty(null);
	}, [newGameQuery.error, requestedDifficulty]);

	// ----------------------------------------------------------------------
	// RESUME CONFIG CHECK – UPDATE LIMITS GRACEFULLY
	// ----------------------------------------------------------------------
	const resumeQuery = useGameConfig(state.difficulty ?? "", "sudoku", {
		enabled:
			state.status === "playing" && !!state.difficulty && !isResumeCheckDone,
	});

	useEffect(() => {
		if (!resumeQuery.config || !state.difficulty) return;
		if (state.status !== "playing") return;
		setIsResumeCheckDone(true);

		const newConfig = resumeQuery.config;
		let limitsChanged = false;

		if (newConfig.timer !== state.maxTime) {
			dispatch({
				type: "UPDATE_CONFIG",
				payload: { maxTime: newConfig.timer },
			});
			limitsChanged = true;
		}
		if (newConfig.max_errors !== state.maxMistakes) {
			dispatch({
				type: "UPDATE_CONFIG",
				payload: { maxMistakes: newConfig.max_errors },
			});
			limitsChanged = true;
		}
		if (newConfig.hint_count !== state.maxHints) {
			dispatch({
				type: "UPDATE_CONFIG",
				payload: {
					maxHints: newConfig.hint_count,
					remainingHints: newConfig.hint_count,
				},
			});
			limitsChanged = true;
		}

		if (limitsChanged) {
			toast.info("محدودیت‌های بازی با تنظیمات فعلی به‌روزرسانی شد.");
		}
	}, [
		resumeQuery.config,
		state.difficulty,
		state.status,
		state.maxTime,
		state.maxMistakes,
		state.maxHints,
		dispatch,
		isResumeCheckDone,
	]);

	// On error – do nothing, keep playing with existing config
	useEffect(() => {
		if (!resumeQuery.error || isResumeCheckDone) return;
		setIsResumeCheckDone(true);
		toast.warn(
			"تأیید تنظیمات بازی ممکن نشد؛ با محدودیت‌های ذخیره‌شده ادامه می‌دهیم.",
		);
	}, [resumeQuery.error, isResumeCheckDone]);

	// ----------------------------------------------------------------------
	// AUTO-SAVE
	// ----------------------------------------------------------------------
	useEffect(() => {
		if (state.status !== "menu" && state.board.length > 0) {
			saveGame(state);
		}
	}, [state, saveGame]);

	// ----------------------------------------------------------------------
	// RECORD COMPLETIONS
	// ----------------------------------------------------------------------
	useEffect(() => {
		if (state.status === "won" && state.difficulty) {
			recordCompletion(state.difficulty);
		}
	}, [state.status, state.difficulty, recordCompletion]);

	// ----------------------------------------------------------------------
	// TIMER
	// ----------------------------------------------------------------------
	useEffect(() => {
		if (state.status !== "playing") return;
		const interval = setInterval(() => {
			dispatch({ type: "TICK" });
		}, 1000);
		return () => clearInterval(interval);
	}, [state.status, dispatch]);

	// ----------------------------------------------------------------------
	// ACTION RECORDING HOOK
	// ----------------------------------------------------------------------
	useRecordSudokuActions({
		roundId: state.roundId ?? null,
		board: state.board,
		status: state.status,
		difficulty: state.difficulty,
		mistakes: state.mistakes,
		maxMistakes: state.maxMistakes,
		remainingHints: state.remainingHints,
		rowCounts: state.rowCounts,
		squareCounts: state.squareCounts,
		isFreshGame,
	});

	// ----------------------------------------------------------------------
	// ACTIONS
	// ----------------------------------------------------------------------
	const generateGame = useCallback((difficulty: Difficulty) => {
		setIsResumeCheckDone(false);
		setRequestedDifficulty(difficulty);
		isFreshGame.current = true; // mark as fresh start
	}, []);

	/**
	 * Starts a board with a configuration the caller already has (fetched before the paid start):
	 * no second request that could fail after the player has paid.
	 */
	const startWithConfig = useCallback(
		(difficulty: Difficulty, config: GameConfig) => {
			setIsResumeCheckDone(false);
			isFreshGame.current = true;
			const solution = makePuzzle();
			const { puzzle } = pluck(solution, TARGET_CELLS_BY_DIFFICULTY[difficulty]);
			dispatch({ type: "START_GAME", payload: { puzzle, solution, difficulty, config } });
		},
		[dispatch],
	);

	/**
	 * Starts the board the server issued for a paid game (`roundId`): its rewards are paid by the
	 * server against that board. The puzzle has one solution, worked out here for hints.
	 */
	const startServerRound = useCallback(
		(difficulty: Difficulty, config: GameConfig, puzzle: Board, roundId: string) => {
			const solution = solveBoard(puzzle);
			if (!solution) throw new Error("unsolvable puzzle");
			setIsResumeCheckDone(false);
			isFreshGame.current = true;
			dispatch({ type: "START_GAME", payload: { puzzle, solution, difficulty, config, roundId } });
		},
		[dispatch],
	);

	const selectCell = useCallback(
		(x: Index, y: Index) => {
			dispatch({ type: "SELECT_CELL", payload: { x, y } });
		},
		[dispatch],
	);

	const fillCell = useCallback(
		(value: CellValue) => {
			dispatch({ type: "FILL_CELL", payload: { value } });
		},
		[dispatch],
	);

	const eraseCell = useCallback(() => {
		dispatch({ type: "ERASE_CELL" });
	}, [dispatch]);

	const toggleNote = useCallback(
		(value: CellValue) => {
			dispatch({ type: "TOGGLE_NOTE", payload: { value } });
		},
		[dispatch],
	);

	const hint = useCallback(() => {
		dispatch({ type: "HINT" });
	}, [dispatch]);

	const undo = useCallback(() => {
		dispatch({ type: "UNDO" });
	}, [dispatch]);

	const redo = useCallback(() => {
		dispatch({ type: "REDO" });
	}, [dispatch]);

	const exitToMenu = useCallback(() => {
		dispatch({ type: "EXIT_TO_MENU" });
		clearGame();
	}, [dispatch, clearGame]);

	const pause = useCallback(() => {
		dispatch({ type: "PAUSE" });
	}, [dispatch]);

	const resume = useCallback(() => {
		dispatch({ type: "RESUME" });
	}, [dispatch]);

	const continueAfterLoss = useCallback(() => {
		dispatch({ type: "CONTINUE_AFTER_LOSS" });
	}, [dispatch]);

	return {
		solution: state.solution,
		board: state.board,
		selectedCell: state.selectedCell,
		conflicts: state.conflicts,
		numberProgress: state.numberProgress,
		difficulty: state.difficulty,
		status: state.status,
		paused: !!state.paused,
		mistakes: state.mistakes,
		timeRemaining: state.timeRemaining,
		maxTime: state.maxTime,
		maxMistakes: state.maxMistakes,
		canUndo: state.historyIndex > 0,
		canRedo: state.historyIndex < state.history.length - 1,
		isLoadingConfig: newGameQuery.isLoading || resumeQuery.isLoading,
		remainingHints: state.remainingHints,
		hintBlocked: !!state.hintBlocked,
		maxHints: state.maxHints,
		generateGame,
		startWithConfig,
		startServerRound,
		selectCell,
		fillCell,
		eraseCell,
		toggleNote,
		hint,
		undo,
		redo,
		exitToMenu,
		continueAfterLoss,
		pause,
		resume,
	};
}
