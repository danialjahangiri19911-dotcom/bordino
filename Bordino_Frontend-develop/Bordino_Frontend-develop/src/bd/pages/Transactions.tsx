"use client";

import { useMemo, useState } from "react";

import { useSearchParams } from "next/navigation";

import { CASH_WALLET_VISIBLE } from "../features";
import { type Entry, HistoryFooter, HistoryRow, PartialHistoryNotice, useHistory, withSummary } from "../history";
import { AppShell, Chips, Panel, usePoints } from "../ui";
import { useCashAccount } from "./Wallet";

type Filter = "all" | "points" | "currency";

export default function Transactions() {
	const initial = useSearchParams().get("kind");
	const [chosen, setFilter] = useState<Filter>(initial === "currency" || initial === "points" ? initial : "all");
	// The cash wallet is hidden for now (features.ts): only the coins history.
	const filter: Filter = CASH_WALLET_VISIBLE ? chosen : "points";
	const points = usePoints();
	const cash = useCashAccount();
	const pointsHistory = useHistory("points", points.account?.id);
	const cashHistory = useHistory("currency", cash.account?.id);

	// «همه» interleaves the pages loaded so far of both accounts by date; «نمایش بیشتر» asks each
	// account that still has more for its next page.
	const rows: Entry[] = useMemo(() => {
		if (filter === "points") return pointsHistory.rows;
		if (filter === "currency") return cashHistory.rows;
		return [...pointsHistory.rows, ...cashHistory.rows].sort((a, b) => Date.parse(b.date) - Date.parse(a.date));
	}, [filter, pointsHistory.rows, cashHistory.rows]);

	const active = filter === "currency" ? cashHistory : pointsHistory;
	const bothLoading = filter === "all" && (pointsHistory.isLoading || cashHistory.isLoading);
	const bothFailed = filter === "all" && (pointsHistory.isError || cashHistory.isError);
	const anyMore = filter === "all" ? pointsHistory.hasNextPage || cashHistory.hasNextPage : active.hasNextPage;
	const fetchingMore = pointsHistory.isFetchingNextPage || cashHistory.isFetchingNextPage;

	return (
		<AppShell nav="wallet" title="تراکنش‌ها">
			<Panel title="تاریخچهٔ حساب">
				{CASH_WALLET_VISIBLE ? (
					<Chips
						label="نوع تراکنش"
						value={filter}
						onChange={setFilter}
						options={[
							["all", "همه"],
							["points", "سکه"],
							["currency", "نقدی"],
						]}
					/>
				) : null}
				{rows.length ? (
					<div className="bd-rows">
						{rows.map((entry) => (
							<HistoryRow key={`${entry.kind}-${entry.id}`} entry={entry} />
						))}
					</div>
				) : null}
				{filter === "all" && (rows.length || points.error || cash.error) ? (
					<PartialHistoryNotice
						parts={[
							{ label: "سکه", history: withSummary(pointsHistory, points) },
							{ label: "نقدی", history: withSummary(cashHistory, cash) },
						]}
					/>
				) : null}
				{filter === "all" ? (
					rows.length ? (
						anyMore ? (
							<button
								type="button"
								className="bd-secondary bd-more"
								disabled={fetchingMore}
								onClick={() => {
									if (pointsHistory.hasNextPage) pointsHistory.fetchNextPage();
									if (cashHistory.hasNextPage) cashHistory.fetchNextPage();
								}}
							>
								{fetchingMore ? "در حال بارگذاری…" : "نمایش بیشتر"}
							</button>
						) : null
					) : (
						<HistoryFooter
							history={bothFailed ? (pointsHistory.isError ? pointsHistory : cashHistory) : pointsHistory}
							empty={!bothLoading && !bothFailed && (!!points.account || !!cash.account || !points.isLoading)}
						/>
					)
				) : (
					<HistoryFooter history={active} empty={!rows.length && !!(filter === "points" ? points.account : cash.account)} />
				)}
			</Panel>
		</AppShell>
	);
}
