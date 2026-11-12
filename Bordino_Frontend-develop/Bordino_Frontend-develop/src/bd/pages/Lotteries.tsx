"use client";

import { PRIZE_UNIT } from "../features";
import { useState } from "react";

import Link from "next/link";

import Icon from "../Icon";
import { fa, faDate } from "../format";
import { AppShell, Chips, EmptyState, LoadState, Panel, R } from "../ui";

import useGetLotteryList from "@/api/lottery/hooks/useGetLotteryList";
import usePastLotteries from "@/api/lottery/hooks/usePastLotteries";
import type { Lottery } from "@/api/lottery/types/getLotteryListType";

export function lotteryStatus(lottery: Pick<Lottery, "status" | "end_date">): string {
	if (lottery.status === "completed") return "برگزار شده";
	if (lottery.status === "cancelled") return "لغو شده";
	if (lottery.status === "active") return new Date(lottery.end_date).getTime() > Date.now() ? "در حال فروش" : "در انتظار قرعه‌کشی";
	return "به‌زودی";
}

function LotteryRow({ lottery }: { lottery: Lottery }) {
	return (
		<Link href={R.lotteryDetail(lottery.id)} className="bd-row">
			<span className="bd-mission-icon" aria-hidden="true">
				<Icon name="ticket" />
			</span>
			<span>
				<b>{lottery.name}</b>
				<small>
					{lotteryStatus(lottery)} · جایزه {fa(lottery.balance_in_money)} {PRIZE_UNIT} · {faDate(lottery.end_date)}
				</small>
			</span>
			<span className="bd-text-btn">جزئیات →</span>
		</Link>
	);
}

export default function Lotteries() {
	const [tab, setTab] = useState<"active" | "ended">("active");
	const list = useGetLotteryList();
	const past = usePastLotteries();
	const current = (list.data?.result?.results ?? []).filter((l) => l.status !== "completed" && l.status !== "cancelled");
	const ended = (past.data?.pages ?? []).flatMap((page) => page?.results ?? []);

	return (
		<AppShell nav="wallet" title="قرعه‌کشی‌ها">
			<Panel title="دوره‌های قرعه‌کشی">
				<Chips
					label="وضعیت دوره"
					value={tab}
					onChange={setTab}
					options={[
						["active", "فعال"],
						["ended", "پایان‌یافته"],
					]}
				/>
				{tab === "active" ? (
					list.isLoading || list.error ? (
						<LoadState loading={list.isLoading} error={list.error} onRetry={list.refetch} />
					) : current.length ? (
						<div className="bd-rows">
							{current.map((lottery) => (
								<LotteryRow key={lottery.id} lottery={lottery} />
							))}
						</div>
					) : (
						<EmptyState
							title="قرعه‌کشی فعالی نیست"
							text="دورهٔ بعدی به‌زودی اعلام می‌شود."
							action={
								<Link className="bd-secondary" href={R.lotteryGuide}>
									راهنمای قرعه‌کشی
								</Link>
							}
						/>
					)
				) : past.isLoading || past.isError ? (
					<LoadState loading={past.isLoading} error={past.error} onRetry={() => past.refetch()} />
				) : ended.length ? (
					<>
						<div className="bd-rows">
							{ended.map((lottery) => (
								<LotteryRow key={lottery.id} lottery={lottery} />
							))}
						</div>
						{past.hasNextPage ? (
							<button type="button" className="bd-secondary bd-more" disabled={past.isFetchingNextPage} onClick={() => past.fetchNextPage()}>
								{past.isFetchingNextPage ? "در حال بارگذاری…" : "نمایش بیشتر"}
							</button>
						) : null}
					</>
				) : (
					<EmptyState title="هنوز دوره‌ای برگزار نشده" text="نتیجهٔ هر دوره پس از قرعه‌کشی اینجا دیده می‌شود." />
				)}
			</Panel>
		</AppShell>
	);
}
