"use client";

import { useEffect, useRef, useState } from "react";

import Icon from "../Icon";
import { useBackHandler } from "../back";
import { trace } from "../trace";
import { adsPlugin, heldSdkUser, markSdkUser } from "./native";
import type { AdPlayerProps } from "./players";

/**
 * An Adivery rewarded video, played by the Android app's SDK (it covers the screen). The player's
 * signed reference goes to Adivery as its user id (the SDK sends it with the request that loads the
 * ad); Adivery's server confirms the view to ours with it, which is what pays. «rewarded» from the
 * SDK only means: ask the server now.
 */
/**
 * While the ad is up and for 90 s after it closes: when the app's page goes behind something (an ad
 * covers it) and comes back — shows in a trace whether Adivery put up more than one screen.
 */
function watchScreens(attempt: string, startedAt: number) {
	if (typeof document === "undefined") return;
	const seen = () =>
		trace("rewarded_ad", attempt, document.visibilityState === "hidden" ? "app_covered" : "app_visible_again", { after_ms: Date.now() - startedAt });
	document.addEventListener("visibilitychange", seen);
	return (afterMs: number) => window.setTimeout(() => document.removeEventListener("visibilitychange", seen), afterMs);
}

export default function AdiveryAd({ session, onWatched, onAbort }: Readonly<AdPlayerProps>) {
	const [failed, setFailed] = useState<string | null>(null);
	// Adivery said the view closed before its reward: told here, not silently dropped.
	const [notRewarded, setNotRewarded] = useState(false);
	const started = useRef(false);
	const alive = useRef(true);
	useBackHandler(true, onAbort);

	useEffect(() => {
		alive.current = true;
		return () => {
			// Gone (the player left): a late result from the SDK changes nothing here.
			alive.current = false;
		};
	}, []);

	useEffect(() => {
		if (started.current) return;
		started.current = true;
		const plugin = adsPlugin();
		const { app_id, placement_id, user_ref } = session.creative;
		if (!plugin || !app_id || !placement_id) {
			setFailed("این ویدیو فقط در اپ اندروید بردینو پخش می‌شود.");
			return;
		}
		// (a server without player references: the view's own id, as before)
		const userId = user_ref || session.session_id;
		const attempt = session.session_id;
		const startedAt = Date.now();
		const held = heldSdkUser();
		trace("rewarded_ad", attempt, "show_asked", { placement: placement_id, sdk_held: held ? (held === user_ref ? "this_player" : "another_player") : "none" });
		const stopWatching = watchScreens(attempt, startedAt);
		const shown = plugin.show({ appId: app_id, placementId: placement_id, userId });
		// The plugin gives the SDK this id at once: the next ad (the SDK loads one after this view)
		// is requested with it, so it may be loaded ahead from now on.
		if (user_ref) markSdkUser(user_ref);
		shown
			.then(({ rewarded }) => {
				trace("rewarded_ad", attempt, rewarded ? "closed_rewarded" : "closed_not_rewarded", { after_ms: Date.now() - startedAt, page_still_open: alive.current }, rewarded ? "info" : "error");
				stopWatching?.(90_000);
				if (!alive.current) return;
				if (rewarded) onWatched();
				else setNotRewarded(true);
			})
			.catch((e: { code?: string; message?: string }) => {
				trace("rewarded_ad", attempt, "show_failed", { code: e?.code ?? e?.message ?? "?", after_ms: Date.now() - startedAt }, "error");
				stopWatching?.(0);
				if (!alive.current) return;
				setFailed(
					(e?.code ?? e?.message) === "no_fill"
						? "فعلاً ویدیویی برای نمایش نیست؛ کمی بعد دوباره امتحان کن."
						: "ویدیو باز نشد؛ کمی بعد دوباره امتحان کن.",
				);
			});
	}, [session, onWatched, onAbort]);

	return (
		<div className="bd-sheet-backdrop" role="presentation">
			<div className="bd-sheet bd-reward" role="dialog" aria-modal="true" aria-labelledby="adivery-title">
				{notRewarded ? (
					<>
						<span className="bd-reward-coin" aria-hidden="true">
							<Icon name="circle-alert" />
						</span>
						<p className="bd-reward-heading" id="adivery-title">
							سکه‌ای اضافه نشد
						</p>
						<p className="bd-reward-text" role="status">
							ادیوری این ویدیو را «کامل دیده‌شده» ثبت نکرد، برای همین جایزه‌ای ندارد. دفعهٔ بعد بگذار ویدیو تا آخر پخش شود و بعد ببندش.
						</p>
						<button type="button" className="bd-sheet-item bd-sheet-cancel" autoFocus onClick={onAbort}>
							باشه
						</button>
					</>
				) : failed ? (
					<>
						<p className="bd-reward-heading" id="adivery-title">
							ویدیو پخش نشد
						</p>
						<p className="bd-reward-text">{failed}</p>
						<button type="button" className="bd-sheet-item bd-sheet-cancel" autoFocus onClick={onAbort}>
							بستن
						</button>
					</>
				) : (
					<div className="bd-reward-done" role="status">
						<span className="bd-reward-coin">
							<Icon name="loader-circle" className="bd-spin" />
						</span>
						<b id="adivery-title">در حال آماده‌شدن ویدیو…</b>
					</div>
				)}
			</div>
		</div>
	);
}
