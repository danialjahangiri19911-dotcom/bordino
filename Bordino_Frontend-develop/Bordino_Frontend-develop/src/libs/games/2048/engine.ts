import { INITIAL_TIME, TILE_COUNT_PER_DIMENSION } from "./constants";
import { createEmptyBoard, getEmptyCells } from "./grid";
import type { MoveResult } from "./moves";
import { moveDown, moveLeft, moveRight, moveUp } from "./moves";
import type { StoredGameState } from "./persistence";
import { createRandomTile } from "./tile-generator";
import type { Direction, GameState, GameStateSnapshot, TileMap } from "./types";
import { checkLoss, checkWin } from "./win-loss";

import { MAX_HISTORY_SIZE } from "@/constants/2048";

type Listener = (state: GameState) => void;

export class GameEngine {
	private state: GameState;
	private listeners: Listener[] = [];
	private history: GameStateSnapshot[] = [];
	private currentHistoryIndex = -1;
	private maxHistorySize = MAX_HISTORY_SIZE;

	constructor() {
		this.state = this.getInitialState();
	}

	private getInitialState(): GameState {
		return {
			board: createEmptyBoard(),
			tiles: {},
			tilesByIds: [],
			hasChanged: false,
			score: 0,
			status: "ongoing",
			timeRemaining: INITIAL_TIME,
			moveCount: 0,
			historyIndex: -1,
			historyLength: 0,
		};
	}

	public subscribe(listener: Listener): () => void {
		this.listeners.push(listener);
		return () => {
			this.listeners = this.listeners.filter((l) => l !== listener);
		};
	}

	private notify() {
		this.listeners.forEach((listener) => listener(this.state));
	}

	public getState(): GameState {
		return this.state;
	}

	// Record the current state as a new history entry (used after tile addition)
	public commitMove() {
		// Truncate any future history (if we had undone some moves)
		this.history = this.history.slice(0, this.currentHistoryIndex + 1);

		const snapshot = {
			...this.state,
			board: this.state.board.map((row) => [...row]), // copy rows (strings are immutable)
			tiles: { ...this.state.tiles }, // copy map (tile objects are immutable)
			tilesByIds: [...this.state.tilesByIds],
		};
		// Remove timeRemaining – it's not part of the snapshot
		const { timeRemaining, ...snapshotWithoutTime } = snapshot;

		this.history.push(snapshotWithoutTime);

		// Enforce size limit
		if (this.history.length > this.maxHistorySize) {
			this.history.shift();
		}

		this.currentHistoryIndex = this.history.length - 1;

		// Update state with new history metadata
		this.state = {
			...this.state,
			historyIndex: this.currentHistoryIndex,
			historyLength: this.history.length,
		};
		this.notify();
	}

	public getHistory() {
		return this.history;
	}

	public getHistoryIndex() {
		return this.currentHistoryIndex;
	}

	public hydrate(
		snapshot: Omit<StoredGameState, "version" | "lastSaved">,
		lastSaved: number,
	) {
		try {
			// Deep copy board rows (each row is an array of strings/undefined)
			const newBoard = snapshot.board.map((row) => [...row]);
			// Copy tiles map (tile objects are plain and immutable)
			const newTiles = { ...snapshot.tiles };
			const newTilesByIds = [...snapshot.tilesByIds];

			// 2048 has no time limit (product decision 2026-10-27): a saved game is resumed as it was,
			// however long ago it was saved.
			void lastSaved;
			const newTimeRemaining = snapshot.timeRemaining;
			const newStatus = snapshot.status;

			this.state = {
				board: newBoard,
				tiles: newTiles,
				tilesByIds: newTilesByIds,
				hasChanged: false,
				score: snapshot.score,
				status: newStatus,
				timeRemaining: newTimeRemaining,
				moveCount: snapshot.moveCount,
				historyIndex: snapshot.historyIndex,
				historyLength: snapshot.history.length,
			};

			// Restore history
			this.history = snapshot.history.map((entry) => ({
				...entry,
			})) as unknown as GameStateSnapshot[];
			this.currentHistoryIndex = snapshot.historyIndex;

			this.notify();
		} catch (error) {
			console.error("Hydration failed, starting new game:", error);
			this.startGame(); // Fallback to a fresh game
		}
	}

