"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";


import Box from "@mui/material/Box";
import ButtonBase from "@mui/material/ButtonBase";

import CrashControls, {
	type AutoAdjust,
	type AutoSettings,
	type CrashMode,
	type MainAction,
} from "./CrashControls";
import CrashGraph, { type CrashPhase } from "./CrashGraph";
import FairnessDialog from "./FairnessDialog";
import useCrashGame from "./useCrashGame";
import {
	CRASH_COLORS,
	formatMultiplier,
	formatPoints,
	multiplierAt,
	profitOnWin,
	verifyCrashPoint,
} from "./utils";

const DEFAULT_AUTO: AutoSettings = {
	count: "0",
	onWin: { mode: "reset", percent: "0" },
	onLoss: { mode: "reset", percent: "0" },
	stopProfit: "0",
	stopLoss: "0",
};
const AUTO_PAUSE_MS = 1500;

function adjust(current: number, base: number, rule: AutoAdjust) {
	if (rule.mode === "reset") return base;
	return Math.max(1, Math.round(current * (1 + (Number(rule.percent) || 0) / 100)));
}

/** True when the player asked the system for less motion. */
function usePrefersReducedMotion() {
	const [reduced, setReduced] = useState(false);
	useEffect(() => {
		const query = window.matchMedia?.("(prefers-reduced-motion: reduce)");
		if (!query) return undefined;
		const update = () => setReduced(query.matches);
		update();
		query.addEventListener?.("change", update);
		return () => query.removeEventListener?.("change", update);
	}, []);
	return reduced;
}

/**
 * Re-render while `active`: every animation frame, or 4 times a second with reduced motion
 * (the multiplier still has to update for the player to cash out).
 */
function useFrameClock(active: boolean, reduced: boolean) {
	const [now, setNow] = useState(() => Date.now());
	useEffect(() => {
		if (!active) return undefined;
		if (reduced) {
			const timer = setInterval(() => setNow(Date.now()), 250);
			return () => clearInterval(timer);
		}
		let frame = 0;
		const tick = () => {
			setNow(Date.now());
			frame = requestAnimationFrame(tick);
		};
		frame = requestAnimationFrame(tick);
		return () => cancelAnimationFrame(frame);
	}, [active, reduced]);
	return now;
}

/** Grace after the highest possible crash before the page says the connection is lost. */
const RECONNECT_GRACE_MS = 3000;

