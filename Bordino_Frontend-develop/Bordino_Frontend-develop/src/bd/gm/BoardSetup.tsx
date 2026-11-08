"use client";

import { useState } from "react";

import Icon, { type IconName } from "../Icon";
import { type LeaderRow, LeaderList } from "../board";
import { fa } from "../format";
import { Notice } from "../ui";
import type { BoardConfig, BoardMetric, BoardPreset, BoardShow, Category, GmOptions } from "./api";

/** What each ready-made leaderboard is for (the server holds the rules themselves). */
const PRESET_INFO: Record<Exclude<BoardPreset, "team">, { name: string; text: string; best: string; metric: string; icon: IconName }> = {
	none: {
		name: "بدون رقابت",
		text: "رتبه و مقایسه‌ای نیست؛ هر بازیکن پیشرفت خودش را می‌بیند و آمار برای تو می‌ماند.",
		best: "تولد، بازی خصوصی، غافلگیری، داستانی",
		metric: "بدون رتبه",
		icon: "heart",
	},
	progress: {
		name: "بیشترین مرحله",
		text: "هر کس مرحله‌های بیشتری را درست حل کند جلوتر است.",
		best: "گنج‌یابی شهری، معمای چندمرحله‌ای، گشت و کشف",
		metric: "مرحله‌های انجام‌شده",
		icon: "flag",
	},
	score: {
		name: "بیشترین امتیاز",
		text: "امتیازی که سرور برای هر جواب درست داده؛ راهنمایی و جواب غلط امتیاز را کم می‌کند.",
		best: "مسابقه، پرسش و پاسخ، معمای مهارتی",
		metric: "امتیاز",
		icon: "trophy",
	},
	speed: {
		name: "سریع‌ترین پایان",
		text: "فقط کسانی که بازی را تمام کنند؛ زمان از شروع تا پایان با ساعت سرور.",
		best: "چالش زمان‌دار، مسابقهٔ سرعت، فرار از اتاق",
		metric: "زمان تمام کردن",
		icon: "timer",
	},
	participation: {
		name: "فعالیت و مشارکت",
		text: "مأموریت‌های انجام‌شده (هر کدام فقط یک بار) و امتیاز فعالیت.",
		best: "کمپین تبلیغاتی، چالش گروهی، مأموریت‌های تکراری",
		metric: "مأموریت‌های انجام‌شده",
		icon: "users",
	},
};
const ORDER: Exclude<BoardPreset, "team">[] = ["none", "progress", "score", "speed", "participation"];

const METRIC_NAME: Record<string, string> = {
	stages: "مرحله‌های انجام‌شده",
	progress: "درصد پیشرفت",
	score: "امتیاز",
	duration: "زمان تمام کردن (کمتر بهتر)",
};
const SHOW_NAME: Record<BoardShow, string> = {
	rank: "شمارهٔ رتبه",
	name: "نام بازیکن (پوشیده، مگر خودش بخواهد)",
	avatar: "عکس پروفایل (فقط اگر خود بازیکن اجازه دهد)",
	stages: "مرحله‌های انجام‌شده",
	percent: "درصد پیشرفت",
	bar: "نوار پیشرفت",
	score: "امتیاز",
	time: "زمان تمام کردن",
	participants: "تعداد شرکت‌کنندگان",
	finishers: "تعداد کسانی که تمام کردند",
};

/** Clearly made-up rows: the preview never shows a real Bordino player. */
function sampleRows(total: number): LeaderRow[] {
	const t = Math.max(total, 3);
	const make = (position: number, stages: number, score: number, seconds: number | null): LeaderRow => ({
		position,
		name: `بازیکن نمونه ${fa(position)}`,
		avatar: null,
		is_me: position === 4,
		stages,
		total: t,
		percent: Math.round((100 * stages) / t),
		score,
		seconds,
		completed: stages === t,
	});
	return [make(1, t, 120, 1460), make(2, t, 95, 1980), make(3, t - 1, 80, null), make(4, Math.max(1, t - 2), 40, null)];
}

