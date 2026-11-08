"use client";

import { type ReactNode, useEffect, useMemo, useRef, useState } from "react";

import Link from "next/link";
import { useRouter } from "next/navigation";

import Icon, { type IconName } from "../Icon";
import { useBackHandler } from "../back";
import { fa } from "../format";
import { currentPosition, LocationError } from "../missions/mystery";
import { CopyButton, EmptyState, LoadState, Notice, Panel, R, usePoints } from "../ui";
import CreatorShell, { GM } from "./CreatorShell";
import {
	CATEGORY_LABEL,
	type Definition,
	type GameAction,
	type GameFull,
	STAGE_ICON,
	STAGE_LABEL,
	STATUS_LABEL,
	type Stage,
	type StageType,
	fieldsOf,
	gameAction,
	maxRun,
	payFee,
	newStage,
	previewStage,
	saveDraft,
	uploadImage,
	useAnalytics,
	useGame,
	useQrCodes,
} from "./api";
import { useQueryClient } from "@tanstack/react-query";

import { gameErrorMessage } from "@/api/games/request";

type Tab = "info" | "stages" | "audience" | "rewards" | "preview" | "publish" | "stats";
const TABS: [Tab, string][] = [
	["info", "۱. اطلاعات"],
	["stages", "۲. مرحله‌ها"],
	["audience", "۳. مخاطب و زمان"],
	["rewards", "۴. جایزه و بودجه"],
	["preview", "۵. امتحان"],
	["publish", "۶. ارسال و انتشار"],
	["stats", "آمار"],
];
const STAGE_TYPES: StageType[] = ["question", "choice", "puzzle", "qr", "location", "staff", "media", "reward"];
const STAGE_HELP: Record<StageType, string> = {
	question: "بازیکن جواب را می‌نویسد.",
	puzzle: "یک معما با جواب مشخص.",
	choice: "یک گزینهٔ درست از چند گزینه.",
	qr: "بازیکن QR محل را اسکن می‌کند (بعد از انتشار چاپش می‌کنی).",
	location: "گوشی بازیکن باید در شعاع محل باشد.",
	staff: "کارکنان محل یک کد به بازیکن می‌گویند.",
	media: "یک متن یا تصویر؛ بازیکن «ادامه» را می‌زند.",
	reward: "یک کد تخفیف یا پیام هدیه نشان داده می‌شود.",
};

const DIGITS = "۰۱۲۳۴۵۶۷۸۹";
const toLatin = (s: string) => s.replace(/[۰-۹]/g, (d) => String(DIGITS.indexOf(d))).replace(/٫/g, ".").replace(/،/g, ",");

/** «35.7001, 51.3912» (as copied from Google Maps or Neshan) → [lat, lng]. */
function parsePoint(text: string): [number, number] | null {
	const numbers = toLatin(text).match(/-?\d+(?:\.\d+)?/g);
	return numbers && numbers.length === 2 ? [Number(numbers[0]), Number(numbers[1])] : null;
}

const lines = (s: string) => s.split("\n").map((x) => x.trim()).filter(Boolean);

function Field({ label, hint, children }: { label: string; hint?: string; children: ReactNode }) {
	return (
		<label className="rt-field gm-field">
			<span>{label}</span>
			{children}
			{hint ? <small className="bd-muted">{hint}</small> : null}
		</label>
	);
}

function ImagePick({ value, onChange, disabled }: { value: string | null; onChange: (name: string | null) => void; disabled: boolean }) {
	const input = useRef<HTMLInputElement>(null);
	const [busy, setBusy] = useState(false);
	const [problem, setProblem] = useState<string | null>(null);
	return (
		<div className="gm-image">
			{value ? <img src={`/media/${value}`} alt="" /> : null}
			<input ref={input} type="file" accept="image/jpeg,image/png,image/webp" hidden onChange={async (e) => {
				const file = e.target.files?.[0];
				e.target.value = "";
				if (!file) return;
				setBusy(true);
				setProblem(null);
				try {
					onChange((await uploadImage(file)).name);
				} catch (err) {
					setProblem(gameErrorMessage(err));
				} finally {
					setBusy(false);
				}
			}} />
			<div className="bd-actions">
				<button type="button" className="bd-secondary" disabled={disabled || busy} onClick={() => input.current?.click()}>
					<Icon name={busy ? "loader-circle" : "image"} className={busy ? "bd-spin" : undefined} /> {value ? "عوض کردن تصویر" : "افزودن تصویر"}
				</button>
				{value ? (
					<button type="button" className="bd-text-btn" disabled={disabled} onClick={() => onChange(null)}>
						حذف تصویر
					</button>
				) : null}
			</div>
			{problem ? <Notice>{problem}</Notice> : null}
		</div>
	);
}

