import { gameReducer } from "./reducer";
import { deserializeGameState, serializeGameState } from "./storage";
import type { GameState } from "./types";

function playing(): GameState {
	const state = {
		solution: [], board: [], selectedCell: null, rowCounts: [], colCounts: [], squareCounts: [], history: [], historyIndex: 0,
		difficulty: null, status: "menu", mistakes: 0, timeRemaining: 0, maxTime: 0, maxMistakes: 3, maxHints: 0, remainingHints: 0,
		conflicts: [], numberProgress: [],
	} as unknown as GameState;
	const puzzle = Array.from({ length: 9 }, () => Array(9).fill(0));
	const solution = Array.from({ length: 9 }, (_, r) => Array.from({ length: 9 }, (_, c) => ((r * 3 + Math.floor(r / 3) + c) % 9) + 1));
	gameReducer(state, {
		type: "START_GAME",
		payload: { puzzle, solution, difficulty: "easy", config: { id: "c", game_name: "sudoku", difficulty_level: "easy", timer: 600, max_errors: 3, hint_count: 5, daily_score_limit: 0, is_active: true, action_scores: [] } },
	} as never);
	return state;
}

describe("sudoku pause", () => {
	it("stops the clock and blocks the board until resumed", () => {
		const s = playing();
		gameReducer(s, { type: "TICK" });
		expect(s.timeRemaining).toBe(599);
		gameReducer(s, { type: "PAUSE" });
		gameReducer(s, { type: "TICK" });
		gameReducer(s, { type: "SELECT_CELL", payload: { x: 0, y: 0 } });
		gameReducer(s, { type: "FILL_CELL", payload: { value: 5 } });
		expect(s.timeRemaining).toBe(599);
		expect(s.board[0][0].value).toBeNull();
		gameReducer(s, { type: "RESUME" });
		gameReducer(s, { type: "FILL_CELL", payload: { value: 5 } });
		gameReducer(s, { type: "TICK" });
		expect(s.board[0][0].value).toBe(5);
		expect(s.timeRemaining).toBe(598);
	});

	it("only a running game can be paused, and the save keeps the pause", () => {
		const s = playing();
		gameReducer(s, { type: "PAUSE" });
		const restored = deserializeGameState(serializeGameState(s));
		expect(restored.paused).toBe(true);
		const menu = playing();
		gameReducer(menu, { type: "EXIT_TO_MENU" });
		gameReducer(menu, { type: "PAUSE" });
		expect(menu.paused).toBeFalsy();
	});
});
