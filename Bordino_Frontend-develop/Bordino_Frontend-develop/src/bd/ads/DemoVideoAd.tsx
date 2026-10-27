"use client";

import { useEffect, useRef, useState } from "react";

import Icon from "../Icon";
import { useBackHandler } from "../back";
import { fa } from "../format";
import type { AdPlayerProps } from "./players";

/**
 * The development stand-in for the ad SDK: a sample video, full screen. Only time actually played
 * counts (no skipping ahead); the end is reported to the flow, which asks the server for the
 * reward. The server checks the time again on its side.
 */
export default function DemoVideoAd({ session, onWatched, onAbort }: Readonly<AdPlayerProps>) {
	const video = useRef<HTMLVideoElement>(null);
	const played = useRef({ total: 0, last: 0 });
	const [watched, setWatched] = useState(0);
	const [duration, setDuration] = useState(session.creative.seconds ?? session.min_watch_seconds);
	const [muted, setMuted] = useState(true);
	const [leaving, setLeaving] = useState(false);
	const [failed, setFailed] = useState(false);
	const done = useRef(false);

	useBackHandler(true, () => (leaving ? setLeaving(false) : setLeaving(true)));

	useEffect(() => {
		const v = video.current;
		if (!v) return;
		// Muted autoplay is allowed everywhere; the player can turn the sound on.
		v.play().catch(() => undefined);
		const hidden = () => document.hidden && v.pause();
		document.addEventListener("visibilitychange", hidden);
		return () => document.removeEventListener("visibilitychange", hidden);
	}, []);

	useEffect(() => {
		const v = video.current;
		if (!v) return;
		if (leaving) v.pause();
		else if (!done.current) v.play().catch(() => undefined);
	}, [leaving]);

	const need = Math.max(duration, session.min_watch_seconds);
	const left = Math.max(0, Math.ceil(need - watched));

	return (
		<div className="bd-ad" role="dialog" aria-modal="true" aria-label="ویدیوی جایزه‌دار">
			<div className="bd-ad-top">
				<span className="bd-ad-pill" aria-live="polite">
					{left > 0 ? `${fa(left)} ثانیه تا ${fa(session.reward_points)} امتیاز` : "جایزه‌ات آماده است"}
				</span>
				{session.creative.demo ? <span className="bd-ad-demo">ویدیوی نمونه · حالت آزمایشی</span> : null}
				<button type="button" className="bd-ad-icon" aria-label={muted ? "روشن کردن صدا" : "بی‌صدا"} onClick={() => setMuted((m) => !m)}>
					<Icon name={muted ? "volume-x" : "volume-2"} />
				</button>
				<button type="button" className="bd-ad-icon" aria-label="بستن ویدیو" onClick={() => setLeaving(true)}>
					<Icon name="x" />
				</button>
			</div>
			<video
				ref={video}
				className="bd-ad-video"
				src={session.creative.video_url}
				playsInline
				muted={muted}
				autoPlay
				preload="auto"
				disablePictureInPicture
				controls={false}
				onLoadedMetadata={(e) => Number.isFinite(e.currentTarget.duration) && setDuration(e.currentTarget.duration)}
				onTimeUpdate={(e) => {
					const t = e.currentTarget.currentTime;
					const step = t - played.current.last;
					// Normal playback moves a fraction of a second per event; a jump is not watching.
					if (step > 0 && step < 1.5) played.current.total += step;
					played.current.last = t;
					setWatched(played.current.total);
				}}
				onSeeking={(e) => {
					if (e.currentTarget.currentTime > played.current.last + 0.5) e.currentTarget.currentTime = played.current.last;
				}}
				onEnded={() => {
					if (done.current) return;
					if (played.current.total >= need - 1) {
						done.current = true;
						onWatched();
					} else {
						// Somehow ended early (a jump): play the part that was missed.
						const v = video.current;
						if (v) {
							v.currentTime = played.current.last = Math.max(0, played.current.total - 0.5);
							v.play().catch(() => undefined);
						}
					}
				}}
				onError={() => setFailed(true)}
			/>
			<div className="bd-ad-bar" aria-hidden="true">
				<i style={{ width: `${Math.min(100, (watched / need) * 100)}%` }} />
			</div>
			{failed ? (
				<div className="bd-ad-sheet" role="alert">
					<b>ویدیو پخش نشد.</b>
					<p>اتصال را بررسی کن؛ بدون جایزه هم می‌توانی بازی کنی.</p>
					<div className="bd-actions">
						<button type="button" className="bd-action" onClick={onAbort}>
							رفتن به بازی
						</button>
					</div>
				</div>
			) : leaving ? (
				<div className="bd-ad-sheet" role="alertdialog" aria-label="بستن ویدیو">
					<b>ویدیو را می‌بندی؟</b>
					<p>اگر الان ببندی، {fa(session.reward_points)} امتیاز را نمی‌گیری.</p>
					<div className="bd-actions">
						<button type="button" className="bd-action" autoFocus onClick={() => setLeaving(false)}>
							ادامهٔ تماشا
						</button>
						<button type="button" className="bd-secondary" onClick={onAbort}>
							بستن و رفتن به بازی
						</button>
					</div>
				</div>
			) : null}
		</div>
	);
}
