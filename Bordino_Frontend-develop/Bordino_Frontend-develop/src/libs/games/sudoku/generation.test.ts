import { writeFileSync } from "fs";

import { TARGET_CELLS_BY_DIFFICULTY } from "./constants";
import { countSolutions, makePuzzle, pluck } from "./generation";
import type { Board } from "./types";

const valid = (b: Board) => {
	const group = (cells: number[]) => [...cells].sort().join("") === "123456789";
	for (let i = 0; i < 9; i++) {
		if (!group(b[i])) return false;
		if (!group(b.map((r) => r[i]))) return false;
		const r = Math.floor(i / 3) * 3;
		const c = (i % 3) * 3;
		if (!group([0, 1, 2].flatMap((dr) => [0, 1, 2].map((dc) => b[r + dr][c + dc])))) return false;
	}
	return true;
};

describe("sudoku boards (player report: a board with no correct answer)", () => {
	it("the solver tells none, one and many solutions apart", () => {
		const solution = makePuzzle();
		expect(countSolutions(solution)).toBe(1);
		const empty = solution.map((r) => r.map(() => 0)) as Board;
		expect(countSolutions(empty)).toBe(2);
		const broken = solution.map((r) => [...r]) as Board;
		broken[0][1] = broken[0][0];
		expect(countSolutions(broken)).toBe(0);
	});

	it("every board has exactly one answer, the stored solution, at about the difficulty's clue count", () => {
		const report: string[] = [];
		for (const d of ["easy", "medium", "hard"] as const) {
			const target = TARGET_CELLS_BY_DIFFICULTY[d];
			let clues = 0;
			let slowest = 0;
			for (let n = 0; n < 12; n++) {
				const solution = makePuzzle();
				expect(valid(solution)).toBe(true);
				const started = Date.now();
				const { puzzle, size } = pluck(solution, target);
				slowest = Math.max(slowest, Date.now() - started);
				// Every given is the solution's number in that cell.
				puzzle.forEach((row, x) => row.forEach((v, y) => v && expect(v).toBe(solution[x][y])));
				expect(size).toBe(puzzle.flat().filter(Boolean).length);
				expect(countSolutions(puzzle, 2)).toBe(1);
				expect(size).toBeLessThanOrEqual(target + 4);
				clues += size;
			}
			report.push(`${d}: target ${target}, avg clues ${(clues / 12).toFixed(1)}, slowest ${slowest} ms`);
		}
		writeFileSync("/tmp/sudoku-gen.txt", report.join("\n"));
	});
});
