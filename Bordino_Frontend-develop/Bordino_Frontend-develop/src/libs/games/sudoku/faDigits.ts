const FA_DIGITS = ["۰", "۱", "۲", "۳", "۴", "۵", "۶", "۷", "۸", "۹"];

/** تبدیل ارقام لاتین به فارسی (فقط برای نمایش). */
export function toFa(input: string | number): string {
	return String(input).replace(/[0-9]/g, (d) => FA_DIGITS[Number(d)]);
}
