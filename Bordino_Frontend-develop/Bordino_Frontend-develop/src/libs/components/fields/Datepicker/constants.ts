import { faIR } from "date-fns/locale";

export const CUSTOM_ADAPTER_LOCALE = {
	...faIR,
	localize: {
		...faIR.localize,
		day: (n: number) =>
			["یکشنبه", "دوشنبه", "سه‌شنبه", "چهارشنبه", "پنجشنبه", "جمعه", "شنبه"][n],
		month: (n: number) =>
			[
				"فروردین",
				"اردیبهشت",
				"خرداد",
				"تیر",
				"مرداد",
				"شهریور",
				"مهر",
				"آبان",
				"آذر",
				"دی",
				"بهمن",
				"اسفند",
			][n],
	},
};
