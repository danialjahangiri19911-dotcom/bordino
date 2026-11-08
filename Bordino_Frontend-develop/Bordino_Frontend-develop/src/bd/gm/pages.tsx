"use client";

import { useState } from "react";

import Link from "next/link";
import { useRouter } from "next/navigation";

import Icon, { type IconName } from "../Icon";
import { fa } from "../format";
import { Chips, EmptyState, LoadState, Notice, Panel } from "../ui";
import CreatorShell, { GM, usePlayerSwitch } from "./CreatorShell";
import {
	CATEGORY_LABEL,
	type Category,
	type GameStatus,
	type GameSummary,
	STATUS_LABEL,
	createGame,
	saveProfile,
	useDashboard,
	useGmProfile,
	useMyGames,
	useTemplates,
} from "./api";
import { useQueryClient } from "@tanstack/react-query";

import { gameErrorMessage } from "@/api/games/request";

function dateText(iso: string | null) {
	return iso ? new Intl.DateTimeFormat("fa-IR", { month: "long", day: "numeric", hour: "2-digit", minute: "2-digit" }).format(new Date(iso)) : "—";
}

/** What the creator should do next with a game, in a few words. */
function nextStep(g: GameSummary): string {
	const v = g.latest_version;
	if (g.status === "draft") return "پیش‌نویس؛ بعد از کامل شدن برای بررسی بفرست.";
	if (g.status === "submitted" || v?.status === "submitted") return "بردینو در حال بررسی است.";
	if (g.status === "changes_requested") return "بردینو اصلاح خواسته؛ پیامش را ببین.";
	if (g.status === "rejected") return "رد شد؛ پیام بررسی را ببین.";
	if (g.status === "approved" || v?.status === "approved") return "تأیید شد؛ حالا منتشرش کن.";
	if (g.status === "paused") return g.paused_by_admin ? "بردینو متوقفش کرده است." : "متوقف است.";
	if (g.status === "scheduled") return "منتشر شده؛ از زمان شروع باز می‌شود.";
	if (g.status === "published") return "برای بازیکنان باز است.";
	return "";
}

export function GameRow({ g }: { g: GameSummary }) {
	return (
		<Link href={GM.game(g.id)} className="bd-mission mi-row gm-row" data-state={g.status}>
			<span className="bd-mission-icon">
				<Icon name={g.category === "business" ? "coffee" : g.category === "personal" ? "gift" : "map-pin"} />
			</span>
			<span className="bd-mission-copy">
				<b>{g.title || "بازی بی‌نام"}</b>
				<small>
					{CATEGORY_LABEL[g.category]} · {fa(g.stages)} مرحله · {nextStep(g)}
				</small>
				<span className={`bd-tag mi-state gm-st-${g.status}`}>{STATUS_LABEL[g.status]}</span>
			</span>
			<Icon name="chevron-right" />
		</Link>
	);
}

