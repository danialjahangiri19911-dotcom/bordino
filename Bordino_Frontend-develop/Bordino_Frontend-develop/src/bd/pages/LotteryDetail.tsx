"use client";

import Link from "next/link";
import { useParams } from "next/navigation";

import { fa } from "../format";
import useCountdown, { formatLeft } from "../useCountdown";
import { AppShell, Art, EmptyState, Facts, LoadState, Panel, R } from "../ui";
import { lotteryStatus } from "./Lotteries";

import useGetLotteryDetail from "@/api/lottery/hooks/useGetLotteryDetail";
import useGetLotteryFullDetail from "@/api/lottery/hooks/useGetLotteryFullDetail";
import useGetLotteryList from "@/api/lottery/hooks/useGetLotteryList";
import useGetLotteryTickets from "@/api/lottery/hooks/useGetLotteryTickets";
import { formatTehranDateTime } from "@/libs/utils/date";

export function Numbers({ numbers, hits = [] }: { numbers: number[]; hits?: number[] }) {
	return (
		<span className="bd-numbers" aria-label={`عددها: ${numbers.map((n) => fa(n)).join("، ")}`}>
			{[...numbers].sort((a, b) => a - b).map((n) => (
				<span key={n} className={hits.includes(n) ? "is-hit" : ""}>
					{fa(n)}
				</span>
			))}
		</span>
	);
}

function MyTickets({ id, winning }: { id: string; winning: number[] }) {
	const { data, isLoading, error, refetch } = useGetLotteryTickets({ id });
	if (isLoading || error) return <LoadState loading={isLoading} error={error} onRetry={refetch} />;
	const tickets = data?.result ?? [];
	if (!tickets.length) return <EmptyState art={null} title="برای این دوره بلیتی نداری" />;
	return (
		<div className="bd-rows">
			{tickets.map((ticket, index) => (
				<Link key={ticket.id} className="bd-row" href={`${R.ticketDetail(ticket.id)}?n=${index + 1}`}>
					<span className="bd-mission-icon">{fa(index + 1)}</span>
					<span>
						<b>بلیت شمارهٔ {fa(index + 1)}</b>
						{ticket.numbers?.length ? <Numbers numbers={ticket.numbers} hits={winning} /> : <small>عددی ثبت نشده</small>}
					</span>
					<span className="bd-text-btn">←</span>
				</Link>
			))}
		</div>
	);
}

export default function LotteryDetail() {
	const { id } = useParams<{ id: string }>();
	const detail = useGetLotteryDetail({ id });
	const lottery = detail.data?.result;
	const completed = lottery?.status === "completed";
	const results = useGetLotteryFullDetail({ id, enabled: completed });
	const list = useGetLotteryList();
	const rules = list.data?.result?.results?.find((l) => l.id === id)?.prize_rules ?? [];
	const left = useCountdown(lottery?.status === "active" ? lottery.end_date : null);

	if (!lottery || (completed && !results.data)) {
		return (
			<AppShell nav="wallet" title="جزئیات قرعه‌کشی">
				<LoadState
					loading={detail.isLoading || (completed && results.isLoading)}
					error={detail.error || results.error}
					onRetry={() => (detail.error ? detail.refetch() : results.refetch())}
				/>
			</AppShell>
		);
	}

	const winning = completed ? (results.data?.winning_numbers ?? []) : [];
	const open = lottery.status === "active" && left > 0;
	const prize = completed ? (results.data?.total_prize_pool ?? 0) : Number(lottery.balance_in_money ?? 0);

	return (
		<AppShell nav="wallet" title="جزئیات قرعه‌کشی">
			<div className="rt-two">
				<Panel title={lottery.name}>
					<span className="bd-tag">{lotteryStatus(lottery)}</span>
					<Art name="rewards" />
					<p>
						{completed ? "جمع جوایز این دوره" : "موجودی جایزهٔ این دوره"}: <b>{fa(prize)} تومان</b>
					</p>
					{completed && winning.length ? (
						<>
							<p>عددهای برنده:</p>
							<Numbers numbers={winning} />
						</>
					) : null}
				</Panel>
				<Panel title="جزئیات دوره">
					<Facts
						items={[
							["وضعیت", lotteryStatus(lottery)],
							[completed ? "زمان پایان فروش" : "پایان فروش", formatTehranDateTime(lottery.end_date)],
							...(open ? ([["زمان باقی‌مانده", formatLeft(left)]] as [string, string][]) : []),
							["قیمت هر بلیت", `${fa(lottery.ticket_price)} امتیاز`],
						]}
					/>
					{rules.length ? (
						<>
							<h3>جایزهٔ هر بلیت</h3>
							<Facts
								items={[...rules]
									.sort((a, b) => b.match_count - a.match_count)
									.map((rule) => [
										`${fa(rule.match_count)} عدد درست`,
										rule.match_count === 6 ? "سهم از باقی‌ماندهٔ جایزه" : `${fa(rule.prize_amount)} تومان`,
									])}
							/>
						</>
					) : null}
					<div className="bd-actions">
						{open ? (
							<Link className="bd-action" href={R.tickets}>
								خرید بلیت
							</Link>
						) : (
							<button className="bd-action" type="button" disabled>
								{completed ? "این دوره برگزار شده" : "فروش این دوره بسته است"}
							</button>
						)}
						<Link className="bd-text-btn" href={R.lotteryGuide}>
							راهنمای قرعه‌کشی ←
						</Link>
					</div>
				</Panel>
			</div>
			<div className="rt-two rt-gap-top">
				<Panel title="بلیت‌های من">
					<MyTickets id={id} winning={winning} />
				</Panel>
				{completed && results.data ? (
					<Panel title="نتیجهٔ قرعه‌کشی">
						<Facts
							items={[
								["تعداد بلیت‌ها", fa(results.data.summary.total_tickets)],
								["بلیت‌های برنده", fa(results.data.summary.winning_tickets_count)],
								["برندگان", fa(results.data.summary.unique_winners_count)],
							]}
						/>
						{results.data.results_by_match
							.filter((group) => group.winners_count > 0)
							.map((group) => (
								<div key={group.matched_numbers}>
									<h3>
										{fa(group.matched_numbers)} عدد درست · {fa(group.winners_count)} برنده
									</h3>
									<div className="bd-rows">
										{group.winners.map((winner) => (
											<div className="bd-row" key={winner.customer_id}>
												<span className="bd-mission-icon">★</span>
												<span>
													<b>{winner.username || "کاربر بردینو"}</b>
													<small>{fa(winner.tickets_count)} بلیت</small>
												</span>
												<span className="bd-amount is-plus">{fa(winner.prize_amount)} تومان</span>
											</div>
										))}
									</div>
								</div>
							))}
					</Panel>
				) : null}
			</div>
		</AppShell>
	);
}
