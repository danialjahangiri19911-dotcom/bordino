import type { CrashRoundStatus } from "@/api/games/crash/types";

export type ChickenDifficulty = "easy" | "medium" | "hard";

export interface ChickenRound {
	id: string;
	bet: number;
	difficulty: ChickenDifficulty;
	lanes: number;
	/** Multiplier after surviving lane 1..lanes (index 0 = lane 1). */
	multipliers: string[];
	step: number;
	status: CrashRoundStatus;
	current_multiplier: string | null;
	next_multiplier: string | null;
	cashout_multiplier: string | null;
	payout: number;
	max_payout: number;
	server_seed_hash: string;
	client_seed: string;
	nonce: number;
	hit_chance: string;
	/** True once the round has ended; only then are hit_lane and server_seed filled. */
	revealed: boolean;
	hit_lane: number | null;
	server_seed: string | null;
	create_time: string;
}

export interface ChickenLevel {
	lanes: number;
	hit: string;
	multipliers: string[];
}

export interface ChickenConfig {
	enabled: boolean;
	min_bet: number;
	max_bet: number;
	max_payout: number;
	house_edge: string;
	difficulties: Record<ChickenDifficulty, ChickenLevel>;
	client_seed: string;
	next_nonce: number;
	balance: number;
	active_round: ChickenRound | null;
}

export interface ChickenRoundState {
	round: ChickenRound;
	balance: number;
}
