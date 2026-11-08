import { fa } from "../format";
import { call } from "@/api/games/request";
import type { ResponseApiData } from "@/libs/http/interfaces";
import useQuery from "@/libs/http/query";

/** Game Master (creator mode): the server's /api/v1/gm/… */
const GM = "gm/";

export type AppMode = "player" | "creator";
export type Intent = "personal" | "business" | "pro";
export type Category = "business" | "personal" | "pro";
export type GameStatus =
	| "draft"
	| "submitted"
	| "changes_requested"
	| "approved"
	| "rejected"
	| "scheduled"
	| "published"
	| "paused"
	| "archived";
export type StageType = "question" | "puzzle" | "choice" | "qr" | "location" | "staff" | "media" | "reward";

export interface GmProfile {
	/** Game Master is open to this account (Bordino opens it gradually). */
	available: boolean;
	exists: boolean;
	onboarded: boolean;
	preferred_mode: AppMode;
	intent: Intent | "";
	business_name: string;
	business_phone: string;
	blocked: boolean;
	terms_version: string;
}

export interface Place {
	name: string;
	address: string;
	about: string;
	offer: string;
	url: string;
}

export interface Stage {
	id: string;
	type: StageType;
	title: string;
	text: string;
	image: string | null;
	question: string;
	answers: string[];
	answer_type: "text" | "number";
	options: string[];
	lat: number | null;
	lng: number | null;
	radius_m: number;
	check_location: boolean;
	staff_code: string;
	place: Place;
	hints: string[];
	points: number;
	time_limit_s: number | null;
	coupon: string;
}

export interface Definition {
	schema: number;
	title: string;
	summary: string;
	story: string;
	area: string;
	duration_minutes: number | null;
	presenter: string;
	cover: string | null;
	access: "public" | "private";
	audience: { age_min: number | null; age_max: number | null; gender: "" | "M" | "F" };
	starts_at: string | null;
	ends_at: string | null;
	capacity: number | null;
	finish_points: number;
	hint_penalty: number;
	budget_points: number;
	completion_message: string;
	stages: Stage[];
}

export interface VersionInfo {
	id: string;
	number: number;
	status: "submitted" | "changes_requested" | "approved" | "rejected" | "published" | "superseded";
	submitted_at: string;
	reviewed_at: string | null;
	review_note: string;
	fee_toman: number;
	fee_paid: boolean;
	published_at: string | null;
}

export interface GameSummary {
	id: string;
	title: string;
	category: Category;
	template: string;
	status: GameStatus;
	paused_by_admin: boolean;
	draft_saved_at: string | null;
	create_time: string;
	stages: number;
	latest_version: VersionInfo | null;
	live_version: VersionInfo | null;
	/** The live game's player page (/pwa/earn/mystery/<id>). */
	mystery_id: string | null;
}

export interface GameFull extends GameSummary {
	draft: Definition;
	/** What still stops a submission: {path: message}. */
	problems: Record<string, string>;
	max_run_points: number;
	budget?: { reserved: number; spent: number; released: number; left: number };
	invite_url?: string;
}

export interface Template {
	id: string;
	category: Category;
	name: string;
	summary: string;
	icon: string;
	stages: number;
}

export interface Analytics {
	started: number;
	completed: number;
	days: string[];
	stages: { order: number; place: string; proof: string; verified_visit: boolean; total: number; week: number; hints: number; daily: number[] }[];
	budget: { reserved: number; spent: number; released: number; left: number };
}

export const useGmProfile = () => useQuery<ResponseApiData<{ profile: GmProfile }>>({ url: `${GM}profile/`, headers: true });
export const saveProfile = (data: Partial<GmProfile> & { accept_terms?: boolean }) => call<{ profile: GmProfile }>("patch", `${GM}profile/`, data);

export const useTemplates = () => useQuery<ResponseApiData<{ templates: Template[] }>>({ url: `${GM}templates/`, headers: true });
export const useMyGames = () => useQuery<ResponseApiData<{ games: GameSummary[]; counts: Record<string, number> }>>({ url: `${GM}games/`, headers: true });
export const useDashboard = () =>
	useQuery<ResponseApiData<{ by_status: Record<string, number>; players: number; completed: number }>>({ url: `${GM}dashboard/`, headers: true });
