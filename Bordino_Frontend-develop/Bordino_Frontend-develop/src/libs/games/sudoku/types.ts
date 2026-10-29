export type CellValue = 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9;
export type Board = (CellValue | 0)[][]; // 0 = empty
export type Index = 0 | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8;
export type Coordinate = { x: Index; y: Index };
export type Difficulty = "easy" | "medium" | "hard";

export type CellMeta = {
	value: CellValue | null;
	prefilled: boolean;
	notes: Set<CellValue> | null;
};

export type BoardWithMeta = CellMeta[][];
export type GroupCounts = number[][]; // 9 x 10, index 0 unused
export type GameStatus = "menu" | "playing" | "won" | "lost";

export interface GameConfig {
	id: string;
	game_name: string;
	difficulty_level: string; // 'easy' | 'medium' | 'hard' (or dynamic)
	timer: number; // seconds
	max_errors: number;
	hint_count: number;
	daily_score_limit: number;
	is_active: boolean;
	action_scores: any[];
}

export interface GameState {
	// Core board data
	solution: Board;
	board: BoardWithMeta;
	selectedCell: Coordinate | null;
	rowCounts: GroupCounts;
	colCounts: GroupCounts;
	squareCounts: GroupCounts;
	history: BoardWithMeta[];
	historyIndex: number;

	// New game progress features
	difficulty: Difficulty | null;
	status: GameStatus;
	mistakes: number; // cumulative mistakes (0..maxMistakes)
	timeRemaining: number; // seconds
	maxMistakes: number;
	maxTime: number; // initial time limit for current difficulty
	/** «مکث»: the clock stops and the board takes no input until resumed (kept in the save). */
	paused?: boolean;

	// New: hint limits from config
	maxHints: number;
	remainingHints: number;
	/** The server's round this board belongs to (null: a board from before server-judged games). */
	roundId?: string | null;
	/** The last «کمک» found no answer that fits the numbers on the board (nothing was filled). */
	hintBlocked?: boolean;

	// Derived data
	conflicts: boolean[][];
	numberProgress: number[];
}

export type GameAction =
	| {
			type: "START_GAME";
			payload: {
				puzzle: Board;
				solution: Board;
				difficulty: Difficulty;
				config: GameConfig;
				/** The server's round for this board (its rewards are paid against it). */
				roundId?: string | null;
			};
	  }
	| { type: "SELECT_CELL"; payload: { x: Index; y: Index } }
	| { type: "FILL_CELL"; payload: { value: CellValue } }
	| { type: "ERASE_CELL" }
	| { type: "TOGGLE_NOTE"; payload: { value: CellValue } }
	| { type: "HINT" }
	| { type: "UNDO" }
	| { type: "REDO" }
	| { type: "TICK" } // timer decrement
	| { type: "PAUSE" }
	| { type: "RESUME" }
	| { type: "EXIT_TO_MENU" }
	| { type: "CONTINUE_AFTER_LOSS" } // ادامهٔ بازی پس از باخت (با کسرِ امتیاز)
	| { type: "RESTORE_GAME"; payload: { savedState: GameState } }
	| {
			type: "UPDATE_CONFIG";
			payload: {
				maxTime?: number;
				maxMistakes?: number;
				maxHints?: number;
				remainingHints?: number;
			};
	  };
