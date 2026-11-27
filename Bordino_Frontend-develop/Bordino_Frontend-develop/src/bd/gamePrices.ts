"use client";

import type { GameEntry } from "./games";
import { fa } from "./format";
import type { ResponseApiData } from "@/libs/http/interfaces";
import useQuery from "@/libs/http/query";

/** Every game's price and coin reward as the server charges and pays them (wallet/games/prices/). */
export interface GamePrice {
	fee_min?: number;
	fee_max?: number;
	min_bet?: number | null;
	max_bet?: number | null;
	reward_min?: number;
	reward_max?: number;
}

export function useGamePrices() {
	return useQuery<ResponseApiData<{ games: Record<string, GamePrice> }>>({ url: "wallet/games/prices/", headers: true });
}

const range = (a: number, b: number) => (a === b ? fa(a) : `${fa(a)} تا ${fa(b)}`);

/**
 * A game card's two lines (2026-11-26, product review): what it costs to play, and what playing does
 * to the coins. null while the price is not known yet (the card waits rather than guess).
 */
export function priceLines(game: GameEntry, price: GamePrice | undefined): { cost: string; pays: string } | null {
	if (game.pays === "free") return { cost: "رایگان", pays: "بدون سکه" };
	if (!price) return null;
	if (game.pays === "bet") {
		if (!price.min_bet) return { cost: "فعلاً بسته", pays: "برد: شرط × ضریب" };
		return { cost: `شرط از ${fa(price.min_bet)} سکه`, pays: "برد: شرط × ضریب" };
	}
	const fee = price.fee_min ?? 0;
	const cost = fee > 0 ? `ورودی ${range(fee, price.fee_max ?? fee)} سکه` : "ورود رایگان";
	if (game.pays === "coins") {
		const r = price.reward_max ? `پاداش حل: ${range(price.reward_min ?? 0, price.reward_max)} سکه` : "پاداش سکه";
		return { cost, pays: r };
	}
	if (game.pays === "score") return { cost, pays: "امتیازش سکه نمی‌شود" };
	return { cost, pays: "بدون پاداش سکه" };
}

/** «label · N سکه»: the start button repeats the exact cost (nothing added while free or unknown). */
export const withCost = (label: string, cost: number | null | undefined) => (cost ? `${label} · ${fa(cost)} سکه` : label);

/** The same on a button a game module draws (Dowr, Spy): a «، N سکه» tag kept in it (re-added after
 * the module redraws it, removed when the game is free). `sep`: the page's own separator — Dowr and
 * Spy turn every «·» into «،», so a «·» here would be rewritten, re-added, rewritten… on every frame. */
export function tagCost(button: Element | null, cost: number | null | undefined, sep = "، ") {
	if (!button) return;
	let tag = button.querySelector<HTMLElement>(".bd-cost-tag");
	if (!cost) {
		tag?.remove();
		return;
	}
	const text = `${sep}${fa(cost)} سکه`;
	if (!tag) {
		tag = document.createElement("span");
		tag.className = "bd-cost-tag";
		button.append(tag);
	}
	// The button's own text often ends in a space (before an icon): no space before the «،».
	const before = tag.previousSibling;
	if (before?.nodeType === Node.TEXT_NODE && /\s$/.test(before.nodeValue ?? "")) before.nodeValue = (before.nodeValue ?? "").trimEnd();
	if (tag.textContent !== text) tag.textContent = text;
}
