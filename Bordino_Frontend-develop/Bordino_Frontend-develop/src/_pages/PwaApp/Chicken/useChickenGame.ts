"use client";

import { useCallback, useEffect, useRef, useState } from "react";

import { chickenApi } from "@/api/games/chicken/api";
import type {
	ChickenConfig,
	ChickenDifficulty,
	ChickenRound,
	ChickenRoundState,
} from "@/api/games/chicken/types";
import { crashApi } from "@/api/games/crash/api";
import { gameErrorMessage } from "@/api/games/request";

const HISTORY_SIZE = 20;

/** One player's chicken session. Turn-based: every step is one server call, which decides it. */
export default function useChickenGame() {
	const [config, setConfig] = useState<ChickenConfig | null>(null);
	const [balance, setBalance] = useState(0);
	const [round, setRound] = useState<ChickenRound | null>(null);
	const [history, setHistory] = useState<ChickenRound[]>([]);
	const [error, setError] = useState<string | null>(null);
	const [busy, setBusy] = useState(false);
	const [loading, setLoading] = useState(true);
	const busyRef = useRef(false);

	useEffect(() => {
		let alive = true;
		(async () => {
			try {
				const [cfg, recent] = await Promise.all([chickenApi.config(), chickenApi.history()]);
				if (!alive) return;
				setConfig(cfg);
				setBalance(cfg.balance);
				setHistory(recent.results.filter((r) => r.revealed));
				if (cfg.active_round) setRound(cfg.active_round);
			} catch (e) {
				if (alive) setError(gameErrorMessage(e));
			} finally {
				if (alive) setLoading(false);
			}
		})();
		return () => {
			alive = false;
		};
	}, []);

	const remember = useCallback((finished: ChickenRound) => {
		setHistory((prev) =>
			[finished, ...prev.filter((r) => r.id !== finished.id)].slice(0, HISTORY_SIZE),
		);
	}, []);

	/**
	 * After a failed request the outcome is unknown (the server may have done it and the answer
	 * got lost, or the round moved on — a 409): read the authoritative state back.
	 */
	const reconcile = useCallback(async (shownId: string | null) => {
		try {
			const cfg = await chickenApi.config();
			setConfig(cfg);
			if (cfg.active_round) {
				setRound(cfg.active_round);
				setBalance(cfg.balance);
				return;
			}
			// A finished round and the balance it produced go on screen together (one render), so
			// the hop animation can hold the balance back until the chicken gets there.
			const recent = shownId ? await chickenApi.history() : null;
			const finished = recent?.results.find((r) => r.id === shownId);
			if (finished) {
				setRound(finished);
				remember(finished);
			}
			setBalance(cfg.balance);
		} catch {
			// Still offline; the error stays on screen and the next tap retries.
		}
	}, [remember]);

	/** Runs one request at a time (a double tap must not send two steps). */
	const run = useCallback(
		async (request: () => Promise<ChickenRoundState>, shownId: string | null) => {
			if (busyRef.current) return null;
			busyRef.current = true;
			setBusy(true);
			setError(null);
			try {
				const state = await request();
				setRound(state.round);
				setBalance(state.balance);
				if (state.round.revealed) remember(state.round);
				return state.round;
			} catch (e) {
				setError(gameErrorMessage(e));
				await reconcile(shownId);
				return null;
			} finally {
				busyRef.current = false;
				setBusy(false);
			}
		},
		[reconcile, remember],
	);

	const placeBet = useCallback(
		async (amount: number, difficulty: ChickenDifficulty) => {
			const placed = await run(() => chickenApi.bet(amount, difficulty), null);
			if (placed) {
				setConfig((prev) => (prev ? { ...prev, next_nonce: placed.nonce + 1 } : prev));
			}
			return placed;
		},
		[run],
	);

	const step = useCallback(
		(to?: number) =>
			round ? run(() => chickenApi.step(round.id, round.step, to), round.id) : Promise.resolve(null),
		[round, run],
	);

	const cashOut = useCallback(
		() => (round ? run(() => chickenApi.cashOut(round.id), round.id) : Promise.resolve(null)),
		[round, run],
	);

	const changeSeed = useCallback(async (clientSeed: string) => {
		try {
			const seed = await crashApi.setSeed(clientSeed);
			setConfig((prev) =>
				prev ? { ...prev, client_seed: seed.client_seed, next_nonce: seed.next_nonce } : prev,
			);
			return true;
		} catch (e) {
			setError(gameErrorMessage(e));
			return false;
		}
	}, []);

	return {
		config,
		balance,
		round,
		history,
		error,
		busy,
		loading,
		placeBet,
		step,
		cashOut,
		changeSeed,
	};
}
