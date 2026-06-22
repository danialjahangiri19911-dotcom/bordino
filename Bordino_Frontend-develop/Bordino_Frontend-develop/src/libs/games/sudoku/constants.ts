import type { Difficulty } from "./types";

export const SIZE = 9;
export const CELL_COUNT = 81;

export const TARGET_CELLS_BY_DIFFICULTY: Record<Difficulty, number> = {
	easy: 36,
	medium: 30,
	hard: 24,
};
