"use client";

import { useCallback, useEffect, useRef, useState } from "react";

import { crashApi, crashErrorMessage } from "@/api/games/crash/api";
import type { CrashConfig, CrashRound } from "@/api/games/crash/types";

const HISTORY_SIZE = 20;

/**
 * One player's crash session: config, balance, the current round and recent results.
 * The server decides everything; this hook only keeps the client's clock in step with it
 * and waits (long-poll) for the crash of the running round.
 */
export default function useCrashGame() {
	const [config, setConfig] = useState<CrashConfig | null>(null);
	const [balance, setBalance] = useState(0);
	const [round, setRound] = useState<CrashRound | null>(null);
	const [history, setHistory] = useState<CrashRound[]>([]);
	const [error, setError] = useState<string | null>(null);
	const [busy, setBusy] = useState(false);
	const [loading, setLoading] = useState(true);

	const offsetRef = useRef(0);
	const waitingRef = useRef<string | null>(null);
	const mountedRef = useRef(true);

	/** Server clock = Date.now() + offset (one-way latency is the only error left). */
	const serverNow = useCallback(() => Date.now() + offsetRef.current, []);

	const syncClock = (serverTime: string, sentAt: number) => {
		offsetRef.current = Date.parse(serverTime) - (sentAt + Date.now()) / 2;
	};

	/** Never let a late, unrevealed answer overwrite a round that is already revealed. */
	const applyRound = useCallback((next: CrashRound) => {
		setRound((prev) =>
			prev && prev.id === next.id && prev.revealed && !next.revealed ? prev : next,
		);
	}, []);

	const waitForCrash = useCallback(
		async (id: string) => {
			if (waitingRef.current === id) return;
			waitingRef.current = id;
			while (mountedRef.current && waitingRef.current === id) {
				try {
					const state = await crashApi.wait(id);
					if (!mountedRef.current) break;
					setBalance(state.balance);
					applyRound(state.round);
					if (state.round.revealed) {
						setHistory((prev) =>
							[state.round, ...prev.filter((r) => r.id !== id)].slice(0, HISTORY_SIZE),
						);
						break;
					}
				} catch (e) {
					setError(crashErrorMessage(e));
					await new Promise((resolve) => setTimeout(resolve, 2000));
				}
			}
			if (waitingRef.current === id) waitingRef.current = null;
		},
		[applyRound],
	);

	useEffect(() => {
		mountedRef.current = true;
		(async () => {
			try {
				const sentAt = Date.now();
				const [cfg, recent] = await Promise.all([crashApi.config(), crashApi.history()]);
				if (!mountedRef.current) return;
				syncClock(cfg.server_time, sentAt);
				setConfig(cfg);
				setBalance(cfg.balance);
				setHistory(recent.results.filter((r) => r.revealed));
				if (cfg.active_round) {
					setRound(cfg.active_round);
					waitForCrash(cfg.active_round.id);
				}
			} catch (e) {
				setError(crashErrorMessage(e));
			} finally {
				if (mountedRef.current) setLoading(false);
			}
		})();
		return () => {
			mountedRef.current = false;
			waitingRef.current = null;
		};
	}, [waitForCrash]);

	const placeBet = useCallback(
		async (amount: number, autoCashout: string | null) => {
			setBusy(true);
			setError(null);
			try {
				const sentAt = Date.now();
				const state = await crashApi.bet(amount, autoCashout);
				syncClock(state.server_time, sentAt);
				setRound(state.round);
				setBalance(state.balance);
				setConfig((prev) =>
					prev ? { ...prev, next_nonce: state.round.nonce + 1 } : prev,
				);
				waitForCrash(state.round.id);
				return state.round;
			} catch (e) {
				setError(crashErrorMessage(e));
				return null;
			} finally {
				setBusy(false);
			}
		},
		[waitForCrash],
	);

	const cashOut = useCallback(async () => {
		if (!round || round.status !== "active") return;
		setBusy(true);
		try {
			const state = await crashApi.cashOut(round.id);
			applyRound(state.round);
			setBalance(state.balance);
		} catch (e) {
			setError(crashErrorMessage(e));
		} finally {
			setBusy(false);
		}
	}, [round, applyRound]);

	const changeSeed = useCallback(async (clientSeed: string) => {
		try {
			const seed = await crashApi.setSeed(clientSeed);
			setConfig((prev) =>
				prev ? { ...prev, client_seed: seed.client_seed, next_nonce: seed.next_nonce } : prev,
			);
			return true;
		} catch (e) {
			setError(crashErrorMessage(e));
			return false;
		}
	}, []);

	return {
		config,
		balance,
		round,
		history,
		error,
		setError,
		busy,
		loading,
		serverNow,
		placeBet,
		cashOut,
		changeSeed,
	};
}
