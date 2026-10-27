import { call } from "@/api/games/request";
import type { ResponseApiData } from "@/libs/http/interfaces";
import useQuery from "@/libs/http/query";

/** What the app needs to show the ad: the demo's video, later the ad network's placement. */
export interface AdCreative {
	video_url?: string;
	seconds?: number;
	/** The development stand-in (a sample video), shown as such. */
	demo?: boolean;
}

export interface AdOffer {
	available: boolean;
	reward_points: number;
	remaining_today: number;
	provider: string;
	creative: AdCreative;
}

export interface AdSession {
	session_id: string;
	reward_points: number;
	min_watch_seconds: number;
	provider: string;
	creative: AdCreative;
}

export interface AdClaim {
	rewarded: boolean;
	already_rewarded: boolean;
	reward_points: number;
	points_balance: number | null;
}

const OFFER = "wallet/ad-reward/offer/";
const SESSIONS = "wallet/ad-reward/sessions/";

/** Whether a rewarded video can be offered now (the server keeps the daily limit and amount). */
export function useAdOffer() {
	return useQuery<ResponseApiData<AdOffer>>({ url: OFFER, headers: true });
}

/** Starts a view on the server; the reward can only be claimed for a session started here. */
export const startAd = (placement: string) => call<AdSession>("post", SESSIONS, { placement });

/** Asks the server for the reward; it pays once, and only when the provider confirms the view. */
export const claimAd = (sessionId: string) => call<AdClaim>("post", `${SESSIONS}${sessionId}/complete/`, {});
