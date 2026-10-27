"use client";

import { useEffect, useState } from "react";

import moment from "moment-jalaali";

import { fa } from "./format";

const MONTHS = ["فروردین", "اردیبهشت", "خرداد", "تیر", "مرداد", "شهریور", "مهر", "آبان", "آذر", "دی", "بهمن", "اسفند"];

function parts(gregorian: string) {
	const m = moment(gregorian, "YYYY-MM-DD", true);
	return m.isValid() ? { y: m.jYear(), m: m.jMonth() + 1, d: m.jDate() } : { y: 0, m: 0, d: 0 };
}

/**
 * Birthdate as day / month / year in the Persian calendar; the value in and out is the Gregorian
 * "YYYY-MM-DD" the API stores ("" until all three are chosen).
 */
export default function JalaliDateField({
	value,
	onChange,
	label,
	error,
}: {
	value: string;
	onChange: (gregorian: string) => void;
	label: string;
	error?: string | null;
}) {
	const [state, setState] = useState(() => parts(value));
	useEffect(() => {
		if (value) setState(parts(value));
	}, [value]);

	const thisYear = moment().jYear();
	const years = Array.from({ length: thisYear - 1300 + 1 }, (_, i) => thisYear - i);
	const days = state.y && state.m ? moment.jDaysInMonth(state.y, state.m - 1) : 31;

	const update = (next: { y: number; m: number; d: number }) => {
		const d = next.y && next.m ? Math.min(next.d, moment.jDaysInMonth(next.y, next.m - 1)) : next.d;
		const fixed = { ...next, d };
		setState(fixed);
		if (fixed.y && fixed.m && fixed.d) {
			onChange(moment(`${fixed.y}/${fixed.m}/${fixed.d}`, "jYYYY/jM/jD").format("YYYY-MM-DD"));
		} else {
			onChange("");
		}
	};

	return (
		<fieldset className="rt-field bd-date-field">
			<legend>{label}</legend>
			<div className="bd-date-row">
				<select aria-label="روز" value={state.d || ""} onChange={(e) => update({ ...state, d: Number(e.target.value) })}>
					<option value="">روز</option>
					{Array.from({ length: days }, (_, i) => i + 1).map((d) => (
						<option key={d} value={d}>
							{fa(d)}
						</option>
					))}
				</select>
				<select aria-label="ماه" value={state.m || ""} onChange={(e) => update({ ...state, m: Number(e.target.value) })}>
					<option value="">ماه</option>
					{MONTHS.map((name, i) => (
						<option key={name} value={i + 1}>
							{name}
						</option>
					))}
				</select>
				<select aria-label="سال" value={state.y || ""} onChange={(e) => update({ ...state, y: Number(e.target.value) })}>
					<option value="">سال</option>
					{years.map((y) => (
						<option key={y} value={y}>
							{fa(y).replace(/٬/g, "")}
						</option>
					))}
				</select>
			</div>
			{error ? <p className="bd-field-error">{error}</p> : null}
		</fieldset>
	);
}
