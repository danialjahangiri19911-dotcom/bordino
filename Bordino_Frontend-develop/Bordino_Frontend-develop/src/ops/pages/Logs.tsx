"use client";

import { useState } from "react";

import { EmptyState, LoadState, Panel } from "@/bd/ui";

import OpsShell from "../Shell";
import { dateText, useOps } from "../client";

interface Log {
	time: string;
	client_time: string | null;
	phone: string;
	flow: string;
	attempt: string;
	step: string;
	level: "info" | "error";
	source: "app" | "server";
	data: Record<string, unknown>;
	user_agent: string;
}

const FLOW: Record<string, string> = { profile_photo: "عکس پروفایل", mission_photo: "عکس مأموریت" };

/** «ردیابی»: what a player's phone (and the server) did, step by step, in a traced flow — newest first. */
export function LogsPage() {
	const [phone, setPhone] = useState("");
	const [query, setQuery] = useState("");
	const q = useOps<{ logs: Log[] }>(`client-logs/?phone=${encodeURIComponent(query)}`, 15_000);
	const logs = q.data?.logs ?? [];
	// Attempts in the order they started (each one's steps oldest first, as they happened).
	const attempts: { id: string; rows: Log[] }[] = [];
	for (const row of [...logs].reverse()) {
		const key = row.attempt || `${row.flow}-${row.time.slice(0, 16)}`;
		const found = attempts.find((a) => a.id === key);
		if (found) found.rows.push(row);
		else attempts.push({ id: key, rows: [row] });
	}
	attempts.reverse();
	return (
		<OpsShell nav="logs" title="ردیابی برنامه">
			<p className="bd-muted">مرحله‌به‌مرحلهٔ کارهایی که گوشی بازیکن (و سرور) در بخش‌های ردیابی‌شده انجام داده؛ تازه‌ترین تلاش بالا. ۳۰ روز نگه داشته می‌شود.</p>
			<form
				className="ops-form ops-log-search"
				onSubmit={(e) => {
					e.preventDefault();
					setQuery(phone.trim());
				}}
			>
				<label className="rt-field gm-field">
					<span>شمارهٔ موبایل</span>
					<input inputMode="tel" dir="ltr" value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="0912…" />
				</label>
				<button type="submit" className="bd-action">
					جستجو
				</button>
			</form>
			<LoadState loading={q.isLoading} error={q.error} onRetry={q.refetch} />
			{q.data && !attempts.length ? <EmptyState icon="search" title="ردیابی‌ای نیست" text="هنوز این کاربر در بخش‌های ردیابی‌شده کاری نکرده." /> : null}
			{attempts.map((a) => (
				<Panel key={a.id} title={`${FLOW[a.rows[0].flow] ?? a.rows[0].flow} · ${a.rows[0].phone} · ${dateText(a.rows[0].time)}`}>
					<ol className="ops-log-steps">
						{a.rows.map((r, i) => (
							<li key={i} data-level={r.level}>
								<b>
									{r.source === "server" ? "سرور" : "گوشی"} · {r.step}
								</b>
								<small className="bd-muted"> {dateText(r.time)}</small>
								{Object.keys(r.data).length ? <pre dir="ltr">{JSON.stringify(r.data, null, 1)}</pre> : null}
							</li>
						))}
					</ol>
					<small className="bd-muted" dir="ltr">
						{a.rows.find((r) => r.user_agent)?.user_agent}
					</small>
				</Panel>
			))}
		</OpsShell>
	);
}
