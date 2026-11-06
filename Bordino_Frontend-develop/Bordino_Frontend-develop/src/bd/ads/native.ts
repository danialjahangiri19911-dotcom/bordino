import { useEffect, useState } from "react";

/**
 * The Android app's Adivery bridge (Bordino_Mobile BordinoAdsPlugin), injected by Capacitor. In a
 * browser, or in an app older than 1.2, there is none: Adivery videos cannot play there.
 */
export interface AdsPlugin {
	prepare(o: { appId: string; placementId: string }): Promise<{ loaded: boolean }>;
	show(o: { appId: string; placementId: string; userId: string }): Promise<{ rewarded: boolean }>;
	/** App 1.3+: a full-screen ad; resolves when it closes (shown: it was really on screen). */
	showInterstitial?(o: { appId: string; placementId: string }): Promise<{ shown: boolean }>;
}

export function adsPlugin(): AdsPlugin | null {
	if (typeof window === "undefined") return null;
	return (window as unknown as { Capacitor?: { Plugins?: { BordinoAds?: AdsPlugin } } }).Capacitor?.Plugins?.BordinoAds ?? null;
}

export const inAndroidApp = () => typeof navigator !== "undefined" && navigator.userAgent.includes("BordinoApp/");

/**
 * The bridge, waited for in the app (Capacitor can come up a moment after the page, as the Back
 * button's App plugin does): null in a browser, or in an app without it after ~5 s.
 */
export function useAdsPlugin(): AdsPlugin | null {
	const [plugin, setPlugin] = useState<AdsPlugin | null>(() => adsPlugin());
	useEffect(() => {
		if (plugin || !inAndroidApp()) return undefined;
		let tries = 0;
		const t = window.setInterval(() => {
			const found = adsPlugin();
			if (found || ++tries >= 20) {
				window.clearInterval(t);
				if (found) setPlugin(found);
			}
		}, 250);
		return () => window.clearInterval(t);
	}, [plugin]);
	return plugin;
}
