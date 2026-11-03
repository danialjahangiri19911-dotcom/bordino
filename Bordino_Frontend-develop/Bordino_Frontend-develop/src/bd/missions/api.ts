import { type AdSession, untilConfirmed } from "../ads/api";
import { call } from "@/api/games/request";
import requester from "@/libs/http/requester";
import type { ResponseApiData } from "@/libs/http/interfaces";
import useQuery from "@/libs/http/query";

export type MissionKind = "video" | "banner" | "signup" | "install" | "qr";
export type MissionState =
	| "available"
	| "in_progress"
	| "waiting"
	| "pending"
	| "rejected"
	| "done"
	| "done_today"
	| "upcoming"
	| "expired"
	| "full"
	| "inactive";

export interface MissionAttempt {
	id: string;
	status: "started" | "pending" | "completed" | "rejected";
	points: number;
	started_at: string;
	review_note: string;
	/** The partner / banner address (with this try's click id), while the try is open. */
	link?: string;
	/** A banner: whether its link was opened (its wait counts from then), and the seconds left. */
	opened?: boolean;
	claim_in?: number;
	/** A video mission's rewarded-ad session. */
	ad?: Omit<AdSession, "session_id"> & { session_id: string };
}

export interface Mission {
	id: string;
	title: string;
	summary: string;
	description: string;
	category: string;
	kind: MissionKind;
	verification: "auto" | "review" | "callback";
	points: number;
	repeat: "once" | "daily";
	limit: number;
	used: number;
	partner_name: string;
	image: string | null;
	proof_label: string;
	proof_image_required: boolean;
	min_seconds: number;
	starts_at: string | null;
	ends_at: string | null;
	order: number;
	create_time: string;
	state: MissionState;
	/** This player's tries still waiting for review (any day), and the ones paid. */
	pending: number;
	completed: number;
	attempt: MissionAttempt | null;
}

export interface MissionCategory {
	id: string;
	name: string;
	icon: string;
}

export interface MissionList {
	categories: MissionCategory[];
	missions: Mission[];
}

export interface MissionReward {
	rewarded: boolean;
	already_rewarded: boolean;
	points: number;
	points_balance: number | null;
	mission?: Mission;
	title?: string;
	summary?: string;
}

export const MISSIONS = "missions/";

/** Waiting for someone else (an admin's review, the partner's server): the list asks again. */
export const awaitsOthers = (m: Mission) =>
	m.state === "waiting" || m.pending > 0 || (m.verification === "callback" && m.attempt?.status === "started");

export function useMissions() {
	return useQuery<ResponseApiData<MissionList>>({
		url: MISSIONS,
		headers: true,
		refetchInterval: (query) => (query.state.data?.data?.result?.missions.some(awaitsOthers) ? 20_000 : false),
	});
}

export const startMission = (id: string) => call<{ mission: Mission }>("post", `${MISSIONS}${id}/start/`, {});

/** The player opened the try's link (a banner's wait starts then). */
export const openedMission = (attemptId: string) => call<{ mission: Mission }>("post", `${MISSIONS}attempts/${attemptId}/opened/`, {});

// A video waits for the ad network's confirmation (Adivery's server to ours): asked again meanwhile.
export const claimMission = (attemptId: string) =>
	untilConfirmed(() => call<MissionReward>("post", `${MISSIONS}attempts/${attemptId}/claim/`, {}));

export function sendProof(attemptId: string, text: string, image: Blob | null) {
	const form = new FormData();
	form.append("text", text);
	if (image) form.append("image", image, "proof.jpg");
	return call<{ mission: Mission }>("post", `${MISSIONS}attempts/${attemptId}/proof/`, form);
}

export const claimQr = (token: string) => call<MissionReward>("post", `${MISSIONS}qr/${encodeURIComponent(token)}/`, {});

/** A venue screen's code (it changes every 30 seconds) rather than a printed QR's. */
export const isVenueCode = (token: string) => /~r\d+~/.test(token);

/** A venue screen's code scanned while signed out: exchanged for a hold that lasts through the sign-in. */
export const holdQr = async (token: string) =>
	(await requester.post<ResponseApiData<{ code: string }>>(`${MISSIONS}qr/${encodeURIComponent(token)}/hold/`, {})).data.result.code;

export interface VenueScreen {
	title: string;
	points: number;
	active: boolean;
	url: string;
	/** The QR as an SVG image. */
	svg: string;
	/** Seconds until the next code. */
	expires_in: number;
	step: number;
}

/** What a venue screen shows now (no sign-in: the screen's own key is its access). */
export const venueScreen = async (key: string) =>
	(await requester.get<ResponseApiData<VenueScreen>>(`${MISSIONS}venue/${encodeURIComponent(key)}/`)).data.result;
