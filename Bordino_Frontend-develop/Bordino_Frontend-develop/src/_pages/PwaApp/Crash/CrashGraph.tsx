"use client";

import { useEffect, useRef } from "react";

import Box from "@mui/material/Box";
import Typography from "@mui/material/Typography";

import { CRASH_COLORS, exactMultiplierAt, formatMultiplier, formatPoints } from "./utils";
import { toPersianDigits } from "@/libs/utils/persianNumberConverter";

export type CrashPhase = "idle" | "starting" | "running" | "crashed";

interface Props {
	phase: CrashPhase;
	/** ms since the round started (server clock); negative while starting. */
	elapsedMs: number;
	growthPerMs: number;
	multiplier: number;
	crashPoint: number | null;
	cashout: { multiplier: number; payout: number } | null;
}

const Y_STEPS = [0.1, 0.2, 0.5, 1, 2, 5, 10, 20, 50, 100, 200, 500, 1000];
const X_STEPS = [1, 2, 5, 10, 15, 30, 60, 120, 300];

function pickStep(span: number, steps: number[], maxTicks: number) {
	return steps.find((s) => span / s <= maxTicks) ?? steps[steps.length - 1];
}

function msToReach(multiplier: number, growthPerMs: number) {
	return Math.log(multiplier) / growthPerMs;
}

function draw(canvas: HTMLCanvasElement, props: Props) {
	const ctx = canvas.getContext("2d");
	if (!ctx) return;
	const dpr = window.devicePixelRatio || 1;
	const width = canvas.clientWidth;
	const height = canvas.clientHeight;
	if (canvas.width !== Math.round(width * dpr) || canvas.height !== Math.round(height * dpr)) {
		canvas.width = Math.round(width * dpr);
		canvas.height = Math.round(height * dpr);
	}
	ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
	ctx.clearRect(0, 0, width, height);

	const { phase, growthPerMs, crashPoint, cashout } = props;
	const shownMs =
		phase === "crashed" && crashPoint
			? msToReach(crashPoint, growthPerMs)
			: phase === "running"
				? Math.max(0, props.elapsedMs)
				: 0;
	const shownM =
		phase === "crashed" && crashPoint ? crashPoint : exactMultiplierAt(shownMs, growthPerMs);

	const pad = { left: 46, right: 14, top: 14, bottom: 26 };
	const plotW = width - pad.left - pad.right;
	const plotH = height - pad.top - pad.bottom;
	const xMax = Math.max(8000, shownMs * 1.12);
	const yMax = Math.max(2, 1 + (shownM - 1) * 1.15);
	const toX = (ms: number) => pad.left + (ms / xMax) * plotW;
	const toY = (m: number) => pad.top + plotH - ((m - 1) / (yMax - 1)) * plotH;

	const font = getComputedStyle(document.body).fontFamily || "sans-serif";
	ctx.font = `11px ${font}`;
	ctx.fillStyle = CRASH_COLORS.muted;
	ctx.strokeStyle = CRASH_COLORS.border;
	ctx.lineWidth = 1;

	// Y axis: multipliers.
	const yStep = pickStep(yMax - 1, Y_STEPS, 5);
	ctx.textAlign = "right";
	ctx.textBaseline = "middle";
	for (let v = 1; v <= yMax + 1e-9; v += yStep) {
		const y = toY(v);
		ctx.setLineDash([3, 5]);
		ctx.beginPath();
		ctx.moveTo(pad.left, y);
		ctx.lineTo(width - pad.right, y);
		ctx.stroke();
		ctx.setLineDash([]);
		ctx.fillText(`${toPersianDigits(v.toFixed(yStep < 1 ? 1 : 0))}×`, pad.left - 8, y);
	}

	// X axis: seconds.
	const xStep = pickStep(xMax / 1000, X_STEPS, 5);
	ctx.textAlign = "center";
	ctx.textBaseline = "top";
	for (let s = xStep; s * 1000 <= xMax; s += xStep) {
		ctx.fillText(`${toPersianDigits(s)}ث`, toX(s * 1000), height - pad.bottom + 8);
	}

	if (phase !== "running" && phase !== "crashed") return;

	const color = phase === "crashed" ? CRASH_COLORS.red : CRASH_COLORS.curve;
	const samples = 80;
	const points: [number, number][] = [];
	for (let i = 0; i <= samples; i += 1) {
		const ms = (shownMs * i) / samples;
		points.push([toX(ms), toY(exactMultiplierAt(ms, growthPerMs))]);
	}

	// Area under the curve.
	const gradient = ctx.createLinearGradient(0, pad.top, 0, pad.top + plotH);
	gradient.addColorStop(0, phase === "crashed" ? "rgba(237,65,99,0.35)" : "rgba(245,179,1,0.35)");
	gradient.addColorStop(1, "rgba(15,33,46,0)");
	ctx.beginPath();
	ctx.moveTo(points[0][0], toY(1));
	points.forEach(([x, y]) => ctx.lineTo(x, y));
	ctx.lineTo(points[points.length - 1][0], toY(1));
	ctx.closePath();
	ctx.fillStyle = gradient;
	ctx.fill();

	// The curve.
	ctx.beginPath();
	points.forEach(([x, y], i) => (i ? ctx.lineTo(x, y) : ctx.moveTo(x, y)));
	ctx.strokeStyle = color;
	ctx.lineWidth = 4;
	ctx.lineCap = "round";
	ctx.lineJoin = "round";
	ctx.stroke();

	// Head of the curve.
	const [hx, hy] = points[points.length - 1];
	ctx.beginPath();
	ctx.arc(hx, hy, 6, 0, Math.PI * 2);
	ctx.fillStyle = color;
	ctx.fill();

	// Where the player cashed out.
	if (cashout) {
		const ms = msToReach(cashout.multiplier, growthPerMs);
		if (ms <= shownMs + 1) {
			const x = toX(ms);
			const y = toY(cashout.multiplier);
			ctx.beginPath();
			ctx.arc(x, y, 7, 0, Math.PI * 2);
			ctx.fillStyle = CRASH_COLORS.green;
			ctx.fill();
			ctx.lineWidth = 3;
			ctx.strokeStyle = CRASH_COLORS.page;
			ctx.stroke();
			ctx.font = `bold 12px ${font}`;
			ctx.fillStyle = CRASH_COLORS.green;
			ctx.textAlign = "center";
			ctx.textBaseline = "bottom";
			ctx.fillText(`+${formatPoints(cashout.payout)}`, x, y - 10);
		}
	}
}

