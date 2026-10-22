/** Persian (۰–۹) and Arabic-Indic (٠–٩) digits to Latin ones; everything else is kept. */
export function persianNumberConverter(text: string) {
	const persianToEnglish: Record<string, string> = {
		"٠": "0",
		"١": "1",
		"٢": "2",
		"٣": "3",
		"٤": "4",
		"٥": "5",
		"٦": "6",
		"٧": "7",
		"٨": "8",
		"٩": "9",
		"۰": "0",
		"۱": "1",
		"۲": "2",
		"۳": "3",
		"۴": "4",
		"۵": "5",
		"۶": "6",
		"۷": "7",
		"۸": "8",
		"۹": "9",
	};

	return text
		.split("")
		.map((char) => persianToEnglish[char] || char)
		.join("");
}

const PERSIAN_DIGITS = ["۰", "۱", "۲", "۳", "۴", "۵", "۶", "۷", "۸", "۹"];

/** تبدیلِ ارقامِ انگلیسی به فارسی برای نمایش (مثلِ ۲۰۴۸). */
/**
 * The whole number in a typed amount: digits of any script, thousands separators ignored
 * ("۱٬۰۰۰" → 1000). Anything else — a decimal point, a sign, letters — makes it NaN rather than
 * a different number ("1.5" is not 15, "-100" is not 100).
 */
export function parseAmount(text: string): number {
	const cleaned = persianNumberConverter(text.trim()).replace(/[\s,٬،']/g, "");
	return /^[0-9]+$/.test(cleaned) ? Number(cleaned) : Number.NaN;
}

export function toPersianDigits(value: string | number) {
	return String(value).replace(/\d/g, (d) => PERSIAN_DIGITS[Number(d)]);
}
