import type { ResponseApiData } from "@/libs/http/interfaces";

/** نامِ بازی در بک‌اند (`GameConfiguration.game_name`). */
export type GameName = "sudoku" | "game_2048";

export interface PlayCost {
	game_name: string;
	/** امتیازی که با هر بار بازی کم می‌شود (از ادمین قابلِ تنظیم). */
	play_cost: number | null;
	/** موجودیِ فعلیِ کیفِ امتیاز. */
	current_amount: number;
}

export interface ChargeResult {
	game_name: string;
	cost: number;
	/** موجودیِ کیفِ امتیاز پس از کسر. */
	new_amount: number;
}

export type PlayCostApiResponse = ResponseApiData<PlayCost>;
export type ChargeApiResponse = ResponseApiData<ChargeResult>;
