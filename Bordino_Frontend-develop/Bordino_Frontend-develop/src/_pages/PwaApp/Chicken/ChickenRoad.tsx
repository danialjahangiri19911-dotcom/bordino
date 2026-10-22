"use client";

import { useEffect, useRef } from "react";

import Box from "@mui/material/Box";
import ButtonBase from "@mui/material/ButtonBase";
import Typography from "@mui/material/Typography";

import { BarrierSvg, CarSvg, ChickenSvg, FlagSvg, RoastSvg } from "./art";
import { ROAD_COLORS, laneTraffic } from "./utils";
import { CRASH_COLORS, formatMultiplier, formatPoints } from "@/_pages/PwaApp/Crash/utils";
import { toPersianDigits } from "@/libs/utils/persianNumberConverter";

const LANE = 76;

interface Props {
	lanes: number;
	multipliers: string[];
	/** Lane the chicken is drawn on (0 = start sidewalk); animates toward the server's step. */
	position: number;
	/** Set once the shown position has reached the end of a finished round. */
	outcome: { kind: "won"; payout: number; multiplier: string } | { kind: "lost"; lane: number } | null;
	/** Lanes the player may tap to jump to (and cash out there); null = not playing. */
	jumpFrom: number | null;
	selected: number | null;
	onSelect: (lane: number | null) => void;
}

// Keyframes live in a raw <style>, which the app's RTL plugin does not mirror, so they only
// move things vertically or scale them; horizontal centring stays on the (mirrored) wrapper.
const KEYFRAMES = `
@keyframes chicken-drive { from { transform: translateY(-130%); } to { transform: translateY(calc(var(--road-h) + 30%)); } }
@keyframes chicken-hop { 0% { transform: translateY(0); } 45% { transform: translateY(-28%); } 100% { transform: translateY(0); } }
@keyframes chicken-slam { from { transform: translateY(-210%); } to { transform: translateY(-12%); } }
@keyframes chicken-pop { from { transform: scale(0.4); opacity: 0; } to { transform: scale(1); opacity: 1; } }
@media (prefers-reduced-motion: reduce) {
  .chicken-motion { animation: none !important; transition: none !important; }
}
`;

