import { call } from "@/api/games/request";
import type { Board, Difficulty } from "@/libs/games/sudoku/types";
import { withRequestId } from "@/libs/http/requestId";

export interface SudokuRound {
	id: string;
	difficulty: Difficulty;
	/** 9 rows of 9, 0 = empty. The server keeps the solution. */
	puzzle: Board;
	status: "active" | "won";
	create_time: string;
}

export interface SudokuReport {
	round: SudokuRound;
	/** What this report paid now (each reward pays once per player). */
	awarded: { action: string; points: number }[];
	/** Why a finished board was not paid as a win (e.g. solved faster than possible). */
	note: string;
}

/**
 * Sudoku judged on the server (apps/crash sudoku): a game starts there — charged and given a
 * puzzle with exactly one solution — and the board rewards are paid there, against that puzzle.
 */
export const sudokuApi = {
	/** Pays for a game and gets its puzzle. A retry after a lost answer gets the same board. */
	start: (difficulty: Difficulty) =>
		withRequestId(`sudoku:start:${difficulty}`, (requestId) =>
			call<{ round: SudokuRound; balance: number }>("post", "games/sudoku/rounds/", { difficulty, request_id: requestId }),
		),
	/** The board as it is now; the server pays the finished rows/boxes and the win it shows. */
	report: (roundId: string, board: number[][]) => call<SudokuReport>("post", `games/sudoku/rounds/${roundId}/report/`, { board }),
};