function PointField({ stage, set, disabled }: { stage: Stage; set: (patch: Partial<Stage>) => void; disabled: boolean }) {
	const [text, setText] = useState(stage.lat !== null && stage.lng !== null ? `${stage.lat}, ${stage.lng}` : "");
	const [problem, setProblem] = useState<string | null>(null);
	useEffect(() => setText(stage.lat !== null && stage.lng !== null ? `${stage.lat}, ${stage.lng}` : ""), [stage.id]); // eslint-disable-line react-hooks/exhaustive-deps
	const here = async () => {
		setProblem(null);
		try {
			const p = await currentPosition();
			const lat = Math.round(p.lat * 1e6) / 1e6;
			const lng = Math.round(p.lng * 1e6) / 1e6;
			setText(`${lat}, ${lng}`);
			set({ lat, lng });
		} catch (e) {
			setProblem(e instanceof LocationError ? e.message : "موقعیت پیدا نشد.");
		}
	};
	return (
		<div className="gm-point">
			<Field label="مختصات محل" hint="در گوگل‌مپ یا نشان روی محل نگه دار و عددها را اینجا بچسبان، یا وقتی آنجایی «موقعیت فعلی من» را بزن.">
				<input
					dir="ltr"
					value={text}
					disabled={disabled}
					placeholder="35.700100, 51.391200"
					onChange={(e) => {
						setText(e.target.value);
						const p = parsePoint(e.target.value);
						if (p) set({ lat: p[0], lng: p[1] });
						if (!e.target.value.trim()) set({ lat: null, lng: null });
					}}
				/>
			</Field>
			<div className="bd-actions">
				<button type="button" className="bd-secondary" disabled={disabled} onClick={() => void here()}>
					<Icon name="map-pin" /> موقعیت فعلی من
				</button>
				{stage.lat !== null && stage.lng !== null ? (
					<a className="bd-text-btn" href={`https://neshan.org/maps/@${stage.lat},${stage.lng},17z`} target="_blank" rel="noopener noreferrer">
						دیدن روی نقشه →
					</a>
				) : null}
			</div>
			<Field label="شعاع پذیرش (متر)" hint="وسط شهر ۸۰ تا ۱۵۰ متر مناسب است.">
				<input type="number" inputMode="numeric" min={20} max={2000} dir="ltr" value={stage.radius_m} disabled={disabled} onChange={(e) => set({ radius_m: Number(e.target.value) || 100 })} />
			</Field>
			{problem ? <Notice>{problem}</Notice> : null}
		</div>
	);
}

