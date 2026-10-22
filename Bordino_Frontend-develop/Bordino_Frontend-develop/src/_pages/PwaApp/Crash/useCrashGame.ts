"use client";

import { useCallback, useEffect, useRef, useState } from "react";

import { crashApi, crashErrorMessage } from "@/api/games/crash/api";
import type { CrashConfig, CrashRound } from "@/api/games/crash/types";

const HISTORY_SIZE = 20;

/** True when `next` is an older view of the same round than `prev` (a late response). */
function isOlder(prev: CrashRound, next: CrashRound) {
	if (prev.revealed && !next.revealed) return true;
	return prev.status !== "active" && next.status === "active";
}

/**
 * One player's crash session: config, balance, the current round and recent results.
 * The server decides everything; this hook keeps the client's clock in step with it, waits
 * (long-poll) for the running round to win or crash, and never lets a late response from an
 * older request or an older round replace newer state.
 */
export default function useCrashGame() {
	const [config, setConfig] = useState<CrashConfig | null>(null);
	const [balance, setBalance] = useState(0);
	const [round, setRoundState] = useState<CrashRound | null>(null);
	const [history, setHistory] = useState<CrashRound[]>([]);
	const [error, setError] = useState<string | null>(null);
	const [busy, setBusy] = useState(false);
	const [loading, setLoading] = useState(true);

	const offsetRef = useRef(0);
	const roundRef = useRef<CrashRound | null>(null);
	// Server time of the answer the shown balance came from; an older snapshot never replaces it.
	const balanceAtRef = useRef(0);
	const waitingRef = useRef<string | null>(null);
	const mountedRef = useRef(true);

	/** Server clock = Date.now() + offset (one-way latency is the only error left). */
	const serverNow = useCallback(() => Date.now() + offsetRef.current, []);

	const syncClock = (serverTime: string, sentAt: number) => {
		offsetRef.current = Date.parse(serverTime) - (sentAt + Date.now()) / 2;
	};

	const updateBalance = useCallback((next: number, serverTime: string) => {
		const at = Date.parse(serverTime);
		if (at < balanceAtRef.current) return;
		balanceAtRef.current = at;
		setBalance(next);
	}, []);

	const setRound = useCallback((next: CrashRound | null) => {
		roundRef.current = next;
		setRoundState(next);
	}, []);

	const remember = useCallback((finished: CrashRound) => {
		setHistory((prev) =>
			[finished, ...prev.filter((r) => r.id !== finished.id)].slice(0, HISTORY_SIZE),
		);
	}, []);

	/**
	 * Apply a server answer about `next`. Ignored when it belongs to a round that is no longer
	 * on screen, or is older than what is shown; the balance travels with it under the same check.
	 */
	const apply = useCallback(
		(next: CrashRound, nextBalance?: { balance: number; server_time: string }) => {
			const prev = roundRef.current;
			if (prev && (prev.id !== next.id || isOlder(prev, next))) return false;
			setRound(next);
			if (nextBalance) updateBalance(nextBalance.balance, nextBalance.server_time);
			if (next.revealed) remember(next);
			return true;
		},
		[remember, setRound, updateBalance],
	);

	const waitForCrash = useCallback(
		async (id: string) => {
			if (waitingRef.current === id) return;
			waitingRef.current = id;
			const stillMine = () =>
				mountedRef.current && waitingRef.current === id && roundRef.current?.id === id;
			while (stillMine()) {
				try {
					const state = await crashApi.wait(id, roundRef.current?.status);
					if (!stillMine()) break;
					apply(state.round, state);
					if (state.round.revealed) break;
				} catch (e) {
					if (!stillMine()) break;
					setError(crashErrorMessage(e));
					await new Promise((resolve) => setTimeout(resolve, 2000));
				}
			}
			if (waitingRef.current === id) waitingRef.current = null;
		},
		[apply],
	);

	/**
	 * After a failed request the outcome is unknown (the server may have done it and the answer
	 * got lost): read the authoritative state back before allowing anything else.
	 */
	const reconcile = useCallback(async () => {
		try {
			const sentAt = Date.now();
			const cfg = await crashApi.config();
			syncClock(cfg.server_time, sentAt);
			if (!mountedRef.current) return;
			setConfig(cfg);
			updateBalance(cfg.balance, cfg.server_time);
			if (cfg.active_round) {
				if (roundRef.current?.id !== cfg.active_round.id) setRound(cfg.active_round);
				waitForCrash(cfg.active_round.id);
				return;
			}
			// No round running: the one on screen, or a bet whose answer was lost, may have finished
			// meanwhile. The server's history is the record of both.
			const recent = await crashApi.history();
			if (!mountedRef.current) return;
			const finished = recent.results.filter((r) => r.revealed);
			setHistory(finished.slice(0, HISTORY_SIZE));
			const shown = roundRef.current;
			const same = shown && finished.find((r) => r.id === shown.id);
			if (same) {
				apply(same);
				return;
			}
			const latest = finished[0];
			if (
				latest &&
				(!shown || Date.parse(latest.started_at) > Date.parse(shown.started_at))
			) {
				setRound(latest);
			}
		} catch {
			// Still offline; the error message stays and the next action retries.
		}
	}, [apply, setRound, updateBalance, waitForCrash]);

	useEffect(() => {
		mountedRef.current = true;
		(async () => {
			try {
				// Sync the clock on the config answer alone; a slow history call must not skew it.
				const sentAt = Date.now();
				const configured = crashApi.config().then((cfg) => {
					syncClock(cfg.server_time, sentAt);
					return cfg;
				});
				const [cfg, recent] = await Promise.all([configured, crashApi.history()]);
				if (!mountedRef.current) return;
				setConfig(cfg);
				updateBalance(cfg.balance, cfg.server_time);
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
	}, [setRound, updateBalance, waitForCrash]);

	const placeBet = useCallback(
		async (amount: number, autoCashout: string | null) => {
			setBusy(true);
			setError(null);
			try {
				const sentAt = Date.now();
				const state = await crashApi.bet(amount, autoCashout);
				syncClock(state.server_time, sentAt);
				waitingRef.current = null;
				setRound(state.round);
				updateBalance(state.balance, state.server_time);
				setConfig((prev) =>
					prev ? { ...prev, next_nonce: state.round.nonce + 1 } : prev,
				);
				waitForCrash(state.round.id);
				return state.round;
			} catch (e) {
				setError(crashErrorMessage(e));
				await reconcile();
				return null;
			} finally {
				setBusy(false);
			}
		},
		[reconcile, setRound, updateBalance, waitForCrash],
	);

	const cashOut = useCallback(async () => {
		const current = roundRef.current;
		if (!current || current.status !== "active") return;
		setBusy(true);
		try {
			const state = await crashApi.cashOut(current.id);
			apply(state.round, state);
		} catch (e) {
			setError(crashErrorMessage(e));
			await reconcile();
		} finally {
			setBusy(false);
		}
	}, [apply, reconcile]);

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
