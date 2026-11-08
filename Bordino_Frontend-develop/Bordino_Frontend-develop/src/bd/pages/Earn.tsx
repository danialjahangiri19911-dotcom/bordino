"use client";

import { useEffect, useMemo, useRef, useState } from "react";

import Link from "next/link";

import Icon from "../Icon";
import { fa } from "../format";
import MissionSheet from "../missions/MissionSheet";
import { type Mission, type MissionState, useMissions } from "../missions/api";
import { KIND_ICON, STATE_LABEL, progressText } from "../missions/labels";
import type { MysteryCard, MysteryState } from "../missions/mystery";
import { AppShell, Balance, Chips, EmptyState, LoadState, R } from "../ui";
import { useQueryClient } from "@tanstack/react-query";

const MYSTERY_LABEL: Record<MysteryState, string> = {
	available: "شروع کن",
	in_progress: "در حال حل",
	done: "حل شد",
	upcoming: "به‌زودی",
	expired: "پایان‌یافته",
	full: "ظرفیت تکمیل",
	inactive: "غیرفعال",
	empty: "به‌زودی",
};
/** A mystery's state in the missions' terms (its tag colour and its place in «پیشنهادی»). */
const MYSTERY_AS: Record<MysteryState, MissionState> = {
	available: "available",
	in_progress: "in_progress",
	done: "done",
	upcoming: "upcoming",
	expired: "expired",
	full: "full",
	inactive: "inactive",
	empty: "inactive",
};
/** The «معمای شهری» chip (beside the server's mission categories). */
const MYSTERY_GROUP = "mystery";

/** One row of the list: a mission (opens its sheet) or a «معمای شهری» (opens its page). */
type Row =
	| {
			kind: "mission";
			id: string;
			state: MissionState;
			order: number;
			points: number;
			created: string | null;
			ends: string | null;
			m: Mission;
	  }
	| {
			kind: "mystery";
			id: string;
			state: MissionState;
			order: number;
			points: number;
			created: string | null;
			ends: string | null;
			m: MysteryCard;
	  };

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

function sorted(rows: Row[], sort: Sort) {
	const list = [...rows];
	const time = (s: string | null, none: number) =>
		s ? new Date(s).getTime() : none;
	if (sort === "points") list.sort((a, b) => b.points - a.points);
	else if (sort === "newest")
		list.sort(
			(a, b) => time(b.created, -Infinity) - time(a.created, -Infinity),
		);
	else if (sort === "ending")
		list.sort((a, b) => time(a.ends, Infinity) - time(b.ends, Infinity));
	else
		list.sort(
			(a, b) =>
				STATE_RANK[a.state] - STATE_RANK[b.state] ||
				a.order - b.order ||
				b.points - a.points,
		);
	return list;
}

