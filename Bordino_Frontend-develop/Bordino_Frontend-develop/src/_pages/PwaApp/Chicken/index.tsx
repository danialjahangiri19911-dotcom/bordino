"use client";

import { useEffect, useMemo, useRef, useState } from "react";

import { useRouter } from "next/navigation";

import Box from "@mui/material/Box";
import ButtonBase from "@mui/material/ButtonBase";
import Typography from "@mui/material/Typography";

import ChickenRoad from "./ChickenRoad";
import useChickenGame from "./useChickenGame";
import { DIFFICULTY_LABELS, ROAD_COLORS, verifyHitLane } from "./utils";
import type { ChickenDifficulty } from "@/api/games/chicken/types";
import { Field, Label, Segmented, SideButton } from "@/_pages/PwaApp/Crash/CrashControls";
import FairnessDialog from "@/_pages/PwaApp/Crash/FairnessDialog";
import { CRASH_COLORS, formatMultiplier, formatPoints } from "@/_pages/PwaApp/Crash/utils";
import { GAME_NET } from "@/constants/routes";
import { toPersianDigits } from "@/libs/utils/persianNumberConverter";

const HOP_MS = 170;
const DIFFICULTIES: ChickenDifficulty[] = ["easy", "medium", "hard"];

function BigButton({
	children,
	onClick,
	disabled,
	color,
}: {
	children: React.ReactNode;
	onClick: () => void;
	disabled?: boolean;
	color: string;
}) {
	return (
		<ButtonBase
			onClick={onClick}
			disabled={disabled}
			sx={{
				flex: 1,
				height: 50,
				borderRadius: 1.5,
				bgcolor: color,
				color: CRASH_COLORS.greenText,
				fontWeight: 800,
				fontSize: 16,
				px: 1,
				"&.Mui-disabled": { opacity: 0.5 },
			}}
		>
			{children}
		</ButtonBase>
	);
}