/** Game Master home: my numbers, what needs me, and a way to make a new game. */
export function Dashboard() {
	const games = useMyGames();
	const dash = useDashboard();
	const list = games.data?.result?.games ?? [];
	const by = dash.data?.result?.by_status ?? {};
	const sum = (...keys: GameStatus[]) => keys.reduce((n, k) => n + (by[k] ?? 0), 0);
	const needsMe = list.filter((g) => ["changes_requested", "rejected", "approved"].includes(g.status) || g.latest_version?.status === "approved");
	return (
		<CreatorShell
			nav="home"
			title="داشبورد"
			actions={
				<Link href={GM.create} className="bd-action">
					<Icon name="plus" /> ساخت بازی
				</Link>
			}
		>
			<div className="gm-stats">
				{(
					[
						["همهٔ بازی‌ها", list.length, "list"],
						["پیش‌نویس", sum("draft"), "pencil"],
						["در بررسی", sum("submitted"), "hourglass"],
						["منتشرشده", sum("published", "scheduled"), "badge-check"],
						["بازیکنان", dash.data?.result?.players ?? 0, "users"],
						["به پایان رسیده", dash.data?.result?.completed ?? 0, "trophy"],
					] as [string, number, IconName][]
				).map(([label, n, icon]) => (
					<div key={label} className="bd-panel gm-stat">
						<Icon name={icon} />
						<b>{fa(n)}</b>
						<small>{label}</small>
					</div>
				))}
			</div>
			<LoadState loading={games.isLoading} error={games.error} onRetry={games.refetch} />
			{needsMe.length ? (
				<Panel title="منتظر توست">
					<div className="bd-mission-list">
						{needsMe.map((g) => (
							<GameRow key={g.id} g={g} />
						))}
					</div>
				</Panel>
			) : null}
			{games.data && !list.length ? (
				<EmptyState
					icon="sparkles"
					title="هنوز بازی‌ای نساخته‌ای"
					text="یک قالب انتخاب کن: تولد معمایی، چالش QR فروشگاه، گنج‌یابی شهری یا مسابقه."
					action={
						<Link href={GM.create} className="bd-action">
							ساخت اولین بازی <Icon name="arrow-right" />
						</Link>
					}
				/>
			) : null}
			{list.length ? (
				<Panel title="آخرین بازی‌ها" headExtra={<Link href={GM.games} className="bd-text-btn">همه →</Link>}>
					<div className="bd-mission-list">
						{list.slice(0, 5).map((g) => (
							<GameRow key={g.id} g={g} />
						))}
					</div>
				</Panel>
			) : null}
		</CreatorShell>
	);
}

type Filter = "all" | "draft" | "review" | "live" | "archived";
const FILTERS: [Filter, string][] = [
	["all", "همه"],
	["draft", "پیش‌نویس"],
	["review", "بررسی"],
	["live", "منتشرشده"],
	["archived", "بایگانی"],
];
const IN: Record<Exclude<Filter, "all">, GameStatus[]> = {
	draft: ["draft", "changes_requested", "rejected"],
	review: ["submitted", "approved"],
	live: ["published", "scheduled", "paused"],
	archived: ["archived"],
};

export function GamesList() {
	const { data, isLoading, error, refetch } = useMyGames();
	const [filter, setFilter] = useState<Filter>("all");
	const list = (data?.result?.games ?? []).filter((g) => filter === "all" || IN[filter].includes(g.status));
	return (
		<CreatorShell
			nav="games"
			title="بازی‌های من"
			actions={
				<Link href={GM.create} className="bd-action">
					<Icon name="plus" /> ساخت بازی
				</Link>
			}
		>
			<Chips label="وضعیت بازی‌ها" value={filter} onChange={setFilter} options={FILTERS} />
			<LoadState loading={isLoading} error={error} onRetry={refetch} />
			{data && !list.length ? <EmptyState title="بازی‌ای اینجا نیست" text="بازی‌های این وضعیت اینجا نشان داده می‌شوند." /> : null}
			{list.length ? (
				<div className="bd-panel bd-missions mi-list">
					<div className="bd-mission-list">
						{list.map((g) => (
							<GameRow key={g.id} g={g} />
						))}
					</div>
				</div>
			) : null}
		</CreatorShell>
	);
}

const CATEGORIES: [Category, string, string, IconName][] = [
	["business", "کسب‌وکار", "مشتری را با معما و QR به فروشگاهت بیاور.", "coffee"],
	["personal", "شخصی", "غافلگیری برای تولد یا سالگرد؛ فقط با لینک دعوت.", "gift"],
	["pro", "حرفه‌ای", "گنج‌یابی شهری، تور و مسابقه برای همه.", "map-pin"],
];

