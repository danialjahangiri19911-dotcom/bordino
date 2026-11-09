"use client";

import { type FormEvent, useState } from "react";

import Icon from "@/bd/Icon";
import { fa } from "@/bd/format";
import { EmptyState, LoadState, Notice, Panel } from "@/bd/ui";

import OpsShell from "../Shell";
import { type OpsRole, ROLE_NAME, ago, dateText, errorText, ops, useOps, useRefresh } from "../client";

// ── settings ──

interface Setting {
	key: string;
	group: string;
	type: "int" | "bool" | "str" | "choice";
	label: string;
	help: string;
	default: unknown;
	min: number | null;
	max: number | null;
	choices: [string, string][] | null;
	value: unknown;
	source: "database" | "env" | "default";
	updated: string | null;
}

const SOURCE: Record<Setting["source"], string> = { database: "تنظیم‌شده", env: "از تنظیمات سرور", default: "پیش‌فرض" };

function show(s: Setting, v: unknown): string {
	if (s.type === "bool") return v ? "روشن" : "خاموش";
	if (s.type === "choice") return s.choices?.find(([k]) => k === v)?.[1] ?? String(v ?? "");
	if (s.type === "int") return v == null ? "—" : fa(Number(v));
	return String(v ?? "") || "—";
}

function SettingRow({ s }: { s: Setting }) {
	const refresh = useRefresh();
	const [value, setValue] = useState<string>(s.type === "bool" ? (s.value ? "true" : "false") : String(s.value ?? ""));
	const [busy, setBusy] = useState(false);
	const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
	const current = s.type === "bool" ? (s.value ? "true" : "false") : String(s.value ?? "");
	const save = async (reset = false) => {
		setBusy(true);
		setMsg(null);
		try {
			if (reset) await ops(`settings/${s.key}/`, "DELETE");
			else await ops(`settings/${s.key}/`, "PUT", { value: s.type === "bool" ? value === "true" : value });
			setMsg({ ok: true, text: reset ? "به پیش‌فرض برگشت." : "ذخیره شد؛ همین حالا اعمال می‌شود." });
			refresh();
		} catch (e) {
			setMsg({ ok: false, text: errorText(e) });
		}
		setBusy(false);
	};
	return (
		<li className="ops-setting">
			<div className="ops-setting-head">
				<b>{s.label}</b>
				<span className={`bd-tag ops-src-${s.source}`}>{SOURCE[s.source]}</span>
			</div>
			{s.help ? <small className="bd-muted">{s.help}</small> : null}
			<div className="ops-setting-edit">
				{s.type === "bool" ? (
					<select aria-label={s.label} value={value} onChange={(e) => setValue(e.target.value)}>
						<option value="true">روشن</option>
						<option value="false">خاموش</option>
					</select>
				) : s.type === "choice" ? (
					<select aria-label={s.label} value={value} onChange={(e) => setValue(e.target.value)}>
						{s.choices?.map(([k, label]) => (
							<option key={k} value={k}>
								{label}
							</option>
						))}
					</select>
				) : (
					<input aria-label={s.label} dir="ltr" inputMode={s.type === "int" ? "numeric" : undefined} value={value} onChange={(e) => setValue(e.target.value)} />
				)}
				<button type="button" className="bd-action" disabled={busy || value === current} onClick={() => void save()}>
					ذخیره
				</button>
				{s.source === "database" ? (
					<button type="button" className="bd-text-btn" disabled={busy} onClick={() => void save(true)}>
						<Icon name="rotate-ccw" /> پیش‌فرض ({show(s, s.default)})
					</button>
				) : null}
			</div>
			<small className="bd-muted">
				{s.type === "int" && (s.min != null || s.max != null) ? `از ${fa(s.min ?? 0)} تا ${fa(s.max ?? 0)}، ` : ""}
				<code dir="ltr">{s.key}</code>
				{s.updated ? `، تغییر ${ago(s.updated)}` : ""}
			</small>
			{msg ? <Notice tone={msg.ok ? "ok" : "warn"}>{msg.text}</Notice> : null}
		</li>
	);
}

