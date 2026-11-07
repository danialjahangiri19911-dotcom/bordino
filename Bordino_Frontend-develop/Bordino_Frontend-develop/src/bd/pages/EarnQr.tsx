"use client";

import { useEffect, useRef, useState } from "react";

import Link from "next/link";
import { useRouter } from "next/navigation";

import Icon from "../Icon";
import { fa } from "../format";
import { claimQr, holdQr, isVenueCode } from "../missions/api";
import type { MysteryQrReward } from "../missions/mystery";
import { rememberQr } from "../missions/pendingQr";
import { AppShell, EmptyState, R } from "../ui";
import { useQueryClient } from "@tanstack/react-query";

import { gameErrorMessage } from "@/api/games/request";
import useAuthStore from "@/libs/stores/authStore";

/**
 * A place's QR, scanned with the phone's camera, opens this page: the server checks the code and pays
 * the mission. Signed out, the code waits through the sign-in (pendingQr) and comes back here; a venue
 * screen's code (valid two minutes) is first exchanged for a hold that outlasts the sign-in.
 */
export default function EarnQr({ token }: { token: string }) {
	const { isLoggedIn } = useAuthStore();
	const { replace } = useRouter();
	const queryClient = useQueryClient();
	const sent = useRef(false);
	const [result, setResult] = useState<MysteryQrReward | null>(null);
	const [problem, setProblem] = useState<string | null>(null);

	useEffect(() => {
		if (sent.current) return;
		if (!isLoggedIn) {
			if (!isVenueCode(token)) {
				rememberQr(token);
				replace(R.login);
				return;
			}
			// A venue screen's code lasts two minutes: kept as a hold, it outlasts the sign-in.
			sent.current = true;
			holdQr(token)
				.then((hold) => {
					rememberQr(hold);
					replace(R.login);
				})
				.catch((e) => setProblem(gameErrorMessage(e)));
			return;
		}
		sent.current = true;
		claimQr(token)
			.then((reward) => {
				setResult(reward);
				void queryClient.invalidateQueries();
			})
			.catch((e) => setProblem(gameErrorMessage(e)));
	}, [isLoggedIn, token, replace, queryClient]);

	if (!isLoggedIn && !problem) return null;
	// A «معمای شهری» step's QR: back to its mystery (the next clue is open there).
	const more = result?.mystery ? (
		<Link className="bd-action" href={R.mystery(result.mystery.id)}>
			{result.mystery.finished ? "دیدن معما" : "سرنخ بعدی"}
		</Link>
	) : (
		<Link className="bd-action" href={R.earn}>
			مأموریت‌های دیگر
		</Link>
	);
	return (
		<AppShell nav="earn" title="دریافت امتیاز" allowGuest={!isLoggedIn}>
			<div className="bd-panel mi-qr-result" role="status">
				{result ? (
					<EmptyState
						icon={result.already_rewarded ? "badge-check" : "coins"}
						title={result.already_rewarded ? "امتیاز این QR را قبلاً گرفته‌ای" : `+${fa(result.points)} امتیاز گرفتی!`}
						text={
							result.mystery
								? `«${result.title}» در معمای «${result.summary}»${result.already_rewarded ? "" : result.mystery.finished ? " — معما را حل کردی!" : " — مرحلهٔ بعد باز شد."}`
								: result.title
									? `«${result.title}»${result.already_rewarded ? "" : " — به کیف امتیازت اضافه شد."}`
									: undefined
						}
						action={more}
					/>
				) : problem ? (
					<EmptyState icon="circle-alert" title="امتیاز داده نشد" text={problem} action={more} />
				) : (
					<EmptyState icon="qr-code" title="در حال بررسی کد…" text={<Icon name="loader-circle" className="bd-spin" />} />
				)}
			</div>
		</AppShell>
	);
}
