"use client";

import Link from "next/link";

import { HistoryFooter, HistoryRow, useHistory } from "../history";
import Icon from "../Icon";
import { fa, faDate } from "../format";
import { AppShell, EmptyState, LoadState, Panel, R, usePoints } from "../ui";

import useExtractLotteries from "@/api/lottery/utils/useExtractLotteries";
import useGetCurrencySummary from "@/api/wallet/hooks/useGetCurrencySummary";

export function useCashAccount() {
	const { data, isLoading, error, refetch } = useGetCurrencySummary();
	const account = data?.result?.currency_wallet_accounts?.[0];
	return {
		account,
		balance: data?.result ? Number(account?.balance ?? 0) : null,
		isLoading,
		error,
		refetch,
	};
}

export default function Wallet() {
	const points = usePoints();
	const cash = useCashAccount();
	const { activeLotteries: lottery, lotteryData } = useExtractLotteries();
	const pointsHistory = useHistory("points", points.account?.id);
	const recent = pointsHistory.rows.slice(0, 5);

	const price = lottery ? Number(lottery.ticket_price) : null;
	const progress = points.account && price ? Math.min(100, (Number(points.account.current_points) / price) * 100) : 0;

	return (
		<AppShell nav="wallet" title="کیف‌پول">
			<div className="rt-two">
				<Panel title="کیف امتیاز">
					{points.points === null ? (
						<LoadState loading={points.isLoading} error={points.error} onRetry={points.refetch} />
					) : (
						<>
							<strong className="rt-big">
								{fa(points.points)} <small>امتیاز</small>
							</strong>
							<p>
								{fa(points.account?.total_tickets ?? 0)} بلیت فعال
								{price ? ` · هر بلیت ${fa(price)} امتیاز` : " · قرعه‌کشی فعالی نیست"}
							</p>
							{price ? (
								<>
									<div className="rt-track" role="progressbar" aria-valuenow={Math.round(progress)} aria-valuemin={0} aria-valuemax={100} aria-label="پیشرفت تا بلیت بعدی">
										<span style={{ width: `${progress}%` }} />
									</div>
									<small>{fa(points.account?.remaining_points ?? price)} امتیاز تا بلیت بعدی</small>
								</>
							) : null}
							{points.account?.expire_time ? (
								<small className="bd-muted"> · اعتبار تا {faDate(points.account.expire_time)}</small>
							) : null}
							<div className="bd-actions">
								{lottery ? (
									<Link className="bd-action" href={R.tickets}>
										تبدیل امتیاز به بلیت
									</Link>
								) : (
									<button type="button" className="bd-action" disabled>
										تبدیل امتیاز به بلیت
									</button>
								)}
							</div>
						</>
					)}
				</Panel>
				<Panel title="کیف نقدی">
					{cash.balance === null ? (
						<LoadState loading={cash.isLoading} error={cash.error} onRetry={cash.refetch} />
					) : (
						<>
							<strong className="rt-big">
								{fa(cash.balance)} <small>تومان</small>
							</strong>
							<p>موجودی قابل برداشت</p>
							<div className="bd-actions">
								<Link className="bd-secondary" href={R.withdraw}>
									درخواست برداشت
								</Link>
								<Link className="bd-text-btn" href={`${R.transactions}?kind=currency`}>
									تراکنش‌های نقدی ←
								</Link>
							</div>
						</>
					)}
				</Panel>
			</div>
			<div className="rt-two rt-gap-top">
				<Panel title="قرعه‌کشی‌ها">
					{lottery ? (
						<div className="bd-rows">
							<div className="bd-row">
								<span className="bd-mission-icon">
									<Icon name="ticket" />
								</span>
								<span>
									<b>{lottery.name}</b>
									<small>جایزه {fa(lottery.balance_in_money)} تومان · پایان {faDate(lottery.end_date)}</small>
								</span>
								<Link className="bd-text-btn" href={R.lotteryDetail(lottery.id)}>
									جزئیات
								</Link>
							</div>
						</div>
					) : (
						<EmptyState
							title={(points.account?.total_tickets ?? 0) > 0 ? "دورهٔ فعالی نیست" : "هنوز بلیتی نداری"}
							text="بلیت‌های هر دوره در این بخش دیده می‌شوند."
						/>
					)}
					<div className="bd-actions">
						<Link className="bd-secondary" href={R.lotteries}>
							مشاهدهٔ دوره‌ها{lotteryData.length ? ` (${fa(lotteryData.length)})` : ""}
						</Link>
					</div>
				</Panel>
				<Panel title="گردش حساب">
					{recent.length ? (
						<div className="bd-rows">
							{recent.map((entry) => (
								<HistoryRow key={entry.id} entry={entry} />
							))}
						</div>
					) : (
						<HistoryFooter history={pointsHistory} empty={!pointsHistory.rows.length} emptyTitle="تراکنشی ثبت نشده" />
					)}
					{recent.length || !points.account ? (
						<div className="bd-actions">
							<Link className="bd-secondary" href={R.transactions}>
								مشاهدهٔ تاریخچه
							</Link>
						</div>
					) : null}
				</Panel>
			</div>
		</AppShell>
	);
}