export default function ChickenRoad({ lanes, multipliers, position, outcome, jumpFrom, selected, onSelect }: Props) {
	const viewportRef = useRef<HTMLDivElement>(null);

	// Keep two lanes ahead of the chicken in view. scrollIntoView works whichever way the road
	// runs (the app's RTL styling mirrors it, so lane 1 is on the right).
	useEffect(() => {
		const viewport = viewportRef.current;
		if (!viewport) return;
		const lane = position === 0 ? 0 : Math.min(position + 2, lanes + 1);
		const target = viewport.querySelector(`[data-lane="${lane}"]`);
		const reduced = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
		target?.scrollIntoView({ behavior: reduced ? "auto" : "smooth", block: "nearest", inline: "nearest" });
	}, [position, lanes]);

	const total = (lanes + 2) * LANE;
	const lost = outcome?.kind === "lost";

	return (
		<Box
			ref={viewportRef}
			sx={{
				position: "relative",
				height: "clamp(190px, 32vh, 280px)",
				overflow: "hidden",
				borderRadius: 2,
				bgcolor: ROAD_COLORS.asphalt,
				"--road-h": "clamp(190px, 32vh, 280px)",
			}}
		>
			<style>{KEYFRAMES}</style>
			<Box sx={{ position: "relative", height: "100%", width: total, display: "flex" }}>
				{/* Start sidewalk. */}
				<Box data-lane={0} sx={{ width: LANE, flexShrink: 0, bgcolor: ROAD_COLORS.sidewalk }} />

				{multipliers.map((multiplier, index) => {
					const lane = index + 1;
					const passed = lane <= position && !(lost && lane === position);
					const isHit = lost && outcome.lane === lane;
					const ahead = lane > position;
					const canJump = jumpFrom !== null && lane > jumpFrom;
					const traffic = laneTraffic(lane);
					return (
						<Box
							key={lane}
							data-lane={lane}
							sx={{
								// border-box: the dashed divider must not widen the lane, or the chicken drifts.
								boxSizing: "border-box",
								width: LANE,
								flexShrink: 0,
								position: "relative",
								overflow: "hidden",
								borderRight: lane < lanes ? `2px dashed ${ROAD_COLORS.laneLine}` : "none",
							}}
						>
							{ahead && !isHit && (
								<Box
									className="chicken-motion"
									sx={{
										position: "absolute",
										left: "50%",
										marginLeft: "-20px",
										top: 0,
										animation: `chicken-drive ${traffic.duration}s linear ${traffic.delay}s infinite`,
									}}
								>
									<CarSvg color={traffic.color} width={40} />
								</Box>
							)}
							{passed && (
								<Box sx={{ position: "absolute", top: 8, left: "50%", transform: "translateX(-50%)" }}>
									<BarrierSvg />
								</Box>
							)}
							{isHit && (
								<Box
									sx={{
										position: "absolute",
										left: "50%",
										top: "50%",
										zIndex: 3,
										transform: "translate(-50%, -50%)",
									}}
								>
									<Box
										className="chicken-motion"
										sx={{ animation: "chicken-slam 0.35s ease-in forwards" }}
									>
										<CarSvg color={traffic.color} width={44} />
									</Box>
								</Box>
							)}
							<ButtonBase
								disabled={!canJump}
								onClick={() => onSelect(selected === lane ? null : lane)}
								aria-label={`پرش تا خط ${lane}، ضریب ${multiplier}`}
								sx={{
									position: "absolute",
									left: "50%",
									top: "50%",
									transform: "translate(-50%, -50%)",
									width: 58,
									height: 58,
									borderRadius: "50%",
									flexDirection: "column",
									bgcolor: isHit ? CRASH_COLORS.red : passed ? ROAD_COLORS.passed : ROAD_COLORS.manhole,
									border: `3px solid ${selected === lane ? CRASH_COLORS.green : passed ? "#fde68a" : ROAD_COLORS.manholeRing}`,
									boxShadow: selected === lane ? `0 0 0 3px rgba(0,231,1,0.35)` : "inset 0 2px 6px rgba(0,0,0,0.5)",
									color: passed ? "#1f2937" : CRASH_COLORS.text,
									"&.Mui-disabled": { color: passed ? "#1f2937" : CRASH_COLORS.text },
								}}
							>
								<Typography sx={{ fontSize: 12, fontWeight: 800, lineHeight: 1 }}>
									{formatMultiplier(multiplier)}
								</Typography>
							</ButtonBase>
							<Typography
								sx={{
									position: "absolute",
									bottom: 4,
									width: "100%",
									textAlign: "center",
									fontSize: 10,
									color: "rgba(255,255,255,0.45)",
								}}
							>
								{toPersianDigits(lane)}
							</Typography>
						</Box>
					);
				})}

				{/* Finish sidewalk. */}
				<Box
					data-lane={lanes + 1}
					sx={{
						width: LANE,
						flexShrink: 0,
						bgcolor: ROAD_COLORS.sidewalk,
						display: "flex",
						alignItems: "center",
						justifyContent: "center",
					}}
				>
					<FlagSvg />
				</Box>

				{/* The chicken (or what is left of it). */}
				<Box
					sx={{
						position: "absolute",
						top: "50%",
						left: position * LANE + LANE / 2,
						zIndex: 2,
						transform: "translate(-50%, -50%)",
						pointerEvents: "none",
					}}
				>
					<Box
						key={lost ? "roast" : position}
						className="chicken-motion"
						sx={{
							animation: lost ? "chicken-pop 0.3s ease-out 0.3s both" : "chicken-hop 0.18s ease-out",
						}}
					>
						{lost ? <RoastSvg size={54} /> : <ChickenSvg size={50} />}
					</Box>
				</Box>
			</Box>

			{outcome && (
				<Box
					role="status"
					sx={{
						position: "absolute",
						top: 10,
						left: "50%",
						transform: "translateX(-50%)",
						px: 2,
						py: 0.75,
						borderRadius: 99,
						bgcolor: "rgba(15,33,46,0.88)",
						border: `1px solid ${outcome.kind === "won" ? CRASH_COLORS.green : CRASH_COLORS.red}`,
						direction: "rtl",
						whiteSpace: "nowrap",
						zIndex: 4,
					}}
				>
					<Typography
						sx={{ fontWeight: 800, fontSize: 15, color: outcome.kind === "won" ? CRASH_COLORS.green : CRASH_COLORS.red }}
					>
						{outcome.kind === "won"
							? `+${formatPoints(outcome.payout)} امتیاز با ${formatMultiplier(outcome.multiplier)}`
							: `تصادف در خط ${toPersianDigits(outcome.lane)}!`}
					</Typography>
				</Box>
			)}
		</Box>
	);
}
