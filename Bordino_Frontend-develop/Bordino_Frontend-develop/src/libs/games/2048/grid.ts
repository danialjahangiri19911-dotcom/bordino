import { TILE_COUNT_PER_DIMENSION } from "./constants";
import type { Board } from "./types";

export function createEmptyBoard(): Board {
	const board: Board = [];
	for (let i = 0; i < TILE_COUNT_PER_DIMENSION; i++) {
		board[i] = new Array(TILE_COUNT_PER_DIMENSION).fill(undefined);
	}
	return board;
}

export function getEmptyCells(board: Board): [number, number][] {
	const empty: [number, number][] = [];
	for (let y = 0; y < TILE_COUNT_PER_DIMENSION; y++) {
		for (let x = 0; x < TILE_COUNT_PER_DIMENSION; x++) {
			if (board[y][x] === undefined) {
				empty.push([x, y]);
			}
		}
	}
	return empty;
}
