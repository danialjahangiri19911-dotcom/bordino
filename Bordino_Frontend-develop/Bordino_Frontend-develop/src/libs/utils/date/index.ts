import { format } from "date-fns-jalali";
import moment from "moment-jalaali";

export const getFormat = (
	isJalali = true,
	isIncludeTime = false,
	separator = "/",
	forDatePicker = false,
) => {
	const gregorianFormat = !forDatePicker
		? `YYYY${separator}MM${separator}DD`
		: `yyyy${separator}MM${separator}dd`;
	const dateFormat = isJalali
		? `jYYYY${separator}jMM${separator}jDD`
		: gregorianFormat;
	const jalaliTimeFormat = isIncludeTime ? "HH:mm:ss " : "";
	const gregorianTimeFormat = isIncludeTime ? " HH:mm:ss" : "";
	return isJalali
		? jalaliTimeFormat + dateFormat
		: dateFormat + gregorianTimeFormat;
};

export function moment2String(
	date: moment.Moment,
	isJalaali = true,
	isIncludeTime = false,
	separator = "/",
): string {
	return date.format(getFormat(isJalaali, isIncludeTime, separator));
}

export function string2Moment(
	text: string,
	isJalaali = true,
	isIncludeTime = false,
	separator = "-",
): moment.Moment {
	return moment(text, getFormat(isJalaali, isIncludeTime, separator));
}

export function isoStringToString(
	date: string,
	isJalali = true,
	isIncludeTime = false,
): string {
	return moment(new Date(date)).format(getFormat(isJalali, isIncludeTime));
}

export const currentDate = format(new Date(), "EEEE d MMMM");

export const string2MomentForDateRange = (date: string) =>
	string2Moment(date).format("YYYY-MM-DD");

export function getRemainingSeconds(isoString: string): number {
	const end = new Date(isoString).getTime();
	const now = Date.now();
	const diffSec = Math.floor((end - now) / 1000);
	return diffSec > 0 ? diffSec : 0;
}

const TEHRAN_DATE_TIME = new Intl.DateTimeFormat("fa-IR-u-ca-persian", {
	timeZone: "Asia/Tehran",
	year: "numeric",
	month: "2-digit",
	day: "2-digit",
	hour: "2-digit",
	minute: "2-digit",
	hour12: false,
});

/** A moment from the API (ISO with its zone) as Tehran time in the Persian calendar, «۱۴۰۵/۰۸/۰۱، ۰۱:۰۰», whatever the device's own time zone. */
export function formatTehranDateTime(iso: string): string {
	const date = new Date(iso);
	return Number.isNaN(date.getTime()) ? "" : TEHRAN_DATE_TIME.format(date);
}
