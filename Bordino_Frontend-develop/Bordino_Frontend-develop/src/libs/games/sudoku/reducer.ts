import {
	computeConflicts,
	computeNumberProgress,
	initializeBoard,
	isBoardCompleteAndValid,
} from "./helpers";
import type { Board, CellValue, GameAction, GameState } from "./types";

export function gameReducer(draft: GameState, action: GameAction): void {
	switch (action.type) {
		case "START_GAME": {
			const { puzzle, solution, difficulty, config } = action.payload;
			const { board, rowCounts, colCounts, squareCounts } =
				initializeBoard(puzzle);
			draft.solution = solution;
			draft.board = board;
			draft.rowCounts = rowCounts;
			draft.colCounts = colCounts;
			draft.squareCounts = squareCounts;
			draft.selectedCell = null;
			draft.history = [board];
			draft.historyIndex = 0;
			draft.difficulty = difficulty;
			draft.status = "playing";
			draft.mistakes = 0;
			draft.maxTime = config.timer; // may be 0 or positive
			draft.timeRemaining = config.timer; // same as maxTime
			draft.maxMistakes = config.max_errors;
			draft.maxHints = config.hint_count;
			draft.remainingHints = config.hint_count;
			draft.conflicts = computeConflicts(
				board,
				rowCounts,
				colCounts,
				squareCounts,
			);
			draft.numberProgress = computeNumberProgress(
				rowCounts,
				colCounts,
				squareCounts,
			);
			break;
		}

		case "SELECT_CELL": {
			draft.selectedCell = action.payload;
			break;
		}

		case "FILL_CELL": {
			if (!draft.selectedCell) break;
			if (draft.status !== "playing") break;

			const { x, y } = draft.selectedCell;
			const cell = draft.board[x][y];
			if (cell.prefilled) break;
			const { value } = action.payload;

			// Remember old conflict state for this cell (to detect new mistake)
			const oldConflict = draft.conflicts[x][y];

			// Remove current value if exists
			if (cell.value) {
				const oldVal = cell.value;
				draft.rowCounts[x][oldVal] -= 1;
				draft.colCounts[y][oldVal] -= 1;
				const squareIdx = Math.floor(x / 3) * 3 + Math.floor(y / 3);
				draft.squareCounts[squareIdx][oldVal] -= 1;
				cell.value = null;
				cell.notes = null;
			}

			// Set new value if different
			if (cell.value !== value) {
				cell.value = value;
				cell.notes = null;
				draft.rowCounts[x][value] += 1;
				draft.colCounts[y][value] += 1;
				const squareIdx = Math.floor(x / 3) * 3 + Math.floor(y / 3);
				draft.squareCounts[squareIdx][value] += 1;
			}

			// Recompute conflicts and progress
			draft.conflicts = computeConflicts(
				draft.board,
				draft.rowCounts,
				draft.colCounts,
				draft.squareCounts,
			);
			draft.numberProgress = computeNumberProgress(
				draft.rowCounts,
				draft.colCounts,
				draft.squareCounts,
			);

			// Mistake detection: if this cell now has a conflict AND it didn't have one before,
			// and we actually set a value (not erased), then increment mistakes.
			if (value !== null) {
				const newConflict = draft.conflicts[x][y];
				if (!oldConflict && newConflict) {
					draft.mistakes += 1;
					if (draft.mistakes >= draft.maxMistakes) {
						draft.status = "lost";
					}
				}
			}

			// Win detection
			if (
				draft.status === "playing" &&
				isBoardCompleteAndValid(
					draft.board,
					draft.rowCounts,
					draft.colCounts,
					draft.squareCounts,
				)
			) {
				draft.status = "won";
			}

			// History (only if game still active)
			if (draft.status === "playing" || draft.status === "won") {
				draft.history = draft.history.slice(0, draft.historyIndex + 1);
				draft.history.push(JSON.parse(JSON.stringify(draft.board)));
				draft.historyIndex = draft.history.length - 1;
			}
			break;
		}

		case "ERASE_CELL": {
			if (!draft.selectedCell) break;
			if (draft.status !== "playing") break;
			const { x, y } = draft.selectedCell;
			const cell = draft.board[x][y];
			if (cell.prefilled || !cell.value) break;

			const oldVal = cell.value;
			draft.rowCounts[x][oldVal] -= 1;
			draft.colCounts[y][oldVal] -= 1;
			const squareIdx = Math.floor(x / 3) * 3 + Math.floor(y / 3);
			draft.squareCounts[squareIdx][oldVal] -= 1;

			cell.value = null;
			cell.notes = null;

			draft.conflicts = computeConflicts(
				draft.board,
				draft.rowCounts,
				draft.colCounts,
				draft.squareCounts,
			);
			draft.numberProgress = computeNumberProgress(
				draft.rowCounts,
				draft.colCounts,
				draft.squareCounts,
			);

			draft.history = draft.history.slice(0, draft.historyIndex + 1);
			draft.history.push(JSON.parse(JSON.stringify(draft.board)));
			draft.historyIndex = draft.history.length - 1;
			break;
		}

		case "TOGGLE_NOTE": {
			if (!draft.selectedCell) break;
			if (draft.status !== "playing") break;
			const { x, y } = draft.selectedCell;
			const cell = draft.board[x][y];
			if (cell.prefilled || cell.value) break;

			if (!cell.notes) cell.notes = new Set<CellValue>();
			if (cell.notes.has(action.payload.value)) {
				cell.notes.delete(action.payload.value);
				if (cell.notes.size === 0) cell.notes = null;
			} else {
				cell.notes.add(action.payload.value);
			}

			draft.history = draft.history.slice(0, draft.historyIndex + 1);
			draft.history.push(JSON.parse(JSON.stringify(draft.board)));
			draft.historyIndex = draft.history.length - 1;
			break;
		}

		case "HINT": {
			if (!draft.selectedCell) break;
			if (draft.status !== "playing") break;
			// Check if hints are available
			if (draft.remainingHints <= 0) break;

			const { x, y } = draft.selectedCell;
			const cell = draft.board[x][y];
			if (cell.prefilled || cell.value) break;

			const solutionValue = draft.solution[x][y] as CellValue;
			const oldConflict = draft.conflicts[x][y];

			if (cell.value) {
				const oldVal = cell.value;
				draft.rowCounts[x][oldVal] -= 1;
				draft.colCounts[y][oldVal] -= 1;
				const squareIdx = Math.floor(x / 3) * 3 + Math.floor(y / 3);
				draft.squareCounts[squareIdx][oldVal] -= 1;
				cell.value = null;
				cell.notes = null;
			}

			cell.value = solutionValue;
			cell.notes = null;
			draft.rowCounts[x][solutionValue] += 1;
			draft.colCounts[y][solutionValue] += 1;
			const squareIdx = Math.floor(x / 3) * 3 + Math.floor(y / 3);
			draft.squareCounts[squareIdx][solutionValue] += 1;

			draft.conflicts = computeConflicts(
				draft.board,
				draft.rowCounts,
				draft.colCounts,
				draft.squareCounts,
			);
			draft.numberProgress = computeNumberProgress(
				draft.rowCounts,
				draft.colCounts,
				draft.squareCounts,
			);

			// Mistake detection (hint might create conflict if board state is inconsistent)
			const newConflict = draft.conflicts[x][y];
			if (!oldConflict && newConflict) {
				draft.mistakes += 1;
				if (draft.mistakes >= draft.maxMistakes) {
					draft.status = "lost";
				}
			}

			// Decrement hint count
			draft.remainingHints -= 1;

			if (
				draft.status === "playing" &&
				isBoardCompleteAndValid(
					draft.board,
					draft.rowCounts,
					draft.colCounts,
					draft.squareCounts,
				)
			) {
				draft.status = "won";
			}

			draft.history = draft.history.slice(0, draft.historyIndex + 1);
			draft.history.push(JSON.parse(JSON.stringify(draft.board)));
			draft.historyIndex = draft.history.length - 1;
			break;
		}

		case "UNDO": {
			if (draft.historyIndex > 0) {
				draft.historyIndex -= 1;
				draft.board = JSON.parse(
					JSON.stringify(draft.history[draft.historyIndex]),
				);
				const { rowCounts, colCounts, squareCounts } = initializeBoard(
					draft.board.map((row) =>
						row.map((cell) => (cell.value ? cell.value : 0)),
					) as Board,
				);
				draft.rowCounts = rowCounts;
				draft.colCounts = colCounts;
				draft.squareCounts = squareCounts;
				draft.conflicts = computeConflicts(
					draft.board,
					rowCounts,
					colCounts,
					squareCounts,
				);
				draft.numberProgress = computeNumberProgress(
					rowCounts,
					colCounts,
					squareCounts,
				);
				// Note: mistakes and hints are NOT decreased on undo – they remain cumulative.
			}
			break;
		}

		case "REDO": {
			if (draft.historyIndex < draft.history.length - 1) {
				draft.historyIndex += 1;
				draft.board = JSON.parse(
					JSON.stringify(draft.history[draft.historyIndex]),
				);
				const { rowCounts, colCounts, squareCounts } = initializeBoard(
					draft.board.map((row) =>
						row.map((cell) => (cell.value ? cell.value : 0)),
					) as Board,
				);
				draft.rowCounts = rowCounts;
				draft.colCounts = colCounts;
				draft.squareCounts = squareCounts;
				draft.conflicts = computeConflicts(
					draft.board,
					rowCounts,
					colCounts,
					squareCounts,
				);
				draft.numberProgress = computeNumberProgress(
					rowCounts,
					colCounts,
					squareCounts,
				);
			}
			break;
		}

		case "TICK": {
			// Only count down if there is a positive time limit
			if (draft.status === "playing" && draft.timeRemaining > 0) {
				draft.timeRemaining -= 1;
				if (draft.timeRemaining === 0) {
					draft.status = "lost";
				}
			}
			break;
		}

		case "EXIT_TO_MENU": {
			draft.status = "menu";
			draft.difficulty = null;
			draft.board = [];
			draft.selectedCell = null;
			draft.maxHints = 0;
			draft.remainingHints = 0;
			break;
		}

		case "RESTORE_GAME": {
			const { savedState } = action.payload;
			draft.solution = savedState.solution;
			draft.board = savedState.board;
			draft.selectedCell = savedState.selectedCell;
			draft.rowCounts = savedState.rowCounts;
			draft.colCounts = savedState.colCounts;
			draft.squareCounts = savedState.squareCounts;
			draft.history = savedState.history;
			draft.historyIndex = savedState.historyIndex;
			draft.difficulty = savedState.difficulty;
			draft.status = savedState.status;
			draft.mistakes = savedState.mistakes;
			draft.timeRemaining = savedState.timeRemaining;
			draft.maxTime = savedState.maxTime;
			draft.maxMistakes = savedState.maxMistakes;
			draft.maxHints = savedState.maxHints;
			draft.remainingHints = savedState.remainingHints;
			draft.conflicts = computeConflicts(
				draft.board,
				draft.rowCounts,
				draft.colCounts,
				draft.squareCounts,
			);
			draft.numberProgress = computeNumberProgress(
				draft.rowCounts,
				draft.colCounts,
				draft.squareCounts,
			);
			break;
		}

		case "UPDATE_CONFIG": {
			const { maxTime, maxMistakes, maxHints, remainingHints } = action.payload;
			if (maxTime !== undefined) {
				draft.maxTime = maxTime;
				// Reset the timer to the new limit (0 means unlimited)
				draft.timeRemaining = maxTime;
			}
			if (maxMistakes !== undefined) draft.maxMistakes = maxMistakes;
			if (maxHints !== undefined) draft.maxHints = maxHints;
			if (remainingHints !== undefined) draft.remainingHints = remainingHints;
			break;
		}

		default:
			break;
	}
}
