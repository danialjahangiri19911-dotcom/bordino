import { produce } from "immer";

import { gameReducer } from "./reducer";
import { deserializeGameState, serializeGameState } from "./storage";
import type { GameState } from "./types";

// Through immer, as the app runs it (useImmerReducer): notes are Sets inside the draft.
function game() {
	let s = {
		solution: [], board: [], selectedCell: null, rowCounts: [], colCounts: [], squareCounts: [], history: [], historyIndex: 0,
		difficulty: null, status: "menu", mistakes: 0, timeRemaining: 0, maxTime: 0, maxMistakes: 3, maxHints: 0, remainingHints: 0,
		conflicts: [], numberProgress: [], paused: false,
	} as unknown as GameState;
	const run = (action: unknown) => {
		s = produce(s, (draft) => gameReducer(draft as GameState, action as never));
	};
	const puzzle = Array.from({ length: 9 }, () => Array(9).fill(0));
	const solution = Array.from({ length: 9 }, (_, r) => Array.from({ length: 9 }, (_, c) => ((r * 3 + Math.floor(r / 3) + c) % 9) + 1));
	run({ type: "START_GAME", payload: { puzzle, solution, difficulty: "easy", config: { id: "c", game_name: "sudoku", difficulty_level: "easy", timer: 600, max_errors: 3, hint_count: 5, daily_score_limit: 0, is_active: true, action_scores: [] } } });
	return { run, get: () => s };
}

describe("sudoku notes (Codex audit phase 4)", () => {
	it("a move after a note works, and undo/redo keep the notes as notes", () => {
		const g = game();
		g.run({ type: "SELECT_CELL", payload: { x: 0, y: 0 } });
		g.run({ type: "TOGGLE_NOTE", payload: { value: 3 } });
		g.run({ type: "TOGGLE_NOTE", payload: { value: 7 } });
		g.run({ type: "SELECT_CELL", payload: { x: 1, y: 0 } });
		g.run({ type: "FILL_CELL", payload: { value: 2 } }); // threw before: immer could not draft the Set
		expect(g.get().board[1][0].value).toBe(2); // board[x][y]: x is the row
		g.run({ type: "UNDO" });
		expect([...(g.get().board[0][0].notes ?? [])].sort()).toEqual([3, 7]);
		expect(g.get().board[1][0].value).toBeNull();
		g.run({ type: "REDO" });
		expect([...(g.get().board[0][0].notes ?? [])].sort()).toEqual([3, 7]);
		// Still editable after undo/redo.
		g.run({ type: "SELECT_CELL", payload: { x: 0, y: 0 } });
		g.run({ type: "TOGGLE_NOTE", payload: { value: 3 } });
		expect([...(g.get().board[0][0].notes ?? [])]).toEqual([7]);
	});

	it("notes in the board and the history survive a save and reload", () => {
		const g = game();
		g.run({ type: "SELECT_CELL", payload: { x: 0, y: 0 } });
		g.run({ type: "TOGGLE_NOTE", payload: { value: 5 } });
		g.run({ type: "SELECT_CELL", payload: { x: 2, y: 0 } });
		g.run({ type: "FILL_CELL", payload: { value: 4 } });
		const back = deserializeGameState(JSON.parse(JSON.stringify(serializeGameState(g.get())))) as GameState;
		expect([...(back.board[0][0].notes ?? [])]).toEqual([5]);
		expect(back.history.some((b) => b[0][0].notes?.has(5))).toBe(true);
	});
});