/** One stage, editable: what the player reads, how it is solved, and what it shows or gives after. */
function StageCard({
	stage,
	index,
	count,
	open,
	disabled,
	problems,
	onToggle,
	onChange,
	onMove,
	onCopy,
	onDelete,
}: {
	stage: Stage;
	index: number;
	count: number;
	open: boolean;
	disabled: boolean;
	problems: string[];
	onToggle: () => void;
	onChange: (patch: Partial<Stage>) => void;
	onMove: (to: number) => void;
	onCopy: () => void;
	onDelete: () => void;
}) {
	const t = stage.type;
	const answered = t === "question" || t === "puzzle";
	const atPlace = t === "qr" || t === "location" || t === "staff" || stage.check_location;
	return (
		<li className={`bd-panel gm-stage ${open ? "gm-stage-open" : ""}`} data-problem={problems.length ? true : undefined}>
			<div className="gm-stage-head">
				<button type="button" className="gm-stage-toggle" aria-expanded={open} onClick={onToggle}>
					<span className="gm-stage-num">{fa(index + 1)}</span>
					<Icon name={STAGE_ICON[t] as IconName} />
					<span>
						<b>{stage.title || STAGE_LABEL[t]}</b>
						<small>
							{STAGE_LABEL[t]}
							{stage.points ? ` · ${fa(stage.points)} امتیاز` : ""}
							{problems.length ? " · نیاز به تکمیل" : ""}
						</small>
					</span>
					<Icon name="chevron-down" />
				</button>
				<div className="gm-stage-tools">
					<button type="button" aria-label="بالاتر" disabled={disabled || index === 0} onClick={() => onMove(index - 1)}>
						↑
					</button>
					<button type="button" aria-label="پایین‌تر" disabled={disabled || index === count - 1} onClick={() => onMove(index + 1)}>
						↓
					</button>
					<button type="button" aria-label="کپی مرحله" disabled={disabled} onClick={onCopy}>
						<Icon name="copy" />
					</button>
					<button type="button" aria-label="حذف مرحله" disabled={disabled} onClick={onDelete}>
						<Icon name="trash-2" />
					</button>
				</div>
			</div>
			{open ? (
				<div className="gm-stage-body">
					{problems.length ? <Notice>{problems.join(" · ")}</Notice> : null}
					<Field label="نوع مرحله" hint={STAGE_HELP[t]}>
						<select
							value={t}
							disabled={disabled}
							onChange={(e) => {
								const type = e.target.value as StageType;
								onChange(type === "choice" && stage.options.length < 2 ? { type, options: ["", ""], answers: [] } : { type });
							}}
						>
							{STAGE_TYPES.map((x) => (
								<option key={x} value={x}>
									{STAGE_LABEL[x]}
								</option>
							))}
						</select>
					</Field>
					<Field label="عنوان">
						<input value={stage.title} maxLength={120} disabled={disabled} onChange={(e) => onChange({ title: e.target.value })} />
					</Field>
					<Field label={t === "media" || t === "reward" ? "متن" : "سرنخ / توضیح"} hint={atPlace ? "نام محل را اینجا ننویس؛ بعد از رسیدن نشان داده می‌شود." : undefined}>
						<textarea rows={3} maxLength={2000} value={stage.text} disabled={disabled} onChange={(e) => onChange({ text: e.target.value })} />
					</Field>
					<ImagePick value={stage.image} disabled={disabled} onChange={(image) => onChange({ image })} />
					{answered || t === "choice" ? (
						<Field label="پرسش">
							<input value={stage.question} maxLength={200} disabled={disabled} onChange={(e) => onChange({ question: e.target.value })} />
						</Field>
					) : null}
					{answered ? (
						<>
							<Field label="پاسخ درست" hint="هر شکل درست در یک خط (مثلاً ۱۳۰۵ و هزار و سیصد و پنج). فاصله و ی/ک فرقی نمی‌کند.">
								<textarea rows={2} value={stage.answers.join("\n")} disabled={disabled} onChange={(e) => onChange({ answers: lines(e.target.value) })} />
							</Field>
							<Field label="نوع پاسخ">
								<select value={stage.answer_type} disabled={disabled} onChange={(e) => onChange({ answer_type: e.target.value as "text" | "number" })}>
									<option value="text">متن</option>
									<option value="number">عدد (صفحه‌کلید عددی)</option>
								</select>
							</Field>
						</>
					) : null}
					{t === "choice" ? (
						<fieldset className="gm-options">
							<legend>گزینه‌ها (گزینهٔ درست را علامت بزن)</legend>
							{stage.options.map((o, i) => (
								<div key={i} className="gm-option">
									<input
										type="radio"
										name={`correct-${stage.id}`}
										aria-label={`گزینهٔ ${fa(i + 1)} درست است`}
										checked={!!o && stage.answers[0] === o}
										disabled={disabled || !o}
										onChange={() => onChange({ answers: [o] })}
									/>
									<input
										value={o}
										maxLength={100}
										disabled={disabled}
										placeholder={`گزینهٔ ${fa(i + 1)}`}
										onChange={(e) => {
											const options = [...stage.options];
											const was = options[i];
											options[i] = e.target.value;
											onChange({ options, answers: stage.answers[0] === was ? [e.target.value] : stage.answers });
										}}
									/>
									<button type="button" className="bd-text-btn" aria-label="حذف گزینه" disabled={disabled || stage.options.length <= 2} onClick={() => onChange({ options: stage.options.filter((_, j) => j !== i) })}>
										<Icon name="x" />
									</button>
								</div>
							))}
							{stage.options.length < 8 ? (
								<button type="button" className="bd-text-btn" disabled={disabled} onClick={() => onChange({ options: [...stage.options, ""] })}>
									<Icon name="plus" /> گزینهٔ دیگر
								</button>
							) : null}
						</fieldset>
					) : null}
					{t === "staff" ? (
						<Field label="کد کارکنان" hint="کدی که به کارکنان محل می‌دهی تا به بازیکنی که رسیده بگویند.">
							<input value={stage.staff_code} maxLength={40} disabled={disabled} onChange={(e) => onChange({ staff_code: e.target.value })} />
						</Field>
					) : null}
					{t === "question" || t === "puzzle" || t === "choice" || t === "staff" || t === "media" ? (
						<label className="gm-check">
							<input type="checkbox" checked={stage.check_location} disabled={disabled} onChange={(e) => onChange({ check_location: e.target.checked })} /> موقعیت گوشی هم سنجیده شود (بازیکن باید در محل باشد)
						</label>
					) : null}
					{t === "location" || stage.check_location ? <PointField stage={stage} disabled={disabled} set={onChange} /> : null}
					{atPlace ? (
						<fieldset className="gm-place">
							<legend>محل (بعد از رسیدن به بازیکن نشان داده می‌شود)</legend>
							<Field label="نام محل یا کسب‌وکار">
								<input value={stage.place.name} maxLength={120} disabled={disabled} onChange={(e) => onChange({ place: { ...stage.place, name: e.target.value } })} />
							</Field>
							<Field label="نشانی">
								<input value={stage.place.address} maxLength={250} disabled={disabled} onChange={(e) => onChange({ place: { ...stage.place, address: e.target.value } })} />
							</Field>
							<Field label="معرفی">
								<textarea rows={2} maxLength={1000} value={stage.place.about} disabled={disabled} onChange={(e) => onChange({ place: { ...stage.place, about: e.target.value } })} />
							</Field>
							<Field label="پیشنهاد ویژه" hint="مثلاً «۱۰٪ تخفیف با نشان دادن همین صفحه».">
								<input value={stage.place.offer} maxLength={200} disabled={disabled} onChange={(e) => onChange({ place: { ...stage.place, offer: e.target.value } })} />
							</Field>
							<Field label="سایت یا اینستاگرام">
								<input value={stage.place.url} maxLength={300} dir="ltr" disabled={disabled} onChange={(e) => onChange({ place: { ...stage.place, url: e.target.value } })} />
							</Field>
						</fieldset>
					) : null}
					{t !== "media" && t !== "reward" ? (
						<Field label="راهنمایی‌ها" hint="هر خط یک راهنمایی، از کم به زیاد. هر راهنمایی بخشی از امتیاز این مرحله را کم می‌کند.">
							<textarea rows={2} value={stage.hints.join("\n")} disabled={disabled} onChange={(e) => onChange({ hints: lines(e.target.value).slice(0, 6) })} />
						</Field>
					) : null}
					<div className="gm-row-2">
						<Field label="امتیاز این مرحله">
							<input type="number" inputMode="numeric" min={0} max={500} dir="ltr" value={stage.points} disabled={disabled} onChange={(e) => onChange({ points: Math.max(0, Number(e.target.value) || 0) })} />
						</Field>
						<Field label="مهلت (ثانیه، اختیاری)" hint="بعد از مهلت، مرحله امتیازی ندارد.">
							<input
								type="number"
								inputMode="numeric"
								min={10}
								dir="ltr"
								value={stage.time_limit_s ?? ""}
								disabled={disabled}
								onChange={(e) => onChange({ time_limit_s: e.target.value ? Number(e.target.value) : null })}
							/>
						</Field>
					</div>
					<Field label="کد تخفیف یا هدیه (اختیاری)" hint="بعد از حل این مرحله به بازیکن نشان داده می‌شود.">
						<input value={stage.coupon} maxLength={120} disabled={disabled} onChange={(e) => onChange({ coupon: e.target.value })} />
					</Field>
				</div>
			) : null}
		</li>
	);
}

