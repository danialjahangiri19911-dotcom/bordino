import { useEffect } from "react";

import { inAndroidApp, sdkHoldsUser, useAdsPlugin } from "./native";
import axios from "axios";

import { call } from "@/api/games/request";
import type { ResponseApiData } from "@/libs/http/interfaces";
import useQuery from "@/libs/http/query";

/** What the app needs to show the ad: the demo's video, later the ad network's placement. */
export interface AdCreative {
	video_url?: string;
	seconds?: number;
	/** The development stand-in (a sample video), shown as such. */
	demo?: boolean;
	/** Adivery: the app id and the rewarded placement the Android app shows. */
	app_id?: string;
	placement_id?: string;
	/** Adivery: the player's signed reference, given to the SDK as its user id (sent back by
	 * Adivery's server with each confirmed view). */
	user_ref?: string;
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

/**
 * The offer as this device can play it: an Adivery video needs the Android app (1.2+), so in a
 * browser — or an older app, which is asked to update — it is not offered. In the app the video is
 * loaded ahead of the tap.
 */
export function usePlayableAdOffer() {
	const query = useAdOffer();
	const offer = query.data?.result;
	const native = offer?.provider === "adivery";
	const plugin = useAdsPlugin();
	const playable = !native || !!plugin;
	const { app_id, placement_id, user_ref } = offer?.creative ?? {};
	useEffect(() => {
		// Loaded ahead only when the SDK already holds this player's reference (it goes with the
		// load request); the first video of an app session loads when it is shown.
		if (native && plugin && offer?.available && app_id && placement_id && sdkHoldsUser(user_ref)) {
			plugin.prepare({ appId: app_id, placementId: placement_id }).catch(() => undefined);
		}
	}, [native, plugin, offer?.available, app_id, placement_id, user_ref]);
	return {
		...query,
		offer: offer && !playable ? { ...offer, available: false } : offer,
		/** An Adivery video is waiting but this Android app is too old to play it. */
		needsAppUpdate: native && !plugin && inAndroidApp(),
		/** An Adivery video is waiting but this is a browser. */
		appOnly: native && !plugin && !inAndroidApp(),
	};
}

/** The server has not had the ad network's confirmation of the view yet (it may take seconds). */
export const awaitingConfirmation = (e: unknown) =>
	axios.isAxiosError(e) && (e.response?.data as { errors?: { code?: string } } | undefined)?.errors?.code === "pending";

/** Asks again while the server waits for the ad network's confirmation (up to ~30 s). */
export async function untilConfirmed<T>(ask: () => Promise<T>, tries = 20, gapMs = 1500): Promise<T> {
	for (let i = 1; ; i++) {
		try {
			return await ask();
		} catch (e) {
			if (!awaitingConfirmation(e) || i >= tries) throw e;
			await new Promise((done) => setTimeout(done, gapMs));
		}
	}
}

/** Starts a view on the server; the reward can only be claimed for a session started here. */
export const startAd = (placement: string) => call<AdSession>("post", SESSIONS, { placement });

/** Asks the server for the reward; it pays once, and only when the provider confirms the view. */
export const claimAd = (sessionId: string) => untilConfirmed(() => call<AdClaim>("post", `${SESSIONS}${sessionId}/complete/`, {}));