export function SettingsPage() {
	const q = useOps<{ groups: Record<string, string>; settings: Setting[]; other?: { key: string; value: string; type: string; description: string }[] }>("settings/");
	const groups = q.data?.groups ?? {};
	return (
		<OpsShell nav="settings" title="تنظیمات" need={["settings"]}>
			<Notice tone="info">هر تغییر همین حالا برای همه اعمال می‌شود و در «سابقهٔ کارها» با مقدار قبلی ثبت می‌شود.</Notice>
			<LoadState loading={q.isLoading} error={q.error} onRetry={q.refetch} />
			{Object.entries(groups).map(([g, name]) => (
				<Panel key={g} title={name}>
					<ul className="ops-settings">
						{q.data?.settings
							.filter((s) => s.group === g)
							.map((s) => (
								<SettingRow key={`${s.key}:${String(s.value)}:${s.source}`} s={s} />
							))}
					</ul>
				</Panel>
			))}
			{q.data?.other?.length ? (
				<Panel title="تنظیم‌های دیگر (فقط مدیر اصلی می‌بیند)">
					<p className="bd-muted">این‌ها در فهرست بالا نیستند؛ از پنل جنگو (System configurations) تغییرشان بده.</p>
					<ul className="ops-facts">
						{q.data.other.map((o) => (
							<li key={o.key}>
								<code dir="ltr">{o.key}</code> = <code dir="ltr">{o.value}</code> {o.description ? `· ${o.description}` : ""}
							</li>
						))}
					</ul>
				</Panel>
			) : null}
			<p className="bd-muted">
				تنظیم بازی‌های امتیازی (کرش، مرغ، سودوکو، …) در{" "}
				<a href="/admin/" target="_blank" rel="noreferrer">
					پنل جنگو
				</a>{" "}
				است.
			</p>
		</OpsShell>
	);
}

// ── users ──

interface UserCard {
	id: string;
	phone: string;
	name: string;
	joined: string;
	last_active: string | null;
	active: boolean;
	staff: boolean;
	points?: number;
	cash?: number;
	streak?: number;
	recent?: { at: string; section: string; action: string; points: number | null; status: string }[];
	games?: { title: string; status: string; points: number; at: string }[];
	withdrawals?: { id: string; amount: number; status: string; requested_at: string }[];
	bank_accounts?: { bank: string; iban: string; holder: string; status: string }[];
}

export function UsersPage() {
	const [q, setQ] = useState("");
	const [search, setSearch] = useState("");
	const data = useOps<{ users: UserCard[] }>(search ? `users/?q=${encodeURIComponent(search)}` : null);
	const submit = (e: FormEvent) => {
		e.preventDefault();
		setSearch(q.trim());
	};
	const users = data.data?.users ?? [];
	return (
		<OpsShell nav="users" title="کاربران">
			<form className="ops-search" onSubmit={submit}>
				<input aria-label="جست‌وجوی کاربر" placeholder="موبایل یا نام کاربری (دست‌کم ۳ حرف)" value={q} onChange={(e) => setQ(e.target.value)} />
				<button type="submit" className="bd-action" disabled={q.trim().length < 3}>
					<Icon name="search" /> جست‌وجو
				</button>
			</form>
			<LoadState loading={data.isLoading} error={data.error} onRetry={data.refetch} />
			{search && data.data && !users.length ? <EmptyState icon="search" title="کاربری پیدا نشد" /> : null}
			{users.length > 1 ? (
				<div className="ops-list">
					{users.map((u) => (
						<button
							key={u.id}
							type="button"
							className="bd-panel ops-row"
							onClick={() => {
								setQ(u.phone);
								setSearch(u.phone);
							}}
						>
							<span className="ops-row-main">
								<b>{u.name || u.phone}</b>
								<small className="bd-muted">
									{u.phone}، عضو از {dateText(u.joined, false)}، آخرین فعالیت {ago(u.last_active)}
								</small>
							</span>
							<Icon name="chevron-left" />
						</button>
					))}
				</div>
			) : null}
			{users.length === 1 ? <UserDetail u={users[0]} /> : null}
		</OpsShell>
	);
}

