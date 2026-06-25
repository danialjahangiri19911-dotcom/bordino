export function persianNumberConverter(text: string) {
	const persianToEnglish: Record<string, string> = {
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
export function toPersianDigits(value: string | number) {
	return String(value).replace(/\d/g, (d) => PERSIAN_DIGITS[Number(d)]);
}
