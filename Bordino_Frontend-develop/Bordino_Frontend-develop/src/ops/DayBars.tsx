"use client";

import { useId, useState } from "react";

import { fa } from "@/bd/format";

/**
 * One series per day as columns (30 days): one hue (the chart token, validated per theme), ≤24 px
 * columns with a 2 px gap, 4 px rounded tops on a square baseline, hairline grid, the latest value
 * labelled, a tooltip on hover / tap, and the numbers as a table for screen readers and on request.
 */
export default function DayBars({ title, days, values, unit }: { title: string; days: string[]; values: number[]; unit: string }) {
	const [active, setActive] = useState<number | null>(null);
	const tableId = useId();
	const W = 600;
	const H = 150;
	const top = 14;
	const n = values.length || 1;
	const band = W / n;
	const barW = Math.min(24, band - 2);
	const max = Math.max(1, ...values);
	// The axis top: the next round number (2, 4, 6, 8, 10 × a power of ten), so its half is whole too.
	const mag = 10 ** Math.floor(Math.log10(max));
	const ceil = ([2, 4, 6, 8, 10].map((k) => k * mag).find((v) => v >= max) ?? 10 * mag) || 2;
	const y = (v: number) => H - (v / ceil) * (H - top);
	const dayText = (iso: string) => new Intl.DateTimeFormat("fa-IR", { month: "short", day: "numeric" }).format(new Date(iso + "T12:00:00"));
	const last = values.length - 1;
	const total = values.reduce((a, b) => a + b, 0);
	const column = (i: number, v: number) => {
		const x = i * band + (band - barW) / 2;
		const h = H - y(v);
		if (h <= 0) return null;
		const r = Math.min(4, h, barW / 2);
		const yt = y(v);
		return `M${x},${H}V${yt + r}Q${x},${yt} ${x + r},${yt}H${x + barW - r}Q${x + barW},${yt} ${x + barW},${yt + r}V${H}Z`;
	};
	return (
		<figure className="ops-chart" aria-labelledby={`${tableId}-t`}>
			<figcaption id={`${tableId}-t`}>
				<b>{title}</b>
				<small className="bd-muted">
					۳۰ روز گذشته، جمع {fa(total)} {unit}، امروز {fa(values[last] ?? 0)}
				</small>
			</figcaption>
			<div className="ops-chart-plot" dir="ltr" onPointerLeave={() => setActive(null)}>
				<svg viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none" role="img" aria-label={`${title}: ${fa(total)} ${unit} در ۳۰ روز`}>
					{[0, 0.5, 1].map((f) => (
						<line key={f} x1={0} x2={W} y1={y(ceil * f)} y2={y(ceil * f)} className="ops-grid" vectorEffect="non-scaling-stroke" />
					))}
					{values.map((v, i) => {
						const d = column(i, v);
						return d ? <path key={days[i]} d={d} className="ops-bar" data-active={active === i ? "true" : undefined} /> : null;
					})}
					{values.map((_v, i) => (
						<rect
							key={`hit-${days[i]}`}
							x={i * band}
							y={0}
							width={band}
							height={H}
							fill="transparent"
							onPointerEnter={() => setActive(i)}
							onPointerDown={() => setActive(i)}
						/>
					))}
				</svg>
				<span className="ops-axis-y" aria-hidden="true">
					<span>{fa(ceil)}</span>
					<span>{fa(ceil / 2)}</span>
					<span>۰</span>
				</span>
				{active !== null ? (
					<span className="ops-tip" style={{ left: `${((active + 0.5) / n) * 100}%` }} role="status">
						<b>{fa(values[active])}</b> {unit}
						<small>{dayText(days[active])}</small>
					</span>
				) : (
					<span className="ops-last" style={{ left: `${((last + 0.5) / n) * 100}%`, bottom: `${((values[last] ?? 0) / ceil) * 100 * ((H - top) / H)}%` }} aria-hidden="true">
						{fa(values[last] ?? 0)}
					</span>
				)}
			</div>
			<div className="ops-axis-x" dir="ltr" aria-hidden="true">
				<span>{days[0] ? dayText(days[0]) : ""}</span>
				<span>{days[last] ? dayText(days[last]) : ""}</span>
			</div>
			<details className="ops-table">
				<summary>جدول اعداد</summary>
				<table>
					<thead>
						<tr>
							<th scope="col">روز</th>
							<th scope="col">{unit}</th>
						</tr>
					</thead>
					<tbody>
						{days.map((d, i) => (
							<tr key={d}>
								<td>{dayText(d)}</td>
								<td>{fa(values[i])}</td>
							</tr>
						))}
					</tbody>
				</table>
			</details>
		</figure>
	);
}
