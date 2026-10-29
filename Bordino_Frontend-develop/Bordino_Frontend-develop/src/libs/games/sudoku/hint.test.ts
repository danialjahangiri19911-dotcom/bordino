import { produce } from "immer";

import { countSolutions, makePuzzle, solveBoard } from "./generation";
import { gameReducer } from "./reducer";
import type { Board, CellValue, GameState } from "./types";

/** An old-style board: a real solution with numbers removed until it has a SECOND answer. */
function ambiguousBoard() {
	for (;;) {
		const solution = makePuzzle();
		const puzzle = solution.map((r) => [...r]) as Board;
		const order = Array.from({ length: 81 }, (_, i) => i).sort(() => Math.random() - 0.5);
		for (const i of order) {
			puzzle[Math.floor(i / 9)][i % 9] = 0;
			if (countSolutions(puzzle, 2) === 2) break;
		}
		// The other answer: try a different number in an empty cell until one still solves.
		for (let i = 0; i < 81; i++) {
			const x = Math.floor(i / 9);
			const y = i % 9;
			if (puzzle[x][y]) continue;
			for (let v = 1; v <= 9; v++) {
				if (v === solution[x][y]) continue;
				const tried = puzzle.map((r) => [...r]) as Board;
				tried[x][y] = v as CellValue;
				const other = solveBoard(tried);
				if (other) return { puzzle, solution, other, x, y };
			}
		}
	}
}

function start(puzzle: Board, solution: Board) {
	let s = {
		solution: [], board: [], selectedCell: null, rowCounts: [], colCounts: [], squareCounts: [], history: [], historyIndex: 0,
		difficulty: null, status: "menu", mistakes: 0, timeRemaining: 0, maxTime: 0, maxMistakes: 3, maxHints: 0, remainingHints: 0,
		conflicts: [], numberProgress: [], paused: false,
	} as unknown as GameState;
	const run = (action: unknown) => {
		s = produce(s, (d) => gameReducer(d as GameState, action as never));
	};
	run({ type: "START_GAME", payload: { puzzle, solution, difficulty: "easy", config: { id: "c", game_name: "sudoku", difficulty_level: "easy", timer: 0, max_errors: 3, hint_count: 3, daily_score_limit: 0, is_active: true, action_scores: [] } } });
	return { run, get: () => s };
}

describe("sudoku hints (player report: a board with no correct answer)", () => {
	it("on a board with two answers, a hint follows the answer the player is filling — no clash, no lost life", () => {
		const { puzzle, solution, other, x, y } = ambiguousBoard();
		const g = start(puzzle, solution);
		// The player fills the OTHER answer everywhere except one cell where the two answers differ.
		for (let r = 0; r < 9; r++)
			for (let c = 0; c < 9; c++) {
				if (puzzle[r][c] || (r === x && c === y)) continue;
				g.run({ type: "SELECT_CELL", payload: { x: r, y: c } });
				g.run({ type: "FILL_CELL", payload: { value: other[r][c] } });
			}
		expect(g.get().mistakes).toBe(0);
		g.run({ type: "SELECT_CELL", payload: { x, y } });
		g.run({ type: "HINT" });
		expect(g.get().board[x][y].value).toBe(other[x][y]); // not the stored solution's number
		expect(g.get().mistakes).toBe(0);
		expect(g.get().status).toBe("won");
	});

	it("when the player's numbers fit no answer, a hint fills nothing and costs nothing", () => {
		const { puzzle, solution, other, x, y } = ambiguousBoard();
		const g = start(puzzle, solution);
		// Two cells from different answers can leave the board unsolvable; find such a pair.
		const empties: [number, number][] = [];
		for (let r = 0; r < 9; r++) for (let c = 0; c < 9; c++) if (!puzzle[r][c] && !(r === x && c === y)) empties.push([r, c]);
		const mix = puzzle.map((r) => [...r]) as Board;
		mix[x][y] = other[x][y];
		let placed: [number, number] | null = null;
		for (const [r, c] of empties) {
			if (other[r][c] === solution[r][c]) continue;
			const t = mix.map((row) => [...row]) as Board;
			t[r][c] = solution[r][c];
			if (!solveBoard(t)) {
				placed = [r, c];
				break;
			}
		}
		if (!placed) return; // this board had no such pair (rare): nothing to check
		g.run({ type: "SELECT_CELL", payload: { x, y } });
		g.run({ type: "FILL_CELL", payload: { value: other[x][y] } });
		g.run({ type: "SELECT_CELL", payload: { x: placed[0], y: placed[1] } });
		g.run({ type: "FILL_CELL", payload: { value: solution[placed[0]][placed[1]] } });
		const before = g.get();
		const target = empties.find(([r, c]) => !(r === placed![0] && c === placed![1]))!;
		g.run({ type: "SELECT_CELL", payload: { x: target[0], y: target[1] } });
		g.run({ type: "HINT" });
		expect(g.get().board[target[0]][target[1]].value).toBeNull();
		expect(g.get().remainingHints).toBe(before.remainingHints);
		expect(g.get().mistakes).toBe(before.mistakes);
		expect(g.get().hintBlocked).toBe(true);
	});
});