/** A new game: its kind, then a template (or an empty start). */
export function NewGame() {
	const router = useRouter();
	const templates = useTemplates();
	const [category, setCategory] = useState<Category | null>(null);
	const [busy, setBusy] = useState<string | null>(null);
	const [problem, setProblem] = useState<string | null>(null);
	const create = async (template: string | null) => {
		if (!category) return;
		setBusy(template ?? "empty");
		setProblem(null);
		try {
			const { game } = await createGame(category, template);
			router.replace(GM.game(game.id));
		} catch (e) {
			setProblem(gameErrorMessage(e));
			setBusy(null);
		}
	};
	const shown = (templates.data?.result?.templates ?? []).filter((t) => !category || t.category === category || category === "pro");
	return (
		<CreatorShell nav="create" title="ساخت بازی">
			<Panel title="۱. چه نوع بازی‌ای؟">
				<div className="gm-choice-grid" role="radiogroup" aria-label="نوع بازی">
					{CATEGORIES.map(([value, label, text, icon]) => (
						<button key={value} type="button" role="radio" aria-checked={category === value} className="gm-choice" onClick={() => setCategory(value)}>
							<Icon name={icon} />
							<b>{label}</b>
							<small>{text}</small>
						</button>
					))}
				</div>
			</Panel>
			{category ? (
				<Panel title="۲. از یک قالب شروع کن">
					<LoadState loading={templates.isLoading} error={templates.error} onRetry={templates.refetch} />
					<div className="gm-choice-grid">
						{shown.map((t) => (
							<button key={t.id} type="button" className="gm-choice gm-template" disabled={!!busy} onClick={() => void create(t.id)}>
								<Icon name={(t.icon as IconName) ?? "sparkles"} />
								<b>{t.name}</b>
								<small>
									{t.summary} · {fa(t.stages)} مرحله
								</small>
								{busy === t.id ? <Icon name="loader-circle" className="bd-spin" /> : null}
							</button>
						))}
						<button type="button" className="gm-choice gm-template" disabled={!!busy} onClick={() => void create(null)}>
							<Icon name="plus" />
							<b>بازی خالی</b>
							<small>از صفر؛ مرحله‌ها را خودت بساز.</small>
						</button>
					</div>
					{problem ? <Notice>{problem}</Notice> : null}
				</Panel>
			) : null}
		</CreatorShell>
	);
}

/** The creator's details and the way back to Player Mode. */
export function CreatorSettings() {
	const { data } = useGmProfile();
	const queryClient = useQueryClient();
	const toPlayer = usePlayerSwitch();
	const p = data?.result?.profile;
	const [name, setName] = useState<string | null>(null);
	const [phone, setPhone] = useState<string | null>(null);
	const [saved, setSaved] = useState<string | null>(null);
	const save = async () => {
		try {
			await saveProfile({ business_name: name ?? p?.business_name ?? "", business_phone: phone ?? p?.business_phone ?? "" });
			setSaved("ذخیره شد.");
			void queryClient.invalidateQueries();
		} catch (e) {
			setSaved(gameErrorMessage(e));
		}
	};
	return (
		<CreatorShell nav="settings" title="تنظیمات سازنده">
			<Panel title="مشخصات سازنده">
				<label className="rt-field">
					<span>نام کسب‌وکار یا سازنده</span>
					<input value={name ?? p?.business_name ?? ""} maxLength={120} onChange={(e) => setName(e.target.value)} />
				</label>
				<label className="rt-field">
					<span>تلفن کسب‌وکار</span>
					<input value={phone ?? p?.business_phone ?? ""} maxLength={20} dir="ltr" inputMode="tel" onChange={(e) => setPhone(e.target.value)} />
				</label>
				<small className="bd-muted">نام سازنده در بازی‌های منتشرشدهٔ بعدی به بازیکنان نشان داده می‌شود.</small>
				<div className="bd-actions">
					<button type="button" className="bd-action" onClick={() => void save()}>
						ذخیره
					</button>
				</div>
				{saved ? <Notice tone="info">{saved}</Notice> : null}
			</Panel>
			<Panel title="حالت برنامه">
				<p className="bd-muted">در حالت بازیکن، بازی‌ها را بازی می‌کنی؛ حسابت همان است و از حساب خارج نمی‌شوی.</p>
				<button type="button" className="bd-secondary" onClick={() => void toPlayer()}>
					<Icon name="gamepad-2" /> رفتن به حالت بازیکن
				</button>
			</Panel>
			<Panel title="قوانین">
				<p className="bd-muted">قوانین گیم مستر را {p?.onboarded ? "پذیرفته‌ای" : "هنوز نپذیرفته‌ای"}. هر بازی عمومی قبل از انتشار توسط بردینو بررسی می‌شود.</p>
			</Panel>
		</CreatorShell>
	);
}

export { dateText };