function UserDetail({ u }: { u: UserCard }) {
	return (
		<>
			<Panel title={u.name || u.phone}>
				<ul className="ops-facts">
					<li>موبایل: {u.phone}</li>
					<li>عضو از {dateText(u.joined)}</li>
					<li>آخرین فعالیت: {ago(u.last_active)}</li>
					<li>روزهای پیاپی: {fa(u.streak ?? 0)}</li>
					{!u.active ? <li>حساب غیرفعال است</li> : null}
					{u.staff ? <li>عضو اپ ادمین</li> : null}
				</ul>
				<div className="gm-stats">
					<div className="bd-panel gm-stat">
						<b>{fa(u.points ?? 0)}</b>
						<small>امتیاز</small>
					</div>
					<div className="bd-panel gm-stat">
						<b>{fa(u.cash ?? 0)}</b>
						<small>موجودی نقدی (تومان)</small>
					</div>
				</div>
			</Panel>
			{u.recent?.length ? (
				<Panel title="آخرین فعالیت‌های امتیازی">
					<ul className="ops-facts">
						{u.recent.map((r) => (
							<li key={`${r.at}${r.action}`}>
								{dateText(r.at)}، <code dir="ltr">{r.section}</code>، {r.points != null ? `${r.points > 0 ? "+" : ""}${fa(r.points)}` : "—"}، {r.status}
							</li>
						))}
					</ul>
				</Panel>
			) : null}
			{u.games?.length ? (
				<Panel title="معماها و بازی‌های سازندگان">
					<ul className="ops-facts">
						{u.games.map((g) => (
							<li key={`${g.at}${g.title}`}>
								{g.title}، {g.status === "completed" ? "تمام کرده" : "در حال بازی"}، {fa(g.points)} امتیاز، {dateText(g.at, false)}
							</li>
						))}
					</ul>
				</Panel>
			) : null}
			{u.withdrawals?.length || u.bank_accounts?.length ? (
				<Panel title="برداشت‌ها و حساب‌ها">
					<ul className="ops-facts">
						{u.bank_accounts?.map((a) => (
							<li key={a.iban}>
								{a.bank}، {a.holder}، <code dir="ltr">{a.iban}</code>، {a.status}
							</li>
						))}
						{u.withdrawals?.map((w) => (
							<li key={w.id}>
								برداشت {fa(w.amount)}، {w.status}، {dateText(w.requested_at)}
							</li>
						))}
					</ul>
				</Panel>
			) : null}
		</>
	);
}

// ── maintenance ──

interface Check {
	name: string;
	ok: boolean;
	detail?: string;
	[k: string]: unknown;
}

const CHECK_NAME: Record<string, string> = { database: "پایگاه داده", redis: "حافظهٔ موقت (Redis)", workers: "کارگرهای پس‌زمینه (Celery)", timers: "زمان‌بندها", disk: "دیسک سرور", errors: "خطاهای سرور در ۲۴ ساعت", migrations: "آخرین به‌روزرسانی پایگاه داده" };

function checkText(c: Check): string {
	if (c.detail) return c.detail;
	switch (c.name) {
		case "database":
			return `${fa(Number(c.size_mb))} مگابایت، ${fa(Number(c.connections))} اتصال`;
		case "redis":
			return `${fa(Number(c.memory_mb))} مگابایت حافظه`;
		case "workers":
			return `${fa(Number(c.workers))} کارگر پاسخ داد${c.queued != null ? `، ${fa(Number(c.queued))} کار در صف` : ""}`;
		case "disk":
			return `${fa(Number(c.free_gb))} گیگابایت آزاد، ${fa(Number(c.used_percent))}٪ پر`;
		case "errors":
			return `${fa(Number(c.count))} پاسخ خطا (۵xx)`;
		case "migrations":
			return `${String(c.last)}، ${dateText(String(c.applied))}`;
		default:
			return "";
	}
}

export function MaintenancePage() {
	const q = useOps<{ maintenance: { at: string; ok: boolean; checks: Check[] } }>("maintenance/", 30_000);
	const m = q.data?.maintenance;
	return (
		<OpsShell nav="maintenance" title="سلامت سرور">
			<LoadState loading={q.isLoading} error={q.error} onRetry={q.refetch} />
			{m ? (
				<>
					<Notice tone={m.ok ? "ok" : "warn"}>
						{m.ok ? "همه چیز سالم است." : "یک یا چند بخش مشکل دارد؛ پایین را ببین."} (بررسی {ago(m.at)}، هر ۳۰ ثانیه)
					</Notice>
					<ul className="ops-checks">
						{m.checks.map((c) => (
							<li key={c.name} className="bd-panel" data-ok={c.ok ? "true" : "false"}>
								<Icon name={c.ok ? "circle-check" : "triangle-alert"} />
								<span>
									<b>
										{CHECK_NAME[c.name] ?? c.name}: {c.ok ? "سالم" : "مشکل"}
									</b>
									<small className="bd-muted">{checkText(c)}</small>
									{c.name === "timers" && Array.isArray(c.tasks) ? (
										<ul className="ops-facts">
											{(c.tasks as { name: string; last_run: string | null; late: boolean }[]).map((t) => (
												<li key={t.name}>
													<code dir="ltr">{t.name}</code>، آخرین اجرا {ago(t.last_run)}
													{t.late ? "، عقب افتاده" : ""}
												</li>
											))}
										</ul>
									) : null}
								</span>
							</li>
						))}
					</ul>
				</>
			) : null}
		</OpsShell>
	);
}

