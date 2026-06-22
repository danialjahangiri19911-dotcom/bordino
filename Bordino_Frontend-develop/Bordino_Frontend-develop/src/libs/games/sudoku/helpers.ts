import { SIZE } from "./constants";
import type { Board, BoardWithMeta, GroupCounts } from "./types";

export function initializeBoard(puzzle: Board): {
	board: BoardWithMeta;
	rowCounts: GroupCounts;
	colCounts: GroupCounts;
	squareCounts: GroupCounts;
} {
	const board: BoardWithMeta = Array.from({ length: SIZE }, () =>
		Array.from({ length: SIZE }, () => ({
			value: null,
			prefilled: false,
			notes: null,
		})),
	);
	const rowCounts: GroupCounts = Array.from({ length: SIZE }, () =>
		Array(10).fill(0),
	);
	const colCounts: GroupCounts = Array.from({ length: SIZE }, () =>
		Array(10).fill(0),
	);
	const squareCounts: GroupCounts = Array.from({ length: SIZE }, () =>
		Array(10).fill(0),
	);

	for (let i = 0; i < SIZE; i++) {
		for (let j = 0; j < SIZE; j++) {
			const cellValue = puzzle[i][j];
			if (cellValue !== 0) {
				board[i][j] = {
					value: cellValue,
					prefilled: true,
					notes: null,
				};
				rowCounts[i][cellValue] += 1;
				colCounts[j][cellValue] += 1;
				const squareIdx = Math.floor(i / 3) * 3 + Math.floor(j / 3);
				squareCounts[squareIdx][cellValue] += 1;
			}
		}
	}
	return { board, rowCounts, colCounts, squareCounts };
}

export function computeConflicts(
	board: BoardWithMeta,
	rowCounts: GroupCounts,
	colCounts: GroupCounts,
	squareCounts: GroupCounts,
): boolean[][] {
	const conflicts: boolean[][] = Array.from({ length: SIZE }, () =>
		Array(SIZE).fill(false),
	);
	for (let i = 0; i < SIZE; i++) {
		for (let j = 0; j < SIZE; j++) {
			const cell = board[i][j];
			if (!cell.value) continue;
			const v = cell.value;
			const squareIdx = Math.floor(i / 3) * 3 + Math.floor(j / 3);
			conflicts[i][j] =
				rowCounts[i][v] > 1 ||
				colCounts[j][v] > 1 ||
				squareCounts[squareIdx][v] > 1;
		}
	}
	return conflicts;
}

export function computeNumberProgress(
	rowCounts: GroupCounts,
	colCounts: GroupCounts,
	squareCounts: GroupCounts,
): number[] {
	const progress = Array(10).fill(0);
	for (let num = 1; num <= 9; num++) {
		const rowsWithNum = rowCounts.filter((row) => row[num] > 0).length;
		const colsWithNum = colCounts.filter((col) => col[num] > 0).length;
		const squaresWithNum = squareCounts.filter((sq) => sq[num] > 0).length;
		progress[num] = Math.min(rowsWithNum, colsWithNum, squaresWithNum);
	}
	return progress;
}

export function isBoardCompleteAndValid(
	board: BoardWithMeta,
	rowCounts: GroupCounts,
	colCounts: GroupCounts,
	squareCounts: GroupCounts,
): boolean {
	// All cells must have a value
	for (let i = 0; i < SIZE; i++) {
		for (let j = 0; j < SIZE; j++) {
			if (!board[i][j].value) return false;
		}
	}
	// No conflicts
	const conflicts = computeConflicts(board, rowCounts, colCounts, squareCounts);
	for (let i = 0; i < SIZE; i++) {
		for (let j = 0; j < SIZE; j++) {
			if (conflicts[i][j]) return false;
		}
	}
	return true;
}
