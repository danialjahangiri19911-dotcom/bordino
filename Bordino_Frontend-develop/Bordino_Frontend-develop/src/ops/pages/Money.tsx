"use client";

import { useState } from "react";

import Link from "next/link";

import Icon from "@/bd/Icon";
import { fa } from "@/bd/format";
import { CopyButton, EmptyState, LoadState, Notice, Panel } from "@/bd/ui";

import OpsShell, { OPS } from "../Shell";
import { ago, dateText, errorText, ops, useOps, useRefresh } from "../client";

interface Withdrawal {
	id: string;
	amount: number;
	currency: string;
	status: string;
	requested_at: string;
	updated_at: string;
	description: string;
	user: { id: string; phone: string; name: string } | null;
	bank: { id: string; name: string; iban: string; holder: string; status: string } | null;
}

const W_STATUS: Record<string, string> = { pending: "در انتظار", completed: "پرداخت‌شده", failed: "ناموفق", cancelled: "لغوشده", all: "همه" };
const A_STATUS: Record<string, string> = { pending: "در انتظار تأیید", approved: "تأییدشده", rejected: "ردشده", all: "همه" };

/** Cash is in toman (the player app shows it so too). */
function money(n: number, _currency?: string) {
	return `${fa(n)} تومان`;
}

export function WithdrawalsPage() {
	const [status, setStatus] = useState("pending");
	const [q, setQ] = useState("");
	const [search, setSearch] = useState("");
	const data = useOps<{ withdrawals: Withdrawal[]; counts: Record<string, number>; pending_amount: number }>(`withdrawals/?status=${status}${search ? `&q=${encodeURIComponent(search)}` : ""}`, 30_000);
	const list = data.data?.withdrawals ?? [];
	return (
		<OpsShell nav="withdrawals" title="درخواست‌های برداشت" need={["finance"]}>
			<div className="ng-chips" role="group" aria-label="وضعیت">
				{Object.entries(W_STATUS).map(([k, label]) => (
					<button key={k} type="button" className="ng-chip" aria-pressed={status === k} onClick={() => setStatus(k)}>
						{label}
						{k !== "all" && data.data?.counts[k] ? ` (${fa(data.data.counts[k])})` : ""}
					</button>
				))}
			</div>
			<form
				className="ops-search"
				onSubmit={(e) => {
					e.preventDefault();
					setSearch(q.trim());
				}}
			>
				<input aria-label="جست‌وجو" placeholder="موبایل، شبا یا نام صاحب حساب" value={q} onChange={(e) => setQ(e.target.value)} />
				<button type="submit" className="bd-secondary">
					<Icon name="search" /> جست‌وجو
				</button>
			</form>
			{status === "pending" && data.data ? (
				<p className="bd-muted">
					جمع در انتظار: <b>{money(data.data.pending_amount)}</b>، قدیمی‌ترین اول
				</p>
			) : null}
			<LoadState loading={data.isLoading} error={data.error} onRetry={data.refetch} />
			{data.data && !list.length ? <EmptyState icon="banknote" title="درخواستی اینجا نیست" /> : null}
			<div className="ops-list">
				{list.map((w) => (
					<Link key={w.id} href={OPS.withdrawal(w.id)} className="bd-panel ops-row">
						<span className="ops-row-main">
							<b>{money(w.amount, w.currency)}</b>
							<small className="bd-muted">
								{w.user?.name || w.user?.phone}، {w.bank?.name}، {w.bank?.holder}
							</small>
						</span>
						<span className="ops-row-side">
							<span className={`bd-tag ops-st-${w.status}`}>{w.status === "pending" ? ago(w.requested_at) : W_STATUS[w.status]}</span>
							<Icon name="chevron-left" />
						</span>
					</Link>
				))}
			</div>
		</OpsShell>
	);
}

interface Detail {
	withdrawal: Withdrawal;
	player: { joined: string | null; last_active: string | null; cash_balance: number; points: number; points_earned: number; activities: number; paid_before: number; paid_count: number; bank_accounts: number };
	history: Withdrawal[];
}

