import { TILE_COUNT_PER_DIMENSION } from "./constants";
import type { Board, Tile, TileMap } from "./types";
import { isEqual, isNil } from "lodash";

export interface MoveResult {
	board: Board;
	tiles: TileMap;
	score: number;
	hasChanged: boolean;
}

function createEmptyBoard(): Board {
	const board: Board = [];
	for (let i = 0; i < TILE_COUNT_PER_DIMENSION; i++) {
		board[i] = new Array(TILE_COUNT_PER_DIMENSION).fill(undefined);
	}
	return board;
}

export function moveUp(
	board: Board,
	tiles: TileMap,
	currentScore: number,
): MoveResult {
	const newBoard = createEmptyBoard();
	const newTiles: TileMap = {};
	let hasChanged = false;
	let score = currentScore;

	for (let x = 0; x < TILE_COUNT_PER_DIMENSION; x++) {
		let newY = 0;
		let previousTile: Tile | undefined;

		for (let y = 0; y < TILE_COUNT_PER_DIMENSION; y++) {
			const tileId = board[y][x];
			if (isNil(tileId)) continue;
			const currentTile = tiles[tileId];

			if (previousTile?.value === currentTile.value) {
				score += previousTile.value * 2;
				newTiles[previousTile.id!] = {
					...previousTile,
					value: previousTile.value * 2,
				};
				newTiles[tileId] = {
					...currentTile,
					position: [x, newY - 1],
				};
				previousTile = undefined;
				hasChanged = true;
				continue;
			}

			newBoard[newY][x] = tileId;
			newTiles[tileId] = {
				...currentTile,
				position: [x, newY],
			};
			previousTile = newTiles[tileId];
			if (!isEqual(currentTile.position, [x, newY])) {
				hasChanged = true;
			}
			newY++;
		}
	}

	return { board: newBoard, tiles: newTiles, score, hasChanged };
}

export function moveDown(
	board: Board,
	tiles: TileMap,
	currentScore: number,
): MoveResult {
	const newBoard = createEmptyBoard();
	const newTiles: TileMap = {};
	let hasChanged = false;
	let score = currentScore;

	for (let x = 0; x < TILE_COUNT_PER_DIMENSION; x++) {
		let newY = TILE_COUNT_PER_DIMENSION - 1;
		let previousTile: Tile | undefined;

		for (let y = TILE_COUNT_PER_DIMENSION - 1; y >= 0; y--) {
			const tileId = board[y][x];
			if (isNil(tileId)) continue;
			const currentTile = tiles[tileId];

			if (previousTile?.value === currentTile.value) {
				score += previousTile.value * 2;
				newTiles[previousTile.id!] = {
					...previousTile,
					value: previousTile.value * 2,
				};
				newTiles[tileId] = {
					...currentTile,
					position: [x, newY + 1],
				};
				previousTile = undefined;
				hasChanged = true;
				continue;
			}

			newBoard[newY][x] = tileId;
			newTiles[tileId] = {
				...currentTile,
				position: [x, newY],
			};
			previousTile = newTiles[tileId];
			if (!isEqual(currentTile.position, [x, newY])) {
				hasChanged = true;
			}
			newY--;
		}
	}

	return { board: newBoard, tiles: newTiles, score, hasChanged };
}

export function moveLeft(
	board: Board,
	tiles: TileMap,
	currentScore: number,
): MoveResult {
	const newBoard = createEmptyBoard();
	const newTiles: TileMap = {};
	let hasChanged = false;
	let score = currentScore;

	for (let y = 0; y < TILE_COUNT_PER_DIMENSION; y++) {
		let newX = 0;
		let previousTile: Tile | undefined;

		for (let x = 0; x < TILE_COUNT_PER_DIMENSION; x++) {
			const tileId = board[y][x];
			if (isNil(tileId)) continue;
			const currentTile = tiles[tileId];

			if (previousTile?.value === currentTile.value) {
				score += previousTile.value * 2;
				newTiles[previousTile.id!] = {
					...previousTile,
					value: previousTile.value * 2,
				};
				newTiles[tileId] = {
					...currentTile,
					position: [newX - 1, y],
				};
				previousTile = undefined;
				hasChanged = true;
				continue;
			}

			newBoard[y][newX] = tileId;
			newTiles[tileId] = {
				...currentTile,
				position: [newX, y],
			};
			previousTile = newTiles[tileId];
			if (!isEqual(currentTile.position, [newX, y])) {
				hasChanged = true;
			}
			newX++;
		}
	}

	return { board: newBoard, tiles: newTiles, score, hasChanged };
}

export function moveRight(
	board: Board,
	tiles: TileMap,
	currentScore: number,
): MoveResult {
	const newBoard = createEmptyBoard();
	const newTiles: TileMap = {};
	let hasChanged = false;
	let score = currentScore;

	for (let y = 0; y < TILE_COUNT_PER_DIMENSION; y++) {
		let newX = TILE_COUNT_PER_DIMENSION - 1;
		let previousTile: Tile | undefined;

		for (let x = TILE_COUNT_PER_DIMENSION - 1; x >= 0; x--) {
			const tileId = board[y][x];
			if (isNil(tileId)) continue;
			const currentTile = tiles[tileId];

			if (previousTile?.value === currentTile.value) {
				score += previousTile.value * 2;
				newTiles[previousTile.id!] = {
					...previousTile,
					value: previousTile.value * 2,
				};
				newTiles[tileId] = {
					...currentTile,
					position: [newX + 1, y],
				};
				previousTile = undefined;
				hasChanged = true;
				continue;
			}

			newBoard[y][newX] = tileId;
			newTiles[tileId] = {
				...currentTile,
				position: [newX, y],
			};
			previousTile = newTiles[tileId];
			if (!isEqual(currentTile.position, [newX, y])) {
				hasChanged = true;
			}
			newX--;
		}
	}

	return { board: newBoard, tiles: newTiles, score, hasChanged };
}
