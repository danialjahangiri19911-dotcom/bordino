"use client";

import Icon from "./Icon";
import { fa } from "./format";

/** One leaderboard row as the server sends it (no ids; a masked name unless the player chose). */
export interface LeaderRow {
	position: number;
	name: string;
	avatar: string | null;
	is_me: boolean;
	stages: number;
	total: number;
	percent: number;
	score: number;
	seconds: number | null;
	completed: boolean;
}

export type LeaderShow = Partial<Record<"rank" | "name" | "avatar" | "stages" | "percent" | "bar" | "score" | "time" | "participants" | "finishers", boolean>>;

/** 754 s → «۱۲ دقیقه و ۳۴ ثانیه»; an hour or more → «۱ ساعت و ۵ دقیقه». */
export function durationText(seconds: number | null): string {
	if (seconds == null) return "—";
	const h = Math.floor(seconds / 3600);
	const m = Math.floor((seconds % 3600) / 60);
	const s = seconds % 60;
	if (h) return `${fa(h)} ساعت${m ? ` و ${fa(m)} دقیقه` : ""}`;
	if (m) return `${fa(m)} دقیقه${s ? ` و ${fa(s)} ثانیه` : ""}`;
	return `${fa(s)} ثانیه`;
}

function Medal({ n }: { n: number }) {
	return <span className={`lb-rank${n <= 3 ? ` lb-top lb-top-${n}` : ""}`}>{fa(n)}</span>;
}

/** The rows of a leaderboard (shared by the player's board and the creator's sample preview). */
export function LeaderList({
	rows,
	show,
	highlightMe = true,
	sample = false,
}: {
	rows: LeaderRow[];
	show: LeaderShow;
	highlightMe?: boolean;
	sample?: boolean;
}) {
	return (
		<ol className="lb-list" aria-label={sample ? "نمونهٔ جدول (بازیکن واقعی نیست)" : "جدول رده‌بندی"}>
			{rows.map((r) => (
				<li key={`${r.position}-${r.name}`} className="lb-row" data-me={highlightMe && r.is_me ? "true" : undefined}>
					{show.rank !== false ? <Medal n={r.position} /> : null}
					{show.avatar ? (
						<span className="lb-avatar" aria-hidden="true">
							{r.avatar ? <img src={r.avatar} alt="" /> : <Icon name="user-round" />}
						</span>
					) : null}
					<span className="lb-who">
						<b>
							{r.name}
							{r.is_me ? <small> (تو)</small> : null}
						</b>
						{show.stages || show.percent ? (
							<small>
								{show.stages ? `${fa(r.stages)} از ${fa(r.total)} مرحله` : ""}
								{show.stages && show.percent ? " · " : ""}
								{show.percent ? `${fa(r.percent)}٪` : ""}
								{r.completed ? " · تمام کرد" : ""}
							</small>
						) : null}
						{show.bar ? (
							<span className="lb-bar" role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={r.percent}>
								<span style={{ width: `${Math.max(0, Math.min(100, r.percent))}%` }} />
							</span>
						) : null}
					</span>
					<span className="lb-metric">
						{show.score ? (
							<span>
								<b>{fa(r.score)}</b> <small>امتیاز</small>
							</span>
						) : null}
						{show.time ? (
							<span>
								<b>{durationText(r.seconds)}</b>
							</span>
						) : null}
					</span>
				</li>
			))}
		</ol>
	);
}