export const useGame = (id: string) => useQuery<ResponseApiData<{ game: GameFull }>>({ url: `${GM}games/${id}/`, headers: true });
export const useAnalytics = (id: string) => useQuery<ResponseApiData<{ analytics: Analytics | null }>>({ url: `${GM}games/${id}/analytics/`, headers: true });
export const useQrCodes = (id: string, enabled = true) =>
	useQuery<ResponseApiData<{ qr: { order: number; place: string; url: string; svg: string }[] }>>({ url: `${GM}games/${id}/qr/`, headers: true, enabled });

export const createGame = (category: Category, template: string | null) => call<{ game: GameFull }>("post", `${GM}games/`, { category, template });
export const saveDraft = (id: string, draft: Definition) => call<{ game: GameFull }>("patch", `${GM}games/${id}/`, { draft });
export type GameAction = "submit" | "publish" | "pause" | "resume" | "archive" | "duplicate";
export const gameAction = (id: string, action: GameAction) => call<{ game: GameFull | null }>("post", `${GM}games/${id}/${action}/`, {});
export const previewStage = (id: string, data: { stage: string; answer?: string; code?: string; lat?: number; lng?: number; accuracy?: number; simulate_location?: boolean }) =>
	call<{ ok: boolean; message: string; points: number; coupon: string }>("post", `${GM}games/${id}/preview/`, data);

export function uploadImage(file: Blob) {
	const form = new FormData();
	form.append("image", file, "image.jpg");
	return call<{ name: string; url: string }>("post", `${GM}uploads/`, form);
}

/** The server's field problems of a failed call (submit), when it sent them. */
export function fieldsOf(error: unknown): Record<string, string> {
	const data = (error as { response?: { data?: { errors?: { fields?: Record<string, string> } } } })?.response?.data;
	return data?.errors?.fields ?? {};
}

export const STATUS_LABEL: Record<GameStatus, string> = {
	draft: "پیش‌نویس",
	submitted: "در انتظار بررسی",
	changes_requested: "نیاز به اصلاح",
	approved: "تأییدشده",
	rejected: "ردشده",
	scheduled: "زمان‌بندی‌شده",
	published: "منتشرشده",
	paused: "متوقف",
	archived: "بایگانی",
};

export const CATEGORY_LABEL: Record<Category, string> = { business: "کسب‌وکار", personal: "شخصی", pro: "حرفه‌ای" };

export const STAGE_LABEL: Record<StageType, string> = {
	question: "پرسش",
	puzzle: "معما",
	choice: "چندگزینه‌ای",
	qr: "اسکن QR محل",
	location: "موقعیت گوشی",
	staff: "کد کارکنان",
	media: "متن یا تصویر",
	reward: "جایزه / کد تخفیف",
};

export const STAGE_ICON: Record<StageType, string> = {
	question: "circle-help",
	puzzle: "puzzle",
	choice: "list",
	qr: "qr-code",
	location: "map-pin",
	staff: "users",
	media: "image",
	reward: "gift",
};

export function newStage(type: StageType, n: number): Stage {
	return {
		id: `s${Date.now().toString(36)}${n}`,
		type,
		title: `مرحلهٔ ${fa(n)}`,
		text: "",
		image: null,
		question: "",
		answers: [],
		answer_type: "text",
		options: type === "choice" ? ["", ""] : [],
		lat: null,
		lng: null,
		radius_m: 100,
		check_location: false,
		staff_code: "",
		place: { name: "", address: "", about: "", offer: "", url: "" },
		hints: [],
		points: type === "media" || type === "reward" ? 0 : 10,
		time_limit_s: null,
		coupon: "",
	};
}

/** The most one player can win: every stage's points and the finish bonus. */
export const maxRun = (d: Definition) => d.stages.reduce((n, s) => n + (s.points || 0), 0) + (d.finish_points || 0);

/** The approved version's publication fee: where to pay it (Zibal, or the sandbox page). */
export const payFee = (id: string) => call<{ payment_url: string; track_id: string; amount_toman: number; mode: string }>("post", `${GM}games/${id}/pay/`, {});
/** Back from the gateway: confirms the payment once. */
export const verifyPayment = (trackId: string, success: boolean) =>
	call<{ status: "paid" | "failed" | "pending"; game_id: string; ref_number: string; amount_toman: number; mode: string }>("post", `${GM}payments/verify/`, { trackId, success: success ? "1" : "0" });
