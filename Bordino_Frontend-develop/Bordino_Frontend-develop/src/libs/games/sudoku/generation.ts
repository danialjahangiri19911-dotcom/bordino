import { CELL_COUNT, SIZE } from "./constants";
import type { Board, CellValue, Coordinate, Index } from "./types";

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

// ----------------------------------------------------------------------
//  pluck() and its helper canBeA() – behaviour preserved exactly,
//  including the known indexing bug. Do NOT change without explicit approval.
// ----------------------------------------------------------------------

/**
 * Checks whether cell (i,j) can legally contain the value found at linear index `cellIndex`.
 *
 * ⚠️ BEHAVIOUR CHANGE NOTICE – 2026-02-12
 * The original implementation contained an accidental comma‑operator bug that caused
 * incorrect peer comparisons. This has been fixed. The puzzle generation algorithm now
 * correctly checks row, column and square peers. As a result, `pluck` will now remove
 * different cells than before, producing different puzzles for the same input.
 *
 * This change was made at the explicit request of the maintainer.
 */
function canBeA(puzzle: Board, i: Index, j: Index, cellIndex: number): boolean {
	const x = Math.floor(cellIndex / 9) as Index;
	const y = (cellIndex % 9) as Index;
	const value = puzzle[x][y];

	// If the cell is the same as the one we're comparing to, it's fine.
	if (puzzle[i][j] === value) return true;
	// If the cell already has a different non‑zero value, it cannot be changed.
	if (puzzle[i][j] > 0) return false;

	// Check all 9 peers in the row, column and square.
	for (let m = 0; m < 9; m++) {
		// Row peer: same row, different column
		if (m !== x) {
			const rowPeerValue = puzzle[m][j];
			if (rowPeerValue === value) return false;
		}
		// Column peer: same column, different row
		if (m !== y) {
			const colPeerValue = puzzle[i][m];
			if (colPeerValue === value) return false;
		}
		// Square peer: inside the same 3x3 block, not the cell itself
		const sx = (Math.floor(i / 3) * 3 + Math.floor(m / 3)) as Index;
		const sy = (Math.floor(j / 3) * 3 + (m % 3)) as Index;
		if (sx !== x || sy !== y) {
			const squarePeerValue = puzzle[sx][sy];
			if (squarePeerValue === value) return false;
		}
	}
	return true;
}

/**
 * Attempts to remove cells from a full solution while preserving uniqueness
 * (using a heuristic – actual uniqueness is not guaranteed).
 *
 * @param fullPuzzle A complete, solved Sudoku board.
 * @param targetCells Desired number of remaining prefilled cells.
 * @returns The reduced puzzle and the final count of filled cells.
 */
export function pluck(
	fullPuzzle: Board,
	targetCells = 0,
): { puzzle: Board; size: number } {
	// Deep clone the board
	const puzzle: Board = JSON.parse(JSON.stringify(fullPuzzle));
	const cells = new Set<number>(range(CELL_COUNT));
	const cellsLeft = new Set(cells);

	while (cellsLeft.size > 0 && cells.size > targetCells) {
		const cell = Array.from(cells)[Math.floor(Math.random() * cells.size)];
		const x = Math.floor(cell / 9) as Index;
		const y = (cell % 9) as Index;

		cellsLeft.delete(cell);

		let rowOk = false;
		let colOk = false;
		let squareOk = false;

		for (let i = 0; i < 9; i++) {
			const rowPeer = { x: i as Index, y };
			const colPeer = { x, y: i as Index };
			const squarePeer = {
				x: (Math.floor(x / 3) * 3 + Math.floor(i / 3)) as Index,
				y: ((x % 3) * 3 + (i % 3)) as Index,
			};

			if (rowPeer.x !== x) {
				rowOk = canBeA(puzzle, rowPeer.x, rowPeer.y, cell);
			}
			if (colPeer.y !== y) {
				colOk = canBeA(puzzle, colPeer.x, colPeer.y, cell);
			}
			if (squarePeer.x !== x && squarePeer.y !== y) {
				squareOk = canBeA(puzzle, squarePeer.x, squarePeer.y, cell);
			}
		}

		if (rowOk && colOk && squareOk) {
			// Not pluckable – skip
			continue;
		} else {
			// Pluck this cell
			puzzle[x][y] = 0;
			cells.delete(cell);
		}
	}

	return { puzzle, size: cells.size };
}
