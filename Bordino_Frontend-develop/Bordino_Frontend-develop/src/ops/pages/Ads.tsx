"use client";

import { useState } from "react";

import { fa } from "@/bd/format";
import { Chips, LoadState, Panel } from "@/bd/ui";

import DayBars from "../DayBars";
import OpsShell from "../Shell";
import { useOps } from "../client";
import { Tile } from "./Home";

interface Day {
	day: string;
	started: number;
	missions: number;
	confirmed: number;
	paid: number;
	paid_unconfirmed: number;
	coins: number;
	players: number;
	callbacks: number;
	matched: number;
	refused: number;
}

type Total = Omit<Day, "day">;

const dayText = (iso: string) => new Intl.DateTimeFormat("fa-IR", { weekday: "short", month: "short", day: "numeric" }).format(new Date(iso + "T12:00:00"));
const share = (part: number, whole: number) => (whole ? `${fa(Math.round((part / whole) * 100))}٪` : "—");

/**
 * «ویدیوهای جایزه‌دار»: per Tehran day, the Adivery videos started, those Adivery confirmed (what it
 * pays for), and what the players were paid — to match with Adivery's own revenue report.
 */
export function AdsPage() {
	const [days, setDays] = useState<"7" | "14" | "30">("14");
	const q = useOps<{ report: { days: Day[]; total: Total } }>(`ads/daily/?days=${days}`, 60_000);
	const r = q.data?.report;
	const t = r?.total;
	return (
		<OpsShell nav="ads" title="ویدیوهای جایزه‌دار" need={["finance", "settings"]}>
			<p className="bd-muted">
				«تأیید ادیوری» همان ویدیوهایی است که ادیوری بابتشان پول می‌دهد؛ این عدد را با گزارش درآمد پنل ادیوری مقایسه کن. هر ویدیو در روز شروعش (به وقت تهران)
				شمرده می‌شود.
			</p>
			<Chips
				label="بازه"
				value={days}
				onChange={setDays}
				options={[
					["7", "۷ روز"],
					["14", "۱۴ روز"],
					["30", "۳۰ روز"],
				]}
			/>
			<LoadState loading={q.isLoading} error={q.error} onRetry={q.refetch} />
			{r && t ? (
				<>
					<Panel title={`جمع ${fa(Number(days))} روز`}>
						<div className="gm-stats">
							<Tile label="ویدیوی شروع‌شده" value={t.started} icon="play" hint={`مأموریت: ${fa(t.missions)} · بازیکن: ${fa(t.players)}`} />
							<Tile label="تأیید ادیوری" value={t.confirmed} icon="badge-check" hint={`${share(t.confirmed, t.started)} از شروع‌شده‌ها`} />
							<Tile label="پرداخت به بازیکنان" value={t.paid} icon="coins" hint={`${fa(t.coins)} سکه`} />
							<Tile label="پرداخت بدون تأیید ادیوری" value={t.paid_unconfirmed} icon="triangle-alert" hint="با «پذیرفتن «دیدم» از خود اپ»" />
							<Tile label="خبرهای ادیوری" value={t.callbacks} icon="zap" hint={`ردشده: ${fa(t.refused)}`} />
						</div>
						<div className="ops-charts">
							<DayBars title="تأیید ادیوری در روز" days={r.days.map((d) => d.day)} values={r.days.map((d) => d.confirmed)} unit="ویدیو" />
							<DayBars title="سکهٔ پرداختی در روز" days={r.days.map((d) => d.day)} values={r.days.map((d) => d.coins)} unit="سکه" />
						</div>
					</Panel>
					<Panel title="روزبه‌روز">
						<div className="ops-wide">
							<table>
								<thead>
									<tr>
										<th scope="col">روز</th>
										<th scope="col">شروع</th>
										<th scope="col">تأیید ادیوری</th>
										<th scope="col">پرداخت</th>
										<th scope="col">سکه</th>
										<th scope="col">بی‌تأیید</th>
										<th scope="col">خبر (رد)</th>
										<th scope="col">بازیکن</th>
									</tr>
								</thead>
								<tbody>
									{[...r.days].reverse().map((d) => (
										<tr key={d.day}>
											<th scope="row">{dayText(d.day)}</th>
											<td>{fa(d.started)}</td>
											<td>
												{fa(d.confirmed)} <small className="bd-muted">{share(d.confirmed, d.started)}</small>
											</td>
											<td>{fa(d.paid)}</td>
											<td>{fa(d.coins)}</td>
											<td>{fa(d.paid_unconfirmed)}</td>
											<td>
												{fa(d.callbacks)} {d.refused ? <small className="bd-muted">({fa(d.refused)})</small> : null}
											</td>
											<td>{fa(d.players)}</td>
										</tr>
									))}
								</tbody>
							</table>
						</div>
					</Panel>
				</>
			) : null}
		</OpsShell>
	);
}
