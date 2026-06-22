export type Tile = {
	id: string;
	position: [number, number];
	value: number;
};

export type TileMap = { [id: string]: Tile };

export type Board = (string | undefined)[][];

export type Direction = "up" | "down" | "left" | "right";

export type GameStatus = "ongoing" | "won" | "lost";

export type GameState = {
	board: Board;
	tiles: TileMap;
	tilesByIds: string[];
	hasChanged?: boolean;
	score: number;
	status: GameStatus;
	timeRemaining: number;
	moveCount: number;
	historyIndex: number; // current position in history
	historyLength: number; // total number of snapshots
};

// Snapshot used for undo/redo – excludes the real‑time timer
export type GameStateSnapshot = Omit<GameState, "timeRemaining">;
