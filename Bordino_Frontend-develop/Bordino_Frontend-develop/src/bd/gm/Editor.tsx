"use client";

import { type ReactNode, useEffect, useMemo, useRef, useState } from "react";

import dynamic from "next/dynamic";
import Link from "next/link";
import { useRouter } from "next/navigation";

import Icon, { type IconName } from "../Icon";
import { useBackHandler } from "../back";
import { fa } from "../format";
import { LocationError, currentPosition } from "../missions/mystery";
import {
	CopyButton,
	EmptyState,
	LoadState,
	Notice,
	Panel,
	R,
	usePoints,
} from "../ui";
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
	newStage,
	payFee,
	previewStage,
	saveDraft,
	uploadImage,
	useAnalytics,
	type ShareInfo,
	useGame,
	useGameBoard,
	useGmOptions,
	useQrCodes,
	useShare,
} from "./api";
import AvailabilitySetup from "./AvailabilitySetup";
import BoardSetup from "./BoardSetup";
import { LeaderList } from "../board";
import { useQueryClient } from "@tanstack/react-query";

import { gameErrorMessage } from "@/api/games/request";

type Tab =
	| "info"
	| "stages"
	| "board"
	| "audience"
	| "rewards"
	| "preview"
	| "publish"
	| "stats";
const TABS: [Tab, string][] = [
	["info", "۱. اطلاعات"],
	["stages", "۲. مرحله‌ها"],
	["board", "۳. رقابت و جدول"],
	["audience", "۴. مخاطب و زمان"],
	["rewards", "۵. جایزه و بودجه"],
	["preview", "۶. امتحان"],
	["publish", "۷. ارسال و انتشار"],
	["stats", "آمار"],
];
const STAGE_TYPES: StageType[] = [
	"question",
	"choice",
	"puzzle",
	"qr",
	"location",
	"staff",
	"media",
	"reward",
];
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

// The map (Leaflet) only in the browser, and only once a stage's place is edited.
const MapPicker = dynamic(() => import("./MapPicker"), {
	ssr: false,
	loading: () => (
		<div className="gm-map gm-map-loading">در حال باز کردن نقشه…</div>
	),
});

const DIGITS = "۰۱۲۳۴۵۶۷۸۹";
const toLatin = (s: string) =>
	s
		.replace(/[۰-۹]/g, (d) => String(DIGITS.indexOf(d)))
		.replace(/٫/g, ".")
		.replace(/،/g, ",");

/** «35.7001, 51.3912» (as copied from Google Maps or Neshan) → [lat, lng]. */
function parsePoint(text: string): [number, number] | null {
	const numbers = toLatin(text).match(/-?\d+(?:\.\d+)?/g);
	return numbers && numbers.length === 2
		? [Number(numbers[0]), Number(numbers[1])]
		: null;
}

const lines = (s: string) =>
	s
		.split("\n")
		.map((x) => x.trim())
		.filter(Boolean);

function Field({
	label,
	hint,
	children,
}: {
	label: string;
	hint?: string;
	children: ReactNode;
}) {
	return (
		<label className="rt-field gm-field">
			<span>{label}</span>
			{children}
			{hint ? <small className="bd-muted">{hint}</small> : null}
		</label>
	);
}

function ImagePick({
	value,
	onChange,
	disabled,
}: {
	value: string | null;
	onChange: (name: string | null) => void;
	disabled: boolean;
}) {
	const input = useRef<HTMLInputElement>(null);
	const [busy, setBusy] = useState(false);
	const [problem, setProblem] = useState<string | null>(null);
	return (
		<div className="gm-image">
			{value ? <img src={`/media/${value}`} alt="" /> : null}
			<input
				ref={input}
				type="file"
				accept="image/jpeg,image/png,image/webp"
				hidden
				onChange={async (e) => {
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
				}}
			/>
			<div className="bd-actions">
				<button
					type="button"
					className="bd-secondary"
					disabled={disabled || busy}
					onClick={() => input.current?.click()}
				>
					<Icon
						name={busy ? "loader-circle" : "image"}
						className={busy ? "bd-spin" : undefined}
					/>{" "}
					{value ? "عوض کردن تصویر" : "افزودن تصویر"}
				</button>
				{value ? (
					<button
						type="button"
						className="bd-text-btn"
						disabled={disabled}
						onClick={() => onChange(null)}
					>
						حذف تصویر
					</button>
				) : null}
			</div>
			<small className="bd-muted gm-copyright">
				فقط تصویری که خودت گرفته‌ای یا اجازهٔ استفاده‌اش را داری؛ حق نشر دیگران
				را رعایت کن.
			</small>
			{problem ? <Notice>{problem}</Notice> : null}
		</div>
	);
}

