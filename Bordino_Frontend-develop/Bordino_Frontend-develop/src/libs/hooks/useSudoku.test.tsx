import { act } from "react";
import { createRoot } from "react-dom/client";

import { useSudoku } from "./useSudoku";
import { makePuzzle, pluck } from "@/libs/games/sudoku/generation";
import { gameReducer } from "@/libs/games/sudoku/reducer";
import { serializeGameState, useSudokuStore } from "@/libs/games/sudoku/storage";
import type { GameState } from "@/libs/games/sudoku/types";
import useAuthStore from "@/libs/stores/authStore";

jest.mock("@/api/game/useGameConfig", () => ({ __esModule: true, default: () => ({ config: undefined }) }));
jest.mock("./useRecordSudokuActions", () => ({ useRecordSudokuActions: () => ({}) }));
jest.mock("@/libs/components/atoms/Toast", () => ({ toast: { info: jest.fn(), error: jest.fn(), success: jest.fn() } }));

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
const b64 = (o: object) => Buffer.from(JSON.stringify(o)).toString("base64url");
const as = (user: string) => {
	const jwt = `${b64({ alg: "HS256" })}.${b64({ user_id: user, exp: 9999999999 })}.s`;
	useAuthStore.setState({ isLoggedIn: true, accessToken: jwt, refreshToken: jwt });
};

function savedGame() {
	const solution = makePuzzle();
	const { puzzle } = pluck(solution, 36);
	const s = {
		solution: [], board: [], selectedCell: null, rowCounts: [], colCounts: [], squareCounts: [], history: [], historyIndex: 0,
		difficulty: null, status: "menu", mistakes: 0, timeRemaining: 0, maxTime: 0, maxMistakes: 3, maxHints: 0, remainingHints: 0,
		conflicts: [], numberProgress: [], paused: true,
	} as unknown as GameState;
	gameReducer(s, { type: "START_GAME", payload: { puzzle, solution, difficulty: "easy", config: { id: "c", game_name: "sudoku", difficulty_level: "easy", timer: 0, max_errors: 3, hint_count: 3, daily_score_limit: 0, is_active: true, action_scores: [] } } } as never);
	return serializeGameState(s);
}

function mount() {
	let api!: ReturnType<typeof useSudoku>;
	function Probe() {
		api = useSudoku();
		return null;
	}
	const root = createRoot(document.createElement("div"));
	act(() => root.render(<Probe />));
	return { get: () => api, root };
}

describe("sudoku save per account (Codex sudoku check)", () => {
	beforeEach(() => localStorage.clear());

	it("account B does not get account A's saved game", () => {
		as("a");
		useSudokuStore.setState({ owner: "a", gameState: savedGame(), completions: null });
		as("b");
		const g = mount();
		expect(g.get().status).toBe("menu");
		expect(useSudokuStore.getState().gameState).toBeNull();
		expect(useSudokuStore.getState().owner).toBe("b");
		act(() => g.root.unmount());
	});

	it("the same account gets its saved game back", () => {
		as("a");
		useSudokuStore.setState({ owner: "a", gameState: savedGame(), completions: null });
		const g = mount();
		expect(g.get().status).toBe("playing");
		act(() => g.root.unmount());
	});

	it("a damaged save (board and solution disagree) is dropped, not played", () => {
		as("a");
		const save = savedGame();
		const x = save.board.findIndex((row) => row.some((c) => c.prefilled));
		const y = save.board[x].findIndex((c) => c.prefilled);
		save.board[x][y].value = (((save.board[x][y].value ?? 1) % 9) + 1) as never;
		useSudokuStore.setState({ owner: "a", gameState: save, completions: null });
		const g = mount();
		expect(g.get().status).toBe("menu");
		expect(useSudokuStore.getState().gameState).toBeNull();
		act(() => g.root.unmount());
	});
});
