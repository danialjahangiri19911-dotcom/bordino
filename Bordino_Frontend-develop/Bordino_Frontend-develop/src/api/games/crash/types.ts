export type CrashRoundStatus = "active" | "won" | "lost";

export interface CrashRound {
	id: string;
	bet: number;
	auto_cashout: string | null;
	target_multiplier: string;
	status: CrashRoundStatus;
	cashout_multiplier: string | null;
	payout: number;
	started_at: string;
	server_seed_hash: string;
	client_seed: string;
	nonce: number;
	/** The parameters the crash point was generated with (for re-verification). */
	house_edge: string;
	max_multiplier: string;
	/** Only true once the curve has reached the crash point. */
	revealed: boolean;
	crash_point: string | null;
	server_seed: string | null;
	create_time: string;
}

export interface CrashConfig {
	enabled: boolean;
	min_bet: number;
	max_bet: number;
	max_payout: number;
	house_edge: string;
	max_multiplier: string;
	growth_per_ms: number;
	start_delay_ms: number;
	client_seed: string;
	next_nonce: number;
	balance: number;
	active_round: CrashRound | null;
	server_time: string;
}

export interface CrashRoundState {
	round: CrashRound;
	balance: number;
	server_time: string;
}

export interface CrashHistory {
	results: CrashRound[];
	server_time: string;
}

export interface CrashSeed {
	client_seed: string;
	next_nonce: number;
}
