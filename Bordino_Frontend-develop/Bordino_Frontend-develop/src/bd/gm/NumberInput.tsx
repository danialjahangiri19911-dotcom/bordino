"use client";

import { type InputHTMLAttributes, useEffect, useRef, useState } from "react";

const DIGITS: Record<string, string> = {
	"۰": "0", "۱": "1", "۲": "2", "۳": "3", "۴": "4", "۵": "5", "۶": "6", "۷": "7", "۸": "8", "۹": "9",
	"٠": "0", "١": "1", "٢": "2", "٣": "3", "٤": "4", "٥": "5", "٦": "6", "٧": "7", "٨": "8", "٩": "9",
};
/** What was typed, as Latin digits only (Persian/Arabic digits from a phone keyboard are digits too). */
const digitsOf = (text: string) => text.replace(/[۰-۹٠-٩]/g, (c) => DIGITS[c] ?? c).replace(/[^0-9]/g, "");

/**
 * A whole-number field that can be emptied while typing (the old fields put a default back the
 * moment the last digit was deleted, so «100» could never become «50»). The number is saved as it is
 * typed; the limits and the default are applied only when the field is left.
 *
 * - `fallback`: the value an empty field becomes on leaving it; without it, empty means «none» (null).
 * - `min` / `max`: applied on leaving the field.
 */
export default function NumberInput({
	value,
	onValue,
	min,
	max,
	fallback,
	...rest
}: {
	value: number | null | undefined;
	onValue: (value: number | null) => void;
	min?: number;
	max?: number;
	fallback?: number;
} & Omit<InputHTMLAttributes<HTMLInputElement>, "value" | "onChange" | "type" | "min" | "max">) {
	const shown = value == null ? "" : String(value);
	const [text, setText] = useState(shown);
	const editing = useRef(false);
	// A change from elsewhere (a template, a reload, another field) shows, but never while typing.
	useEffect(() => {
		if (!editing.current) setText(shown);
	}, [shown]);
	const clamp = (n: number) => Math.min(max ?? Infinity, Math.max(min ?? -Infinity, n));
	return (
		<input
			{...rest}
			type="text"
			inputMode="numeric"
			dir="ltr"
			autoComplete="off"
			value={text}
			onFocus={(e) => {
				editing.current = true;
				rest.onFocus?.(e);
			}}
			onChange={(e) => {
				const next = digitsOf(e.target.value).slice(0, 9);
				setText(next);
				if (next === "") {
					if (fallback === undefined) onValue(null);
					return; // (a default comes back only on leaving the field)
				}
				onValue(Number(next));
			}}
			onBlur={(e) => {
				editing.current = false;
				let n: number | null = text === "" ? (fallback ?? null) : Number(text);
				if (n != null) n = clamp(n);
				setText(n == null ? "" : String(n));
				if (n !== value) onValue(n);
				rest.onBlur?.(e);
			}}
		/>
	);
}
