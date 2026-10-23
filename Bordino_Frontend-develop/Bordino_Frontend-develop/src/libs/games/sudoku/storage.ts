import {
	type Board,
	type CellValue,
	type Coordinate,
	type Difficulty,
} from "./types";
import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";

import { currentUserId } from "@/libs/stores/authStore";

// ----------------------------------------------------------------------
// Types matching the game state we need to persist
// ----------------------------------------------------------------------
export interface PersistedCellMeta {
	value: CellValue | null;
	prefilled: boolean;
	notes: number[] | null; // store as array for JSON serialization
}

export type PersistedBoard = PersistedCellMeta[][];

export interface PersistedGameState {
	// Core game data
	solution: Board;
	board: PersistedBoard;
	selectedCell: Coordinate | null;
	rowCounts: number[][];
	colCounts: number[][];
	squareCounts: number[][];
	history: PersistedBoard[];
	historyIndex: number;

	// Progress features
	difficulty: Difficulty | null;
	status: "menu" | "playing" | "won" | "lost";
	mistakes: number;
	timeRemaining: number;
	maxTime: number;
	maxMistakes: number;

	// New: hint limits from config
	maxHints: number;
	remainingHints: number;

	// Unlock progress
	completions: {
		easy: number;
		medium: number;
	};

	// Timestamp for resume validation
	lastUpdated: number;
}

// ----------------------------------------------------------------------
// Helper to convert between Set and array for JSON serialization
// ----------------------------------------------------------------------
function serializeNotes(notes: Set<CellValue> | null): number[] | null {
	if (!notes) return null;
	return Array.from(notes).sort();
}

function deserializeNotes(notesArray: number[] | null): Set<CellValue> | null {
	if (!notesArray) return null;
	return new Set(notesArray as CellValue[]);
}

// Convert from our runtime format (with Sets) to persisted format (arrays)
export function serializeGameState(state: any): PersistedGameState {
	const serializeBoard = (board: any[][]): PersistedBoard => {
		return board.map((row) =>
			row.map((cell) => ({
				value: cell.value,
				prefilled: cell.prefilled,
				notes: serializeNotes(cell.notes),
			})),
		);
	};

	return {
		solution: state.solution,
		board: serializeBoard(state.board),
		selectedCell: state.selectedCell,
		rowCounts: state.rowCounts,
		colCounts: state.colCounts,
		squareCounts: state.squareCounts,
		history: state.history.map(serializeBoard),
		historyIndex: state.historyIndex,
		difficulty: state.difficulty,
		status: state.status,
		mistakes: state.mistakes,
		timeRemaining: state.timeRemaining,
		maxTime: state.maxTime,
		maxMistakes: state.maxMistakes,
		maxHints: state.maxHints,
		remainingHints: state.remainingHints,
		completions: {
			easy: state.completions?.easy ?? 0,
			medium: state.completions?.medium ?? 0,
		},
		lastUpdated: Date.now(),
	};
}

// Convert from persisted format back to runtime format (with Sets)
export function deserializeGameState(persisted: PersistedGameState): any {
	const deserializeBoard = (board: PersistedBoard): any[][] => {
		return board.map((row) =>
			row.map((cell) => ({
				value: cell.value,
				prefilled: cell.prefilled,
				notes: deserializeNotes(cell.notes),
			})),
		);
	};

	return {
		solution: persisted.solution,
		board: deserializeBoard(persisted.board),
		selectedCell: persisted.selectedCell,
		rowCounts: persisted.rowCounts,
		colCounts: persisted.colCounts,
		squareCounts: persisted.squareCounts,
		history: persisted.history.map(deserializeBoard),
		historyIndex: persisted.historyIndex,
		difficulty: persisted.difficulty,
		status: persisted.status,
		mistakes: persisted.mistakes,
		timeRemaining: persisted.timeRemaining,
		maxTime: persisted.maxTime,
		maxMistakes: persisted.maxMistakes,
		maxHints: persisted.maxHints ?? 0, // fallback for old saves
		remainingHints: persisted.remainingHints ?? 0,
		completions: persisted.completions,
	};
}

// ----------------------------------------------------------------------
// Zustand store interface
// ----------------------------------------------------------------------
type Completions = { easy: number; medium: number };
const NO_COMPLETIONS: Completions = { easy: 0, medium: 0 };

interface SudokuStore {
	// Persisted game state (the board in progress)
	gameState: PersistedGameState | null;
	// Levels completed: kept apart from the board, so leaving a game keeps the unlocks.
	completions: Completions | null;
	// Whose save this is (JWT user id): on a shared phone, another account starts fresh.
	owner: string | null;

	// Actions
	ensureOwner: () => void;
	saveGame: (state: any) => void;
	clearGame: () => void;
	recordCompletion: (difficulty: Difficulty) => void;
	getCompletionCounts: () => Completions;
	isMediumUnlocked: () => boolean;
	isHardUnlocked: () => boolean;
}

// ----------------------------------------------------------------------
// Create the store with persistence
// ----------------------------------------------------------------------
export const useSudokuStore = create<SudokuStore>()(
	persist(
		(set, get) => {
			// Completions of the current user (older saves kept them inside gameState).
			const owned = (): Completions => {
				const { owner, completions, gameState } = get();
				if (owner !== currentUserId()) return NO_COMPLETIONS;
				return completions ?? gameState?.completions ?? NO_COMPLETIONS;
			};
			return {
				gameState: null,
				completions: null,
				owner: null,

				ensureOwner: () => {
					const me = currentUserId();
					if (get().owner !== me) set({ gameState: null, completions: null, owner: me });
				},

				saveGame: (state: any) => {
					const serialized = serializeGameState(state);
					set({ gameState: serialized, owner: currentUserId() });
				},

				clearGame: () => {
					set({ gameState: null });
				},

				recordCompletion: (difficulty: Difficulty) => {
					const completions = { ...owned() };
					if (difficulty === "easy") {
						completions.easy += 1;
					} else if (difficulty === "medium") {
						completions.medium += 1;
					}
					// Hard completions aren't tracked for unlocking further
					set({ completions, owner: currentUserId() });
				},

				getCompletionCounts: () => owned(),

				isMediumUnlocked: () => owned().easy >= 1,

				isHardUnlocked: () => owned().medium >= 2,
			};
		},
		{
			name: "sudoku-evolved-storage", // unique name for localStorage
			storage: createJSONStorage(() => localStorage),
			partialize: (state) => ({
				gameState: state.gameState,
				completions: state.completions,
				owner: state.owner,
			}),
		},
	),
);
