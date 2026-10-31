"use client";

import { useMemo, useState } from "react";

import Icon from "../Icon";
import { fa } from "../format";
import MissionSheet from "../missions/MissionSheet";
import { type Mission, type MissionState, useMissions } from "../missions/api";
import { KIND_ICON, STATE_LABEL, progressText } from "../missions/labels";
import { AppShell, Balance, Chips, EmptyState, LoadState } from "../ui";

// «پیشنهادی»: what can be done now first, then what is under way, then the rest.
const STATE_RANK: Record<MissionState, number> = {
	in_progress: 0,
	rejected: 0,
	available: 1,
	waiting: 2,
	pending: 2,
	upcoming: 3,
	done_today: 4,
	done: 5,
	full: 6,
	inactive: 6,
	expired: 7,
};

type Sort = "suggested" | "points" | "newest" | "ending";
const SORTS: [Sort, string][] = [
	["suggested", "پیشنهادی"],
	["points", "بیشترین امتیاز"],
	["newest", "جدیدترین"],
	["ending", "زودتر تمام می‌شود"],
];

function sorted(missions: Mission[], sort: Sort) {
	const list = [...missions];
	const time = (s: string | null) => (s ? new Date(s).getTime() : Infinity);
	if (sort === "points") list.sort((a, b) => b.points - a.points);
	else if (sort === "newest") list.sort((a, b) => time(b.create_time) - time(a.create_time));
	else if (sort === "ending") list.sort((a, b) => time(a.ends_at) - time(b.ends_at));
	else list.sort((a, b) => STATE_RANK[a.state] - STATE_RANK[b.state] || a.order - b.order || b.points - a.points);
	return list;
}

/** «دریافت امتیاز»: the missions a player can do for points, by category, with their state. */
export default function Earn() {
	const { data, isLoading, error, refetch } = useMissions();
	const list = data?.result;
	const [group, setGroup] = useState("all");
	const [sort, setSort] = useState<Sort>("suggested");
	const [openId, setOpenId] = useState<string | null>(null);

	const shown = useMemo(
		() => sorted((list?.missions ?? []).filter((m) => group === "all" || m.category === group), sort),
		[list, group, sort],
	);
	const open = list?.missions.find((m) => m.id === openId) ?? null;
	const doable = list?.missions.filter((m) => m.state === "available" || m.state === "in_progress" || m.state === "rejected").length ?? 0;

	return (
		<AppShell nav="earn" title="دریافت امتیاز" headingExtra={<Balance />}>
			<section className="ng-catalog">
				<div className="ng-filterbar">
					<h3>
						<Icon name="coins" /> مأموریت‌های امتیاز
						{list ? <span className="bd-tag">{fa(doable)} قابل انجام</span> : null}
					</h3>
					<label className="ng-sort">
						<Icon name="arrow-down-wide-narrow" />
						<select aria-label="مرتب‌سازی" value={sort} onChange={(e) => setSort(e.target.value as Sort)}>
							{SORTS.map(([key, text]) => (
								<option key={key} value={key}>
									{text}
								</option>
							))}
						</select>
					</label>
				</div>
				{list && list.categories.length > 1 ? (
					<Chips
						label="دسته‌بندی مأموریت‌ها"
						value={group}
						onChange={setGroup}
						options={[["all", "همه"], ...list.categories.map((c): [string, string] => [c.id, c.name])]}
					/>
				) : null}
				<LoadState loading={isLoading} error={error} onRetry={refetch} />
				{list && !shown.length ? (
					<EmptyState title="فعلاً مأموریتی نیست" text="مأموریت‌های تازه همین‌جا اضافه می‌شوند؛ بعداً سر بزن." />
				) : null}
				{shown.length ? (
					<div className="bd-panel bd-missions mi-list">
						<div className="bd-mission-list">
							{shown.map((m) => (
								<button key={m.id} type="button" className="bd-mission mi-row" data-state={m.state} onClick={() => setOpenId(m.id)}>
									<span className={`bd-mission-icon ${m.image ? "bd-mission-logo" : ""}`}>
										{m.image ? <img src={m.image} alt="" width={36} height={36} /> : <Icon name={KIND_ICON[m.kind]} />}
									</span>
									<span className="bd-mission-copy">
										<b>{m.title}</b>
										<small>{progressText(m) ?? m.summary}</small>
										<span className={`bd-tag mi-state mi-${m.state}`}>{STATE_LABEL[m.state]}</span>
									</span>
									<span className="mi-points">
										<bdi dir="ltr">+{fa(m.points)}</bdi>
										<small>امتیاز</small>
									</span>
								</button>
							))}
						</div>
					</div>
				) : null}
			</section>
			{open ? <MissionSheet mission={open} onClose={() => setOpenId(null)} onChanged={() => void refetch()} /> : null}
			<div className="ng-status">
				<Icon name="info" />
				<div>
					<b>امتیاز هر مأموریت بعد از انجام یا تأیید به کیف امتیاز می‌رود.</b>
					<small>مأموریت‌های ثبت‌نام و نصب اپ بعد از بررسی تأیید می‌شوند؛ وضعیت هر مأموریت روی همان ردیف دیده می‌شود.</small>
				</div>
			</div>
		</AppShell>
	);
}
