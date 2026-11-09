"use client";

import Link from "next/link";

import Icon, { type IconName } from "@/bd/Icon";
import { fa } from "@/bd/format";
import { LoadState, Panel } from "@/bd/ui";

import DayBars from "../DayBars";
import OpsShell, { OPS } from "../Shell";
import { ago, useOps } from "../client";

interface Overview {
	at: string;
	users: Record<"total" | "new_today" | "new_7" | "new_30" | "active_today" | "active_7" | "active_30", number>;
	days: string[];
	signups: number[];
	active: number[];
	points: Record<"issued_today" | "issued_7" | "spent_today" | "spent_7", number>;
	cash: { pending: number; pending_amount: number; paid_30: number; bank_accounts_pending: number };
	games: Record<"waiting_review" | "live" | "expired" | "drafts" | "mystery_runs_today" | "stage_proofs_today", number>;
	lotteries: { active: number };
}

function Tile({ label, value, icon, href, hint }: { label: string; value: number | string; icon: IconName; href?: string; hint?: string }) {
	const inner = (
		<>
			<Icon name={icon} />
			<b>{typeof value === "number" ? fa(value) : value}</b>
			<small>{label}</small>
			{hint ? <small className="bd-muted">{hint}</small> : null}
		</>
	);
	return href ? (
		<Link href={href} className="bd-panel gm-stat ops-tile">
			{inner}
		</Link>
	) : (
		<div className="bd-panel gm-stat ops-tile">{inner}</div>
	);
}

/** Home: what needs me now (by my roles), then the numbers and the last 30 days. */
export default function Home() {
	const home = useOps<{ todo: { games?: number; withdrawals?: number; bank_accounts?: number }; owner: boolean }>("home/", 60_000);
	const o = useOps<{ overview: Overview }>("overview/", 60_000);
	const v = o.data?.overview;
	const todo = home.data?.todo ?? {};
	return (
		<OpsShell nav="home" title="داشبورد">
			{Object.keys(todo).length ? (
				<Panel title="منتظر توست">
					<div className="gm-stats">
						{todo.games !== undefined ? <Tile label="بازی در انتظار بررسی" value={todo.games} icon="shield-check" href={OPS.games} /> : null}
						{todo.withdrawals !== undefined ? <Tile label="درخواست برداشت" value={todo.withdrawals} icon="banknote" href={OPS.withdrawals} /> : null}
						{todo.bank_accounts !== undefined ? <Tile label="حساب بانکی برای تأیید" value={todo.bank_accounts} icon="landmark" href={OPS.banks} /> : null}
					</div>
				</Panel>
			) : null}
			<LoadState loading={o.isLoading} error={o.error} onRetry={o.refetch} />
			{v ? (
				<>
					<Panel title="کاربران" headExtra={<small className="bd-muted">به‌روزشده {ago(v.at)}</small>}>
						<div className="gm-stats">
							<Tile label="همهٔ کاربران" value={v.users.total} icon="users" href={OPS.users} />
							<Tile label="ثبت‌نام امروز" value={v.users.new_today} icon="user-plus" hint={`۷ روز: ${fa(v.users.new_7)}، ۳۰ روز: ${fa(v.users.new_30)}`} />
							<Tile label="فعال امروز" value={v.users.active_today} icon="zap" hint={`۷ روز: ${fa(v.users.active_7)}، ۳۰ روز: ${fa(v.users.active_30)}`} />
						</div>
						<div className="ops-charts">
							<DayBars title="ثبت‌نام روزانه" days={v.days} values={v.signups} unit="نفر" />
							<DayBars title="بازیکنان فعال روزانه" days={v.days} values={v.active} unit="نفر" />
						</div>
					</Panel>
					<Panel title="امتیاز و پول">
						<div className="gm-stats">
							<Tile label="امتیاز داده‌شده امروز" value={v.points.issued_today} icon="coins" hint={`۷ روز: ${fa(v.points.issued_7)}`} />
							<Tile label="امتیاز خرج‌شده امروز" value={Math.abs(v.points.spent_today)} icon="ticket" hint={`۷ روز: ${fa(Math.abs(v.points.spent_7))}`} />
							<Tile label="برداشت در انتظار" value={v.cash.pending} icon="banknote" hint={`مبلغ: ${fa(v.cash.pending_amount)} تومان`} href={OPS.withdrawals} />
							<Tile label="پرداخت‌شده در ۳۰ روز (تومان)" value={v.cash.paid_30} icon="badge-check" />
							<Tile label="حساب بانکی منتظر تأیید" value={v.cash.bank_accounts_pending} icon="landmark" href={OPS.banks} />
						</div>
					</Panel>
					<Panel title="بازی‌ها">
						<div className="gm-stats">
							<Tile label="در انتظار بررسی" value={v.games.waiting_review} icon="hourglass" href={OPS.games} />
							<Tile label="بازی سازنده باز" value={v.games.live} icon="play" />
							<Tile label="به پایان رسیده" value={v.games.expired} icon="flag" />
							<Tile label="معمای شروع‌شده امروز" value={v.games.mystery_runs_today} icon="map-pin" hint={`مرحلهٔ حل‌شده: ${fa(v.games.stage_proofs_today)}`} />
							<Tile label="قرعه‌کشی فعال" value={v.lotteries.active} icon="ticket" />
						</div>
					</Panel>
					<p className="bd-muted">
						<Link href={OPS.maintenance} className="bd-text-btn">
							<Icon name="monitor" /> سلامت سرور و زمان‌بندها
						</Link>
					</p>
				</>
			) : null}
		</OpsShell>
	);
}
