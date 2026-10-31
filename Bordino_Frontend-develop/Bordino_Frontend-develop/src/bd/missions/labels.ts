import { type IconName } from "../Icon";
import { fa } from "../format";
import type { Mission, MissionKind, MissionState } from "./api";

export const KIND_ICON: Record<MissionKind, IconName> = {
	video: "clapperboard",
	banner: "mouse-pointer-click",
	signup: "user-plus",
	install: "smartphone",
	qr: "qr-code",
};

export const STATE_LABEL: Record<MissionState, string> = {
	available: "فعال",
	in_progress: "در حال انجام",
	waiting: "در انتظار تأیید همکار",
	pending: "در انتظار بررسی",
	rejected: "رد شد",
	done: "انجام شد",
	done_today: "امروز انجام شد",
	upcoming: "به‌زودی",
	expired: "پایان‌یافته",
	full: "ظرفیت تکمیل",
	inactive: "غیرفعال",
};

export function progressText(m: Mission) {
	return m.repeat === "daily" ? `روزانه · امروز ${fa(m.used)} از ${fa(m.limit)}` : null;
}