/** One withdrawal: who, where to, the player's account at a glance (is it plausible?), and the decision. */
export function WithdrawalPage({ id }: { id: string }) {
	const q = useOps<Detail>(`withdrawals/${id}/`);
	const refresh = useRefresh();
	const [decision, setDecision] = useState<"pay" | "fail" | "cancel" | null>(null);
	const [text, setText] = useState("");
	const [confirm, setConfirm] = useState(false);
	const [busy, setBusy] = useState(false);
	const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
	const w = q.data?.withdrawal;
	const p = q.data?.player;
	const decide = async () => {
		if (!decision) return;
		setBusy(true);
		setMsg(null);
		try {
			await ops(`withdrawals/${id}/${decision}/`, "POST", decision === "pay" ? { reference: text } : { reason: text });
			setMsg({ ok: true, text: decision === "pay" ? "پرداخت ثبت شد و به کاربر خبر داده شد." : "ثبت شد؛ مبلغ به کیف پول کاربر برگشت." });
			setDecision(null);
			setText("");
			setConfirm(false);
			refresh();
		} catch (e) {
			setMsg({ ok: false, text: errorText(e) });
		}
		setBusy(false);
	};
	const young = p?.joined ? (Date.now() - new Date(p.joined).getTime()) / 86400000 < 7 : false;
	return (
		<OpsShell nav="withdrawals" title="درخواست برداشت" need={["finance"]}>
			<Link href={OPS.withdrawals} className="my-back">
				<Icon name="arrow-left" /> درخواست‌ها
			</Link>
			<LoadState loading={q.isLoading} error={q.error} onRetry={q.refetch} />
			{w && p ? (
				<>
					<Panel title={money(w.amount, w.currency)} headExtra={<span className={`bd-tag ops-st-${w.status}`}>{W_STATUS[w.status]}</span>}>
						<ul className="ops-facts">
							<li>
								کاربر: <b>{w.user?.name || "—"}</b> {w.user?.phone}
							</li>
							<li>درخواست: {dateText(w.requested_at)}</li>
							<li>
								بانک: {w.bank?.name}، صاحب حساب: <b>{w.bank?.holder}</b>، حساب {w.bank?.status === "approved" ? "تأییدشده" : w.bank?.status}
							</li>
							<li className="ops-iban">
								شبا: <code dir="ltr">{w.bank?.iban}</code> {w.bank ? <CopyButton text={w.bank.iban} label="کپی شبا" /> : null}
							</li>
							{w.description ? <li className="ops-pre">یادداشت: {w.description}</li> : null}
						</ul>
					</Panel>
					<Panel title="حساب کاربر (برای بررسی)">
						<div className="gm-stats">
							<div className="bd-panel gm-stat">
								<b>{fa(p.cash_balance)}</b>
								<small>موجودی نقدی (تومان) فعلی</small>
							</div>
							<div className="bd-panel gm-stat">
								<b>{fa(p.points)}</b>
								<small>امتیاز فعلی</small>
							</div>
							<div className="bd-panel gm-stat">
								<b>{fa(p.points_earned)}</b>
								<small>امتیاز گرفته‌شده تا حالا ({fa(p.activities)} فعالیت)</small>
							</div>
							<div className="bd-panel gm-stat">
								<b>{fa(p.paid_before)}</b>
								<small>برداشت‌های پرداخت‌شدهٔ قبلی ({fa(p.paid_count)})</small>
							</div>
						</div>
						<p className="bd-muted">
							عضو از {dateText(p.joined, false)}، آخرین فعالیت {ago(p.last_active)}، {fa(p.bank_accounts)} حساب بانکی
						</p>
						{young ? <Notice>این حساب کمتر از یک هفته است ساخته شده؛ با دقت بیشتری بررسی کن.</Notice> : null}
					</Panel>
					{w.status === "pending" ? (
						<Panel title="تصمیم">
							<div className="ng-chips" role="group" aria-label="تصمیم">
								{(
									[
										["pay", "پرداخت شد"],
										["fail", "ناموفق (برگشت مبلغ)"],
										["cancel", "لغو (برگشت مبلغ)"],
									] as const
								).map(([k, label]) => (
									<button
										key={k}
										type="button"
										className="ng-chip"
										aria-pressed={decision === k}
										onClick={() => {
											setDecision(k);
											setConfirm(false);
										}}
									>
										{label}
									</button>
								))}
							</div>
							{decision ? (
								<>
									<label className="rt-field gm-field">
										<span>{decision === "pay" ? "شمارهٔ پیگیری واریز بانک" : "دلیل (به کاربر گفته می‌شود که مبلغ برگشت)"}</span>
										<input value={text} maxLength={200} dir={decision === "pay" ? "ltr" : undefined} onChange={(e) => setText(e.target.value)} />
									</label>
									<label className="gm-check">
										<input type="checkbox" checked={confirm} onChange={(e) => setConfirm(e.target.checked)} />{" "}
										{decision === "pay" ? `مطمئنم ${money(w.amount, w.currency)} به شبای بالا واریز شده است.` : "مطمئنم؛ مبلغ به کیف پول کاربر برگردد."}
									</label>
									<button type="button" className="bd-action" disabled={busy || !text.trim() || !confirm} onClick={() => void decide()}>
										{busy ? <Icon name="loader-circle" className="bd-spin" /> : <Icon name="check" />} ثبت
									</button>
								</>
							) : null}
							{msg ? <Notice tone={msg.ok ? "ok" : "warn"}>{msg.text}</Notice> : null}
						</Panel>
					) : msg ? (
						<Notice tone={msg.ok ? "ok" : "warn"}>{msg.text}</Notice>
					) : null}
					{q.data?.history.length ? (
						<Panel title="درخواست‌های دیگر این کاربر">
							<ul className="ops-facts">
								{q.data.history.map((h) => (
									<li key={h.id}>
										<Link href={OPS.withdrawal(h.id)}>
											{money(h.amount, h.currency)}، {W_STATUS[h.status]}، {dateText(h.requested_at)}
										</Link>
									</li>
								))}
							</ul>
						</Panel>
					) : null}
				</>
			) : null}
		</OpsShell>
	);
}

