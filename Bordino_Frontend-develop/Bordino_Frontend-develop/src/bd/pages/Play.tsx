"use client";

import { useEffect, useRef, useState } from "react";

import Link from "next/link";
import { useRouter } from "next/navigation";

import { rememberInvite } from "../missions/pendingQr";
import { joinByInvite } from "../missions/mystery";
import { AppShell, EmptyState, R } from "../ui";

import { gameErrorMessage } from "@/api/games/request";
import useAuthStore from "@/libs/stores/authStore";

/** A private game's invite link (/pwa/play/<token>): joins the game and opens it (after sign-in if needed). */
export default function Play({ token }: { token: string }) {
	const { isLoggedIn } = useAuthStore();
	const { replace } = useRouter();
	const sent = useRef(false);
	const [problem, setProblem] = useState<string | null>(null);
	useEffect(() => {
		if (sent.current) return;
		sent.current = true;
		if (!isLoggedIn) {
			rememberInvite(token);
			replace(R.login);
			return;
		}
		joinByInvite(token)
			.then(({ mystery }) => replace(R.mystery(mystery.id)))
			.catch((e) => setProblem(gameErrorMessage(e)));
	}, [isLoggedIn, token, replace]);
	if (!isLoggedIn) return null;
	return (
		<AppShell nav="earn" title="دعوت به بازی">
			{problem ? (
				<EmptyState icon="circle-alert" title="این دعوت باز نشد" text={problem} action={<Link className="bd-action" href={R.home}>صفحهٔ اصلی</Link>} />
			) : (
				<EmptyState icon="gift" title="در حال باز کردن بازی…" />
			)}
		</AppShell>
	);
}