// ── staff (owner) ──

interface Member {
	id: string;
	user_id: string;
	phone: string;
	name: string;
	active: boolean;
	roles: OpsRole[];
	note: string;
	added: string | null;
	owner: boolean;
}

const ALL_ROLES: OpsRole[] = ["reviewer", "finance", "settings", "support"];

function RolePicker({ value, onChange }: { value: OpsRole[]; onChange: (r: OpsRole[]) => void }) {
	return (
		<div className="ops-roles" role="group" aria-label="نقش‌ها">
			{ALL_ROLES.map((r) => (
				<label key={r} className="gm-check">
					<input type="checkbox" checked={value.includes(r)} onChange={(e) => onChange(e.target.checked ? [...value, r] : value.filter((x) => x !== r))} /> {ROLE_NAME[r]}
				</label>
			))}
		</div>
	);
}

function MemberRow({ m }: { m: Member }) {
	const refresh = useRefresh();
	const [roles, setRoles] = useState<OpsRole[]>(m.roles);
	const [asking, setAsking] = useState(false);
	const [msg, setMsg] = useState<string | null>(null);
	const call = async (method: string, data?: unknown) => {
		setMsg(null);
		try {
			await ops(`staff/${m.id}/`, method, data);
			setAsking(false);
			refresh();
		} catch (e) {
			setMsg(errorText(e));
		}
	};
	return (
		<li className="bd-panel ops-row ops-row-col" data-inactive={!m.active ? "true" : undefined}>
			<span className="ops-row-main">
				<b>
					{m.name || m.phone} <small className="bd-muted">{m.phone}</small>
				</b>
				<small className="bd-muted">{m.owner ? "مدیر اصلی، همهٔ نقش‌ها (از تنظیمات سرور)" : `${m.active ? "فعال" : "غیرفعال"}، از ${dateText(m.added, false)}`}</small>
			</span>
			{!m.owner ? (
				<>
					<RolePicker value={roles} onChange={setRoles} />
					<div className="bd-actions">
						<button type="button" className="bd-action" disabled={!roles.length || roles.join() === m.roles.join()} onClick={() => void call("PATCH", { roles })}>
							ذخیرهٔ نقش‌ها
						</button>
						<button type="button" className="bd-secondary" onClick={() => void call("PATCH", { active: !m.active })}>
							{m.active ? "غیرفعال کردن" : "فعال کردن"}
						</button>
						{asking ? (
							<>
								<button type="button" className="bd-action" onClick={() => void call("DELETE")}>
									حذف شود
								</button>
								<button type="button" className="bd-secondary" onClick={() => setAsking(false)}>
									نه
								</button>
							</>
						) : (
							<button type="button" className="bd-text-btn" onClick={() => setAsking(true)}>
								<Icon name="trash-2" /> حذف
							</button>
						)}
					</div>
				</>
			) : null}
			{msg ? <Notice>{msg}</Notice> : null}
		</li>
	);
}

