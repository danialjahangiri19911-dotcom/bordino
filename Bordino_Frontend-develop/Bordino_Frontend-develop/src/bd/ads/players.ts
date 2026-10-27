import type { ComponentType } from "react";

import DemoVideoAd from "./DemoVideoAd";
import type { AdSession } from "./api";

/**
 * One player per ad provider, picked by the provider name the server sends. The AdDelivery SDK
 * becomes another entry here (its component shows the SDK's ad and calls onWatched on the SDK's
 * reward event); the server verifies the view on its own side either way.
 */
export interface AdPlayerProps {
	session: AdSession;
	/** The ad played to the end: ask the server for the reward. */
	onWatched: () => void;
	/** Closed early or failed: no reward, go on to the game. */
	onAbort: () => void;
}

export const AD_PLAYERS: Record<string, ComponentType<AdPlayerProps>> = {
	demo: DemoVideoAd,
};
