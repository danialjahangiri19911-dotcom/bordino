import { MISSIONS, type MissionReward } from "./api";
import { call } from "@/api/games/request";
import type { ResponseApiData } from "@/libs/http/interfaces";
import useQuery from "@/libs/http/query";

/** «معمای شهری»: a chain of clues, each solved at a real place (a café, a shop, a landmark). */
export type MysteryState = "available" | "in_progress" | "done" | "upcoming" | "expired" | "full" | "inactive" | "empty";
export type MysteryProof = "qr" | "gps" | "answer" | "staff";

export interface MysteryCard {
	id: string;
	title: string;
	summary: string;
	cover: string | null;
	area: string;
	duration_minutes: number | null;
	/** How many steps, and how many of them this player has solved. */
	steps: number;
	done: number;
	/** Every step's points and the finish bonus. */
	points: number;
	finish_points: number;
	starts_at: string | null;
	ends_at: string | null;
	order: number;
	state: MysteryState;
}

/** The place of a solved step: what the mystery introduces. */
export interface MysteryPlace {
	name: string;
	logo: string | null;
	address: string;
	about: string;
	offer: string;
	url: string;
	map: string;
}

/** One help level: a hint line, the place itself, or (an answer step's last) the answer. */
export type MysteryHint =
	| { kind: "text"; text: string }
	| { kind: "place"; name: string; address: string; map: string }
	| { kind: "answer"; answer: string };

export type MysteryStep =
	| { id: string; number: number; points: number; state: "done"; clue: string; place: MysteryPlace; visited_at: string }
	| {
			id: string;
			number: number;
			points: number;
			state: "current";
			clue: string;
			clue_image: string | null;
			/** The help levels opened so far, and the next one (null: none left) and its cost. */
			hints: MysteryHint[];
			hints_total: number;
			next_hint: MysteryHint["kind"] | null;
			next_hint_cost: number;
			/** What the step pays now (less the help opened). */
			points_now: number;
			/** «پاسخ در محل»: a number gets the number keypad. */
			answer_type: "text" | "number";
			proof: MysteryProof;
			/** «پاسخ در محل»: what to find out there. */
			question: string;
			/** The phone's location is checked too (a GPS step, or an answer / staff code with it). */
			check_location: boolean;
			radius_m: number;
	  }
	| { id: string; number: number; points: number; state: "locked" };

export interface MysteryDetail extends MysteryCard {
	story: string;
	run: {
		status: "active" | "completed";
		started_at: string;
		completed_at: string | null;
		points_earned: number;
		/** Seconds before another answer may be tried (after several wrong ones). */
		locked_in: number;
	} | null;
	step_list: MysteryStep[];
}

export interface CheckinReward {
	rewarded: boolean;
	already_rewarded: boolean;
	points: number;
	bonus: number;
	finished: boolean;
	points_balance: number | null;
	mystery: MysteryDetail;
}

/** A QR scan's answer when the QR is a mystery step's. */
export type MysteryQrReward = MissionReward & { mystery?: { id: string; finished: boolean; bonus: number } };

const MYSTERIES = `${MISSIONS}mysteries/`;

export function useMystery(id: string) {
	return useQuery<ResponseApiData<{ mystery: MysteryDetail }>>({ url: `${MYSTERIES}${id}/`, headers: true });
}

export const startMystery = (id: string) => call<{ mystery: MysteryDetail }>("post", `${MYSTERIES}${id}/start/`, {});

/** Opens the current step's next help level (its points go down). */
export const revealHint = (id: string, stepId: string) =>
	call<{ mystery: MysteryDetail }>("post", `${MYSTERIES}${id}/steps/${stepId}/hint/`, {});

export interface Proof {
	answer?: string;
	code?: string;
	lat?: number;
	lng?: number;
	accuracy?: number;
}

export const checkinMystery = (id: string, stepId: string, proof: Proof) =>
	call<CheckinReward>("post", `${MYSTERIES}${id}/steps/${stepId}/checkin/`, proof);

export class LocationError extends Error {}

/** The phone's position, as precise as it gets in a few seconds (GPS on). */
export function currentPosition(): Promise<{ lat: number; lng: number; accuracy: number }> {
	return new Promise((resolve, reject) => {
		if (typeof navigator === "undefined" || !navigator.geolocation) {
			reject(new LocationError("این گوشی یا مرورگر موقعیت مکانی نمی‌دهد."));
			return;
		}
		navigator.geolocation.getCurrentPosition(
			(p) => resolve({ lat: p.coords.latitude, lng: p.coords.longitude, accuracy: p.coords.accuracy }),
			(e) =>
				reject(
					new LocationError(
						e.code === e.PERMISSION_DENIED
							? "اجازهٔ موقعیت مکانی داده نشد؛ از تنظیمات گوشی یا مرورگر اجازه بده و دوباره بزن."
							: e.code === e.TIMEOUT
								? "موقعیت به‌موقع پیدا نشد؛ GPS را روشن کن، در فضای باز بایست و دوباره بزن."
								: "موقعیت پیدا نشد؛ GPS را روشن کن و دوباره بزن.",
					),
				),
			{ enableHighAccuracy: true, timeout: 20_000, maximumAge: 5_000 },
		);
	});
}

/** The code in a scanned QR: the step's address (…/pwa/earn/qr/<code>) or the bare code. */
export function codeFromScan(text: string): string | null {
	const value = text.trim();
	const match = value.match(/\/pwa\/earn\/qr\/([^/?#\s]+)/);
	if (match) {
		try {
			return decodeURIComponent(match[1]);
		} catch {
			return null;
		}
	}
	return /^[\w~-]{8,120}$/.test(value) ? value : null;
}

/**
 * Inside an Android app older than 1.4, which cannot pass on location or camera requests (it lacks
 * those permissions): the player updates the app for «من اینجام» and the in-app QR scan.
 */
export function appTooOld(): boolean {
	if (typeof navigator === "undefined") return false;
	const found = navigator.userAgent.match(/BordinoApp\/(\d+)(?:\.(\d+))?/);
	if (!found) return false;
	const [major, minor] = [Number(found[1]), Number(found[2] ?? 0)];
	return major < 1 || (major === 1 && minor < 4);
}