/** Plays the draft stage by stage; the server checks each answer, nothing is recorded or paid. */
function PreviewRunner({ game }: { game: GameFull }) {
	const d = game.draft;
	const [i, setI] = useState(0);
	const [text, setText] = useState("");
	const [result, setResult] = useState<{ ok: boolean; message: string; coupon?: string } | null>(null);
	const [busy, setBusy] = useState(false);
	const [total, setTotal] = useState(0);
	const stage = d.stages[i];
	useEffect(() => {
		setText("");
		setResult(null);
	}, [i]);
	if (!d.stages.length) return <EmptyState icon="list" title="هنوز مرحله‌ای نیست" text="اول در «مرحله‌ها» چند مرحله بساز." />;
	if (!stage)
		return (
			<EmptyState
				icon="trophy"
				title="بازی تمام شد (امتحانی)"
				text={`${d.completion_message || "پیام پایان را در «جایزه و بودجه» بنویس."} · بازیکن تا ${fa(total + (d.finish_points || 0))} امتیاز می‌گرفت.`}
				action={
					<button type="button" className="bd-secondary" onClick={() => { setI(0); setTotal(0); }}>
						از اول
					</button>
				}
			/>
		);
	const check = async (extra: Record<string, unknown> = {}) => {
		setBusy(true);
		try {
			const r = await previewStage(game.id, { stage: stage.id, answer: text, code: text, ...extra });
			setResult(r);
			if (r.ok) setTotal((n) => n + (r.points || 0));
		} catch (e) {
			setResult({ ok: false, message: e instanceof LocationError ? e.message : gameErrorMessage(e) });
		} finally {
			setBusy(false);
		}
	};
	const t = stage.type;
	const needsHere = t === "location" || stage.check_location;
	return (
		<div className="gm-preview">
			<Notice tone="info">حالت امتحانی: هیچ امتیاز، بازدید یا پرداختی ثبت نمی‌شود. تغییرهای ذخیره‌شده را امتحان می‌کنی.</Notice>
			<p className="bd-muted">
				مرحلهٔ {fa(i + 1)} از {fa(d.stages.length)} · {STAGE_LABEL[t]}
			</p>
			{stage.title ? <h3>{stage.title}</h3> : null}
			{stage.text ? <p className="my-clue">{stage.text}</p> : null}
			{stage.image ? <img className="my-clue-image" src={`/media/${stage.image}`} alt="" /> : null}
			{stage.question ? <p><b>{stage.question}</b></p> : null}
			{t === "choice" ? (
				<div className="gm-choice-grid gm-options-play">
					{stage.options.filter(Boolean).map((o) => (
						<button key={o} type="button" className="gm-choice" aria-pressed={text === o} onClick={() => setText(o)}>
							{o}
						</button>
					))}
				</div>
			) : null}
			{t === "question" || t === "puzzle" || t === "staff" ? (
				<input className="gm-preview-input" value={text} onChange={(e) => setText(e.target.value)} placeholder={t === "staff" ? "کد کارکنان" : "جواب"} inputMode={stage.answer_type === "number" ? "numeric" : undefined} />
			) : null}
			{!result?.ok ? (
				<div className="bd-actions">
					{needsHere ? (
						<>
							<button type="button" className="bd-action" disabled={busy} onClick={() => void currentPosition().then((p) => check(p)).catch((e) => setResult({ ok: false, message: e instanceof LocationError ? e.message : "موقعیت پیدا نشد." }))}>
								<Icon name="map-pin" /> سنجش موقعیت من
							</button>
							<button type="button" className="bd-secondary" disabled={busy} onClick={() => void check({ simulate_location: true })}>
								فرض کن رسیده‌ام
							</button>
						</>
					) : (
						<button type="button" className="bd-action" disabled={busy || ((t === "question" || t === "puzzle" || t === "staff" || t === "choice") && !text.trim())} onClick={() => void check()}>
							{t === "qr" ? "فرض کن QR را اسکن کردم" : t === "media" || t === "reward" ? "ادامه" : "ثبت"}
						</button>
					)}
				</div>
			) : null}
			{result ? (
				<Notice tone={result.ok ? "ok" : "warn"}>
					{result.message}
					{result.ok && stage.points ? ` +${fa(stage.points)} امتیاز.` : ""}
					{result.ok && result.coupon ? ` کد هدیه: ${result.coupon}` : ""}
				</Notice>
			) : null}
			{result?.ok ? (
				<button type="button" className="bd-action" onClick={() => setI(i + 1)}>
					مرحلهٔ بعد <Icon name="arrow-right" />
				</button>
			) : null}
		</div>
	);
}

function problemText(path: string, message: string, d: Definition) {
	const m = path.match(/^stages\.(\d+)/);
	if (m) {
		const n = Number(m[1]);
		return `مرحلهٔ ${fa(n + 1)}${d.stages[n]?.title ? ` («${d.stages[n].title}»)` : ""}: ${message}`;
	}
	return message;
}

function Stats({ id }: { id: string }) {
	const { data, isLoading, error, refetch } = useAnalytics(id);
	const a = data?.result?.analytics;
	if (!a) return <LoadState loading={isLoading} error={error} onRetry={refetch} />;
	const top = Math.max(1, ...a.stages.map((s) => s.total));
	return (
		<>
			<div className="gm-stats">
				{(
					[
						["شروع کرده‌اند", a.started, "users"],
						["تمام کرده‌اند", a.completed, "trophy"],
						["امتیاز پرداخت‌شده", a.budget.spent, "coins"],
						["بودجهٔ مانده", a.budget.left, "wallet"],
					] as [string, number, IconName][]
				).map(([label, n, icon]) => (
					<div key={label} className="bd-panel gm-stat">
						<Icon name={icon} />
						<b>{fa(n)}</b>
						<small>{label}</small>
					</div>
				))}
			</div>
			<Panel title="هر مرحله">
				<ul className="gm-bars">
					{a.stages.map((s) => (
						<li key={s.order}>
							<span>
								{fa(s.order)}. {s.place}
								{s.verified_visit ? <em> · بازدید تأییدشده با QR</em> : null}
							</span>
							<span className="gm-bar" aria-hidden="true">
								<i style={{ width: `${(s.total / top) * 100}%` }} />
							</span>
							<b>{fa(s.total)}</b>
						</li>
					))}
				</ul>
				<small className="bd-muted">
					فقط اسکن QR در محل «بازدید تأییدشده» است؛ موقعیت گوشی یا جواب درست نشانهٔ رسیدن است، نه اثبات آن. آمار جمعی است و اطلاعات
					شخصی بازیکنان نشان داده نمی‌شود.
				</small>
			</Panel>
		</>
	);
}