export default function CrashGraph(props: Props) {
	const canvasRef = useRef<HTMLCanvasElement>(null);
	const propsRef = useRef(props);
	propsRef.current = props;

	useEffect(() => {
		if (canvasRef.current) draw(canvasRef.current, props);
	});

	useEffect(() => {
		const canvas = canvasRef.current;
		if (!canvas || typeof ResizeObserver === "undefined") return undefined;
		const observer = new ResizeObserver(() => draw(canvas, propsRef.current));
		observer.observe(canvas);
		return () => observer.disconnect();
	}, []);

	const { phase, multiplier, crashPoint, elapsedMs, cashout } = props;

	let headline: React.ReactNode;
	if (phase === "crashed" && crashPoint) {
		headline = (
			<>
				<Typography sx={{ fontSize: 40, fontWeight: 800, color: CRASH_COLORS.red, lineHeight: 1.1 }}>
					{formatMultiplier(crashPoint)}
				</Typography>
				<Typography sx={{ color: CRASH_COLORS.red, fontWeight: 700 }}>منفجر شد!</Typography>
				{cashout && (
					<Typography sx={{ color: CRASH_COLORS.green, fontWeight: 700, fontSize: 14, mt: 0.5 }}>
						+{formatPoints(cashout.payout)} امتیاز با {formatMultiplier(cashout.multiplier)}
					</Typography>
				)}
			</>
		);
	} else if (phase === "running") {
		headline = (
			<Typography sx={{ fontSize: 44, fontWeight: 800, color: CRASH_COLORS.text, lineHeight: 1.1 }}>
				{formatMultiplier(multiplier)}
			</Typography>
		);
	} else if (phase === "starting") {
		headline = (
			<Typography sx={{ fontSize: 20, fontWeight: 700, color: CRASH_COLORS.muted }}>
				شروع در {toPersianDigits(Math.max(0, -elapsedMs / 1000).toFixed(1))} ثانیه
			</Typography>
		);
	} else {
		headline = (
			<Typography sx={{ fontSize: 15, fontWeight: 600, color: CRASH_COLORS.muted, textAlign: "center", px: 3 }}>
				مبلغ شرط را بزن و قبل از انفجار برداشت کن
			</Typography>
		);
	}

	return (
		<Box
			sx={{
				position: "relative",
				// Shrinks on short phones so the bet button stays above the fold.
				height: "clamp(170px, 30vh, 280px)",
				bgcolor: CRASH_COLORS.page,
				borderRadius: 2,
				overflow: "hidden",
				direction: "ltr",
			}}
		>
			<canvas
				ref={canvasRef}
				style={{ width: "100%", height: "100%", display: "block" }}
				aria-hidden
			/>
			<Box
				sx={{
					position: "absolute",
					inset: 0,
					display: "flex",
					flexDirection: "column",
					alignItems: "center",
					justifyContent: "center",
					pointerEvents: "none",
					direction: "rtl",
				}}
			>
				<Box
					sx={{
						display: "flex",
						flexDirection: "column",
						alignItems: "center",
						px: 2,
						py: 0.5,
						borderRadius: 2,
						bgcolor: phase === "idle" ? "transparent" : "rgba(15,33,46,0.72)",
						"& p": { textShadow: "0 2px 8px rgba(0,0,0,0.6)" },
					}}
				>
					{headline}
				</Box>
			</Box>
		</Box>
	);
}
