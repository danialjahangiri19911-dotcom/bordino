"use client";

import { useState } from "react";

import Link from "next/link";

import Icon from "@/bd/Icon";
import { fa } from "@/bd/format";
import { EmptyState, LoadState, Notice, Panel } from "@/bd/ui";

import OpsShell, { OPS } from "../Shell";
import { ago, dateText, errorText, ops, useOps, useRefresh } from "../client";

interface VersionRow {
	id: string;
	game_id: string;
	title: string;
	number: number;
	category_name: string;
	status: string;
	submitted_at: string;
	waiting_hours: number;
	stages: number;
	creator: { name: string; phone: string };
	extension: boolean;
}
interface LiveRow {
	id: string;
	title: string;
	status: string;
	status_name: string;
	category_name: string;
	creator: { name: string; phone: string };
	paused_by_admin: boolean;
	edition: number;
	mystery_id: string | null;
	ends_at: string | null;
	players: number;
	finished: number;
	leaderboard: string;
}

const TABS: [string, string][] = [
	["queue", "در انتظار بررسی"],
	["live", "منتشرشده"],
	["expired", "به پایان رسیده"],
	["archived", "بایگانی"],
	["history", "بررسی‌شده"],
];

export function GamesPage() {
	const [tab, setTab] = useState("queue");
	return (
		<OpsShell nav="games" title="بازی‌های سازندگان" need={["reviewer"]}>
			<div className="ng-chips" role="group" aria-label="بخش">
				{TABS.map(([k, label]) => (
					<button key={k} type="button" className="ng-chip" aria-pressed={tab === k} onClick={() => setTab(k)}>
						{label}
					</button>
				))}
			</div>
			{tab === "queue" || tab === "history" ? <Queue status={tab === "queue" ? "submitted" : "all"} /> : <Live status={tab} />}
		</OpsShell>
	);
}

function Queue({ status }: { status: string }) {
	const q = useOps<{ versions: VersionRow[]; counts: Record<string, number> }>(`games/queue/?status=${status}`, 30_000);
	const list = q.data?.versions ?? [];
	return (
		<>
			<LoadState loading={q.isLoading} error={q.error} onRetry={q.refetch} />
			{q.data && !list.length ? <EmptyState icon="badge-check" title="چیزی در انتظار بررسی نیست" text="بازی تازه‌ای که سازنده‌ها بفرستند اینجا می‌آید." /> : null}
			<div className="ops-list">
				{list.map((v) => (
					<Link key={v.id} href={OPS.version(v.id)} className="bd-panel ops-row">
						<span className="ops-row-main">
							<b>{v.title || "بی‌نام"}</b>
							<small className="bd-muted">
								{v.category_name}، نسخهٔ {fa(v.number)}، {fa(v.stages)} مرحله، {v.creator.name || v.creator.phone}
								{v.extension ? "، تمدید یا اصلاح بازی منتشرشده" : ""}
							</small>
						</span>
						<span className="ops-row-side">
							{status === "submitted" ? <span className={`bd-tag ${v.waiting_hours > 24 ? "ops-late" : ""}`}>{ago(v.submitted_at)}</span> : <span className="bd-tag">{STATUS[v.status] ?? v.status}</span>}
							<Icon name="chevron-left" />
						</span>
					</Link>
				))}
			</div>
		</>
	);
}

const STATUS: Record<string, string> = {
	submitted: "در انتظار بررسی",
	approved: "تأییدشده",
	changes_requested: "نیاز به اصلاح",
	rejected: "ردشده",
	published: "منتشرشده",
	superseded: "جایگزین‌شده",
};

