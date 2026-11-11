"use client";

import { useEffect, useState } from "react";

import Icon from "../Icon";
import { useBackHandler } from "../back";
import { fa } from "../format";
import { type AdOffer, type AdSession, claimAd, startAd } from "./api";
import { AD_PLAYERS } from "./players";
import { useQueryClient } from "@tanstack/react-query";

import { gameErrorMessage } from "@/api/games/request";

interface Props {
	offer: AdOffer;
	/** The game the player picked (its name, and the placement reported to the server). */
	gameName: string;
	placement: string;
	/** Start the game (always the end of this flow, rewarded or not). */
	onPlay: () => void;
	/** Back / tap outside: stay on the game list. */
	onCancel: () => void;
}

type Step =
	| { kind: "offer" }
	| { kind: "starting" }
	| { kind: "playing"; session: AdSession }
	| { kind: "claiming"; session: AdSession }
	| { kind: "rewarded"; points: number }
	| { kind: "failed"; message: string };

/**
 * Before a game: «تماشای ویدیو و دریافت X سکه» or «ادامه بدون تماشای ویدیو». The game opens only
 * after this flow ends, never behind it. The points come from the server, after it accepts the view.
 */
export default function RewardOffer({ offer, gameName, placement, onPlay, onCancel }: Readonly<Props>) {
	const queryClient = useQueryClient();
	const [step, setStep] = useState<Step>({ kind: "offer" });

	useBackHandler(step.kind === "offer" || step.kind === "failed", step.kind === "offer" ? onCancel : onPlay);

	useEffect(() => {
		if (step.kind !== "rewarded") return;
		const t = window.setTimeout(onPlay, 1400);
		return () => window.clearTimeout(t);
	}, [step, onPlay]);

	const watch = async () => {
		setStep({ kind: "starting" });
		try {
			setStep({ kind: "playing", session: await startAd(placement) });
		} catch (e) {
			setStep({ kind: "failed", message: gameErrorMessage(e) });
		}
	};

	const claim = async (session: AdSession) => {
		setStep({ kind: "claiming", session });
		try {
			const result = await claimAd(session.session_id);
			// Balances everywhere (header, wallet) show the new points.
			void queryClient.invalidateQueries();
			setStep({ kind: "rewarded", points: result.reward_points });
		} catch (e) {
			setStep({ kind: "failed", message: gameErrorMessage(e) });
		}
	};

	if (step.kind === "playing") {
		const Player = AD_PLAYERS[step.session.provider] ?? AD_PLAYERS.demo;
		return <Player session={step.session} onWatched={() => void claim(step.session)} onAbort={onPlay} />;
	}

	const seconds = offer.creative.seconds;
	return (
		<div className="bd-sheet-backdrop" role="presentation" onClick={(e) => step.kind === "offer" && e.target === e.currentTarget && onCancel()}>
			<div className="bd-sheet bd-reward" role="dialog" aria-modal="true" aria-labelledby="reward-title">
				{step.kind === "rewarded" ? (
					<div className="bd-reward-done" role="status">
						<span className="bd-reward-coin">
							<Icon name="check" />
						</span>
						<b id="reward-title">
							<bdi dir="ltr">+{fa(step.points)}</bdi> سکه
						</b>
						<p>به کیفت اضافه شد. بریم سراغ {gameName}…</p>
					</div>
				) : step.kind === "failed" ? (
					<>
						<p className="bd-sheet-title" id="reward-title">
							جایزه داده نشد
						</p>
						<p className="bd-reward-text">{step.message}</p>
						<button type="button" className="bd-sheet-item bd-reward-main" autoFocus onClick={onPlay}>
							<Icon name="play" /> رفتن به {gameName}
						</button>
					</>
				) : (
					<>
						<span className="bd-reward-coin" aria-hidden="true">
							<Icon name="coins" />
						</span>
						<p className="bd-reward-heading" id="reward-title">
							قبل از {gameName}، سکه بگیر!
						</p>
						<p className="bd-reward-text">
							{seconds ? `یک ویدیوی کوتاه (${fa(seconds)} ثانیه) ببین` : "یک ویدیوی کوتاه ببین"} و {fa(offer.reward_points)} سکه بگیر.
						</p>
						<button
							type="button"
							className="bd-sheet-item bd-reward-main"
							autoFocus
							disabled={step.kind !== "offer"}
							onClick={() => void watch()}
						>
							{step.kind === "offer" ? <Icon name="play" /> : <Icon name="loader-circle" className="bd-spin" />}
							{step.kind === "claiming" ? "در حال ثبت جایزه…" : `تماشای ویدیو و دریافت ${fa(offer.reward_points)} سکه`}
						</button>
						<button type="button" className="bd-sheet-item bd-sheet-cancel" disabled={step.kind !== "offer"} onClick={onPlay}>
							ادامه بدون تماشای ویدیو
						</button>
						<small className="bd-reward-left">امروز {fa(offer.remaining_today)} ویدیوی جایزه‌دار دیگر داری.</small>
					</>
				)}
			</div>
		</div>
	);
}
