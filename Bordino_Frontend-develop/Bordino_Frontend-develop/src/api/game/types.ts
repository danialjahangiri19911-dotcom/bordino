import type { GameConfig } from "@/libs/games/sudoku/types";

export interface GameConfigApiResponse {
	is_successful: boolean;
	status_code: number;
	result: GameConfig;
}
