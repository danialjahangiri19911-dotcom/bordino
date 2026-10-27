"use client";

import { Suspense, useMemo, useRef, useState } from "react";

import Link from "next/link";
import { useSearchParams } from "next/navigation";

import { fa } from "../format";
import { landingRotation, prizeLabel, slicesFor } from "../wheelMath";
import { EmptyState, GameShell, LoadState, Notice, Panel, R, usePoints } from "../ui";

import { gameErrorMessage } from "@/api/games/request";
import useGetWheel from "@/api/lottery/hooks/useGetWheel";
import useSpinWheel from "@/api/lottery/hooks/useSpinWheel";

// The wheel made by `manage.py seed_wheel`; another one can be opened with ?wheel=<id>.
const DEFAULT_WHEEL_ID = "11111111-1111-1111-1111-111111111111";
const MULTIPLIERS = [1, 2, 3, 4, 5];
const SPIN_MS = 4200;

function WheelGame() {
	const wheelId = useSearchParams().get("wheel") ?? DEFAULT_WHEEL_ID;
	const wheelQuery = useGetWheel({ id: wheelId });
	const wheel = wheelQuery.data?.result;
	const points = usePoints();
	const { spinAsync } = useSpinWheel();
	const [multiplier, setMultiplier] = useState(1);
	const [rotation, setRotation] = useState(0);
	const [spinning, setSpinning] = useState(false);
	const [result, setResult] = useState<{ text: string; won: boolean } | null>(null);
	const [error, setError] = useState<string | null>(null);
	const busy = useRef(false);

	const prizes = useMemo(() => wheel?.lottery_wheel_prizes ?? [], [wheel?.lottery_wheel_prizes]);
	const slices = useMemo(() => slicesFor(prizes, multiplier), [prizes, multiplier]);
	const cost = Number(wheel?.cost_per_spin ?? 0);
	const balance = points.points ?? 0;
	const enough = points.points !== null && balance >= cost;
	const reduced = typeof window !== "undefined" && window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;

	const gradient = slices
		.map((s, i) => `${i % 2 ? "var(--bd-tint)" : "var(--bd-accent)"} ${s.start}deg ${s.end}deg`)
		.join(",");

	const spin = async () => {
		if (busy.current || !points.account || !enough) return;
		busy.current = true;
		setSpinning(true);
		setResult(null);
		setError(null);
		try {
			const answer = await spinAsync({ lottery_wheel: wheelId, token_wallet_account: points.account.id, multiplier });
			const won = answer.result?.prize;
			const slice = slices.find((s) => s.prize.id === won?.id);
			const text = !won
				? "نتیجه دریافت نشد؛ کیف‌پول را ببین."
				: won.prize_type === "empty"
					? "این بار پوچ بود."
					: `بردی: ${prizeLabel(Number(won.prize_amount || 0), won.prize_type)}`;
			if (slice) {
				// Land on the slice the server chose (anywhere inside it, not on its edge).
				const span = slice.end - slice.start;
				const target = slice.start + span / 2 + (Math.random() - 0.5) * span * 0.6;
				setRotation((r) => landingRotation(r, target));
				await new Promise((done) => setTimeout(done, reduced ? 0 : SPIN_MS));
			} else {
				void wheelQuery.refetch();
			}
			setResult({ text, won: !!won && won.prize_type !== "empty" });
		} catch (e) {
			setError(gameErrorMessage(e));
		} finally {
			void points.refetch();
			busy.current = false;
			setSpinning(false);
		}
	};

	if (!prizes.length) {
		return wheelQuery.isLoading || wheelQuery.error ? (
			<LoadState loading={wheelQuery.isLoading} error={wheelQuery.error} onRetry={wheelQuery.refetch} errorText="گردونه بارگذاری نشد." />
		) : (
			<EmptyState
				title="گردونهٔ فعالی در حال حاضر نیست"
				text="به‌زودی دوباره سر بزن."
				action={
					<Link className="bd-secondary" href={R.home}>
						خانه
					</Link>
				}
			/>
		);
	}

	return (
		<div className="rt-game-layout">
			<div className="rt-wheel-stage">
				<span className="rt-wheel-pointer" />
				<div
					className="bd-wheel rt-large-wheel bd-spin-wheel"
					role="img"
					aria-label={`گردونه با ${fa(slices.length)} خانه: ${slices.map((s) => s.label).join("، ")}`}
					style={{
						background: `conic-gradient(${gradient})`,
						transform: `rotate(${rotation}deg)`,
						transition: spinning && !reduced ? `transform ${SPIN_MS}ms cubic-bezier(.12,.75,.12,1)` : "none",
					}}
				>
					{slices.map((s, i) => (
						<span
							key={s.prize.id}
							className={`bd-slice-label ${i % 2 ? "" : "is-on-accent"}`}
							style={{ transform: `rotate(${(s.start + s.end) / 2}deg)` }}
							aria-hidden="true"
						>
							{s.end - s.start >= 14 ? <b>{s.short}</b> : null}
						</span>
					))}
				</div>
				<p aria-live="polite" className="bd-wheel-result">
					{result ? <span className={result.won ? "bd-amount is-plus" : ""}>{result.text}</span> : <small className="bd-muted">نتیجه را سرور انتخاب می‌کند.</small>}
				</p>
			</div>
			<Panel title={wheel?.name || "گردونهٔ بوردینو"}>
				<p>
					موجودی تو: <b>{points.points === null ? "…" : `${fa(balance)} امتیاز`}</b>
				</p>
				<p>
					امتیاز موردنیاز برای یک چرخش: <b>{fa(cost)}</b>
				</p>
				<div className="ng-chips" role="radiogroup" aria-label="ضریب جایزه">
					{MULTIPLIERS.map((m) => (
						<button
							key={m}
							type="button"
							className="ng-chip"
							role="radio"
							aria-checked={multiplier === m}
							aria-pressed={multiplier === m}
							disabled={spinning}
							onClick={() => {
								setMultiplier(m);
								setResult(null);
							}}
						>
							<bdi dir="ltr">{m}×</bdi>
						</button>
					))}
				</div>
				<small className="bd-muted">
					با ضریب بالاتر جایزه بزرگ‌تر و احتمالش کمتر می‌شود؛ هزینهٔ چرخش ثابت است. عدد هر خانه امتیاز جایزه است و «ت» یعنی جایزهٔ نقدی به تومان.
				</small>
				<div className="bd-actions">
					<button type="button" className="bd-action" disabled={!enough || spinning} onClick={spin}>
						{spinning ? "در حال چرخش…" : `بگردون · ${fa(cost)} امتیاز`}
					</button>
				</div>
				{points.points !== null && !enough ? <Notice>برای چرخاندن گردونه امتیاز کافی نداری.</Notice> : null}
				{error ? <Notice>{error}</Notice> : null}
			</Panel>
		</div>
	);
}

export default function Wheel() {
	return (
		<GameShell
			title="گردونه"
			icon="disc-3"
			help={
				<>
					<p>هر چرخش به اندازهٔ هزینهٔ گردونه امتیاز کم می‌کند. جایزه را سرور انتخاب می‌کند و گردونه روی همان خانه می‌ایستد.</p>
					<p>ضریب ×۲ تا ×۵ جایزه را چند برابر و احتمال بردن آن را به همان نسبت کمتر می‌کند. جایزهٔ امتیازی به کیف امتیاز و جایزهٔ نقدی به کیف نقدی می‌رود.</p>
				</>
			}
		>
			<Suspense>
				<WheelGame />
			</Suspense>
		</GameShell>
	);
}
