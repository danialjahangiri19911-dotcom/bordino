"use client";

import { fa } from "../format";
import type { Availability, Category, Definition, GmOptions } from "./api";
import NumberInput from "./NumberInput";

/** "2026-11-10T14:30" in the phone's own clock (what a datetime-local input shows and gives). */
function toLocalInput(iso: string | null): string {
	if (!iso) return "";
	const d = new Date(iso);
	if (Number.isNaN(d.getTime())) return "";
	const p = (n: number) => String(n).padStart(2, "0");
	return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}T${p(d.getHours())}:${p(d.getMinutes())}`;
}
const fromLocalInput = (v: string): string | null => (v ? new Date(v).toISOString() : null);

const DURATIONS: [number, "days" | "months", string][] = [
	[1, "days", "۱ روز"],
	[3, "days", "۳ روز"],
	[7, "days", "۷ روز"],
	[14, "days", "۱۴ روز"],
	[30, "days", "۳۰ روز"],
	[1, "months", "۱ ماه"],
	[3, "months", "۳ ماه"],
];
const GRACES: [number, string][] = [
	[0, "بدون مهلت"],
	[24, "۲۴ ساعت"],
	[48, "۴۸ ساعت"],
	[168, "۷ روز"],
];

export function expiryText(a: Availability, endsAt: string | null): string {
	if (a.expiry === "date") return endsAt ? `تا ${new Intl.DateTimeFormat("fa-IR", { dateStyle: "medium", timeStyle: "short" }).format(new Date(endsAt))}` : "تاریخ پایان را انتخاب کن";
	if (a.expiry === "duration") return a.duration_value ? `${fa(a.duration_value)} ${a.duration_unit === "months" ? "ماه" : "روز"} از لحظهٔ انتشار` : "مدت را انتخاب کن";
	return "بدون پایان خودکار";
}

export default function AvailabilitySetup({
	d,
	options,
	category,
	disabled,
	set,
}: {
	d: Definition;
	options: GmOptions | undefined;
	category: Category;
	disabled: boolean;
	set: (patch: Partial<Definition>) => void;
}) {
	const a = d.availability;
	const setA = (patch: Partial<Availability>) => set({ availability: { ...a, ...patch } });
	const maxDays = options?.availability.max_days[category] ?? 0;
	const maxGrace = options?.availability.max_grace_hours ?? 168;
	const preset = DURATIONS.find(([n, u]) => n === a.duration_value && u === a.duration_unit);
	return (
		<fieldset className="gm-availability">
			<legend>زمان بازی و پایان آن</legend>
			<label className="rt-field gm-field">
				<span>شروع (اختیاری)</span>
				<input
					type="datetime-local"
					dir="ltr"
					value={toLocalInput(d.starts_at)}
					disabled={disabled}
					onChange={(e) => set({ starts_at: fromLocalInput(e.target.value) })}
				/>
				<small className="bd-muted">خالی = از لحظهٔ انتشار.</small>
			</label>

			<div className="gm-choice-grid" role="radiogroup" aria-label="پایان بازی">
				{(
					[
						["none", "بدون پایان خودکار", "تا وقتی خودت متوقف یا بایگانی‌اش کنی."],
						["date", "تاریخ مشخص", "مثلاً تا آخر آذر، ساعت ۲۳:۵۹."],
						["duration", "مدت از انتشار", "مثلاً ۷ روز یا ۱ ماه بعد از انتشار."],
					] as [Availability["expiry"], string, string][]
				).map(([k, label, text]) => (
					<button
						key={k}
						type="button"
						role="radio"
						aria-checked={a.expiry === k}
						className="gm-choice"
						disabled={disabled || (k === "none" && maxDays > 0)}
						onClick={() => setA({ expiry: k, duration_value: k === "duration" ? a.duration_value || 7 : a.duration_value })}
					>
						<b>{label}</b>
						<small>{text}</small>
					</button>
				))}
			</div>
			{maxDays > 0 ? <small className="bd-muted">بازی‌های این نوع حداکثر {fa(maxDays)} روز باز می‌مانند.</small> : null}

			{a.expiry === "date" ? (
				<label className="rt-field gm-field">
					<span>پایان</span>
					<input type="datetime-local" dir="ltr" value={toLocalInput(d.ends_at)} disabled={disabled} onChange={(e) => set({ ends_at: fromLocalInput(e.target.value) })} />
				</label>
			) : null}

			{a.expiry === "duration" ? (
				<div className="gm-duration">
					<div className="ng-chips" role="group" aria-label="مدت بازی">
						{DURATIONS.map(([n, u, label]) => (
							<button
								key={label}
								type="button"
								aria-pressed={a.duration_value === n && a.duration_unit === u}
								className="ng-chip"
								disabled={disabled}
								onClick={() => setA({ duration_value: n, duration_unit: u })}
							>
								{label}
							</button>
						))}
					</div>
					<div className="gm-row-2">
						<label className="rt-field gm-field">
							<span>{preset ? "یا مدت دلخواه" : "مدت دلخواه"}</span>
							<NumberInput
								min={1}
								max={a.duration_unit === "months" ? 120 : 3650}
								value={a.duration_value}
								disabled={disabled}
								onValue={(n) => setA({ duration_value: n })}
							/>
						</label>
						<label className="rt-field gm-field">
							<span>واحد</span>
							<select value={a.duration_unit} disabled={disabled} onChange={(e) => setA({ duration_unit: e.target.value as "days" | "months" })}>
								<option value="days">روز</option>
								<option value="months">ماه تقویمی</option>
							</select>
						</label>
					</div>
					<small className="bd-muted">
						از لحظهٔ واقعی انتشار، به وقت تهران. «یک ماه» یعنی همان روز و ساعتِ ماه بعد (نه ۳۰ روز)؛ اگر آن روز در ماه بعد نباشد، آخرین روز آن ماه.
					</small>
				</div>
			) : null}

			<label className="rt-field gm-field">
				<span>ظرفیت بازیکنان (اختیاری)</span>
				<NumberInput min={1} max={1000000} value={d.capacity} disabled={disabled} onValue={(n) => set({ capacity: n })} />
				<small className="bd-muted">وقتی پر شود کسی تازه وارد نمی‌شود (جدا از زمان پایان). خالی = تا جایی که بودجه اجازه بدهد.</small>
			</label>

			{a.expiry !== "none" ? (
				<>
					<div className="gm-choice-grid" role="radiogroup" aria-label="بعد از پایان">
						<button type="button" role="radio" aria-checked={a.after === "strict"} className="gm-choice" disabled={disabled} onClick={() => setA({ after: "strict", grace_hours: 0 })}>
							<b>پایان کامل</b>
							<small>سر وقت، بازی برای همه بسته می‌شود؛ سکه‌های گرفته‌شده می‌ماند.</small>
						</button>
						<button type="button" role="radio" aria-checked={a.after === "finish"} className="gm-choice" disabled={disabled} onClick={() => setA({ after: "finish", grace_hours: a.grace_hours || 24 })}>
							<b>فرصت تمام کردن</b>
							<small>کسی تازه وارد نمی‌شود، ولی کسانی که شروع کرده‌اند تا مدتی می‌توانند تمامش کنند.</small>
						</button>
					</div>
					{a.after === "finish" ? (
						<label className="rt-field gm-field">
							<span>مهلت تمام کردن</span>
							<select value={GRACES.some(([h]) => h === a.grace_hours) ? a.grace_hours : "custom"} disabled={disabled} onChange={(e) => e.target.value !== "custom" && setA({ grace_hours: Number(e.target.value) })}>
								{GRACES.filter(([h]) => h <= maxGrace).map(([h, label]) => (
									<option key={h} value={h}>
										{label}
									</option>
								))}
								{!GRACES.some(([h]) => h === a.grace_hours) ? <option value="custom">{fa(a.grace_hours)} ساعت</option> : null}
							</select>
							<NumberInput
								min={0}
								max={maxGrace}
								fallback={0}
								aria-label="مهلت دلخواه (ساعت)"
								value={a.grace_hours}
								disabled={disabled}
								onValue={(n) => setA({ grace_hours: n ?? 0 })}
							/>
							<small className="bd-muted">به ساعت؛ حداکثر {fa(maxGrace)} ساعت (سقف بردینو). زمان پایان و پایان مهلت جدا ثبت می‌شوند.</small>
						</label>
					) : null}
					<small className="bd-muted">
						بعد از پایان، بازی از فهرست بازی‌ها پنهان می‌شود؛ آمار، پیشرفت بازیکنان، جایزه‌ها و تراکنش‌ها می‌ماند و بازیکنان سابقهٔ خودشان را می‌بینند. باقی‌ماندهٔ بودجه به کیف
						سکه‌ات برمی‌گردد.
					</small>
				</>
			) : null}
		</fieldset>
	);
}