interface Account {
	id: string;
	user: { id: string; phone: string; name: string };
	bank: string;
	iban: string;
	holder: string;
	status: string;
	added: string;
}

export function BankAccountsPage() {
	const [status, setStatus] = useState("pending");
	const q = useOps<{ accounts: Account[]; counts: Record<string, number> }>(`bank-accounts/?status=${status}`, 30_000);
	const refresh = useRefresh();
	const [rejecting, setRejecting] = useState<string | null>(null);
	const [reason, setReason] = useState("");
	const [problem, setProblem] = useState<string | null>(null);
	const decide = async (id: string, decision: "approve" | "reject") => {
		setProblem(null);
		try {
			await ops(`bank-accounts/${id}/${decision}/`, "POST", { reason });
			setRejecting(null);
			setReason("");
			refresh();
		} catch (e) {
			setProblem(errorText(e));
		}
	};
	const list = q.data?.accounts ?? [];
	return (
		<OpsShell nav="banks" title="حساب‌های بانکی" need={["finance"]}>
			<p className="bd-muted">کاربر فقط به حساب تأییدشده برداشت می‌کند. نام صاحب حساب و شبا را با نام کاربر مقایسه کن.</p>
			<div className="ng-chips" role="group" aria-label="وضعیت">
				{Object.entries(A_STATUS).map(([k, label]) => (
					<button key={k} type="button" className="ng-chip" aria-pressed={status === k} onClick={() => setStatus(k)}>
						{label}
						{k !== "all" && q.data?.counts[k] ? ` (${fa(q.data.counts[k])})` : ""}
					</button>
				))}
			</div>
			<LoadState loading={q.isLoading} error={q.error} onRetry={q.refetch} />
			{problem ? <Notice>{problem}</Notice> : null}
			{q.data && !list.length ? <EmptyState icon="landmark" title="حسابی اینجا نیست" /> : null}
			<div className="ops-list">
				{list.map((a) => (
					<div key={a.id} className="bd-panel ops-row ops-row-col">
						<span className="ops-row-main">
							<b>
								{a.holder} <small className="bd-muted">· {a.bank}</small>
							</b>
							<small className="bd-muted">
								کاربر: {a.user.name || "—"} {a.user.phone}، {dateText(a.added, false)}، {A_STATUS[a.status]}
							</small>
							<code dir="ltr" className="ops-iban">
								{a.iban}
							</code>
						</span>
						{a.status === "pending" ? (
							rejecting === a.id ? (
								<div className="my-hint-ask">
									<label className="rt-field gm-field">
										<span>دلیل رد (به کاربر گفته می‌شود)</span>
										<input value={reason} maxLength={200} onChange={(e) => setReason(e.target.value)} />
									</label>
									<button type="button" className="bd-action" disabled={!reason.trim()} onClick={() => void decide(a.id, "reject")}>
										رد
									</button>
									<button type="button" className="bd-secondary" onClick={() => setRejecting(null)}>
										نه
									</button>
								</div>
							) : (
								<div className="bd-actions">
									<button type="button" className="bd-action" onClick={() => void decide(a.id, "approve")}>
										<Icon name="check" /> تأیید
									</button>
									<button type="button" className="bd-secondary" onClick={() => setRejecting(a.id)}>
										<Icon name="x" /> رد
									</button>
								</div>
							)
						) : null}
					</div>
				))}
			</div>
		</OpsShell>
	);
}