	public startGame() {
		this.state = this.getInitialState();
		this.history = [];
		this.currentHistoryIndex = -1;
		this.addRandomTile();
		this.addRandomTile();
		this.commitMove(); // record initial state
	}

	public addRandomTile() {
		const emptyCells = getEmptyCells(this.state.board);
		if (emptyCells.length === 0) return;

		const [x, y] = emptyCells[Math.floor(Math.random() * emptyCells.length)];
		const newTile = createRandomTile([x, y]);
		const tileId = newTile.id!;

		const newBoard = this.state.board.map((row) => [...row]);
		newBoard[y][x] = tileId;

		this.state = {
			...this.state,
			board: newBoard,
			tiles: { ...this.state.tiles, [tileId]: newTile },
			tilesByIds: [...this.state.tilesByIds, tileId],
		};
		this.notify();
	}

	public move(direction: Direction) {
		if (this.state.status !== "ongoing") return;

		let moveResult: MoveResult;
		switch (direction) {
			case "up":
				moveResult = moveUp(
					this.state.board,
					this.state.tiles,
					this.state.score,
				);
				break;
			case "down":
				moveResult = moveDown(
					this.state.board,
					this.state.tiles,
					this.state.score,
				);
				break;
			case "left":
				moveResult = moveLeft(
					this.state.board,
					this.state.tiles,
					this.state.score,
				);
				break;
			case "right":
				moveResult = moveRight(
					this.state.board,
					this.state.tiles,
					this.state.score,
				);
				break;
		}

		if (!moveResult.hasChanged) return;

		// Increment move counter on a valid move
		const newMoveCount = this.state.moveCount + 1;

		this.state = {
			...this.state,
			board: moveResult.board,
			tiles: moveResult.tiles,
			score: moveResult.score,
			hasChanged: true,
			moveCount: newMoveCount,
		};
		this.notify();
	}

	public cleanup() {
		const boardTileIds = new Set<string>();
		for (let y = 0; y < TILE_COUNT_PER_DIMENSION; y++) {
			for (let x = 0; x < TILE_COUNT_PER_DIMENSION; x++) {
				const id = this.state.board[y][x];
				if (id) boardTileIds.add(id);
			}
		}

		const newTiles: TileMap = {};
		const newTilesByIds: string[] = [];
		boardTileIds.forEach((id) => {
			if (this.state.tiles[id]) {
				newTiles[id] = this.state.tiles[id];
				newTilesByIds.push(id);
			}
		});

		this.state = {
			...this.state,
			tiles: newTiles,
			tilesByIds: newTilesByIds,
			hasChanged: false,
		};
		this.notify();
	}

	public updateStatus() {
		if (this.state.status !== "ongoing") return;

		if (checkWin(this.state.tiles)) {
			this.state = { ...this.state, status: "won" };
			this.notify();
			return;
		}

		if (checkLoss(this.state.board, this.state.tiles)) {
			this.state = { ...this.state, status: "lost" };
			this.notify();
		}
	}

	/** No time limit any more: a game ends only when no move is left (or 2048 is made). */
	public tick() {
		// intentionally nothing
	}

	// Undo: go to previous snapshot
	public undo() {
		if (this.currentHistoryIndex <= 0) return;

		this.currentHistoryIndex--;
		const snapshot = this.history[this.currentHistoryIndex];

		// Restore everything except the timer, which keeps running
		this.state = {
			...snapshot,
			timeRemaining: this.state.timeRemaining,
			historyIndex: this.currentHistoryIndex,
			historyLength: this.history.length,
			hasChanged: false, // prevent tile addition effect
		};
		this.notify();
	}

	// Redo: go to next snapshot
	public redo() {
		if (this.currentHistoryIndex >= this.history.length - 1) return;

		this.currentHistoryIndex++;
		const snapshot = this.history[this.currentHistoryIndex];

		this.state = {
			...snapshot,
			timeRemaining: this.state.timeRemaining,
			historyIndex: this.currentHistoryIndex,
			historyLength: this.history.length,
			hasChanged: false,
		};
		this.notify();
	}

	// Helpers for UI
	public canUndo(): boolean {
		return this.currentHistoryIndex > 0;
	}

	public canRedo(): boolean {
		return this.currentHistoryIndex < this.history.length - 1;
	}
}