function Live({ status }: { status: string }) {
	const q = useOps<{ games: LiveRow[] }>(`games/live/?status=${status}`, 60_000);
	const refresh = useRefresh();
	const [asking, setAsking] = useState<{ id: string; action: string } | null>(null);
	const [problem, setProblem] = useState<string | null>(null);
	const act = async (id: string, action: string) => {
		setProblem(null);
		try {
			await ops(`games/${id}/${action}/`, "POST", {});
			setAsking(null);
			refresh();
		} catch (e) {
			setProblem(errorText(e));
		}
	};
	const list = q.data?.games ?? [];
	const ACT: Record<string, [string, string]> = {
		pause: ["توقف (بردینو)", "بازی برای همه متوقف می‌شود؛ فقط بردینو دوباره بازش می‌کند."],
		resume: ["ادامه", "بازی دوباره برای بازیکنان باز می‌شود."],
		expire: ["پایان فوری", "بازی همین حالا تمام می‌شود (بدون مهلت)؛ سابقه می‌ماند و باقی‌ماندهٔ بودجه برمی‌گردد."],
		archive: ["بایگانی", "بازی برای همیشه بسته می‌شود."],
	};
	return (
		<>
			<LoadState loading={q.isLoading} error={q.error} onRetry={q.refetch} />
			{problem ? <Notice>{problem}</Notice> : null}
			{q.data && !list.length ? <EmptyState icon="list" title="بازی‌ای اینجا نیست" /> : null}
			<div className="ops-list">
				{list.map((g) => (
					<div key={g.id} className="bd-panel ops-row ops-row-col">
						<span className="ops-row-main">
							<b>{g.title}</b>
							<small className="bd-muted">
								{g.category_name}، {g.creator.name || g.creator.phone}، {g.status_name}
								{g.paused_by_admin ? " (توسط بردینو)" : ""}، {fa(g.players)} بازیکن، {fa(g.finished)} تمام کرده
								{g.edition > 1 ? `، دورهٔ ${fa(g.edition)}` : ""}، {g.ends_at ? `پایان: ${dateText(g.ends_at)}` : "بدون پایان خودکار"}
							</small>
						</span>
						<div className="bd-actions">
							{g.mystery_id ? (
								<a className="bd-text-btn" href={`/pwa/earn/mystery/${g.mystery_id}`} target="_blank" rel="noreferrer">
									<Icon name="eye" /> صفحهٔ بازی
								</a>
							) : null}
							<Link className="bd-text-btn" href={OPS.game(g.id)}>
								<Icon name="users" /> بازیکنان و جدول
							</Link>
							{(status === "live" ? (g.status === "paused" ? ["resume", "expire", "archive"] : ["pause", "expire", "archive"]) : status === "expired" ? ["archive"] : []).map((a) => (
								<button key={a} type="button" className="bd-secondary" onClick={() => setAsking({ id: g.id, action: a })}>
									{ACT[a][0]}
								</button>
							))}
						</div>
						{asking?.id === g.id ? (
							<div className="my-hint-ask" role="alertdialog" aria-label="تأیید">
								<span>{ACT[asking.action][1]} ادامه؟</span>
								<button type="button" className="bd-action" onClick={() => void act(g.id, asking.action)}>
									{ACT[asking.action][0]}
								</button>
								<button type="button" className="bd-secondary" onClick={() => setAsking(null)}>
									نه
								</button>
							</div>
						) : null}
					</div>
				))}
			</div>
		</>
	);
}

interface Stage {
	number: number;
	type_name: string;
	title: string;
	text: string;
	question: string;
	answers: string[];
	options: string[];
	staff_code: string;
	map: string;
	lat: number | null;
	lng: number | null;
	radius_m: number;
	check_location: boolean;
	qr_rotating: boolean;
	place: { name: string; address: string; offer: string; url: string };
	hints: string[];
	points: number;
	time_limit_s: number | null;
	coupon: string;
	image: string | null;
}
interface VersionFull extends Omit<VersionRow, "stages"> {
	definition: Record<string, unknown> & { summary?: string; story?: string; access?: string; presenter?: string; area?: string; audience?: { age_min: number | null; age_max: number | null; gender: string }; capacity?: number | null; finish_points?: number; budget_points?: number; completion_message?: string };
	stages: Stage[];
	max_run_points: number;
	availability: string;
	leaderboard: string;
	problems: Record<string, string>;
	fee_toman: number;
	review_note: string;
	own_game: boolean;
	can_decide: boolean;
}