export function StaffPage() {
	const q = useOps<{ staff: Member[] }>("staff/");
	const refresh = useRefresh();
	const [phone, setPhone] = useState("");
	const [roles, setRoles] = useState<OpsRole[]>(["support"]);
	const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
	const add = async (e: FormEvent) => {
		e.preventDefault();
		setMsg(null);
		try {
			await ops("staff/", "POST", { phone, roles });
			setMsg({ ok: true, text: "اضافه شد؛ حالا با همین شماره در اپ ادمین وارد می‌شود." });
			setPhone("");
			refresh();
		} catch (err) {
			setMsg({ ok: false, text: errorText(err) });
		}
	};
	return (
		<OpsShell nav="staff" title="کارکنان و نقش‌ها" need={["owner"]}>
			<Panel title="افزودن همکار">
				<form onSubmit={(e) => void add(e)}>
					<label className="rt-field gm-field">
						<span>شمارهٔ موبایل (باید در اپ بردینو ثبت‌نام کرده باشد)</span>
						<input dir="ltr" inputMode="tel" placeholder="09121234567" value={phone} onChange={(e) => setPhone(e.target.value)} />
					</label>
					<RolePicker value={roles} onChange={setRoles} />
					<ul className="ops-facts">
						{ALL_ROLES.map((r) => (
							<li key={r}>
								<b>{ROLE_NAME[r]}:</b> {ROLE_HELP[r]}
							</li>
						))}
					</ul>
					<button type="submit" className="bd-action" disabled={phone.replace(/\D/g, "").length < 10 || !roles.length}>
						<Icon name="user-plus" /> افزودن
					</button>
				</form>
				{msg ? <Notice tone={msg.ok ? "ok" : "warn"}>{msg.text}</Notice> : null}
			</Panel>
			<LoadState loading={q.isLoading} error={q.error} onRetry={q.refetch} />
			<ul className="ops-list">
				{q.data?.staff.map((m) => (
					<MemberRow key={`${m.id || m.user_id}:${m.roles.join()}:${m.active}`} m={m} />
				))}
			</ul>
		</OpsShell>
	);
}

const ROLE_HELP: Record<OpsRole, string> = {
	reviewer: "بازی‌های سازندگان: بررسی، تأیید، اصلاح، رد، توقف، پایان و حذف از جدول.",
	finance: "درخواست‌های برداشت (پرداخت، ناموفق، لغو) و تأیید حساب‌های بانکی.",
	settings: "تنظیمات برنامه (هزینه‌ها، سقف‌ها، روشن و خاموش‌ها).",
	support: "جست‌وجوی کاربران و دیدن داشبوردها؛ بدون تغییر.",
};

// ── audit ──

const ACTION: Record<string, string> = {
	sign_in: "ورود",
	sign_out: "خروج",
	staff_add: "افزودن همکار",
	staff_reactivate: "فعال کردن دوباره",
	staff_change: "تغییر همکار",
	staff_remove: "حذف همکار",
	game_approve: "تأیید بازی",
	game_changes: "درخواست اصلاح بازی",
	game_reject: "رد بازی",
	game_pause: "توقف بازی",
	game_resume: "ادامهٔ بازی",
	game_expire: "پایان فوری بازی",
	game_archive: "بایگانی بازی",
	leaderboard_exclude: "حذف از جدول",
	withdrawal_pay: "پرداخت برداشت",
	withdrawal_fail: "برداشت ناموفق",
	withdrawal_cancel: "لغو برداشت",
	bank_account_approve: "تأیید حساب بانکی",
	bank_account_reject: "رد حساب بانکی",
	setting_change: "تغییر تنظیم",
	setting_reset: "برگشت تنظیم به پیش‌فرض",
	user_search: "جست‌وجوی کاربر",
};

export function AuditPage() {
	const [offset, setOffset] = useState(0);
	const q = useOps<{ rows: { at: string; actor: string; actor_name: string; action: string; target: string; data: Record<string, unknown> }[]; more: boolean }>(`audit/?offset=${offset}`);
	return (
		<OpsShell nav="audit" title="سابقهٔ کارها">
			<p className="bd-muted">مدیر اصلی کار همه را می‌بیند؛ بقیه کارهای خودشان را.</p>
			<LoadState loading={q.isLoading} error={q.error} onRetry={q.refetch} />
			<ul className="ops-list">
				{q.data?.rows.map((r) => (
					<li key={`${r.at}${r.action}${r.target}`} className="bd-panel ops-row ops-row-col">
						<span className="ops-row-main">
							<b>{ACTION[r.action] ?? r.action}</b>
							<small className="bd-muted">
								{dateText(r.at)}، {r.actor_name || r.actor} {r.target ? `· ${r.target}` : ""}
							</small>
							{Object.keys(r.data ?? {}).length ? (
								<code className="ops-data" dir="ltr">
									{JSON.stringify(r.data)}
								</code>
							) : null}
						</span>
					</li>
				))}
			</ul>
			<div className="bd-actions">
				{offset > 0 ? (
					<button type="button" className="bd-secondary" onClick={() => setOffset(Math.max(0, offset - 50))}>
						جدیدتر
					</button>
				) : null}
				{q.data?.more ? (
					<button type="button" className="bd-secondary" onClick={() => setOffset(offset + 50)}>
						قدیمی‌تر
					</button>
				) : null}
			</div>
		</OpsShell>
	);
}