export default function CrashGame() {
	const game = useCrashGame();
	const { config, balance, round, history, busy } = game;

	const [mode, setMode] = useState<CrashMode>("manual");
	const [bet, setBet] = useState("10");
	const [cashoutAt, setCashoutAt] = useState("2.00");
	const [auto, setAuto] = useState<AutoSettings>(DEFAULT_AUTO);
	const [autoRunning, setAutoRunning] = useState(false);
	const [fairOpen, setFairOpen] = useState(false);

	const reducedMotion = usePrefersReducedMotion();
	const live = !!round && !round.revealed;
	useFrameClock(live, reducedMotion);
	const growth = config?.growth_per_ms ?? 0.00006;
	const rawElapsedMs = round ? game.serverNow() - Date.parse(round.started_at) : 0;
	// No round can outlive its multiplier cap: past that point the answer is just late, so the
	// curve stops there instead of growing without bound while the connection is down.
	const capMs = round ? Math.log(Number(round.max_multiplier) || 1000) / growth : Infinity;
	const elapsedMs = Math.min(rawElapsedMs, capMs);
	const reconnecting = live && rawElapsedMs > capMs + RECONNECT_GRACE_MS;

	let phase: CrashPhase = "idle";
	if (round?.revealed) phase = "crashed";
	else if (round) phase = elapsedMs < 0 ? "starting" : "running";

	const liveMultiplier = phase === "running" ? multiplierAt(elapsedMs, growth) : 1;
	const target = round ? Number(round.target_multiplier) : null;
	// Passing the target locally is not a win yet: the server confirms it (the long-poll answers
	// at that moment). Until then the button says it is waiting, and nothing shows a payout.
	const autoPending =
		phase === "running" && round?.status === "active" && !!target && liveMultiplier >= target;

	const cashout = useMemo(() => {
		if (round?.status === "won" && round.cashout_multiplier) {
			return { multiplier: Number(round.cashout_multiplier), payout: round.payout };
		}
		return null;
	}, [round]);

	const betValue = Number(bet) || 0;
	const cashoutValue = Number(cashoutAt) || null;
	const roundBusy = phase === "starting" || phase === "running";
	const locked = roundBusy || autoRunning || busy;

	const betProblem = useMemo(() => {
		if (!config) return null;
		if (!config.enabled) return "بازی انفجار فعلاً غیرفعال است.";
		if (betValue < config.min_bet) return `حداقل شرط ${formatPoints(config.min_bet)} امتیاز است.`;
		if (betValue > config.max_bet) return `حداکثر شرط ${formatPoints(config.max_bet)} امتیاز است.`;
		if (betValue > balance) return "امتیاز کافی نداری.";
		if (cashoutAt && (!cashoutValue || cashoutValue < 1.01)) return "ضریب برداشت باید حداقل ۱٫۰۱ باشد.";
		if (mode === "auto" && !cashoutValue) return "برای شرط خودکار، ضریب برداشت را وارد کن.";
		return null;
	}, [config, betValue, balance, cashoutAt, cashoutValue, mode]);

	const { placeBet } = game;
	const startRound = useCallback(
		(amount: number) => placeBet(amount, cashoutValue ? cashoutValue.toFixed(2) : null),
		[placeBet, cashoutValue],
	);

	// ---- Auto-bet: one ordinary server bet after another, adjusted by the rules.
	const autoRef = useRef({ base: 0, current: 0, played: 0, profit: 0, lastRound: "" });
	// Kept outside the effect's cleanup: re-renders must not cancel the next queued bet.
	const autoTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

	const stopAuto = useCallback(() => setAutoRunning(false), []);

	useEffect(() => {
		if (!autoRunning && autoTimer.current) {
			clearTimeout(autoTimer.current);
			autoTimer.current = null;
		}
	}, [autoRunning]);
	useEffect(() => () => {
		if (autoTimer.current) clearTimeout(autoTimer.current);
	}, []);

	const startAuto = useCallback(async () => {
		// The round on screen is the last manual one; it must not count as the first auto result.
		autoRef.current = { base: betValue, current: betValue, played: 0, profit: 0, lastRound: round?.id ?? "" };
		setAutoRunning(true);
		const started = await startRound(betValue);
		if (!started) setAutoRunning(false);
	}, [betValue, startRound, round?.id]);

	useEffect(() => {
		if (!autoRunning || !round?.revealed || autoRef.current.lastRound === round.id) return;
		const state = autoRef.current;
		state.lastRound = round.id;
		state.played += 1;
		state.profit += round.payout - round.bet;
		const won = round.status === "won";
		state.current = adjust(state.current, state.base, won ? auto.onWin : auto.onLoss);

		const count = Number(auto.count) || 0;
		const stopProfit = Number(auto.stopProfit) || 0;
		const stopLoss = Number(auto.stopLoss) || 0;
		if (
			(count > 0 && state.played >= count) ||
			(stopProfit > 0 && state.profit >= stopProfit) ||
			(stopLoss > 0 && -state.profit >= stopLoss) ||
			!config ||
			state.current > balance ||
			state.current > config.max_bet
		) {
			setAutoRunning(false);
			return;
		}
		setBet(String(state.current));
		autoTimer.current = setTimeout(async () => {
			autoTimer.current = null;
			const next = await startRound(state.current);
			if (!next) setAutoRunning(false);
		}, AUTO_PAUSE_MS);
	}, [autoRunning, round, auto, balance, config, startRound]);

	// ---- Main button: bet / cash out (manual), start / stop (auto).
	let action: MainAction;
	if (mode === "auto") {
		action = autoRunning
			? { label: "توقف شرط خودکار", disabled: false, onClick: stopAuto }
			: { label: "شروع شرط خودکار", disabled: !!betProblem || roundBusy || busy || !config, onClick: startAuto };
	} else if (phase === "starting") {
		action = { label: "در حال شروع…", disabled: true, onClick: () => undefined };
	} else if (phase === "running" && reconnecting) {
		action = { label: "در حال اتصال دوباره…", disabled: true, onClick: () => undefined };
	} else if (phase === "running" && autoPending) {
		action = {
			label: `در انتظار تأیید ${formatMultiplier(target ?? 0)}…`,
			disabled: true,
			onClick: () => undefined,
		};
	} else if (phase === "running" && cashout) {
		action = { label: `برداشت شد ${formatMultiplier(cashout.multiplier)}`, disabled: true, onClick: () => undefined };
	} else if (phase === "running" && round) {
		action = {
			label: `برداشت ${formatPoints(round.bet * liveMultiplier)}`,
			disabled: busy,
			onClick: game.cashOut,
		};
	} else {
		action = {
			label: "شرط",
			disabled: !!betProblem || busy || !config,
			onClick: () => startRound(betValue),
		};
	}

	// Space bar = the main button (Stake's hotkey), when not typing in a field.
	useEffect(() => {
		const onKey = (event: KeyboardEvent) => {
			if (event.code !== "Space" || event.repeat) return;
			const tag = (event.target as HTMLElement | null)?.tagName;
			if (tag === "INPUT" || tag === "TEXTAREA" || tag === "BUTTON") return;
			event.preventDefault();
			if (!action.disabled) action.onClick();
		};
		window.addEventListener("keydown", onKey);
		return () => window.removeEventListener("keydown", onKey);
	});

	const setBetClamped = (value: number) => {
		const max = Math.min(config?.max_bet ?? value, Math.max(balance, config?.min_bet ?? 1));
		setBet(String(Math.max(config?.min_bet ?? 1, Math.min(Math.floor(value), max))));
	};

	const stepCashout = (delta: number) => {
		const current = cashoutValue ?? 2;
		const step = current >= 10 ? 1 : current >= 3 ? 0.5 : 0.1;
		setCashoutAt(Math.max(1.01, Math.round((current + delta * step) * 100) / 100).toFixed(2));
	};

	const lastRevealed = round?.revealed ? round : history[0] ?? null;
	const announcement = round?.revealed
		? round.status === "won"
			? `برد! ${formatPoints(round.payout)} امتیاز با ضریب ${formatMultiplier(round.cashout_multiplier ?? 0)}`
			: `انفجار در ${formatMultiplier(round.crash_point ?? 0)}`
		: "";

	return (
		<Box sx={{ bgcolor: CRASH_COLORS.panel, borderRadius: 3, p: 1.25, color: CRASH_COLORS.text }}>
			{/* One row: recent results (newest first), fairness. The game shell (src/bd) has the
			    title, info and exit. */}
			<Box sx={{ display: "flex", alignItems: "center", gap: 1, mb: 1 }}>
				<Box
					aria-label="نتایج اخیر"
					sx={{
						display: "flex",
						gap: 0.5,
						overflowX: "auto",
						flex: 1,
						minWidth: 0,
						"&::-webkit-scrollbar": { display: "none" },
						scrollbarWidth: "none",
					}}
				>
					{history.map((r) => {
						const point = Number(r.crash_point);
						return (
							<Box
								key={r.id}
								sx={{
									flexShrink: 0,
									px: 1,
									py: 0.25,
									borderRadius: 99,
									fontSize: 11,
									fontWeight: 700,
									bgcolor: point >= 2 ? CRASH_COLORS.pillHigh : CRASH_COLORS.pillLow,
									color: CRASH_COLORS.text,
								}}
							>
								{formatMultiplier(point)}
							</Box>
						);
					})}
				</Box>
				<ButtonBase
					onClick={() => setFairOpen(true)}
					aria-label="منصفانه بودن"
					sx={{
						color: CRASH_COLORS.muted,
						fontSize: 12,
						px: 1,
						height: 28,
						borderRadius: 1,
						border: `1px solid ${CRASH_COLORS.border}`,
						flexShrink: 0,
					}}
				>
					منصفانه
				</ButtonBase>
			</Box>

			<CrashGraph
				phase={phase}
				elapsedMs={elapsedMs}
				growthPerMs={growth}
				multiplier={liveMultiplier}
				crashPoint={round?.revealed && round.crash_point ? Number(round.crash_point) : null}
				cashout={cashout}
				reconnecting={reconnecting}
			/>

			<Box sx={{ position: "absolute", width: 1, height: 1, overflow: "hidden", clip: "rect(0 0 0 0)" }} aria-live="polite">
				{announcement}
			</Box>

			<Box sx={{ mt: 1 }}>
				<CrashControls
					mode={mode}
					onModeChange={setMode}
					locked={locked}
					bet={bet}
					onBetChange={setBet}
					onHalf={() => setBetClamped(betValue / 2)}
					onDouble={() => setBetClamped(betValue * 2)}
					cashoutAt={cashoutAt}
					onCashoutAtChange={setCashoutAt}
					onCashoutStep={stepCashout}
					profit={profitOnWin(betValue, cashoutValue, config?.max_payout)}
					balance={balance}
					auto={auto}
					onAutoChange={setAuto}
					action={action}
					hint={game.error ?? (roundBusy || autoRunning || game.loading ? null : betProblem)}
				/>
			</Box>

			<FairnessDialog
				open={fairOpen}
				onClose={() => setFairOpen(false)}
				clientSeed={config?.client_seed ?? ""}
				nextNonce={config?.next_nonce ?? 0}
				lastRound={
					lastRevealed && {
						...lastRevealed,
						resultLabel: lastRevealed.crash_point ? formatMultiplier(lastRevealed.crash_point) : null,
					}
				}
				seedLocked={roundBusy || autoRunning}
				onChangeSeed={game.changeSeed}
				formula={
					<>
						HMAC_SHA256(server_seed, client_seed:nonce) → x = first 4 bytes
						<br />
						crash = max(1, floor(2³² × (1 − edge) / (x + 1) × 100) / 100)
					</>
				}
				onVerify={async () => {
					if (!lastRevealed?.server_seed || !config) return "";
					const result = await verifyCrashPoint(
						lastRevealed.server_seed,
						lastRevealed.client_seed,
						lastRevealed.nonce,
						lastRevealed.house_edge,
						lastRevealed.max_multiplier,
					);
					if (result === null) return "بررسی در مرورگر فقط روی نشانی https کار می‌کند.";
					return result === lastRevealed.crash_point
						? `✓ درست است: ${formatMultiplier(result)}`
						: `✗ نتیجهٔ محاسبه ${formatMultiplier(result)} است.`;
				}}
			/>
		</Box>
	);
}
