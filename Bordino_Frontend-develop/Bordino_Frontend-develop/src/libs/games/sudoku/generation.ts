import { CELL_COUNT, SIZE } from "./constants";
import type { Board, CellValue, Coordinate } from "./types";

/**
 * Returns an array [0, 1, ..., n-1]
 */
export function range(n: number): number[] {
	return Array.from({ length: n }, (_, i) => i);
}

/**
 * Generates a complete, valid Sudoku board.
 * Algorithm: fill cells row‑by‑row, randomly picking from the intersection
 * of available numbers in the current row, column and 3×3 square.
 * If a dead end is reached, the whole process restarts.
 *
 * NOTE: This function may loop indefinitely in theory, but for 9×9 it always
 * succeeds quickly. Behaviour is kept exactly as in the original.
 */
export function makePuzzle(): Board {
	while (true) {
		try {
			const board: Board = Array.from({ length: SIZE }, () =>
				Array(SIZE).fill(0),
			);
			const rowSets = Array.from(
				{ length: SIZE },
				() => new Set<CellValue>([1, 2, 3, 4, 5, 6, 7, 8, 9]),
			);
			const colSets = Array.from(
				{ length: SIZE },
				() => new Set<CellValue>([1, 2, 3, 4, 5, 6, 7, 8, 9]),
			);
			const squareSets = Array.from(
				{ length: SIZE },
				() => new Set<CellValue>([1, 2, 3, 4, 5, 6, 7, 8, 9]),
			);

			for (let i = 0; i < SIZE; i++) {
				for (let j = 0; j < SIZE; j++) {
					const rowSet = rowSets[i];
					const colSet = colSets[j];
					const squareIdx = Math.floor(i / 3) * 3 + Math.floor(j / 3);
					const squareSet = squareSets[squareIdx];

					// available numbers are those present in all three sets
					const choices = [...rowSet].filter(
						(x) => colSet.has(x) && squareSet.has(x),
					);
					if (choices.length === 0) {
						throw new Error("Dead end");
					}

					const choice = choices[
						Math.floor(Math.random() * choices.length)
					] as CellValue;
					board[i][j] = choice;
					rowSet.delete(choice);
					colSet.delete(choice);
					squareSet.delete(choice);
				}
			}
			return board;
		} catch {
			// continue loop
		}
	}
}

/**
 * Determines whether two cells are peers (same row, column or 3×3 box).
 */
export function isPeer(a: Coordinate, b: Coordinate): boolean {
	if (!a || !b) return false;
	const squareA = Math.floor(a.x / 3) * 3 + Math.floor(a.y / 3);
	const squareB = Math.floor(b.x / 3) * 3 + Math.floor(b.y / 3);
	return a.x === b.x || a.y === b.y || squareA === squareB;
}

/**
 * How many solutions `board` (0 = empty) has, counting no further than `limit`: 0 (none or the
 * givens conflict), 1 (a proper Sudoku) or `limit` (more than one). Bitmasks per row/column/box
 * and the cell with the fewest candidates first, so it is quick even on sparse boards.
 */
export function countSolutions(board: Board, limit = 2, first?: { board: Board | null }): number {
	const cells = board.flat() as number[];
	const rows = new Array<number>(9).fill(0);
	const cols = new Array<number>(9).fill(0);
	const boxes = new Array<number>(9).fill(0);
	const box = (r: number, c: number) => Math.floor(r / 3) * 3 + Math.floor(c / 3);
	for (let i = 0; i < 81; i++) {
		const v = cells[i];
		if (!v) continue;
		const r = Math.floor(i / 9);
		const c = i % 9;
		const bit = 1 << v;
		if (rows[r] & bit || cols[c] & bit || boxes[box(r, c)] & bit) return 0;
		rows[r] |= bit;
		cols[c] |= bit;
		boxes[box(r, c)] |= bit;
	}
	let found = 0;
	const search = (): void => {
		let best = -1;
		let bestMask = 0;
		let bestCount = 10;
		for (let i = 0; i < 81; i++) {
			if (cells[i]) continue;
			const r = Math.floor(i / 9);
			const c = i % 9;
			const mask = ~(rows[r] | cols[c] | boxes[box(r, c)]) & 0x3fe;
			let n = 0;
			for (let m = mask; m; m &= m - 1) n++;
			if (n === 0) return; // dead end
			if (n < bestCount) {
				best = i;
				bestMask = mask;
				bestCount = n;
				if (n === 1) break;
			}
		}
		if (best < 0) {
			if (first && !first.board) first.board = Array.from({ length: 9 }, (_, r) => cells.slice(r * 9, r * 9 + 9)) as Board;
			found++;
			return;
		}
		const r = Math.floor(best / 9);
		const c = best % 9;
		const b = box(r, c);
		for (let v = 1; v <= 9; v++) {
			const bit = 1 << v;
			if (!(bestMask & bit)) continue;
			cells[best] = v;
			rows[r] |= bit;
			cols[c] |= bit;
			boxes[b] |= bit;
			search();
			cells[best] = 0;
			rows[r] &= ~bit;
			cols[c] &= ~bit;
			boxes[b] &= ~bit;
			if (found >= limit) return;
		}
	};
	search();
	return found;
}

/** A full solution that keeps every number already on `board` (0 = empty), or null if none does. */
export function solveBoard(board: Board): Board | null {
	const first: { board: Board | null } = { board: null };
	countSolutions(board, 1, first);
	return first.board;
}

function shuffled(n: number): number[] {
	const a = range(n);
	for (let i = n - 1; i > 0; i--) {
		const j = Math.floor(Math.random() * (i + 1));
		[a[i], a[j]] = [a[j], a[i]];
	}
	return a;
}

/** Tries per board to get down to the difficulty's clue count (each pass removes in a new order). */
const PLUCK_ATTEMPTS = 6;

/**
 * Removes numbers from a full solution down to `targetCells` givens, keeping each removal only
 * if the board still has exactly ONE solution — so the stored solution is the only right answer
 * and a correct number is never judged a mistake. (The earlier heuristic left almost every board
 * with several solutions.) If no order reaches the target, the board with the fewest givens is
 * used: a few more clues, never an ambiguous board.
 *
 * @param fullPuzzle A complete, solved Sudoku board.
 * @param targetCells Desired number of remaining prefilled cells.
 * @returns The reduced puzzle and the final count of filled cells.
 */
export function pluck(fullPuzzle: Board, targetCells = 0): { puzzle: Board; size: number } {
	let best: Board = fullPuzzle.map((row) => [...row]);
	let bestSize = CELL_COUNT;
	for (let attempt = 0; attempt < PLUCK_ATTEMPTS && bestSize > targetCells; attempt++) {
		const puzzle: Board = fullPuzzle.map((row) => [...row]);
		let size = CELL_COUNT;
		for (const cell of shuffled(CELL_COUNT)) {
			if (size <= targetCells) break;
			const x = Math.floor(cell / 9);
			const y = cell % 9;
			const value = puzzle[x][y];
			puzzle[x][y] = 0;
			if (countSolutions(puzzle, 2) === 1) size--;
			else puzzle[x][y] = value;
		}
		if (size < bestSize) {
			best = puzzle;
			bestSize = size;
		}
	}
	return { puzzle: best, size: bestSize };
}
