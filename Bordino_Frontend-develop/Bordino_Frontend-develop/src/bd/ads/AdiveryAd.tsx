"use client";

import { useEffect, useRef, useState } from "react";

import Icon from "../Icon";
import { useBackHandler } from "../back";
import { adsPlugin } from "./native";
import type { AdPlayerProps } from "./players";

/**
 * An Adivery rewarded video, played by the Android app's SDK (it covers the screen). The view's
 * session id goes to Adivery as its user id; Adivery's server confirms the view to ours with it,
 * which is what pays. «rewarded» from the SDK only means: ask the server now.
 */
export default function AdiveryAd({ session, onWatched, onAbort }: Readonly<AdPlayerProps>) {
	const [failed, setFailed] = useState<string | null>(null);
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
		const { app_id, placement_id } = session.creative;
		if (!plugin || !app_id || !placement_id) {
			setFailed("این ویدیو فقط در اپ اندروید بردینو پخش می‌شود.");
			return;
		}
		plugin
			.show({ appId: app_id, placementId: placement_id, userId: session.session_id })
			.then(({ rewarded }) => {
				if (!alive.current) return;
				if (rewarded) onWatched();
				else onAbort();
			})
			.catch((e: { code?: string; message?: string }) =>
				alive.current &&
				setFailed(
					(e?.code ?? e?.message) === "no_fill"
						? "فعلاً ویدیویی برای نمایش نیست؛ کمی بعد دوباره امتحان کن."
						: "ویدیو باز نشد؛ کمی بعد دوباره امتحان کن.",
				),
			);
	}, [session, onWatched, onAbort]);

	return (
		<div className="bd-sheet-backdrop" role="presentation">
			<div className="bd-sheet bd-reward" role="dialog" aria-modal="true" aria-labelledby="adivery-title">
				{failed ? (
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
