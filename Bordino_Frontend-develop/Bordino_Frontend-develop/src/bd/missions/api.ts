import type { AdSession } from "../ads/api";
import { call } from "@/api/games/request";
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
	/** Seconds until a banner's points can be taken. */
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

export function useMissions() {
	return useQuery<ResponseApiData<MissionList>>({ url: MISSIONS, headers: true });
}

export const startMission = (id: string) => call<{ mission: Mission }>("post", `${MISSIONS}${id}/start/`, {});

export const claimMission = (attemptId: string) => call<MissionReward>("post", `${MISSIONS}attempts/${attemptId}/claim/`, {});

export function sendProof(attemptId: string, text: string, image: Blob | null) {
	const form = new FormData();
	form.append("text", text);
	if (image) form.append("image", image, "proof.jpg");
	return call<{ mission: Mission }>("post", `${MISSIONS}attempts/${attemptId}/proof/`, form);
}

export const claimQr = (token: string) => call<MissionReward>("post", `${MISSIONS}qr/${encodeURIComponent(token)}/`, {});