function PointField({
	stage,
	set,
	disabled,
}: {
	stage: Stage;
	set: (patch: Partial<Stage>) => void;
	disabled: boolean;
}) {
	const [text, setText] = useState(
		stage.lat !== null && stage.lng !== null
			? `${stage.lat}, ${stage.lng}`
			: "",
	);
	const [problem, setProblem] = useState<string | null>(null);
	useEffect(
		() =>
			setText(
				stage.lat !== null && stage.lng !== null
					? `${stage.lat}, ${stage.lng}`
					: "",
			),
		[stage.id],
	); // eslint-disable-line react-hooks/exhaustive-deps
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
			<div className="gm-field">
				<span>محل روی نقشه</span>
				<MapPicker
					lat={stage.lat}
					lng={stage.lng}
					radius={stage.radius_m}
					disabled={disabled}
					onPick={(lat, lng) => {
						setText(`${lat}, ${lng}`);
						set({ lat, lng });
					}}
				/>
				<small className="bd-muted">
					روی نقشه بزن تا نشانگر آنجا برود، یا نشانگر را بکش. دایره، شعاعی است
					که بازیکن باید در آن باشد.
				</small>
			</div>
			<Field
				label="مختصات محل"
				hint="یا عددها را از گوگل‌مپ یا نشان اینجا بچسبان، یا وقتی آنجایی «موقعیت فعلی من» را بزن."
			>
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
				<button
					type="button"
					className="bd-secondary"
					disabled={disabled}
					onClick={() => void here()}
				>
					<Icon name="map-pin" /> موقعیت فعلی من
				</button>
				{stage.lat !== null && stage.lng !== null ? (
					<a
						className="bd-text-btn"
						href={`https://neshan.org/maps/@${stage.lat},${stage.lng},17z`}
						target="_blank"
						rel="noopener noreferrer"
					>
						دیدن روی نقشه →
					</a>
				) : null}
			</div>
			<Field label="شعاع پذیرش (متر)" hint="وسط شهر ۸۰ تا ۱۵۰ متر مناسب است.">
				<input
					type="number"
					inputMode="numeric"
					min={20}
					max={2000}
					dir="ltr"
					value={stage.radius_m}
					disabled={disabled}
					onChange={(e) => set({ radius_m: Number(e.target.value) || 100 })}
				/>
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
	const atPlace =
		t === "qr" || t === "location" || t === "staff" || stage.check_location;
	return (
		<li
			id={`gm-stage-${stage.id}`}
			className={`bd-panel gm-stage ${open ? "gm-stage-open" : ""}`}
			data-problem={problems.length ? true : undefined}
		>
			<div className="gm-stage-head">
				<button
					type="button"
					className="gm-stage-toggle"
					aria-expanded={open}
					onClick={onToggle}
				>
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
					<button
						type="button"
						aria-label="بالاتر"
						disabled={disabled || index === 0}
						onClick={() => onMove(index - 1)}
					>
						↑
					</button>
					<button
						type="button"
						aria-label="پایین‌تر"
						disabled={disabled || index === count - 1}
						onClick={() => onMove(index + 1)}
					>
						↓
					</button>
					<button
						type="button"
						aria-label="کپی مرحله"
						disabled={disabled}
						onClick={onCopy}
					>
						<Icon name="copy" />
					</button>
					<button
						type="button"
						aria-label="حذف مرحله"
						disabled={disabled}
						onClick={onDelete}
					>
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
								onChange(
									type === "choice" && stage.options.length < 2
										? { type, options: ["", ""], answers: [] }
										: { type },
								);
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
						<input
							value={stage.title}
							maxLength={120}
							disabled={disabled}
							onChange={(e) => onChange({ title: e.target.value })}
						/>
					</Field>
					<Field
						label={t === "media" || t === "reward" ? "متن" : "سرنخ / توضیح"}
						hint={
							atPlace
								? "نام محل را اینجا ننویس؛ بعد از رسیدن نشان داده می‌شود."
								: undefined
						}
					>
						<textarea
							rows={3}
							maxLength={2000}
							value={stage.text}
							disabled={disabled}
							onChange={(e) => onChange({ text: e.target.value })}
						/>
					</Field>
					<ImagePick
						value={stage.image}
						disabled={disabled}
						onChange={(image) => onChange({ image })}
					/>
					{answered || t === "choice" ? (
						<Field label="پرسش">
							<input
								value={stage.question}
								maxLength={200}
								disabled={disabled}
								onChange={(e) => onChange({ question: e.target.value })}
							/>
						</Field>
					) : null}
					{answered ? (
						<>
							<Field
								label="پاسخ درست"
								hint="هر شکل درست در یک خط (مثلاً ۱۳۰۵ و هزار و سیصد و پنج). فاصله و ی/ک فرقی نمی‌کند."
							>
								<textarea
									rows={2}
									value={stage.answers.join("\n")}
									disabled={disabled}
									onChange={(e) => onChange({ answers: lines(e.target.value) })}
								/>
							</Field>
							<Field label="نوع پاسخ">
								<select
									value={stage.answer_type}
									disabled={disabled}
									onChange={(e) =>
										onChange({
											answer_type: e.target.value as "text" | "number",
										})
									}
								>
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
											onChange({
												options,
												answers:
													stage.answers[0] === was
														? [e.target.value]
														: stage.answers,
											});
										}}
									/>
									<button
										type="button"
										className="bd-text-btn"
										aria-label="حذف گزینه"
										disabled={disabled || stage.options.length <= 2}
										onClick={() =>
											onChange({
												options: stage.options.filter((_, j) => j !== i),
											})
										}
									>
										<Icon name="x" />
									</button>
								</div>
							))}
							{stage.options.length < 8 ? (
								<button
									type="button"
									className="bd-text-btn"
									disabled={disabled}
									onClick={() => onChange({ options: [...stage.options, ""] })}
								>
									<Icon name="plus" /> گزینهٔ دیگر
								</button>
							) : null}
						</fieldset>
					) : null}
					{t === "qr" ? (
						<label className="gm-check">
							<input
								type="checkbox"
								checked={!!stage.qr_rotating}
								disabled={disabled}
								onChange={(e) => onChange({ qr_rotating: e.target.checked })}
							/>{" "}
							QR متغیر روی نمایشگر محل (امن‌تر: تبلت یا تلویزیون محل هر ۳۰ ثانیه
							QR تازه نشان می‌دهد و عکسش به درد نمی‌خورد؛ فقط این بازدیدها
							«تأییدشده» شمرده می‌شوند)
						</label>
					) : null}
					{t === "staff" ? (
						<Field
							label="کد کارکنان"
							hint="کدی که به کارکنان محل می‌دهی تا به بازیکنی که رسیده بگویند."
						>
							<input
								value={stage.staff_code}
								maxLength={40}
								disabled={disabled}
								onChange={(e) => onChange({ staff_code: e.target.value })}
							/>
						</Field>
					) : null}
					{t === "question" ||
					t === "puzzle" ||
					t === "choice" ||
					t === "staff" ||
					t === "media" ? (
						<label className="gm-check">
							<input
								type="checkbox"
								checked={stage.check_location}
								disabled={disabled}
								onChange={(e) => onChange({ check_location: e.target.checked })}
							/>{" "}
							موقعیت گوشی هم سنجیده شود (بازیکن باید در محل باشد)
						</label>
					) : null}
					{t === "location" || stage.check_location ? (
						<PointField stage={stage} disabled={disabled} set={onChange} />
					) : null}
					{atPlace ? (
						<fieldset className="gm-place">
							<legend>محل (بعد از رسیدن به بازیکن نشان داده می‌شود)</legend>
							<Field label="نام محل یا کسب‌وکار">
								<input
									value={stage.place.name}
									maxLength={120}
									disabled={disabled}
									onChange={(e) =>
										onChange({
											place: { ...stage.place, name: e.target.value },
										})
									}
								/>
							</Field>
							<Field label="نشانی">
								<input
									value={stage.place.address}
									maxLength={250}
									disabled={disabled}
									onChange={(e) =>
										onChange({
											place: { ...stage.place, address: e.target.value },
										})
									}
								/>
							</Field>
							<Field label="معرفی">
								<textarea
									rows={2}
									maxLength={1000}
									value={stage.place.about}
									disabled={disabled}
									onChange={(e) =>
										onChange({
											place: { ...stage.place, about: e.target.value },
										})
									}
								/>
							</Field>
							<Field
								label="پیشنهاد ویژه"
								hint="مثلاً «۱۰٪ تخفیف با نشان دادن همین صفحه»."
							>
								<input
									value={stage.place.offer}
									maxLength={200}
									disabled={disabled}
									onChange={(e) =>
										onChange({
											place: { ...stage.place, offer: e.target.value },
										})
									}
								/>
							</Field>
							<Field label="سایت یا اینستاگرام">
								<input
									value={stage.place.url}
									maxLength={300}
									dir="ltr"
									disabled={disabled}
									onChange={(e) =>
										onChange({ place: { ...stage.place, url: e.target.value } })
									}
								/>
							</Field>
						</fieldset>
					) : null}
					{t !== "media" && t !== "reward" ? (
						<Field
							label="راهنمایی‌ها"
							hint="هر خط یک راهنمایی، از کم به زیاد. هر راهنمایی بخشی از امتیاز این مرحله را کم می‌کند."
						>
							<textarea
								rows={2}
								value={stage.hints.join("\n")}
								disabled={disabled}
								onChange={(e) =>
									onChange({ hints: lines(e.target.value).slice(0, 6) })
								}
							/>
						</Field>
					) : null}
					<div className="gm-row-2">
						<Field label="امتیاز این مرحله">
							<input
								type="number"
								inputMode="numeric"
								min={0}
								max={500}
								dir="ltr"
								value={stage.points}
								disabled={disabled}
								onChange={(e) =>
									onChange({ points: Math.max(0, Number(e.target.value) || 0) })
								}
							/>
						</Field>
						<Field
							label="مهلت (ثانیه، اختیاری)"
							hint="بعد از مهلت، مرحله امتیازی ندارد."
						>
							<input
								type="number"
								inputMode="numeric"
								min={10}
								dir="ltr"
								value={stage.time_limit_s ?? ""}
								disabled={disabled}
								onChange={(e) =>
									onChange({
										time_limit_s: e.target.value
											? Number(e.target.value)
											: null,
									})
								}
							/>
						</Field>
					</div>
					<Field
						label="کد تخفیف یا هدیه (اختیاری)"
						hint="بعد از حل این مرحله به بازیکن نشان داده می‌شود."
					>
						<input
							value={stage.coupon}
							maxLength={120}
							disabled={disabled}
							onChange={(e) => onChange({ coupon: e.target.value })}
						/>
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
	const [result, setResult] = useState<{
		ok: boolean;
		message: string;
		coupon?: string;
	} | null>(null);
	const [busy, setBusy] = useState(false);
	const [total, setTotal] = useState(0);
	const stage = d.stages[i];
	useEffect(() => {
		setText("");
		setResult(null);
	}, [i]);
	if (!d.stages.length)
		return (
			<EmptyState
				icon="list"
				title="هنوز مرحله‌ای نیست"
				text="اول در «مرحله‌ها» چند مرحله بساز."
			/>
		);
	if (!stage)
		return (
			<EmptyState
				icon="trophy"
				title="بازی تمام شد (امتحانی)"
				text={`${d.completion_message || "پیام پایان را در «جایزه و بودجه» بنویس."} · بازیکن تا ${fa(total + (d.finish_points || 0))} امتیاز می‌گرفت.`}
				action={
					<button
						type="button"
						className="bd-secondary"
						onClick={() => {
							setI(0);
							setTotal(0);
						}}
					>
						از اول
					</button>
				}
			/>
		);
	const check = async (extra: Record<string, unknown> = {}) => {
		setBusy(true);
		try {
			const r = await previewStage(game.id, {
				stage: stage.id,
				answer: text,
				code: text,
				...extra,
			});
			setResult(r);
			if (r.ok) setTotal((n) => n + (r.points || 0));
		} catch (e) {
			setResult({
				ok: false,
				message: e instanceof LocationError ? e.message : gameErrorMessage(e),
			});
		} finally {
			setBusy(false);
		}
	};
	const t = stage.type;
	const needsHere = t === "location" || stage.check_location;
	return (
		<div className="gm-preview">
			<Notice tone="info">
				حالت امتحانی: هیچ امتیاز، بازدید یا پرداختی ثبت نمی‌شود. تغییرهای
				ذخیره‌شده را امتحان می‌کنی.
			</Notice>
			<p className="bd-muted">
				مرحلهٔ {fa(i + 1)} از {fa(d.stages.length)} · {STAGE_LABEL[t]}
			</p>
			{stage.title ? <h3>{stage.title}</h3> : null}
			{stage.text ? <p className="my-clue">{stage.text}</p> : null}
			{stage.image ? (
				<img className="my-clue-image" src={`/media/${stage.image}`} alt="" />
			) : null}
			{stage.question ? (
				<p>
					<b>{stage.question}</b>
				</p>
			) : null}
			{t === "choice" ? (
				<div className="gm-choice-grid gm-options-play">
					{stage.options.filter(Boolean).map((o) => (
						<button
							key={o}
							type="button"
							className="gm-choice"
							aria-pressed={text === o}
							onClick={() => setText(o)}
						>
							{o}
						</button>
					))}
				</div>
			) : null}
			{t === "question" || t === "puzzle" || t === "staff" ? (
				<input
					className="gm-preview-input"
					value={text}
					onChange={(e) => setText(e.target.value)}
					placeholder={t === "staff" ? "کد کارکنان" : "جواب"}
					inputMode={stage.answer_type === "number" ? "numeric" : undefined}
				/>
			) : null}
			{!result?.ok ? (
				<div className="bd-actions">
					{needsHere ? (
						<>
							<button
								type="button"
								className="bd-action"
								disabled={busy}
								onClick={() =>
									void currentPosition()
										.then((p) => check(p))
										.catch((e) =>
											setResult({
												ok: false,
												message:
													e instanceof LocationError
														? e.message
														: "موقعیت پیدا نشد.",
											}),
										)
								}
							>
								<Icon name="map-pin" /> سنجش موقعیت من
							</button>
							<button
								type="button"
								className="bd-secondary"
								disabled={busy}
								onClick={() => void check({ simulate_location: true })}
							>
								فرض کن رسیده‌ام
							</button>
						</>
					) : (
						<button
							type="button"
							className="bd-action"
							disabled={
								busy ||
								((t === "question" ||
									t === "puzzle" ||
									t === "staff" ||
									t === "choice") &&
									!text.trim())
							}
							onClick={() => void check()}
						>
							{t === "qr"
								? "فرض کن QR را اسکن کردم"
								: t === "media" || t === "reward"
									? "ادامه"
									: "ثبت"}
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
					مرحلهٔ بعد <Icon name="arrow-left" />
				</button>
			) : null}
		</div>
	);
}

function dateTimeText(iso: string) {
	return new Intl.DateTimeFormat("fa-IR", { dateStyle: "medium", timeStyle: "short" }).format(new Date(iso));
}

/** Which part of a stage a problem is about (the server's path after "stages.<n>."). */
const FIELD_NAME: Record<string, string> = {
	id: "شناسهٔ مرحله",
	text: "متن یا سرنخ",
	question: "پرسش",
	answers: "پاسخ درست",
	options: "گزینه‌ها",
	staff_code: "کد کارکنان",
	lat: "مختصات محل",
	lng: "مختصات محل",
	"place.name": "نام محل",
};
/** Where a game-level problem is fixed: its step of the editor and a name for it. */
const SECTION_OF: [RegExp, Tab, string][] = [
	[/^title$/, "info", "اطلاعات · عنوان بازی"],
	[/^(stages|images)$/, "stages", "مرحله‌ها"],
	[/^leaderboard\./, "board", "رقابت و جدول"],
	[/^audience\./, "audience", "مخاطب"],
	[/^(starts_at|ends_at|availability\.)/, "audience", "زمان بازی و پایان آن"],
	[/^(budget_points|finish_points|hint_penalty)$/, "rewards", "جایزه و بودجه"],
];
/** A stage's own title, unless it is just the automatic «مرحلهٔ N» (that says nothing). */
function stageName(s: Stage | undefined): string {
	const title = (s?.title ?? "").trim();
	return title && !/^مرحلهٔ\s*[0-9۰-۹]+$/.test(title) ? `«${title}»` : "";
}

/** What is still missing, grouped: each stage once (number, kind, name) with the parts to fill in;
 * then the game's other steps. Each line opens the place to fix it. */
function ProblemList({ problems, d, go }: { problems: Record<string, string>; d: Definition; go: (tab: Tab, stageId?: string) => void }) {
	const byStage = new Map<number, [string, string][]>();
	const other: [string, string, Tab, string][] = [];
	for (const [k, msg] of Object.entries(problems)) {
		const m = k.match(/^stages\.(\d+)\.?(.*)$/);
		if (m) {
			const list = byStage.get(Number(m[1])) ?? [];
			const field = FIELD_NAME[m[2]] ?? "";
			if (!list.some(([f, x]) => f === field && x === msg)) list.push([field, msg]);
			byStage.set(Number(m[1]), list);
			continue;
		}
		const [, tab, name] = SECTION_OF.find(([re]) => re.test(k)) ?? [null, "info" as Tab, "اطلاعات"];
		other.push([k, msg, tab, name]);
	}
	return (
		<div className="gm-problems">
			<b>قبل از ارسال، این‌ها را کامل کن:</b>
			<ul>
				{[...byStage.entries()]
					.sort(([a], [b]) => a - b)
					.map(([i, items]) => {
						const s = d.stages[i];
						return (
							<li key={`s${i}`}>
								<button type="button" className="gm-problem-head" onClick={() => go("stages", s?.id)}>
									مرحلهٔ {fa(i + 1)}
									{s ? ` · ${STAGE_LABEL[s.type]}` : ""} {stageName(s)}
								</button>
								<ul>
									{items.map(([field, msg]) => (
										<li key={field + msg}>
											<button type="button" className="gm-problem" onClick={() => go("stages", s?.id)}>
												{field ? <b>{field}: </b> : null}
												{msg}
											</button>
										</li>
									))}
								</ul>
							</li>
						);
					})}
				{other.map(([k, msg, tab, name]) => (
					<li key={k}>
						<button type="button" className="gm-problem" onClick={() => go(tab)}>
							<b>{name}: </b>
							{msg}
						</button>
					</li>
				))}
			</ul>
			<small className="bd-muted">روی هر مورد بزنی، همان‌جا باز می‌شود.</small>
		</div>
	);
}

function Stats({ id }: { id: string }) {
	const { data, isLoading, error, refetch } = useAnalytics(id);
	const a = data?.result?.analytics;
	if (!a)
		return <LoadState loading={isLoading} error={error} onRetry={refetch} />;
	const top = Math.max(1, ...a.stages.map((s) => s.total));
	return (
		<>
			<div className="gm-stats">
				{(
					[
						["وارد شده‌اند", a.enrolled ?? a.started, "user-plus", "بازی را شروع کرده‌اند (ثبت‌نام)"],
						["مرحله حل کرده‌اند", a.started_playing ?? a.started, "users", "دست‌کم یک مرحله را درست حل کرده‌اند"],
						["فعال", a.active ?? 0, "zap", "در ۷ روز گذشته پیش رفته‌اند و هنوز تمام نکرده‌اند"],
						["تمام کرده‌اند", a.completed_players ?? a.completed, "trophy", ""],
						["درصد پایان", a.completion_rate ?? 0, "flag", "از کسانی که وارد شده‌اند"],
						["میانگین پیشرفت", a.average_progress ?? 0, "arrow-up-right", "درصد"],
						["مرحله‌های حل‌شده", a.stage_completions ?? 0, "check", "همهٔ اثبات‌های معتبر"],
						["بازدید تأییدشده", a.verified_visits ?? 0, "badge-check", "اسکن QR نمایشگر محل"],
						["کد هدیهٔ دریافت‌شده", a.reward_claims ?? 0, "gift", ""],
						["امتیاز پرداخت‌شده", a.budget.spent, "coins", "هزینهٔ کمپین"],
						["بودجهٔ مانده", a.budget.left, "wallet", ""],
					] as [string, number, IconName, string][]
				).map(([label, n, icon, hint]) => (
					<div key={label} className="bd-panel gm-stat" title={hint || undefined}>
						<Icon name={icon} />
						<b>{fa(n)}{label === "درصد پایان" || label === "میانگین پیشرفت" ? "٪" : ""}</b>
						<small>{label}</small>
					</div>
				))}
			</div>
			<small className="bd-muted">دورهٔ {fa(a.edition ?? 1)} · «وارد شده»، «مرحله حل کرده»، «فعال» و «تمام کرده» چهار گروه جدا هستند.</small>
			<Panel title="هر مرحله">
				<ul className="gm-bars">
					{a.stages.map((s, i) => (
						<li key={s.order}>
							<span>
								{fa(s.order)}. {s.place}
								{s.verified_visit ? (
									<em> · بازدید تأییدشده (QR نمایشگر)</em>
								) : s.qr_printed ? (
									<em className="gm-printed"> · اسکن QR چاپی</em>
								) : null}
							</span>
							<span className="gm-bar" aria-hidden="true">
								<i style={{ width: `${(s.total / top) * 100}%` }} />
							</span>
							<b>{fa(s.total)}</b>
							{a.drop_off?.[i] ? <small className="gm-drop">ریزش {fa(a.drop_off[i])}٪</small> : null}
						</li>
					))}
				</ul>
				<small className="bd-muted">
					فقط اسکن QR نمایشگرِ محل «بازدید تأییدشده» است؛ QR چاپی را می‌شود عکس
					گرفت و فرستاد، و موقعیت گوشی یا جواب درست نشانهٔ رسیدن است، نه اثبات
					آن. آمار جمعی است و اطلاعات شخصی بازیکنان نشان داده نمی‌شود.
				</small>
			</Panel>
			{a.leaderboard && a.leaderboard !== "none" ? <CreatorBoard id={id} /> : null}
		</>
	);
}

/** The game's leaderboard as its creator sees it (names masked unless a player chose otherwise). */
function CreatorBoard({ id }: { id: string }) {
	const { data } = useGameBoard(id);
	const b = data?.result?.board;
	if (!b?.rows) return null;
	return (
		<Panel title={b.final ? "جدول رده‌بندی (نتیجهٔ نهایی)" : "جدول رده‌بندی"}>
			<p className="bd-muted">
				{fa(b.totals.players)} شرکت‌کننده · {fa(b.totals.finishers)} نفر تمام کردند{b.config.rules ? ` · ${b.config.rules}` : ""}
			</p>
			{b.rows.length ? <LeaderList rows={b.rows} show={{ ...b.config.show, rank: true }} /> : <p className="bd-muted">هنوز کسی در جدول نیست.</p>}
		</Panel>
	);
}

/** The editor of one game: a step-by-step wizard, saved as you type. */
export default function Editor({ id }: { id: string }) {
	const router = useRouter();
	const queryClient = useQueryClient();
	const { data, isLoading, error, refetch } = useGame(id);
	const share = useShare(id);
	const options = useGmOptions();
	const [edition, setEdition] = useState<"continue" | "new">("continue");
	const server = data?.result?.game ?? null;
	const points = usePoints();
	const [draft, setDraft] = useState<Definition | null>(null);
	const [tab, setTab] = useState<Tab>("info");
	const [open, setOpen] = useState<string | null>(null);
	const [save, setSave] = useState<{
		state: "idle" | "pending" | "saving" | "saved" | "failed";
		at?: string;
		error?: string;
	}>({ state: "idle" });
	const [problems, setProblems] = useState<Record<string, string>>({});
	const [action, setAction] = useState<{
		busy: GameAction | null;
		message: string | null;
		ok?: boolean;
	}>({ busy: null, message: null });
	const [asking, setAsking] = useState<GameAction | null>(null);
	const timer = useRef<number>(0);
	const latest = useRef<Definition | null>(null);

	useEffect(() => {
		if (server && !draft) {
			setDraft(server.draft);
			setProblems(server.problems);
		}
	}, [server, draft]);

	const locked =
		!server ||
		server.status === "submitted" ||
		server.status === "archived" ||
		server.latest_version?.status === "submitted";

	const flush = async () => {
		const d = latest.current;
		if (!d) return;
		latest.current = null;
		setSave({ state: "saving" });
		try {
			const { game } = await saveDraft(id, d);
			setProblems(game.problems);
			// Switching between public and private changes what there is to share.
			const kind = share.data?.result?.kind;
			if (kind && kind !== (d.access === "private" ? "invite" : "public")) void share.refetch();
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
	const setStage = (i: number, patch: Partial<Stage>) =>
		update({
			...d,
			stages: d.stages.map((s, j) => (j === i ? { ...s, ...patch } : s)),
		});
	const live = ["published", "scheduled", "paused"].includes(server.status);
	const run = maxRun(d);
	const funded = run > 0 ? Math.floor((d.budget_points || 0) / run) : null;

	const act = async (a: GameAction) => {
		setAsking(null);
		await flush();
		setAction({ busy: a, message: null });
		try {
			const { game } = await gameAction(id, a, a === "publish" ? { new_edition: edition === "new" } : {});
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
		<CreatorShell
			nav="games"
			title={d.title || "بازی بی‌نام"}
			actions={
				<span className={`bd-tag gm-st-${server.status}`}>
					{STATUS_LABEL[server.status]}
				</span>
			}
		>
			<div className="gm-editor-top">
				<Link href={GM.games} className="my-back">
					<Icon name="arrow-left" /> بازی‌های من
				</Link>
				<span className={`gm-save gm-save-${save.state}`} role="status">
					{saveText}
				</span>
			</div>
			{locked && server.status !== "archived" ? (
				<Notice tone="info">
					این بازی در بررسی بردینو است و تا پایان بررسی ویرایش نمی‌شود.
				</Notice>
			) : null}
			{live && !locked ? (
				<Notice tone="info">
					این بازی منتشر شده است. تغییرها یک نسخهٔ تازه می‌سازند که بعد از تأیید
					بردینو جای نسخهٔ فعلی را می‌گیرد.
				</Notice>
			) : null}
			{live && server.days_left != null && server.days_left <= 7 ? (
				<Notice tone="warn">
					{server.days_left === 0 ? "این بازی امروز تمام می‌شود." : `این بازی ${fa(server.days_left)} روز دیگر تمام می‌شود.`} برای تمدید، تاریخ یا مدت را عوض کن و نسخهٔ تازه بفرست
					(بعد از تأیید بردینو).
				</Notice>
			) : null}
			{server.status === "expired" ? (
				<Notice tone="info">
					این بازی به پایان رسیده
					{server.grace_ends_at && new Date(server.grace_ends_at) > new Date() ? ` (کسانی که شروع کرده‌اند تا ${dateTimeText(server.grace_ends_at)} وقت دارند تمامش کنند)` : ""}. سابقه
					و آمارش می‌ماند. برای تمدید یا دورهٔ تازه، تغییر بده و دوباره بفرست.
				</Notice>
			) : null}
			<nav className="gm-tabs" aria-label="مراحل ساخت بازی">
				{TABS.filter(
					([k]) => k !== "stats" || live || server.status === "archived" || server.status === "expired",
				).map(([k, label]) => (
					<button
						key={k}
						type="button"
						aria-current={tab === k ? "step" : undefined}
						onClick={() => setTab(k)}
					>
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
						<input
							value={d.title}
							maxLength={120}
							disabled={locked}
							onChange={(e) => set({ title: e.target.value })}
						/>
					</Field>
					<Field label="توضیح کوتاه">
						<input
							value={d.summary}
							maxLength={200}
							disabled={locked}
							onChange={(e) => set({ summary: e.target.value })}
						/>
					</Field>
					<Field
						label="داستان شروع"
						hint="متنی که بازیکن قبل از اولین مرحله می‌خواند."
					>
						<textarea
							rows={4}
							maxLength={3000}
							value={d.story}
							disabled={locked}
							onChange={(e) => set({ story: e.target.value })}
						/>
					</Field>
					<div className="gm-row-2">
						<Field label="محدوده" hint="مثلاً «محلهٔ تجریش»">
							<input
								value={d.area}
								maxLength={120}
								disabled={locked}
								onChange={(e) => set({ area: e.target.value })}
							/>
						</Field>
						<Field label="زمان تقریبی (دقیقه)">
							<input
								type="number"
								inputMode="numeric"
								dir="ltr"
								min={1}
								value={d.duration_minutes ?? ""}
								disabled={locked}
								onChange={(e) =>
									set({
										duration_minutes: e.target.value
											? Number(e.target.value)
											: null,
									})
								}
							/>
						</Field>
					</div>
					<Field
						label="ارائه‌دهنده"
						hint="نام کسب‌وکار یا سازنده که به بازیکنان نشان داده می‌شود."
					>
						<input
							value={d.presenter}
							maxLength={120}
							disabled={locked}
							onChange={(e) => set({ presenter: e.target.value })}
						/>
					</Field>
					<Field label="تصویر بازی">
						<ImagePick
							value={d.cover}
							disabled={locked}
							onChange={(cover) => set({ cover })}
						/>
					</Field>
					<button
						type="button"
						className="bd-action"
						onClick={() => setTab("stages")}
					>
						بعدی: مرحله‌ها <Icon name="arrow-left" />
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
									const copy = {
										...s,
										id: `s${Date.now().toString(36)}`,
										title: `${s.title} (کپی)`.slice(0, 120),
									};
									const stages = [...d.stages];
									stages.splice(i + 1, 0, copy);
									update({ ...d, stages });
								}}
								onDelete={() => {
									if (
										window.confirm(
											`«${s.title || STAGE_LABEL[s.type]}» حذف شود؟`,
										)
									)
										update({
											...d,
											stages: d.stages.filter((_, j) => j !== i),
										});
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
					<button
						type="button"
						className="bd-action"
						onClick={() => setTab("board")}
					>
						بعدی: رقابت و جدول <Icon name="arrow-left" />
					</button>
				</>
			) : null}

			{tab === "board" ? (
				<Panel title="رقابت و جدول رده‌بندی">
					<BoardSetup
						value={d.leaderboard ?? { preset: "none" }}
						options={options.data?.result}
						category={server.category}
						stages={d.stages.length}
						disabled={locked}
						onChange={(leaderboard) => set({ leaderboard })}
					/>
					<button
						type="button"
						className="bd-action"
						onClick={() => setTab("audience")}
					>
						بعدی: مخاطب و زمان <Icon name="arrow-left" />
					</button>
				</Panel>
			) : null}

			{tab === "audience" ? (
				<Panel title="مخاطب و زمان">
					<Field
						label="دسترسی"
						hint={
							server.category === "personal"
								? "بازی شخصی همیشه خصوصی است."
								: "خصوصی: فقط کسی که لینک دعوت را دارد."
						}
					>
						<select
							value={d.access}
							disabled={locked || server.category === "personal"}
							onChange={(e) =>
								set({ access: e.target.value as "public" | "private" })
							}
						>
							<option value="public">
								عمومی (بعد از تأیید بردینو در گیمنت و دریافت امتیاز)
							</option>
							<option value="private">خصوصی (فقط با لینک دعوت)</option>
						</select>
					</Field>
					<div className="gm-row-2">
						<Field label="حداقل سن (اختیاری)">
							<input
								type="number"
								inputMode="numeric"
								dir="ltr"
								min={7}
								max={120}
								value={d.audience.age_min ?? ""}
								disabled={locked}
								onChange={(e) =>
									set({
										audience: {
											...d.audience,
											age_min: e.target.value ? Number(e.target.value) : null,
										},
									})
								}
							/>
						</Field>
						<Field label="حداکثر سن (اختیاری)">
							<input
								type="number"
								inputMode="numeric"
								dir="ltr"
								min={7}
								max={120}
								value={d.audience.age_max ?? ""}
								disabled={locked}
								onChange={(e) =>
									set({
										audience: {
											...d.audience,
											age_max: e.target.value ? Number(e.target.value) : null,
										},
									})
								}
							/>
						</Field>
					</div>
					<Field
						label="مخاطب"
						hint="بر اساس اطلاعاتی که خود بازیکن در پروفایلش وارد کرده؛ بازیکن بدون آن اطلاعات، بازی‌های محدودشده را نمی‌بیند."
					>
						<select
							value={d.audience.gender}
							disabled={locked}
							onChange={(e) =>
								set({
									audience: {
										...d.audience,
										gender: e.target.value as "" | "M" | "F",
									},
								})
							}
						>
							<option value="">همه</option>
							<option value="F">خانم‌ها</option>
							<option value="M">آقایان</option>
						</select>
					</Field>
					<AvailabilitySetup
						d={d}
						options={options.data?.result}
						category={server.category}
						disabled={locked}
						set={set}
					/>
					<button
						type="button"
						className="bd-action"
						onClick={() => setTab("rewards")}
					>
						بعدی: جایزه و بودجه <Icon name="arrow-left" />
					</button>
				</Panel>
			) : null}

			{tab === "rewards" ? (
				<Panel title="جایزه و بودجه">
					<div className="gm-row-2">
						<Field label="جایزهٔ پایان (امتیاز)">
							<input
								type="number"
								inputMode="numeric"
								dir="ltr"
								min={0}
								max={500}
								value={d.finish_points}
								disabled={locked}
								onChange={(e) =>
									set({
										finish_points: Math.max(0, Number(e.target.value) || 0),
									})
								}
							/>
						</Field>
						<Field label="هزینهٔ هر راهنمایی (درصد)">
							<input
								type="number"
								inputMode="numeric"
								dir="ltr"
								min={0}
								max={100}
								value={d.hint_penalty}
								disabled={locked}
								onChange={(e) =>
									set({
										hint_penalty: Math.min(
											100,
											Math.max(0, Number(e.target.value) || 0),
										),
									})
								}
							/>
						</Field>
					</div>
					<Field
						label="پیام پایان"
						hint="بعد از آخرین مرحله به بازیکن نشان داده می‌شود."
					>
						<textarea
							rows={2}
							maxLength={1000}
							value={d.completion_message}
							disabled={locked}
							onChange={(e) => set({ completion_message: e.target.value })}
						/>
					</Field>
					<Field
						label="بودجهٔ امتیاز جایزه‌ها"
						hint="هنگام انتشار از کیف امتیاز تو کنار گذاشته می‌شود؛ باقی‌مانده در پایان بازی برمی‌گردد."
					>
						<input
							type="number"
							inputMode="numeric"
							dir="ltr"
							min={0}
							value={d.budget_points}
							disabled={locked}
							onChange={(e) =>
								set({ budget_points: Math.max(0, Number(e.target.value) || 0) })
							}
						/>
					</Field>
					<ul className="gm-budget-facts">
						<li>
							بیشترین جایزهٔ یک بازیکن: <b>{fa(run)}</b> امتیاز
						</li>
						<li>
							{funded === null ? (
								"این بازی امتیازی نمی‌دهد؛ بودجه لازم نیست."
							) : (
								<>
									این بودجه جایزهٔ کامل <b>{fa(funded)}</b> بازیکن را می‌پردازد.
								</>
							)}
						</li>
						<li>
							موجودی امتیاز تو: <b>{fa(points.points ?? 0)}</b>
						</li>
					</ul>
					{run > 0 && (d.budget_points || 0) < run ? (
						<Notice>
							بودجه دست‌کم باید به اندازهٔ جایزهٔ یک بازیکن ({fa(run)}) باشد.
						</Notice>
					) : null}
					<button
						type="button"
						className="bd-action"
						onClick={() => setTab("preview")}
					>
						بعدی: امتحان بازی <Icon name="arrow-left" />
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
								آخرین نسخه: <b>{fa(v.number)}</b> ·{" "}
								{STATUS_LABEL[
									(v.status === "superseded"
										? "archived"
										: v.status) as keyof typeof STATUS_LABEL
								] ?? v.status}
							</p>
							{v.review_note ? (
								<Notice tone={v.status === "approved" ? "ok" : "warn"}>
									پیام بردینو: {v.review_note}
								</Notice>
							) : null}
						</div>
					) : null}
					{Object.keys(problems).length && !locked ? (
						<ProblemList
							problems={problems}
							d={d}
							go={(t, stageId) => {
								setTab(t);
								if (stageId) {
									setOpen(stageId);
									window.setTimeout(() => document.getElementById(`gm-stage-${stageId}`)?.scrollIntoView({ block: "start", behavior: "smooth" }), 150);
								} else {
									window.scrollTo({ top: 0, behavior: "smooth" });
								}
							}}
						/>
					) : null}
					{!locked &&
					server.status !== "archived" &&
					!(v?.status === "approved") ? (
						<button
							type="button"
							className="bd-action"
							disabled={!!action.busy || !!Object.keys(problems).length}
							onClick={() => void act("submit")}
						>
							<Icon name="shield-check" />{" "}
							{live
								? "فرستادن نسخهٔ تازه برای بررسی"
								: "فرستادن برای بررسی بردینو"}
						</button>
					) : null}
					{v?.status === "approved" ? (
						<div className="gm-publish">
							<p>
								بردینو این نسخه را تأیید کرده است.
								{v.fee_toman
									? ` هزینهٔ انتشار: ${fa(v.fee_toman)} تومان${v.fee_paid ? " (پرداخت شد)" : ""}.`
									: " انتشار هزینه‌ای ندارد."}
								{d.budget_points
									? ` با انتشار، ${fa(d.budget_points)} امتیاز برای جایزه‌ها از کیف امتیازت کنار گذاشته می‌شود.`
									: ""}
							</p>
							{server.next_publish === "continue" ? (
								<div className="gm-choice-grid" role="radiogroup" aria-label="دورهٔ بازی">
									<button type="button" role="radio" aria-checked={edition === "continue"} className="gm-choice" onClick={() => setEdition("continue")}>
										<b>ادامهٔ همین دوره</b>
										<small>تمدید یا اصلاح: بازیکنان و جدول همین دوره ادامه پیدا می‌کنند؛ کسی دوباره از اول بازی نمی‌کند.</small>
									</button>
									<button type="button" role="radio" aria-checked={edition === "new"} className="gm-choice" onClick={() => setEdition("new")}>
										<b>دورهٔ تازه</b>
										<small>همه می‌توانند دوباره بازی کنند و جدول تازه شروع می‌شود؛ نتیجهٔ دورهٔ {fa(server.edition)} همان‌طور می‌ماند.</small>
									</button>
								</div>
							) : server.next_publish === "new_only" ? (
								<Notice tone="info">
									دورهٔ {fa(server.edition)} تمام شده و نتیجه‌اش ثبت شده است؛ این انتشار دورهٔ {fa(server.edition + 1)} را شروع می‌کند (بازیکنان و جدول تازه).
								</Notice>
							) : null}
							{v.fee_toman && !v.fee_paid ? (
								<button
									type="button"
									className="bd-action"
									disabled={!!action.busy}
									onClick={() => void pay()}
								>
									<Icon name="banknote" /> پرداخت هزینهٔ انتشار (
									{fa(v.fee_toman)} تومان)
								</button>
							) : asking === "publish" ? (
								<div className="my-hint-ask">
									<span>
										مطمئنی؟ بازی برای بازیکنان باز می‌شود
										{d.budget_points
											? ` و ${fa(d.budget_points)} امتیاز کنار گذاشته می‌شود`
											: ""}
										.
									</span>
									<button
										type="button"
										className="bd-action"
										disabled={!!action.busy}
										onClick={() => void act("publish")}
									>
										انتشار
									</button>
									<button
										type="button"
										className="bd-secondary"
										onClick={() => setAsking(null)}
									>
										نه
									</button>
								</div>
							) : (
								<button
									type="button"
									className="bd-action"
									disabled={!!action.busy}
									onClick={() => setAsking("publish")}
								>
									<Icon name="rocket" /> انتشار بازی
								</button>
							)}
						</div>
					) : null}
					<ShareBox info={share.data?.result} title={d.title} />
					{live ? (
						<LiveTools
							game={server}
							busy={action.busy}
							onAct={(a) => void act(a)}
						/>
					) : null}
					{action.message ? (
						<Notice tone={action.ok ? "ok" : "warn"}>{action.message}</Notice>
					) : null}
					<div className="gm-secondary-actions">
						<button
							type="button"
							className="bd-text-btn"
							disabled={!!action.busy}
							onClick={() => void act("duplicate")}
						>
							<Icon name="copy" /> کپی این بازی
						</button>
						{server.status !== "archived" ? (
							asking === "archive" ? (
								<div className="my-hint-ask">
									<span>
										بایگانی یعنی پایان بازی برای همه؛ باقی‌ماندهٔ بودجه
										برمی‌گردد. ادامه؟
									</span>
									<button
										type="button"
										className="bd-action"
										onClick={() => void act("archive")}
									>
										بایگانی
									</button>
									<button
										type="button"
										className="bd-secondary"
										onClick={() => setAsking(null)}
									>
										نه
									</button>
								</div>
							) : (
								<button
									type="button"
									className="bd-text-btn"
									disabled={!!action.busy}
									onClick={() => setAsking("archive")}
								>
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

/** The game's link and its QR, to send or print: a private game's invite link is there from the
 * first draft (it opens the game once published); a public game's page once it is published. */
function ShareBox({ info, title }: { info: ShareInfo | undefined; title: string }) {
	const [shared, setShared] = useState<string | null>(null);
	if (!info?.url) return null;
	const invite = info.kind === "invite";
	const name = invite ? "لینک دعوت" : "لینک بازی";
	const canShare = typeof navigator !== "undefined" && typeof navigator.share === "function";
	const send = async () => {
		try {
			await navigator.share({ title: title || "بازی بردینو", text: invite ? "به بازی من در بردینو دعوتی:" : title, url: info.url });
		} catch (e) {
			if ((e as Error)?.name !== "AbortError") setShared("فرستادن نشد؛ لینک را کپی کن.");
		}
	};
	return (
		<div className="gm-share">
			<b>
				<Icon name={invite ? "lock-keyhole" : "share"} /> {name} و QR آن
			</b>
			<small className="bd-muted">
				{invite
					? info.active
						? "فقط کسانی که این لینک یا QR را دارند وارد بازی می‌شوند. با نسخه‌های بعدی هم همین می‌ماند."
						: "این لینک ثابت است و از همین حالا می‌توانی بفرستی یا چاپ کنی؛ بعد از انتشار بازی کار می‌کند."
					: info.active
						? "هر کسی با این لینک یا QR مستقیم به صفحهٔ بازی می‌رسد."
						: "بازی الان باز نیست؛ این لینک وقتی بازی باز است کار می‌کند."}
			</small>
			<div className="gm-invite">
				<code dir="ltr">{info.url}</code>
				<CopyButton text={info.url} label={`کپی ${name}`} />
				{canShare ? (
					<button type="button" className="bd-secondary" onClick={() => void send()}>
						<Icon name="share-2" /> فرستادن
					</button>
				) : null}
			</div>
			{info.svg ? (
				<figure className="gm-qr gm-share-qr">
					<span dangerouslySetInnerHTML={{ __html: info.svg }} />
					<figcaption>{title || "بازی بردینو"}</figcaption>
					<a
						className="bd-text-btn"
						download={invite ? "invite-qr.svg" : "game-qr.svg"}
						href={`data:image/svg+xml;charset=utf-8,${encodeURIComponent(info.svg)}`}
					>
						<Icon name="download" /> دانلود QR
					</a>
				</figure>
			) : null}
			{shared ? <Notice>{shared}</Notice> : null}
		</div>
	);
}

/** A live game: where players see it, its invite link and QR codes, pause / resume. */
function LiveTools({
	game,
	busy,
	onAct,
}: {
	game: GameFull;
	busy: GameAction | null;
	onAct: (a: GameAction) => void;
}) {
	const qr = useQrCodes(game.id);
	const codes = qr.data?.result?.qr ?? [];
	return (
		<div className="gm-live">
			<p>
				{game.status === "paused"
					? "متوقف است."
					: game.status === "scheduled"
						? "منتشر شده و از زمان شروع باز می‌شود."
						: "برای بازیکنان باز است."}
				{game.expires_at ? ` تا ${dateTimeText(game.expires_at)}.` : " بدون پایان خودکار."}
				{game.budget
					? ` بودجه: ${fa(game.budget.spent)} پرداخت‌شده از ${fa(game.budget.reserved)}.`
					: ""}
			</p>
			<div className="bd-actions">
				{game.mystery_id ? (
					<Link className="bd-secondary" href={R.mystery(game.mystery_id)}>
						<Icon name="eye" /> دیدن مثل بازیکن
					</Link>
				) : null}
				{game.status === "paused" ? (
					<button
						type="button"
						className="bd-action"
						disabled={!!busy || game.paused_by_admin}
						onClick={() => onAct("resume")}
					>
						<Icon name="play" /> ادامهٔ بازی
					</button>
				) : (
					<button
						type="button"
						className="bd-secondary"
						disabled={!!busy}
						onClick={() => onAct("pause")}
					>
						<Icon name="pause" /> توقف موقت
					</button>
				)}
			</div>
			{game.paused_by_admin ? (
				<Notice>بردینو این بازی را متوقف کرده است.</Notice>
			) : null}
			{codes.length ? (
				<div className="gm-qr-list">
					<b>QR محل‌ها (چاپ کن و در محل بگذار)</b>
					{codes.map((c) =>
						c.venue_url ? (
							<div key={c.order} className="gm-venue">
								<b>
									مرحلهٔ {fa(c.order)} · {c.place}: نمایشگر محل
								</b>
								<small className="bd-muted">
									این لینک را روی تبلت یا تلویزیون محل باز کن (تمام‌صفحه). به
									کسی جز مسئول محل نده.
								</small>
								<code dir="ltr">{c.venue_url}</code>
								<CopyButton text={c.venue_url} label="کپی لینک نمایشگر" />
							</div>
						) : (
							<figure key={c.order} className="gm-qr">
								<span dangerouslySetInnerHTML={{ __html: c.svg }} />
								<figcaption>
									مرحلهٔ {fa(c.order)} · {c.place}
								</figcaption>
								<a
									className="bd-text-btn"
									download={`qr-${c.order}.svg`}
									href={`data:image/svg+xml;charset=utf-8,${encodeURIComponent(c.svg)}`}
								>
									دانلود
								</a>
							</figure>
						),
					)}
				</div>
			) : null}
		</div>
	);
}
