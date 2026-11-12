"use client";

import { useCallback, useRef } from "react";

import { useQueryClient } from "@tanstack/react-query";

import { askLeave } from "./back";
import { fa } from "./format";
import { R } from "./ui";

import type { GameName } from "@/api/games/types";
import useChargeGamePlay from "@/api/games/useChargeGamePlay";
import useGetPlayCost from "@/api/games/useGetPlayCost";

/**
 * Entry fees (2026-11-12): every game's fee is the server's (GameConfiguration.play_cost, edited in
 * «بردینو ادمین» › بسته‌های سکه › هزینهٔ ورود), never a number in the page. It is charged by the server
 * once per new game or round (request id kept until answered: a double tap, a refresh or a network
 * retry is the same charge), never for opening, resuming or navigating.
 */

const RETURN_KEY = "bd-coins-return";

/** To the coin shop, remembering the game to come back to after buying. */
export function goBuyCoins(push: (href: string) => void, back?: string) {
	try {
		sessionStorage.setItem(RETURN_KEY, back ?? window.location.pathname);
	} catch {
		// storage blocked: the shop's own «برگشت به کیف» is still there
	}
	push(R.coins);
}

/** The game to come back to after buying coins (a path inside the app), if one was remembered. */
export function coinsReturn(): string | null {
	try {
		const path = sessionStorage.getItem(RETURN_KEY);
		return path && path.startsWith("/pwa/") && !path.startsWith(R.coins) ? path : null;
	} catch {
		return null;
	}
}

export function clearCoinsReturn() {
	try {
		sessionStorage.removeItem(RETURN_KEY);
	} catch {
		// nothing kept
	}
}

/** «برای شروع هر دست از این بازی، X سکه از کیف پول شما کسر می‌شود.» (nothing while free or unknown) */
export function EntryFeeNote({ fee, className = "" }: { fee: number | null | undefined; className?: string }) {
	if (!fee) return null;
	return <p className={`bd-fee-note ${className}`}>برای شروع هر دست از این بازی، {fa(fee)} سکه از کیف پول شما کسر می‌شود.</p>;
}

/** The text of the note, for the games drawn by their own modules (Dowr, Spy). */
export const entryFeeText = (fee: number) => `برای شروع هر دست از این بازی، ${fa(fee)} سکه از کیف پول شما کسر می‌شود.`;

/** The bet games (Crash, Chicken, wheel): the bet is the entry — at least the smallest bet per round. */
export function BetFeeNote({ minBet, className = "" }: { minBet: number | null | undefined; className?: string }) {
	if (!minBet) return null;
	return <p className={`bd-fee-note ${className}`}>برای شروع هر دست از این بازی، دست‌کم {fa(minBet)} سکه (کمترین شرط) از کیف پول شما کسر می‌شود.</p>;
}

/** «سکهٔ کافی نداری» with «خرید سکه» (the app's own question sheet). */
export function askBuyCoins(push: (href: string) => void, fee: number, balance: number | null) {
	askLeave(
		{
			title: "سکهٔ کافی نداری",
			text: `برای شروع این بازی ${fa(fee)} سکه لازم است${balance !== null ? `؛ موجودی تو ${fa(balance)} سکه است` : ""}. بعد از خرید، به همین بازی برمی‌گردی.`,
			yes: "خرید سکه",
			no: "انصراف",
		},
		() => goBuyCoins(push),
	);
}

/**
 * A game's fee and a paid start: `start(begin)` checks the balance, charges once (the server refuses a
 * balance below the fee, never goes negative) and only then runs `begin` — the moment the new game or
 * round is really created. Not enough coins: «خرید سکه» instead, and nothing starts.
 */
export function useEntryFee(game: GameName, push: (href: string) => void, difficulty?: string) {
	const cost = useGetPlayCost({ gameName: game, difficulty });
	const { chargeAsync, isCharging } = useChargeGamePlay();
	const queryClient = useQueryClient();
	const busy = useRef(false);
	const fee = cost.data?.result?.play_cost ?? null;
	const balance = cost.data?.result ? Number(cost.data.result.current_amount) : null;

	const start = useCallback(
		async (begin: () => void): Promise<boolean> => {
			if (busy.current) return false; // one start at a time (double tap)
			busy.current = true;
			try {
				const now = (await cost.refetch()).data?.data?.result; // (refetch gives the response still wrapped)
				const price = now?.play_cost ?? fee ?? 0;
				const have = now ? Number(now.current_amount) : balance;
				if (price > 0 && have !== null && have < price) {
					askBuyCoins(push, price, have);
					return false;
				}
				if (price > 0) {
					await chargeAsync({ game_name: game, ...(difficulty ? { difficulty } : {}) });
					// The new balance everywhere (header, wallet), and this fee's own query.
					void queryClient.invalidateQueries();
				}
				begin();
				return true;
			} catch (e) {
				// The server refused (e.g. the balance changed meanwhile): the same «خرید سکه» question.
				const text = String((e as { response?: { data?: { errors?: { error?: string } } } })?.response?.data?.errors?.error ?? "");
				if (text.includes("کافی")) askBuyCoins(push, fee ?? 0, null);
				return false;
			} finally {
				busy.current = false;
			}
		},
		[balance, chargeAsync, cost, difficulty, fee, game, push, queryClient],
	);

	return { fee, balance, start, charging: isCharging, loading: cost.isLoading };
}
