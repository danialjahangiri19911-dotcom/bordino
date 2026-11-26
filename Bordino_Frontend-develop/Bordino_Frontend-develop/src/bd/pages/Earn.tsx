"use client";

import { useEffect, useMemo, useRef, useState } from "react";

import Link from "next/link";

import { APK_URL } from "../BackButton";
import Icon from "../Icon";
import { usePlayableAdOffer } from "../ads/api";
import { inAndroidApp, useAdsPlugin } from "../ads/native";
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
/** In a browser: the chip that leaves out what only the Android app can play (product review 2026-11-26). */
const WEB_GROUP = "web";

/** Why a mission cannot be done here: «web» (a browser: the Android app plays it), «update» (an
 * app too old for it), or null. Rewarded videos (Adivery) and full-screen ads need the app's bridge. */
type Elsewhere = "web" | "update" | null;
function useElsewhere(): (m: Mission) => Elsewhere {
	const ads = usePlayableAdOffer();
	const plugin = useAdsPlugin();
	const inApp = inAndroidApp();
	return (m) => {
		if (m.kind === "video" && (ads.appOnly || ads.needsAppUpdate)) return ads.appOnly ? "web" : "update";
		if (m.kind === "interstitial" && typeof plugin?.showInterstitial !== "function") return inApp ? "update" : "web";
		return null;
	};
}
const ACTIONABLE: MissionState[] = ["available", "in_progress", "rejected"];

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
	["points", "بیشترین سکه"],
	["newest", "جدیدترین"],
	["ending", "زودتر تمام می‌شود"],
];

/** Each order's own direction first («بیشترین سکه» = most first); the arrow reverses it. */
function sorted(rows: Row[], sort: Sort, reverse = false) {
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
	return reverse ? list.reverse() : list;
}

/** «دریافت سکه»: the missions a player can do for points, by category, with their state. */
export default function Earn() {
	const { data, isLoading, error, refetch } = useMissions();
	const list = data?.result;
	const [group, setGroup] = useState("all");
	const [sort, setSort] = useState<Sort>("suggested");
	const [reverse, setReverse] = useState(false);
	// Tapped (not reached by keyboard): Chrome still calls a tapped select «focus-visible», so the
	// keyboard-only focus border is switched off until the keyboard is used again.
	const [tapped, setTapped] = useState(false);
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
	const elsewhere = useElsewhere();
	const awayHere = (r: Row) => (r.kind === "mission" ? elsewhere(r.m) : null);
	// Missions a player could do now but not in this browser/app (said on the card, and in a note).
	const awayCount = rows.filter((r) => ACTIONABLE.includes(r.state) && awayHere(r) === "web").length;
	const shown = sorted(
		rows.filter(
			(r) =>
				group === "all" ||
				(group === WEB_GROUP
					? !awayHere(r)
					: r.kind === "mystery"
						? group === MYSTERY_GROUP
						: r.m.category === group),
		),
		sort,
		reverse,
	);
	const open = list?.missions.find((m) => m.id === openId) ?? null;
	// «N قابل انجام»: what can be done here (a browser leaves out what only the app plays).
	const doable = rows.filter((r) => ACTIONABLE.includes(r.state) && !awayHere(r)).length;
	const groups: [string, string][] = [
		...(list?.categories ?? []).map((c): [string, string] => [c.id, c.name]),
		...(list?.mysteries?.length
			? ([[MYSTERY_GROUP, "معمای شهری"]] as [string, string][])
			: []),
	];

	return (
		<AppShell nav="earn" title="دریافت سکه" headingExtra={<Balance />}>
			<section className="ng-catalog">
				<div className="ng-filterbar">
					<h3>
						<Icon name="coins" /> مأموریت‌های سکه
						{/* Its room is kept while loading (invisible), so the heading never grows and moves the sort menu. */}
						<span
							className="bd-tag"
							aria-hidden={!list}
							style={list ? undefined : { visibility: "hidden" }}
						>
							{fa(doable)} قابل انجام
						</span>
					</h3>
					<div
						className="ng-sort"
						data-tapped={tapped ? "true" : undefined}
						onPointerDown={() => setTapped(true)}
						onKeyDown={(e) => {
							if (e.key === "Tab" || e.key.startsWith("Arrow")) setTapped(false);
						}}
						onBlur={(e) => {
							if (!e.currentTarget.contains(e.relatedTarget as Node | null)) setTapped(false);
						}}
					>
						<button
							type="button"
							className="ng-sort-dir"
							aria-pressed={reverse}
							aria-label={reverse ? "ترتیب برعکس (برگرداندن)" : "برعکس کردن ترتیب"}
							title={reverse ? "ترتیب برعکس" : "برعکس کردن ترتیب"}
							data-reverse={reverse ? "true" : undefined}
							onClick={() => setReverse((r) => !r)}
						>
							<Icon name="arrow-down-wide-narrow" />
						</button>
						<select
							aria-label="مرتب‌سازی"
							value={sort}
							onChange={(e) => {
								setSort(e.target.value as Sort);
								setReverse(false);
							}}
						>
							{SORTS.map(([key, text]) => (
								<option key={key} value={key}>
									{text}
								</option>
							))}
						</select>
					</div>
				</div>
				{list && (groups.length > 1 || awayCount > 0) ? (
					<Chips
						label="دسته‌بندی مأموریت‌ها"
						value={group}
						onChange={setGroup}
						options={[["all", "همه"], ...(awayCount ? ([[WEB_GROUP, "قابل انجام در مرورگر"]] as [string, string][]) : []), ...groups]}
					/>
				) : null}
				{awayCount ? (
					<div className="mi-web-note" role="note">
						<Icon name="smartphone" />
						<div>
							<b>
								{fa(awayCount)} مأموریت فقط در اپ اندروید بردینو انجام می‌شود (ویدیوها و تبلیغ‌های تمام‌صفحه).
							</b>
							<small>بقیهٔ مأموریت‌ها همین‌جا در مرورگر انجام می‌شوند.</small>
							<div className="bd-actions">
								{group !== WEB_GROUP ? (
									<button type="button" className="bd-secondary" onClick={() => setGroup(WEB_GROUP)}>
										نمایش مأموریت‌های قابل انجام در مرورگر
									</button>
								) : null}
								<a className="bd-text-btn" href={APK_URL}>
									<Icon name="download" /> دریافت اپ اندروید
								</a>
							</div>
						</div>
					</div>
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
											<small>سکه</small>
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
											{ACTIONABLE.includes(row.m.state) && awayHere(row) ? (
												<span className="bd-tag mi-away">
													<Icon name="smartphone" /> {awayHere(row) === "web" ? "فقط در اپ اندروید" : "نیاز به نسخهٔ تازهٔ اپ"}
												</span>
											) : null}
										</span>
										<span className="mi-points">
											<bdi dir="ltr">+{fa(row.m.points)}</bdi>
											<small>سکه</small>
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
					<b>سکهٔ هر مأموریت بعد از انجام یا تأیید به کیف می‌رود.</b>
					<small>
						مأموریت‌های ثبت‌نام و نصب اپ بعد از بررسی تأیید می‌شوند؛ وضعیت هر
						مأموریت روی همان ردیف دیده می‌شود.
					</small>
				</div>
			</div>
		</AppShell>
	);
}
