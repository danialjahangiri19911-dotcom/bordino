import { GAME_WIN_TILE_VALUE, TILE_COUNT_PER_DIMENSION } from "./constants";
import type { Board, TileMap } from "./types";

export function checkWin(tiles: TileMap): boolean {
	return Object.values(tiles).some(
		(tile) => tile.value === GAME_WIN_TILE_VALUE,
	);
}

export function checkLoss(board: Board, tiles: TileMap): boolean {
	// Check for empty cell
	for (let y = 0; y < TILE_COUNT_PER_DIMENSION; y++) {
		for (let x = 0; x < TILE_COUNT_PER_DIMENSION; x++) {
			if (board[y][x] === undefined) {
				return false;
			}
		}
	}

	// Check for possible merges horizontally and vertically
	for (let y = 0; y < TILE_COUNT_PER_DIMENSION; y++) {
		for (let x = 0; x < TILE_COUNT_PER_DIMENSION - 1; x++) {
			const tileId = board[y][x];
			const nextTileId = board[y][x + 1];
			if (
				tileId &&
				nextTileId &&
				tiles[tileId].value === tiles[nextTileId].value
			) {
				return false;
			}
		}
	}

	for (let y = 0; y < TILE_COUNT_PER_DIMENSION - 1; y++) {
		for (let x = 0; x < TILE_COUNT_PER_DIMENSION; x++) {
			const tileId = board[y][x];
			const belowTileId = board[y + 1][x];
			if (
				tileId &&
				belowTileId &&
				tiles[tileId].value === tiles[belowTileId].value
			) {
				return false;
			}
		}
	}

	return true;
}