/** «دریافت امتیاز»: the missions a player can do for points, by category, with their state. */
export default function Earn() {
	const { data, isLoading, error, refetch } = useMissions();
	const list = data?.result;
	const [group, setGroup] = useState("all");
	const [sort, setSort] = useState<Sort>("suggested");
	const [openId, setOpenId] = useState<string | null>(null);
	const queryClient = useQueryClient();
	const paid = useRef<Map<string, number> | null>(null);

	// A review approved or a partner's confirmation while the page is open (a mission with more
	// tries paid than before): the balances too.
	useEffect(() => {
		if (!list) return;
		const now = new Map(list.missions.map((m) => [m.id, m.completed]));
		const before = paid.current;
		if (before && [...now].some(([id, n]) => n > (before.get(id) ?? n))) {
			void queryClient.invalidateQueries({
				predicate: (q) => !String(q.queryKey[0]).startsWith("missions"),
			});
		}
		paid.current = now;
	}, [list, queryClient]);

	const rows = useMemo<Row[]>(
		() => [
			...(list?.missions ?? []).map(
				(m): Row => ({
					kind: "mission",
					id: m.id,
					state: m.state,
					order: m.order,
					points: m.points,
					created: m.create_time,
					ends: m.ends_at,
					m,
				}),
			),
			...(list?.mysteries ?? []).map(
				(m): Row => ({
					kind: "mystery",
					id: m.id,
					state: MYSTERY_AS[m.state],
					order: m.order,
					points: m.points,
					created: m.starts_at,
					ends: m.ends_at,
					m,
				}),
			),
		],
		[list],
	);
	const shown = useMemo(
		() =>
			sorted(
				rows.filter(
					(r) =>
						group === "all" ||
						(r.kind === "mystery"
							? group === MYSTERY_GROUP
							: r.m.category === group),
				),
				sort,
			),
		[rows, group, sort],
	);
	const open = list?.missions.find((m) => m.id === openId) ?? null;
	const doable = rows.filter(
		(r) =>
			r.state === "available" ||
			r.state === "in_progress" ||
			r.state === "rejected",
	).length;
	const groups: [string, string][] = [
		...(list?.categories ?? []).map((c): [string, string] => [c.id, c.name]),
		...(list?.mysteries?.length
			? ([[MYSTERY_GROUP, "معمای شهری"]] as [string, string][])
			: []),
	];

	return (
		<AppShell nav="earn" title="دریافت امتیاز" headingExtra={<Balance />}>
			<section className="ng-catalog">
				<div className="ng-filterbar">
					<h3>
						<Icon name="coins" /> مأموریت‌های امتیاز
						{/* Its room is kept while loading (invisible), so the heading never grows and moves the sort menu. */}
						<span
							className="bd-tag"
							aria-hidden={!list}
							style={list ? undefined : { visibility: "hidden" }}
						>
							{fa(doable)} قابل انجام
						</span>
					</h3>
					<label className="ng-sort">
						<Icon name="arrow-down-wide-narrow" />
						<select
							aria-label="مرتب‌سازی"
							value={sort}
							onChange={(e) => setSort(e.target.value as Sort)}
						>
							{SORTS.map(([key, text]) => (
								<option key={key} value={key}>
									{text}
								</option>
							))}
						</select>
					</label>
				</div>
				{list && groups.length > 1 ? (
					<Chips
						label="دسته‌بندی مأموریت‌ها"
						value={group}
						onChange={setGroup}
						options={[["all", "همه"], ...groups]}
					/>
				) : null}
				{/* While loading, about a list's height: the note below does not jump down when the list arrives. */}
				<div className={isLoading ? "mi-loading" : undefined}>
					<LoadState loading={isLoading} error={error} onRetry={refetch} />
				</div>
				{list && !shown.length ? (
					<EmptyState
						title="فعلاً مأموریتی نیست"
						text="مأموریت‌های تازه همین‌جا اضافه می‌شوند؛ بعداً سر بزن."
					/>
				) : null}
				{shown.length ? (
					<div className="bd-panel bd-missions mi-list">
						<div className="bd-mission-list">
							{shown.map((row) =>
								row.kind === "mystery" ? (
									<Link
										key={`my-${row.id}`}
										href={R.mystery(row.id)}
										className="bd-mission mi-row"
										data-state={row.state}
									>
										<span
											className={`bd-mission-icon ${row.m.cover ? "bd-mission-logo mi-cover" : ""}`}
										>
											{row.m.cover ? (
												<img src={row.m.cover} alt="" width={36} height={36} />
											) : (
												<Icon name="map-pin" />
											)}
										</span>
										<span className="bd-mission-copy">
											<b>{row.m.title}</b>
											<small>
												معمای شهری ·{" "}
												{row.m.state === "in_progress" || row.m.state === "done"
													? `${fa(row.m.done)} از ${fa(row.m.steps)} مرحله`
													: `${fa(row.m.steps)} مرحله`}
												{row.m.area ? ` · ${row.m.area}` : ""}
											</small>
											<span className={`bd-tag mi-state mi-${row.state}`}>
												{MYSTERY_LABEL[row.m.state]}
											</span>
										</span>
										<span className="mi-points">
											<bdi dir="ltr">+{fa(row.points)}</bdi>
											<small>امتیاز</small>
										</span>
									</Link>
								) : (
									<button
										key={row.id}
										type="button"
										className="bd-mission mi-row"
										data-state={row.state}
										onClick={() => setOpenId(row.id)}
									>
										<span
											className={`bd-mission-icon ${row.m.image ? "bd-mission-logo" : ""}`}
										>
											{row.m.image ? (
												<img src={row.m.image} alt="" width={36} height={36} />
											) : (
												<Icon name={KIND_ICON[row.m.kind]} />
											)}
										</span>
										<span className="bd-mission-copy">
											<b>{row.m.title}</b>
											<small>{progressText(row.m) ?? row.m.summary}</small>
											<span className={`bd-tag mi-state mi-${row.m.state}`}>
												{STATE_LABEL[row.m.state]}
											</span>
										</span>
										<span className="mi-points">
											<bdi dir="ltr">+{fa(row.m.points)}</bdi>
											<small>امتیاز</small>
										</span>
									</button>
								),
							)}
						</div>
					</div>
				) : null}
			</section>
			{open ? (
				<MissionSheet
					mission={open}
					onClose={() => setOpenId(null)}
					onChanged={() => void refetch()}
				/>
			) : null}
			<div className="ng-status">
				<Icon name="info" />
				<div>
					<b>امتیاز هر مأموریت بعد از انجام یا تأیید به کیف امتیاز می‌رود.</b>
					<small>
						مأموریت‌های ثبت‌نام و نصب اپ بعد از بررسی تأیید می‌شوند؛ وضعیت هر
						مأموریت روی همان ردیف دیده می‌شود.
					</small>
				</div>
			</div>
		</AppShell>
	);
}