export default function ChickenGame() {
	const { push } = useRouter();
	const game = useChickenGame();
	const { config, round, balance, history, busy } = game;

	const [difficulty, setDifficulty] = useState<ChickenDifficulty>("easy");
	const [bet, setBet] = useState("10");
	const [selected, setSelected] = useState<number | null>(null);
	const [fairOpen, setFairOpen] = useState(false);

	// The chicken hops lane by lane toward the server's step (a jump crosses several).
	const [shown, setShown] = useState(0);
	const [shownRound, setShownRound] = useState<string | null>(null);
	useEffect(() => {
		if (!round) return undefined;
		if (round.id !== shownRound) {
			setShownRound(round.id);
			setShown(round.step);
			return undefined;
		}
		if (shown === round.step) return undefined;
		const timer = setTimeout(() => setShown((s) => s + Math.sign(round.step - s)), HOP_MS);
		return () => clearTimeout(timer);
	}, [round, shown, shownRound]);

	useEffect(() => {
		if (round?.difficulty) setDifficulty(round.difficulty);
	}, [round?.difficulty]);

	const active = round?.status === "active";
	const settled = !!round && round.revealed && shown === round.step && shownRound === round.id;
	const animating = !!round && shown !== round.step;
	const level = config?.difficulties[difficulty];
	// A finished round stays on the road until the player picks another difficulty or bets again.
	const showRound =
		!!round && (active || animating || (settled && round.difficulty === difficulty));
	const multipliers = showRound ? round!.multipliers : level?.multipliers ?? [];
	const lanes = showRound ? round!.lanes : level?.lanes ?? 0;
	const position = showRound ? shown : 0;

	const outcome = useMemo(() => {
		if (!settled || !round || !showRound) return null;
		if (round.status === "won") {
			return { kind: "won" as const, payout: round.payout, multiplier: round.cashout_multiplier ?? "0" };
		}
		return { kind: "lost" as const, lane: round.step };
	}, [settled, round, showRound]);

	const betValue = Number(bet) || 0;
	const betProblem = useMemo(() => {
		if (!config) return null;
		if (!config.enabled) return "بازی مرغ فراری فعلاً غیرفعال است.";
		if (betValue < config.min_bet) return `حداقل شرط ${formatPoints(config.min_bet)} امتیاز است.`;
		if (betValue > config.max_bet) return `حداکثر شرط ${formatPoints(config.max_bet)} امتیاز است.`;
		if (betValue > balance) return "امتیاز کافی نداری.";
		return null;
	}, [config, betValue, balance]);

	const setBetClamped = (value: number) => {
		const max = Math.min(config?.max_bet ?? value, Math.max(balance, config?.min_bet ?? 1));
		setBet(String(Math.max(config?.min_bet ?? 1, Math.min(Math.floor(value), max))));
	};

	const start = async () => {
		setSelected(null);
		await game.placeBet(betValue, difficulty);
	};
	const go = async () => {
		const to = selected ?? undefined;
		setSelected(null);
		await game.step(to);
	};

	// While the chicken hops toward the server's answer, the buttons describe the lane it stands
	// on now, not the lane the answer put it on (that would give the result away).
	const atLane = animating ? shown : round?.step ?? 0;
	const current = animating
		? atLane > 0 ? Number(multipliers[atLane - 1]) : null
		: round?.current_multiplier ? Number(round.current_multiplier) : null;
	const cashValue = (active || animating) && current ? Math.floor(round!.bet * current) : 0;
	const nextMultiplier = selected
		? multipliers[selected - 1]
		: animating ? multipliers[atLane] : round?.next_multiplier;
	const playing = active && !animating;

	// Space bar: Go while playing, Bet otherwise.
	useEffect(() => {
		const onKey = (event: KeyboardEvent) => {
			if (event.code !== "Space" || event.repeat) return;
			const tag = (event.target as HTMLElement | null)?.tagName;
			if (tag === "INPUT" || tag === "TEXTAREA" || tag === "BUTTON") return;
			event.preventDefault();
			if (playing && !busy) go();
			else if (!active && !animating && !busy && !betProblem && config) start();
		};
		window.addEventListener("keydown", onKey);
		return () => window.removeEventListener("keydown", onKey);
	});

	// The result belongs to the end of the hop animation: until the chicken gets there, keep the
	// finished round out of the history pills, the balance and the fairness dialog.
	const hiding = !!round && round.revealed && !settled;
	const shownHistory = hiding ? history.filter((r) => r.id !== round!.id) : history;
	const stableBalance = useRef(balance);
	if (!hiding) stableBalance.current = balance;
	const shownBalance = hiding ? stableBalance.current : balance;
	const lastFinished = settled ? round : shownHistory[0] ?? null;

	return (
		// Bottom margin clears the app's fixed bottom navigation bar.
		<Box sx={{ bgcolor: CRASH_COLORS.panel, borderRadius: 3, p: 1.25, mb: 9, color: CRASH_COLORS.text }}>
			{/* One row: back + title, recent results (newest first), fairness. */}
			<Box sx={{ display: "flex", alignItems: "center", gap: 1, mb: 1 }}>
				<ButtonBase
					onClick={() => push(GAME_NET.path)}
					aria-label="بازگشت به گیمنت"
					sx={{ color: CRASH_COLORS.muted, fontSize: 18, width: 28, height: 28, borderRadius: 1, flexShrink: 0 }}
				>
					→
				</ButtonBase>
				<Typography sx={{ fontWeight: 800, fontSize: 16, flexShrink: 0 }}>مرغ فراری</Typography>
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
					{shownHistory.map((r) => (
						<Box
							key={r.id}
							sx={{
								flexShrink: 0,
								px: 1,
								py: 0.25,
								borderRadius: 99,
								fontSize: 11,
								fontWeight: 700,
								bgcolor: r.status === "won" ? CRASH_COLORS.pillHigh : CRASH_COLORS.pillLow,
								color: CRASH_COLORS.text,
							}}
						>
							{r.status === "won" ? formatMultiplier(r.cashout_multiplier ?? 0) : "باخت"}
						</Box>
					))}
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

			<ChickenRoad
				lanes={lanes}
				multipliers={multipliers}
				position={position}
				outcome={outcome}
				jumpFrom={playing ? round!.step : null}
				selected={selected}
				onSelect={setSelected}
			/>

			<Box
				sx={{
					mt: 1,
					bgcolor: CRASH_COLORS.raised,
					borderRadius: 2,
					p: 1.25,
					display: "flex",
					flexDirection: "column",
					gap: 1.25,
				}}
			>
				{active || animating ? (
					<>
						<Box sx={{ display: "flex", gap: 1 }}>
							<BigButton color={CRASH_COLORS.green} onClick={go} disabled={!playing || busy}>
								{selected
									? `پرش و برداشت ${formatMultiplier(nextMultiplier ?? 0)}`
									: `برو ${nextMultiplier ? formatMultiplier(nextMultiplier) : ""}`}
							</BigButton>
							<BigButton
								color={ROAD_COLORS.orange}
								onClick={game.cashOut}
								disabled={!playing || busy || !round?.step}
							>
								{atLane ? `برداشت ${formatPoints(cashValue)}` : "برداشت"}
							</BigButton>
						</Box>
						<Box sx={{ display: "flex", gap: 1, alignItems: "center" }}>
							<ButtonBase
								onClick={() => game.step(round!.lanes)}
								disabled={!playing || busy}
								sx={{
									height: 36,
									px: 1.5,
									borderRadius: 1,
									border: `1px solid ${CRASH_COLORS.border}`,
									color: CRASH_COLORS.text,
									fontWeight: 700,
									fontSize: 13,
									flexShrink: 0,
									"&.Mui-disabled": { opacity: 0.5 },
								}}
							>
								تا انتها {round ? formatMultiplier(round.multipliers[round.lanes - 1]) : ""}
							</ButtonBase>
							<Typography sx={{ fontSize: 11, color: CRASH_COLORS.muted, lineHeight: 1.6 }}>
								برای پرش مستقیم، روی ضریب یکی از خط‌های جلو بزن.
							</Typography>
						</Box>
					</>
				) : (
					<>
						<Box sx={{ display: "flex" }}>
							<BigButton
								color={CRASH_COLORS.green}
								onClick={start}
								disabled={!!betProblem || busy || !config}
							>
								شرط
							</BigButton>
						</Box>
						<Segmented
							value={difficulty}
							onChange={setDifficulty}
							options={DIFFICULTIES.map((d) => ({ value: d, label: DIFFICULTY_LABELS[d] }))}
						/>
						<Box>
							<Label>مبلغ شرط</Label>
							<Field label="مبلغ شرط" value={bet} onChange={setBet}>
								<SideButton label="نصف" onClick={() => setBetClamped(betValue / 2)}>
									½
								</SideButton>
								<SideButton label="دو برابر" onClick={() => setBetClamped(betValue * 2)}>
									۲×
								</SideButton>
							</Field>
						</Box>
					</>
				)}

				{(game.error || (!active && !animating && !game.loading && betProblem)) && (
					<Typography role="alert" sx={{ color: CRASH_COLORS.red, fontSize: 12, textAlign: "center" }}>
						{game.error ?? betProblem}
					</Typography>
				)}

				<Box sx={{ display: "flex", justifyContent: "space-between" }}>
					<Typography component="span" sx={{ fontSize: 12, color: CRASH_COLORS.muted }}>
						{active
							? <>شرط {formatPoints(round!.bet)} · {DIFFICULTY_LABELS[round!.difficulty]} · خط {toPersianDigits(round!.step)} از {toPersianDigits(round!.lanes)}</>
							: level
								? <>{toPersianDigits(level.lanes)} خط · تا {formatMultiplier(level.multipliers[level.lanes - 1])}</>
								: null}
					</Typography>
					<Typography component="span" sx={{ fontSize: 12, color: CRASH_COLORS.muted }}>
						موجودی: <Box component="b" sx={{ color: CRASH_COLORS.text }}>{formatPoints(shownBalance)}</Box> امتیاز
					</Typography>
				</Box>
			</Box>

			<FairnessDialog
				open={fairOpen}
				onClose={() => setFairOpen(false)}
				clientSeed={config?.client_seed ?? ""}
				nextNonce={config?.next_nonce ?? 0}
				lastRound={
					lastFinished && {
						...lastFinished,
						resultLabel: lastFinished.hit_lane
							? `تصادف در خط ${toPersianDigits(lastFinished.hit_lane)}`
							: "بدون تصادف",
					}
				}
				seedLocked={active}
				onChangeSeed={game.changeSeed}
				formula={
					<>
						u(i) = first 4 bytes of HMAC_SHA256(server_seed, client_seed:nonce:i) / 2³²
						<br />
						car hits lane i ⇔ u(i) &lt; hit · multiplier(i) = (1 − edge) / (1 − hit)^i
					</>
				}
				onVerify={async () => {
					if (!lastFinished?.server_seed) return "";
					const lane = await verifyHitLane(
						lastFinished.server_seed,
						lastFinished.client_seed,
						lastFinished.nonce,
						lastFinished.lanes,
						lastFinished.hit_chance,
					);
					if (lane === null) return "بررسی در مرورگر فقط روی نشانی https کار می‌کند.";
					const expected = lastFinished.hit_lane ?? 0;
					const label = lane ? `تصادف در خط ${toPersianDigits(lane)}` : "بدون تصادف";
					return lane === expected ? `✓ درست است: ${label}` : `✗ نتیجهٔ محاسبه: ${label}`;
				}}
			/>
		</Box>
	);
}
