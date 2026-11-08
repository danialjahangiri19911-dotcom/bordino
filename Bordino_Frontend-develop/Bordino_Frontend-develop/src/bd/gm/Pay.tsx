"use client";

import { useEffect, useRef, useState } from "react";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";

import Icon from "../Icon";
import { fa } from "../format";
import { EmptyState, Panel } from "../ui";
import CreatorShell, { GM } from "./CreatorShell";
import { verifyPayment } from "./api";

import { gameErrorMessage } from "@/api/games/request";

/**
 * Zibal's sandbox stand-in (GM_ZIBAL_MODE = "sandbox", the first step): no card, no money. It only
 * says «paid» or «cancelled» back, the way Zibal's page would.
 */
export function PaySandbox() {
	const params = useSearchParams();
	const { replace } = useRouter();
	const trackId = params.get("trackId") ?? "";
	const amount = Number(params.get("amount") ?? 0);
	const back = (success: boolean) => replace(`/pwa/gm/pay/callback?trackId=${encodeURIComponent(trackId)}&success=${success ? 1 : 0}`);
	return (
		<CreatorShell title="درگاه پرداخت آزمایشی">
			<Panel title="درگاه آزمایشی زیبال" className="gm-sandbox">
				<p>
					این صفحهٔ <b>آزمایشی</b> است: هیچ پولی جابه‌جا نمی‌شود و کارتی خواسته نمی‌شود. وقتی درگاه واقعی زیبال روشن شود، به‌جای این
					صفحه به زیبال می‌روی.
				</p>
				<p className="gm-amount">
					مبلغ: <b>{fa(amount)}</b> تومان
				</p>
				<div className="bd-actions">
					<button type="button" className="bd-action" disabled={!trackId} onClick={() => back(true)}>
						<Icon name="badge-check" /> پرداخت موفق (آزمایشی)
					</button>
					<button type="button" className="bd-secondary" disabled={!trackId} onClick={() => back(false)}>
						انصراف
					</button>
				</div>
			</Panel>
		</CreatorShell>
	);
}

/** Back from the gateway: the server asks Zibal and records the payment once, then back to the game. */
export function PayCallback() {
	const params = useSearchParams();
	const { replace } = useRouter();
	const sent = useRef(false);
	const [state, setState] = useState<{ ok?: boolean; text: string; game?: string }>({ text: "در حال بررسی پرداخت…" });
	useEffect(() => {
		if (sent.current) return;
		sent.current = true;
		const trackId = params.get("trackId") ?? "";
		const success = params.get("success") === "1";
		verifyPayment(trackId, success)
			.then((r) => {
				const ok = r.status === "paid";
				setState({
					ok,
					game: r.game_id,
					text: ok ? `پرداخت ${fa(r.amount_toman)} تومان ثبت شد${r.ref_number ? ` (پیگیری ${r.ref_number})` : ""}. حالا می‌توانی بازی را منتشر کنی.` : "پرداخت انجام نشد؛ دوباره امتحان کن.",
				});
				if (ok) window.setTimeout(() => replace(GM.game(r.game_id)), 2500);
			})
			.catch((e) => setState({ ok: false, text: gameErrorMessage(e) }));
	}, [params, replace]);
	return (
		<CreatorShell title="نتیجهٔ پرداخت">
			<EmptyState
				icon={state.ok === undefined ? "loader-circle" : state.ok ? "badge-check" : "circle-alert"}
				title={state.ok === undefined ? "صبر کن…" : state.ok ? "پرداخت شد" : "پرداخت نشد"}
				text={state.text}
				action={state.game ? <Link className="bd-action" href={GM.game(state.game)}>برگشت به بازی</Link> : <Link className="bd-action" href={GM.games}>بازی‌های من</Link>}
			/>
		</CreatorShell>
	);
}