export default function BoardSetup({
	value,
	options,
	category,
	stages,
	disabled,
	onChange,
}: {
	value: BoardConfig;
	options: GmOptions | undefined;
	category: Category;
	stages: number;
	disabled: boolean;
	onChange: (next: BoardConfig) => void;
}) {
	const presets = options?.leaderboard.presets;
	const allowed = options ? options.leaderboard.categories[category] !== false : true;
	const preset = value.preset === "team" ? "none" : value.preset;
	const [open, setOpen] = useState(!!value.customized);
	const defaults = (p: BoardPreset): BoardConfig => (p === "none" || p === "team" || !presets ? { preset: "none" } : { ...presets[p], customized: false });
	const choose = (p: Exclude<BoardPreset, "team">) => {
		setOpen(false);
		onChange(defaults(p));
	};
	const custom = (patch: Partial<BoardConfig>) => onChange({ ...defaults(preset), ...value, ...patch, customized: true });
	const show = value.show ?? ({} as Record<BoardShow, boolean>);
	const rankBy = value.rank_by ?? [];
	const setRank = (i: number, m: BoardMetric | "") => {
		const next = [...rankBy];
		if (m) next[i] = m;
		else next.splice(i);
		custom({ rank_by: next.filter(Boolean) as BoardMetric[] });
	};
	return (
		<div className="gm-board-setup">
			<p className="gm-q">می‌خواهی این بازی جدول رده‌بندی داشته باشد؟</p>
			{!allowed ? <Notice tone="info">جدول رده‌بندی برای این نوع بازی فعال نیست.</Notice> : null}
			<div className="gm-choice-grid gm-presets" role="radiogroup" aria-label="جدول رده‌بندی">
				{ORDER.map((p) => {
					const info = PRESET_INFO[p];
					return (
						<button
							key={p}
							type="button"
							role="radio"
							aria-checked={preset === p}
							className="gm-choice gm-preset"
							disabled={disabled || (!allowed && p !== "none")}
							onClick={() => choose(p)}
						>
							<Icon name={info.icon} />
							<b>{info.name}</b>
							<small>{info.text}</small>
							<small>
								<b>مناسب:</b> {info.best}
							</small>
							<small>
								<b>معیار اصلی:</b> {info.metric}
							</small>
						</button>
					);
				})}
				<div className="gm-choice gm-preset" aria-disabled="true">
					<Icon name="swords" />
					<b>رقابت تیمی</b>
					<small>بازی تیمی هنوز در بردینو نیست؛ وقتی اضافه شود این جدول هم فعال می‌شود.</small>
					<small className="bd-tag">به‌زودی</small>
				</div>
			</div>

			{preset !== "none" ? (
				<>
					<div className="bd-actions">
						<button type="button" className="bd-action" disabled={disabled} onClick={() => choose(preset)} aria-pressed={!value.customized}>
							<Icon name="check" /> تنظیمات پیشنهادی
						</button>
						<button type="button" className="bd-secondary" disabled={disabled} onClick={() => {
								if (open) {
									setOpen(false);
									return;
								}
								setOpen(true);
								custom({});
							}} aria-expanded={open}>
							<Icon name="pencil" /> تنظیمات دلخواه
						</button>
						{value.customized ? (
							<button type="button" className="bd-text-btn" disabled={disabled} onClick={() => choose(preset)}>
								<Icon name="rotate-ccw" /> برگشت به پیش‌فرض «{PRESET_INFO[preset].name}»
							</button>
						) : null}
					</div>
					<p className="bd-muted">
						جدول: <b>{PRESET_INFO[preset].name}</b>
						{value.customized ? " (سفارشی)" : " (پیش‌فرض)"} · هر بازیکن یک بار بازی می‌کند · رتبه و امتیاز فقط با ثبت سرور.
					</p>

					{open ? (
						<div className="gm-advanced">
							<fieldset>
								<legend>معیار رتبه</legend>
								{[0, 1, 2].map((i) => (
									<label key={i} className="rt-field gm-field">
										<span>{i === 0 ? "معیار اصلی" : i === 1 ? "در تساوی" : "باز هم در تساوی"}</span>
										<select
											value={rankBy[i] ?? ""}
											disabled={disabled || (i > 0 && !rankBy[i - 1])}
											onChange={(e) => setRank(i, e.target.value as BoardMetric | "")}
										>
											{i > 0 ? <option value="">—</option> : null}
											{Object.keys(METRIC_NAME).map((m) => (
												<option key={m} value={m} disabled={rankBy.includes(m as BoardMetric) && rankBy[i] !== m}>
													{METRIC_NAME[m]}
												</option>
											))}
											<option value="team" disabled>
												امتیاز تیم (به‌زودی)
											</option>
										</select>
									</label>
								))}
								<small className="bd-muted">در تساوی کامل، کسی که زودتر به نتیجه‌اش رسیده جلوتر است؛ ترتیب همیشه یکسان می‌ماند.</small>
								<label className="gm-check">
									<input
										type="checkbox"
										checked={!!value.only_finishers}
										disabled={disabled}
										onChange={(e) => custom({ only_finishers: e.target.checked })}
									/>{" "}
									فقط کسانی که بازی را تمام کنند رتبه بگیرند
								</label>
							</fieldset>

							<fieldset>
								<legend>چه چیزهایی دیده شود</legend>
								<div className="gm-check-grid">
									{(Object.keys(SHOW_NAME) as BoardShow[]).map((k) => (
										<label key={k} className="gm-check">
											<input type="checkbox" checked={!!show[k]} disabled={disabled} onChange={(e) => custom({ show: { ...show, [k]: e.target.checked } })} />{" "}
											{SHOW_NAME[k]}
										</label>
									))}
								</div>
								<div className="gm-row-2">
									<label className="rt-field gm-field">
										<span>چند نفر اول نشان داده شود</span>
										<select value={value.top ?? 10} disabled={disabled} onChange={(e) => custom({ top: Number(e.target.value) as BoardConfig["top"] })}>
											{[3, 10, 20, 50].map((n) => (
												<option key={n} value={n}>
													{fa(n)}
												</option>
											))}
										</select>
									</label>
									<label className="rt-field gm-field">
										<span>همهٔ جدول</span>
										<select value={value.full === false ? "no" : "yes"} disabled={disabled} onChange={(e) => custom({ full: e.target.value === "yes" })}>
											<option value="yes">بازیکن می‌تواند کل جدول را باز کند</option>
											<option value="no">فقط همان چند نفر اول</option>
										</select>
									</label>
								</div>
								<label className="gm-check">
									<input
										type="checkbox"
										checked={value.highlight_me !== false}
										disabled={disabled}
										onChange={(e) => custom({ highlight_me: e.target.checked })}
									/>{" "}
									ردیف خود بازیکن پررنگ شود (رتبهٔ خودش همیشه دیده می‌شود)
								</label>
							</fieldset>

							<fieldset>
								<legend>چه کسی جدول را ببیند</legend>
								<label className="rt-field gm-field">
									<span>در طول بازی</span>
									<select value={value.visibility ?? "players"} disabled={disabled} onChange={(e) => custom({ visibility: e.target.value as BoardConfig["visibility"] })}>
										<option value="players">همهٔ شرکت‌کنندگان بازی</option>
										<option value="finishers">فقط بعد از تمام کردن بازی</option>
										<option value="creator">فقط من و بردینو</option>
									</select>
								</label>
								<label className="rt-field gm-field">
									<span>بعد از پایان بازی</span>
									<select value={value.after ?? "keep"} disabled={disabled} onChange={(e) => custom({ after: e.target.value as BoardConfig["after"] })}>
										<option value="keep">نتیجهٔ نهایی همان‌طور بماند</option>
										<option value="top10">فقط ۱۰ نفر اول</option>
										<option value="participants">فقط برای شرکت‌کنندگان</option>
										<option value="creator">فقط من و بردینو</option>
										<option value="hide">از بازیکنان پنهان شود</option>
									</select>
								</label>
								<small className="bd-muted">حریم خصوصی بازیکن همیشه رعایت می‌شود: نام و عکس هر کس فقط با اجازهٔ خودش نشان داده می‌شود.</small>
							</fieldset>

							<details className="gm-more">
								<summary>دورهٔ رتبه و تلاش‌ها</summary>
								<label className="rt-field gm-field">
									<span>دورهٔ رتبه‌بندی</span>
									<select value={value.period ?? "lifetime"} disabled={disabled} onChange={(e) => custom({ period: e.target.value as BoardConfig["period"] })}>
										<option value="lifetime">کل دورهٔ بازی</option>
										<option value="daily" disabled>
											روزانه (به‌زودی)
										</option>
										<option value="weekly" disabled>
											هفتگی (به‌زودی)
										</option>
										<option value="monthly" disabled>
											ماهانه (به‌زودی)
										</option>
										<option value="range" disabled>
											بازهٔ دلخواه (به‌زودی)
										</option>
									</select>
								</label>
								<ul className="gm-rules">
									<li>هر بازیکن یک بار بازی می‌کند (اولین تلاش معتبر)؛ نسخهٔ تازهٔ بازی فرصت دوباره نیست.</li>
									<li>جواب غلط در چندگزینه‌ای امتیاز آن مرحله را صفر می‌کند.</li>
									<li>هر راهنمایی امتیاز مرحله را کم می‌کند (درصدش در «جایزه و بودجه»).</li>
									<li>مرحله‌ای که مهلت دارد، بعد از مهلت امتیاز ندارد.</li>
								</ul>
								<small className="bd-muted">این قوانین قبل از شروع به بازیکن نشان داده می‌شود. تغییرشان بعد از انتشار نسخهٔ تازه و بررسی بردینو لازم دارد.</small>
							</details>
						</div>
					) : null}

					<div className="gm-board-preview">
						<b>پیش‌نمایش</b> <span className="bd-tag">نمونه — بازیکن واقعی نیست</span>
						{show.participants || show.finishers ? (
							<p className="bd-muted">
								{show.participants ? `${fa(24)} شرکت‌کننده` : ""}
								{show.participants && show.finishers ? " · " : ""}
								{show.finishers ? `${fa(9)} نفر تمام کردند` : ""}
							</p>
						) : null}
						<LeaderList rows={sampleRows(stages)} show={show} highlightMe={value.highlight_me !== false} sample />
					</div>
				</>
			) : (
				<p className="bd-muted">بدون جدول: بازیکنان مقایسه نمی‌شوند. پیشرفت هر بازیکن برای خودش و آمار بازی برای تو ثبت می‌شود.</p>
			)}
		</div>
	);
}