/** One submitted version, exactly as it would be played (answers visible to staff only), and the decision. */
export function VersionPage({ id }: { id: string }) {
	const q = useOps<{ version: VersionFull; history: { at: string; version: number; decision: string; note: string; by: string }[] }>(`games/versions/${id}/`);
	const refresh = useRefresh();
	const [decision, setDecision] = useState<"approve" | "changes" | "reject" | null>(null);
	const [note, setNote] = useState("");
	const [busy, setBusy] = useState(false);
	const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
	const v = q.data?.version;
	const decide = async () => {
		if (!decision) return;
		setBusy(true);
		setMsg(null);
		try {
			await ops(`games/versions/${id}/decide/`, "POST", { decision, note });
			setMsg({ ok: true, text: decision === "approve" ? "تأیید شد؛ به سازنده خبر داده شد." : "ثبت شد؛ سازنده پیام تو را می‌بیند." });
			setDecision(null);
			refresh();
		} catch (e) {
			setMsg({ ok: false, text: errorText(e) });
		}
		setBusy(false);
	};
	const d = v?.definition;
	return (
		<OpsShell nav="games" title={v ? `بررسی «${v.title}»` : "بررسی بازی"} need={["reviewer"]}>
			<Link href={OPS.games} className="my-back">
				<Icon name="arrow-left" /> صف بررسی
			</Link>
			<LoadState loading={q.isLoading} error={q.error} onRetry={q.refetch} />
			{v && d ? (
				<>
					<Panel title={`${v.title} — نسخهٔ ${fa(v.number)}`}>
						<ul className="ops-facts">
							<li>
								سازنده: <b>{v.creator.name || "—"}</b> ({v.creator.phone})
							</li>
							<li>نوع: {v.category_name}</li>
							<li>وضعیت: {STATUS[v.status] ?? v.status}</li>
							<li>فرستاده: {dateText(v.submitted_at)}</li>
							<li>دسترسی: {d.access === "private" ? "خصوصی (با لینک دعوت)" : "عمومی"}</li>
							<li>ارائه‌دهنده: {d.presenter || "—"}</li>
							<li>محدوده: {d.area || "—"}</li>
							<li>
								مخاطب: سن {d.audience?.age_min ?? "—"} تا {d.audience?.age_max ?? "—"}، {d.audience?.gender === "M" ? "آقایان" : d.audience?.gender === "F" ? "خانم‌ها" : "همه"}
							</li>
							<li>ظرفیت: {d.capacity ? fa(d.capacity) : "بدون سقف"}</li>
							<li>
								جایزهٔ پایان {fa(d.finish_points ?? 0)}، بیشترین جایزهٔ یک بازیکن <b>{fa(v.max_run_points)}</b>، بودجه <b>{fa(d.budget_points ?? 0)}</b> امتیاز
							</li>
							<li>هزینهٔ انتشار: {v.fee_toman ? `${fa(v.fee_toman)} تومان` : "—"}</li>
							<li>
								<b>زمان و پایان:</b> {v.availability}
							</li>
							<li>
								<b>جدول رده‌بندی:</b> {v.leaderboard}
							</li>
						</ul>
						{v.extension ? <Notice tone="info">این بازی قبلاً منتشر شده؛ این نسخه تمدید یا اصلاح آن است.</Notice> : null}
						{d.summary ? <p>{d.summary}</p> : null}
						{d.story ? <p className="ops-pre">{d.story}</p> : null}
						{d.completion_message ? <p className="bd-muted">پیام پایان: {d.completion_message}</p> : null}
						{Object.keys(v.problems).length ? (
							<Notice>
								این نسخه کامل نیست: {Object.values(v.problems).join("، ")}
							</Notice>
						) : null}
					</Panel>
					{v.stages.map((s) => (
						<Panel key={s.number} title={`مرحلهٔ ${fa(s.number)}، ${s.type_name}${s.title ? ` — ${s.title}` : ""}`} className="ops-stage">
							{s.text ? <p className="ops-pre">{s.text}</p> : null}
							{s.image ? <img className="ops-stage-img" src={`/media/${s.image}`} alt="" /> : null}
							<ul className="ops-facts">
								{s.question ? <li>پرسش: {s.question}</li> : null}
								{s.options?.length ? <li>گزینه‌ها: {s.options.join("، ")}</li> : null}
								{s.answers?.length ? (
									<li>
										پاسخ درست: <span className="ops-secret">{s.answers.join(" | ")}</span>
									</li>
								) : null}
								{s.staff_code ? (
									<li>
										کد کارکنان: <span className="ops-secret">{s.staff_code}</span>
									</li>
								) : null}
								{s.map ? (
									<li>
										مکان:{" "}
										<a href={s.map} target="_blank" rel="noreferrer" dir="ltr">
											{s.lat}, {s.lng}
										</a>{" "}
										· شعاع {fa(s.radius_m)} متر{s.check_location ? "، موقعیت سنجیده می‌شود" : ""}
									</li>
								) : null}
								{s.place?.name ? (
									<li>
										محل: <b>{s.place.name}</b> {s.place.address}
									</li>
								) : null}
								{s.place?.offer ? <li>پیشنهاد: {s.place.offer}</li> : null}
								{s.place?.url ? <li dir="ltr">{s.place.url}</li> : null}
								{s.qr_rotating ? <li>QR متغیر روی نمایشگر محل</li> : null}
								<li>امتیاز: {fa(s.points)}</li>
								{s.time_limit_s ? <li>مهلت: {fa(s.time_limit_s)} ثانیه</li> : null}
								{s.coupon ? (
									<li>
										کد هدیه: <span className="ops-secret">{s.coupon}</span>
									</li>
								) : null}
								{s.hints?.length ? <li>راهنمایی‌ها: {s.hints.join(" ← ")}</li> : null}
							</ul>
						</Panel>
					))}
					<Panel title="تصمیم">
						{v.own_game ? <Notice>این بازی مال خود توست؛ نفر دیگری باید بررسی‌اش کند.</Notice> : null}
						{v.can_decide ? (
							<>
								<div className="ng-chips" role="group" aria-label="تصمیم">
									{(
										[
											["approve", "تأیید"],
											["changes", "نیاز به اصلاح"],
											["reject", "رد"],
										] as const
									).map(([k, label]) => (
										<button key={k} type="button" className="ng-chip" aria-pressed={decision === k} onClick={() => setDecision(k)}>
											{label}
										</button>
									))}
								</div>
								{decision ? (
									<>
										<label className="rt-field gm-field">
											<span>{decision === "approve" ? "پیام به سازنده (اختیاری)" : "دلیل (سازنده می‌بیند؛ لازم است)"}</span>
											<textarea rows={3} value={note} maxLength={2000} onChange={(e) => setNote(e.target.value)} />
										</label>
										<button type="button" className="bd-action" disabled={busy || (decision !== "approve" && !note.trim())} onClick={() => void decide()}>
											{busy ? <Icon name="loader-circle" className="bd-spin" /> : <Icon name="check" />} ثبت تصمیم
										</button>
									</>
								) : null}
							</>
						) : !v.own_game ? (
							<p className="bd-muted">این نسخه در انتظار بررسی نیست ({STATUS[v.status] ?? v.status}).</p>
						) : null}
						{msg ? <Notice tone={msg.ok ? "ok" : "warn"}>{msg.text}</Notice> : null}
					</Panel>
					{q.data?.history.length ? (
						<Panel title="بررسی‌های قبلی این بازی">
							<ul className="ops-facts ops-history">
								{q.data.history.map((h) => (
									<li key={h.at}>
										{dateText(h.at)}، نسخهٔ {fa(h.version)}، {h.decision === "approve" ? "تأیید" : h.decision === "reject" ? "رد" : "اصلاح"}، {h.by}
										{h.note ? `: ${h.note}` : ""}
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

/** A game's players (for a leaderboard dispute): take a run off the board, with a reason. */
export function GameRunsPage({ id }: { id: string }) {
	const q = useOps<{ runs: { id: string; phone: string; name: string; status: string; stages: number; points: number; started: string; completed: string | null; excluded: boolean }[]; exclusions: number }>(`games/${id}/runs/`);
	const refresh = useRefresh();
	const [asking, setAsking] = useState<string | null>(null);
	const [note, setNote] = useState("");
	const [problem, setProblem] = useState<string | null>(null);
	const exclude = async (runId: string) => {
		setProblem(null);
		try {
			await ops(`games/runs/${runId}/exclude/`, "POST", { note });
			setAsking(null);
			setNote("");
			refresh();
		} catch (e) {
			setProblem(errorText(e));
		}
	};
	return (
		<OpsShell nav="games" title="بازیکنان بازی" need={["reviewer"]}>
			<Link href={OPS.games} className="my-back">
				<Icon name="arrow-left" /> بازی‌ها
			</Link>
			<LoadState loading={q.isLoading} error={q.error} onRetry={q.refetch} />
			{problem ? <Notice>{problem}</Notice> : null}
			{q.data && !q.data.runs.length ? <EmptyState icon="users" title="هنوز کسی این بازی را شروع نکرده" /> : null}
			<div className="ops-list">
				{q.data?.runs.map((r) => (
					<div key={r.id} className="bd-panel ops-row ops-row-col">
						<span className="ops-row-main">
							<b>
								{r.name || r.phone} <small className="bd-muted">{r.phone}</small>
							</b>
							<small className="bd-muted">
								{fa(r.stages)} مرحله، {fa(r.points)} امتیاز، شروع {dateText(r.started)}
								{r.completed ? `، پایان ${dateText(r.completed)}` : ""}
								{r.excluded ? "، از جدول حذف شده" : ""}
							</small>
						</span>
						{!r.excluded ? (
							asking === r.id ? (
								<div className="my-hint-ask">
									<label className="rt-field gm-field">
										<span>دلیل حذف از جدول (در سابقه می‌ماند)</span>
										<input value={note} maxLength={300} onChange={(e) => setNote(e.target.value)} />
									</label>
									<button type="button" className="bd-action" disabled={!note.trim()} onClick={() => void exclude(r.id)}>
										حذف از جدول
									</button>
									<button type="button" className="bd-secondary" onClick={() => setAsking(null)}>
										نه
									</button>
								</div>
							) : (
								<button type="button" className="bd-text-btn" onClick={() => setAsking(r.id)}>
									<Icon name="ban" /> حذف از جدول رده‌بندی
								</button>
							)
						) : null}
					</div>
				))}
			</div>
		</OpsShell>
	);
}
