import { persianNumberConverter } from "@/libs/utils/persianNumberConverter";

/** Persian display of a whole or decimal number (۱٬۲۵۰). Canonical values go to the API untouched. */
export function fa(value: number | string | null | undefined, maximumFractionDigits = 0): string {
	const number = Number(value ?? 0);
	if (!Number.isFinite(number)) return "—";
	return number.toLocaleString("fa-IR", { maximumFractionDigits });
}

/** A multiplier the way the games show it: Latin digits, two decimals, left-to-right (1.25×). */
export function multiplier(value: number | string | null | undefined): string {
	const number = Number(value ?? 0);
	return `${Number.isFinite(number) ? number.toFixed(2) : "—"}×`;
}

/** «۱۴۰۵/۰۸/۰۸» from an ISO date (Persian calendar, Persian digits). */
export function faDate(iso: string | null | undefined): string {
	if (!iso) return "—";
	const date = new Date(iso);
	if (Number.isNaN(date.getTime())) return "—";
	return new Intl.DateTimeFormat("fa-IR-u-ca-persian", { timeZone: "Asia/Tehran", year: "numeric", month: "2-digit", day: "2-digit" }).format(date);
}

/**
 * An Iranian mobile number as the API wants it (10 digits, 9xxxxxxxxx), from what people type:
 * Persian/Arabic/Latin digits, spaces or dashes, and 09…, 9…, +989… or 00989… — or null.
 */
export function normalizePhone(text: string): string | null {
	let digits = persianNumberConverter(text).replace(/[\s\-()]/g, "");
	if (digits.startsWith("+98")) digits = digits.slice(3);
	else if (digits.startsWith("0098")) digits = digits.slice(4);
	else if (digits.startsWith("98") && digits.length === 12) digits = digits.slice(2);
	if (digits.startsWith("0")) digits = digits.slice(1);
	return /^9\d{9}$/.test(digits) ? digits : null;
}