/** The editor of one game: a step-by-step wizard, saved as you type. */
export default function Editor({ id }: { id: string }) {
	const router = useRouter();
	const queryClient = useQueryClient();
	const { data, isLoading, error, refetch } = useGame(id);
	const server = data?.result?.game ?? null;
	const points = usePoints();
	const [draft, setDraft] = useState<Definition | null>(null);
	const [tab, setTab] = useState<Tab>("info");
	const [open, setOpen] = useState<string | null>(null);
	const [save, setSave] = useState<{ state: "idle" | "pending" | "saving" | "saved" | "failed"; at?: string; error?: string }>({ state: "idle" });
	const [problems, setProblems] = useState<Record<string, string>>({});
	const [action, setAction] = useState<{ busy: GameAction | null; message: string | null; ok?: boolean }>({ busy: null, message: null });
	const [asking, setAsking] = useState<GameAction | null>(null);
	const timer = useRef<number>(0);
	const latest = useRef<Definition | null>(null);

	useEffect(() => {
		if (server && !draft) {
			setDraft(server.draft);
			setProblems(server.problems);
		}
	}, [server, draft]);

	const locked = !server || server.status === "submitted" || server.status === "archived" || server.latest_version?.status === "submitted";

	const flush = async () => {
		const d = latest.current;
		if (!d) return;
		latest.current = null;
		setSave({ state: "saving" });
		try {
			const { game } = await saveDraft(id, d);
			setProblems(game.problems);
			setSave({ state: "saved", at: new Date().toISOString() });
		} catch (e) {
			setSave({ state: "failed", error: gameErrorMessage(e) });
		}
	};

	const update = (next: Definition) => {
		setDraft(next);
		latest.current = next;
		setSave({ state: "pending" });
		window.clearTimeout(timer.current);
		timer.current = window.setTimeout(() => void flush(), 1200);
	};

	// Nothing typed is lost: a pending save goes out before leaving, and the browser asks meanwhile.
	useEffect(() => {
		const onLeave = (e: BeforeUnloadEvent) => {
			if (latest.current) {
				void flush();
				e.preventDefault();
			}
		};
		window.addEventListener("beforeunload", onLeave);
		return () => {
			window.removeEventListener("beforeunload", onLeave);
			if (latest.current) void flush();
		};
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, []);
	useBackHandler(!!asking, () => setAsking(null));

	const stageProblems = useMemo(() => {
		const out: Record<number, string[]> = {};
		for (const [k, v] of Object.entries(problems)) {
			const m = k.match(/^stages\.(\d+)/);
			if (m) (out[Number(m[1])] ??= []).push(v);
		}
		return out;
	}, [problems]);

	if (!server || !draft) {
		return (
			<CreatorShell nav="games" title="ویرایش بازی">
				<LoadState loading={isLoading} error={error} onRetry={refetch} />
			</CreatorShell>
		);
	}
	const d = draft;
	const set = (patch: Partial<Definition>) => update({ ...d, ...patch });
	const setStage = (i: number, patch: Partial<Stage>) => update({ ...d, stages: d.stages.map((s, j) => (j === i ? { ...s, ...patch } : s)) });
	const live = ["published", "scheduled", "paused"].includes(server.status);
	const run = maxRun(d);
	const funded = run > 0 ? Math.floor((d.budget_points || 0) / run) : null;

	const act = async (a: GameAction) => {
		setAsking(null);
		await flush();
		setAction({ busy: a, message: null });
		try {
			const { game } = await gameAction(id, a);
			if (a === "duplicate" && game) {
				router.push(GM.game(game.id));
				return;
			}
			if (game) {
				setProblems(game.problems);
				if (a === "submit") setDraft(game.draft);
			}
			const done: Record<GameAction, string> = {
				submit: "برای بررسی فرستاده شد. نتیجه را خبر می‌دهیم.",
				publish: "منتشر شد! حالا بازیکنان آن را می‌بینند.",
				pause: "متوقف شد.",
				resume: "دوباره باز شد.",
				archive: "بایگانی شد؛ باقی‌ماندهٔ بودجه به کیف امتیازت برگشت.",
				duplicate: "",
			};
			setAction({ busy: null, message: done[a], ok: true });
			void queryClient.invalidateQueries();
		} catch (e) {
			const fields = fieldsOf(e);
			if (Object.keys(fields).length) setProblems(fields);
			setAction({ busy: null, message: gameErrorMessage(e), ok: false });
		}
	};

	const pay = async () => {
		setAction({ busy: "publish", message: null });
		try {
			const { payment_url } = await payFee(id);
			window.location.assign(payment_url);
		} catch (e) {
			setAction({ busy: null, message: gameErrorMessage(e), ok: false });
		}
	};

	const v = server.latest_version;
	const saveText =
		save.state === "pending" || save.state === "saving"
			? "در حال ذخیره…"
			: save.state === "saved"
				? `ذخیره شد · ${new Intl.DateTimeFormat("fa-IR", { hour: "2-digit", minute: "2-digit" }).format(new Date(save.at!))}`
				: save.state === "failed"
					? `ذخیره نشد: ${save.error}`
					: server.draft_saved_at
						? "همه چیز ذخیره است"
						: "";

	return (
		<CreatorShell nav="games" title={d.title || "بازی بی‌نام"} actions={<span className={`bd-tag gm-st-${server.status}`}>{STATUS_LABEL[server.status]}</span>}>
			<div className="gm-editor-top">
				<Link href={GM.games} className="my-back">
					<Icon name="arrow-left" /> بازی‌های من
				</Link>
				<span className={`gm-save gm-save-${save.state}`} role="status">
					{saveText}
				</span>
			</div>
			{locked && server.status !== "archived" ? <Notice tone="info">این بازی در بررسی بردینو است و تا پایان بررسی ویرایش نمی‌شود.</Notice> : null}
			{live && !locked ? <Notice tone="info">این بازی منتشر شده است. تغییرها یک نسخهٔ تازه می‌سازند که بعد از تأیید بردینو جای نسخهٔ فعلی را می‌گیرد.</Notice> : null}
			<nav className="gm-tabs" aria-label="مراحل ساخت بازی">
				{TABS.filter(([k]) => k !== "stats" || live || server.status === "archived").map(([k, label]) => (
					<button key={k} type="button" aria-current={tab === k ? "step" : undefined} onClick={() => setTab(k)}>
						{label}
					</button>
				))}
			</nav>

			{tab === "info" ? (
				<Panel title="اطلاعات بازی">
					<p className="bd-muted">
						نوع: {CATEGORY_LABEL[server.category]}
						{server.category === "personal" ? " · فقط با لینک دعوت" : ""}
					</p>
					<Field label="عنوان">
						<input value={d.title} maxLength={120} disabled={locked} onChange={(e) => set({ title: e.target.value })} />
					</Field>
					<Field label="توضیح کوتاه">
						<input value={d.summary} maxLength={200} disabled={locked} onChange={(e) => set({ summary: e.target.value })} />
					</Field>
					<Field label="داستان شروع" hint="متنی که بازیکن قبل از اولین مرحله می‌خواند.">
						<textarea rows={4} maxLength={3000} value={d.story} disabled={locked} onChange={(e) => set({ story: e.target.value })} />
					</Field>
					<div className="gm-row-2">
						<Field label="محدوده" hint="مثلاً «محلهٔ تجریش»">
							<input value={d.area} maxLength={120} disabled={locked} onChange={(e) => set({ area: e.target.value })} />
						</Field>
						<Field label="زمان تقریبی (دقیقه)">
							<input type="number" inputMode="numeric" dir="ltr" min={1} value={d.duration_minutes ?? ""} disabled={locked} onChange={(e) => set({ duration_minutes: e.target.value ? Number(e.target.value) : null })} />
						</Field>
					</div>
					<Field label="ارائه‌دهنده" hint="نام کسب‌وکار یا سازنده که به بازیکنان نشان داده می‌شود.">
						<input value={d.presenter} maxLength={120} disabled={locked} onChange={(e) => set({ presenter: e.target.value })} />
					</Field>
					<Field label="تصویر بازی">
						<ImagePick value={d.cover} disabled={locked} onChange={(cover) => set({ cover })} />
					</Field>
					<button type="button" className="bd-action" onClick={() => setTab("stages")}>
						بعدی: مرحله‌ها <Icon name="arrow-right" />
					</button>
				</Panel>
			) : null}

			{tab === "stages" ? (
				<>
					<ol className="gm-stage-list">
						{d.stages.map((s, i) => (
							<StageCard
								key={s.id}
								stage={s}
								index={i}
								count={d.stages.length}
								open={open === s.id}
								disabled={locked}
								problems={stageProblems[i] ?? []}
								onToggle={() => setOpen(open === s.id ? null : s.id)}
								onChange={(patch) => setStage(i, patch)}
								onMove={(to) => {
									const stages = [...d.stages];
									const [moved] = stages.splice(i, 1);
									stages.splice(to, 0, moved);
									update({ ...d, stages });
								}}
								onCopy={() => {
									const copy = { ...s, id: `s${Date.now().toString(36)}`, title: `${s.title} (کپی)`.slice(0, 120) };
									const stages = [...d.stages];
									stages.splice(i + 1, 0, copy);
									update({ ...d, stages });
								}}
								onDelete={() => {
									if (window.confirm(`«${s.title || STAGE_LABEL[s.type]}» حذف شود؟`)) update({ ...d, stages: d.stages.filter((_, j) => j !== i) });
								}}
							/>
						))}
					</ol>
					{d.stages.length < 20 && !locked ? (
						<Panel title="افزودن مرحله">
							<div className="gm-add-grid">
								{STAGE_TYPES.map((t) => (
									<button
										key={t}
										type="button"
										className="gm-add"
										onClick={() => {
											const s = newStage(t, d.stages.length + 1);
											update({ ...d, stages: [...d.stages, s] });
											setOpen(s.id);
										}}
									>
										<Icon name={STAGE_ICON[t] as IconName} />
										<b>{STAGE_LABEL[t]}</b>
										<small>{STAGE_HELP[t]}</small>
									</button>
								))}
							</div>
						</Panel>
					) : null}
					<button type="button" className="bd-action" onClick={() => setTab("audience")}>
						بعدی: مخاطب و زمان <Icon name="arrow-right" />
					</button>
				</>
			) : null}

			{tab === "audience" ? (
				<Panel title="مخاطب و زمان">
					<Field label="دسترسی" hint={server.category === "personal" ? "بازی شخصی همیشه خصوصی است." : "خصوصی: فقط کسی که لینک دعوت را دارد."}>
						<select value={d.access} disabled={locked || server.category === "personal"} onChange={(e) => set({ access: e.target.value as "public" | "private" })}>
							<option value="public">عمومی (بعد از تأیید بردینو در گیمنت و دریافت امتیاز)</option>
							<option value="private">خصوصی (فقط با لینک دعوت)</option>
						</select>
					</Field>
					<div className="gm-row-2">
						<Field label="حداقل سن (اختیاری)">
							<input type="number" inputMode="numeric" dir="ltr" min={7} max={120} value={d.audience.age_min ?? ""} disabled={locked} onChange={(e) => set({ audience: { ...d.audience, age_min: e.target.value ? Number(e.target.value) : null } })} />
						</Field>
						<Field label="حداکثر سن (اختیاری)">
							<input type="number" inputMode="numeric" dir="ltr" min={7} max={120} value={d.audience.age_max ?? ""} disabled={locked} onChange={(e) => set({ audience: { ...d.audience, age_max: e.target.value ? Number(e.target.value) : null } })} />
						</Field>
					</div>
					<Field label="مخاطب" hint="بر اساس اطلاعاتی که خود بازیکن در پروفایلش وارد کرده؛ بازیکن بدون آن اطلاعات، بازی‌های محدودشده را نمی‌بیند.">
						<select value={d.audience.gender} disabled={locked} onChange={(e) => set({ audience: { ...d.audience, gender: e.target.value as "" | "M" | "F" } })}>
							<option value="">همه</option>
							<option value="F">خانم‌ها</option>
							<option value="M">آقایان</option>
						</select>
					</Field>
					<div className="gm-row-2">
						<Field label="شروع (اختیاری)">
							<input type="datetime-local" dir="ltr" value={d.starts_at ? d.starts_at.slice(0, 16) : ""} disabled={locked} onChange={(e) => set({ starts_at: e.target.value ? new Date(e.target.value).toISOString() : null })} />
						</Field>
						<Field label="پایان (اختیاری)">
							<input type="datetime-local" dir="ltr" value={d.ends_at ? d.ends_at.slice(0, 16) : ""} disabled={locked} onChange={(e) => set({ ends_at: e.target.value ? new Date(e.target.value).toISOString() : null })} />
						</Field>
					</div>
					<Field label="ظرفیت بازیکنان (اختیاری)" hint="خالی = تا جایی که بودجه اجازه بدهد.">
						<input type="number" inputMode="numeric" dir="ltr" min={1} value={d.capacity ?? ""} disabled={locked} onChange={(e) => set({ capacity: e.target.value ? Number(e.target.value) : null })} />
					</Field>
					<button type="button" className="bd-action" onClick={() => setTab("rewards")}>
						بعدی: جایزه و بودجه <Icon name="arrow-right" />
					</button>
				</Panel>
			) : null}

			{tab === "rewards" ? (
				<Panel title="جایزه و بودجه">
					<div className="gm-row-2">
						<Field label="جایزهٔ پایان (امتیاز)">
							<input type="number" inputMode="numeric" dir="ltr" min={0} max={500} value={d.finish_points} disabled={locked} onChange={(e) => set({ finish_points: Math.max(0, Number(e.target.value) || 0) })} />
						</Field>
						<Field label="هزینهٔ هر راهنمایی (درصد)">
							<input type="number" inputMode="numeric" dir="ltr" min={0} max={100} value={d.hint_penalty} disabled={locked} onChange={(e) => set({ hint_penalty: Math.min(100, Math.max(0, Number(e.target.value) || 0)) })} />
						</Field>
					</div>
					<Field label="پیام پایان" hint="بعد از آخرین مرحله به بازیکن نشان داده می‌شود.">
						<textarea rows={2} maxLength={1000} value={d.completion_message} disabled={locked} onChange={(e) => set({ completion_message: e.target.value })} />
					</Field>
					<Field label="بودجهٔ امتیاز جایزه‌ها" hint="هنگام انتشار از کیف امتیاز تو کنار گذاشته می‌شود؛ باقی‌مانده در پایان بازی برمی‌گردد.">
						<input type="number" inputMode="numeric" dir="ltr" min={0} value={d.budget_points} disabled={locked} onChange={(e) => set({ budget_points: Math.max(0, Number(e.target.value) || 0) })} />
					</Field>
					<ul className="gm-budget-facts">
						<li>
							بیشترین جایزهٔ یک بازیکن: <b>{fa(run)}</b> امتیاز
						</li>
						<li>{funded === null ? "این بازی امتیازی نمی‌دهد؛ بودجه لازم نیست." : <>این بودجه جایزهٔ کامل <b>{fa(funded)}</b> بازیکن را می‌پردازد.</>}</li>
						<li>
							موجودی امتیاز تو: <b>{fa(points.points ?? 0)}</b>
						</li>
					</ul>
					{run > 0 && (d.budget_points || 0) < run ? <Notice>بودجه دست‌کم باید به اندازهٔ جایزهٔ یک بازیکن ({fa(run)}) باشد.</Notice> : null}
					<button type="button" className="bd-action" onClick={() => setTab("preview")}>
						بعدی: امتحان بازی <Icon name="arrow-right" />
					</button>
				</Panel>
			) : null}

			{tab === "preview" ? (
				<Panel title="امتحان بازی">
					<PreviewRunner game={{ ...server, draft: d }} />
				</Panel>
			) : null}

			{tab === "publish" ? (
				<Panel title="ارسال و انتشار">
					{v ? (
						<div className="gm-version">
							<p>
								آخرین نسخه: <b>{fa(v.number)}</b> · {STATUS_LABEL[(v.status === "superseded" ? "archived" : v.status) as keyof typeof STATUS_LABEL] ?? v.status}
							</p>
							{v.review_note ? <Notice tone={v.status === "approved" ? "ok" : "warn"}>پیام بردینو: {v.review_note}</Notice> : null}
						</div>
					) : null}
					{Object.keys(problems).length && !live ? (
						<div className="gm-problems">
							<b>قبل از ارسال، این‌ها را کامل کن:</b>
							<ul>
								{Object.entries(problems).map(([k, msg]) => (
									<li key={k}>{problemText(k, msg, d)}</li>
								))}
							</ul>
						</div>
					) : null}
					{!locked && server.status !== "archived" && !(v?.status === "approved") ? (
						<button type="button" className="bd-action" disabled={!!action.busy || !!Object.keys(problems).length} onClick={() => void act("submit")}>
							<Icon name="shield-check" /> {live ? "فرستادن نسخهٔ تازه برای بررسی" : "فرستادن برای بررسی بردینو"}
						</button>
					) : null}
					{v?.status === "approved" ? (
						<div className="gm-publish">
							<p>
								بردینو این نسخه را تأیید کرده است.
								{v.fee_toman ? ` هزینهٔ انتشار: ${fa(v.fee_toman)} تومان${v.fee_paid ? " (پرداخت شد)" : ""}.` : " انتشار هزینه‌ای ندارد."}
								{d.budget_points ? ` با انتشار، ${fa(d.budget_points)} امتیاز برای جایزه‌ها از کیف امتیازت کنار گذاشته می‌شود.` : ""}
							</p>
							{v.fee_toman && !v.fee_paid ? (
								<button type="button" className="bd-action" disabled={!!action.busy} onClick={() => void pay()}>
									<Icon name="banknote" /> پرداخت هزینهٔ انتشار ({fa(v.fee_toman)} تومان)
								</button>
							) : asking === "publish" ? (
								<div className="my-hint-ask">
									<span>مطمئنی؟ بازی برای بازیکنان باز می‌شود{d.budget_points ? ` و ${fa(d.budget_points)} امتیاز کنار گذاشته می‌شود` : ""}.</span>
									<button type="button" className="bd-action" disabled={!!action.busy} onClick={() => void act("publish")}>
										انتشار
									</button>
									<button type="button" className="bd-secondary" onClick={() => setAsking(null)}>
										نه
									</button>
								</div>
							) : (
								<button type="button" className="bd-action" disabled={!!action.busy} onClick={() => setAsking("publish")}>
									<Icon name="rocket" /> انتشار بازی
								</button>
							)}
						</div>
					) : null}
					{live ? <LiveTools game={server} busy={action.busy} onAct={(a) => void act(a)} /> : null}
					{action.message ? <Notice tone={action.ok ? "ok" : "warn"}>{action.message}</Notice> : null}
					<div className="gm-secondary-actions">
						<button type="button" className="bd-text-btn" disabled={!!action.busy} onClick={() => void act("duplicate")}>
							<Icon name="copy" /> کپی این بازی
						</button>
						{server.status !== "archived" ? (
							asking === "archive" ? (
								<div className="my-hint-ask">
									<span>بایگانی یعنی پایان بازی برای همه؛ باقی‌ماندهٔ بودجه برمی‌گردد. ادامه؟</span>
									<button type="button" className="bd-action" onClick={() => void act("archive")}>
										بایگانی
									</button>
									<button type="button" className="bd-secondary" onClick={() => setAsking(null)}>
										نه
									</button>
								</div>
							) : (
								<button type="button" className="bd-text-btn" disabled={!!action.busy} onClick={() => setAsking("archive")}>
									<Icon name="inbox" /> بایگانی
								</button>
							)
						) : null}
					</div>
				</Panel>
			) : null}

			{tab === "stats" ? <Stats id={id} /> : null}
		</CreatorShell>
	);
}

/** A live game: where players see it, its invite link and QR codes, pause / resume. */
function LiveTools({ game, busy, onAct }: { game: GameFull; busy: GameAction | null; onAct: (a: GameAction) => void }) {
	const qr = useQrCodes(game.id);
	const codes = qr.data?.result?.qr ?? [];
	return (
		<div className="gm-live">
			<p>
				{game.status === "paused" ? "متوقف است." : game.status === "scheduled" ? "منتشر شده و از زمان شروع باز می‌شود." : "برای بازیکنان باز است."}
				{game.budget ? ` بودجه: ${fa(game.budget.spent)} پرداخت‌شده از ${fa(game.budget.reserved)}.` : ""}
			</p>
			<div className="bd-actions">
				{game.mystery_id ? (
					<Link className="bd-secondary" href={R.mystery(game.mystery_id)}>
						<Icon name="eye" /> دیدن مثل بازیکن
					</Link>
				) : null}
				{game.status === "paused" ? (
					<button type="button" className="bd-action" disabled={!!busy || game.paused_by_admin} onClick={() => onAct("resume")}>
						<Icon name="play" /> ادامهٔ بازی
					</button>
				) : (
					<button type="button" className="bd-secondary" disabled={!!busy} onClick={() => onAct("pause")}>
						<Icon name="pause" /> توقف موقت
					</button>
				)}
			</div>
			{game.paused_by_admin ? <Notice>بردینو این بازی را متوقف کرده است.</Notice> : null}
			{game.invite_url ? (
				<div className="gm-invite">
					<b>لینک دعوت</b>
					<code dir="ltr">{game.invite_url}</code>
					<CopyButton text={game.invite_url} label="کپی لینک دعوت" />
				</div>
			) : null}
			{codes.length ? (
				<div className="gm-qr-list">
					<b>QR محل‌ها (چاپ کن و در محل بگذار)</b>
					{codes.map((c) => (
						<figure key={c.order} className="gm-qr">
							<span dangerouslySetInnerHTML={{ __html: c.svg }} />
							<figcaption>
								مرحلهٔ {fa(c.order)} · {c.place}
							</figcaption>
							<a className="bd-text-btn" download={`qr-${c.order}.svg`} href={`data:image/svg+xml;charset=utf-8,${encodeURIComponent(c.svg)}`}>
								دانلود
							</a>
						</figure>
					))}
				</div>
			) : null}
		</div>
	);
}
