"use client";

import { useEffect, useState } from "react";

import { usePathname } from "next/navigation";

import { GAMES, type GameEntry } from "./games";
import useAuthStore from "@/libs/stores/authStore";
import useUserStore from "@/libs/stores/userStore";

/**
 * How often this player opened each game on this device (2026-11-26: «گیمنت» lists the games they
 * play most first). Counted when a game's page opens — from the list, a link or Back — once per visit;
 * kept per player in this device's storage (another device starts from the usual order).
 */
type Use = Record<string, { n: number; at: number }>;

const PREFIX = "bd-game-use:";
const CHANGED = "bd-game-use-changed";

const storageKey = (player: string | undefined) => `${PREFIX}${player || "guest"}`;

/** The signed-in player: the session token's user (there from sign-in on, the same on every page),
 * else the stored profile's id. */
function usePlayer(): string | undefined {
	const id = useUserStore((s) => s.user?.id);
	const token = useAuthStore((s) => s.accessToken);
	try {
		const payload = JSON.parse(atob((token ?? "").split(".")[1].replace(/-/g, "+").replace(/_/g, "/")));
		if (payload.user_id) return `u${payload.user_id}`;
	} catch {
		// no session token readable: the profile's id
	}
	return id ? String(id) : undefined;
}

export function readGameUse(player: string | undefined): Use {
	try {
		const raw = JSON.parse(localStorage.getItem(storageKey(player)) ?? "{}");
		return raw && typeof raw === "object" ? (raw as Use) : {};
	} catch {
		return {};
	}
}

export function recordGameUse(player: string | undefined, game: GameEntry["id"], now = Date.now()) {
	try {
		const use = readGameUse(player);
		const before = use[game] ?? { n: 0, at: 0 };
		use[game] = { n: before.n + 1, at: now };
		localStorage.setItem(storageKey(player), JSON.stringify(use));
		window.dispatchEvent(new Event(CHANGED));
	} catch {
		// storage blocked: the list keeps its usual order
	}
}

/** Most opened first; equal counts: the more recent first; never opened: the usual order. */
export function sortByUse<T extends { id: string }>(games: readonly T[], use: Use): T[] {
	const order = new Map(games.map((g, i) => [g.id, i]));
	return [...games].sort((a, b) => {
		const ua = use[a.id] ?? { n: 0, at: 0 };
		const ub = use[b.id] ?? { n: 0, at: 0 };
		return ub.n - ua.n || ub.at - ua.at || (order.get(a.id) ?? 0) - (order.get(b.id) ?? 0);
	});
}

/** The game a page belongs to (its own route or one under it), if any. */
export function gameAt(path: string): GameEntry["id"] | null {
	const p = path.replace(/\/+$/, "");
	return GAMES.find((g) => p === g.href || p.startsWith(`${g.href}/`))?.id ?? null;
}

/** This player's counts (null until read on this device: the first render keeps the usual order). */
export function useGameUse(): Use | null {
	const player = usePlayer();
	const [use, setUse] = useState<Use | null>(null);
	useEffect(() => {
		const read = () => setUse(readGameUse(player));
		read();
		window.addEventListener(CHANGED, read);
		window.addEventListener("storage", read);
		return () => {
			window.removeEventListener(CHANGED, read);
			window.removeEventListener("storage", read);
		};
	}, [player]);
	return use;
}

/** Counts a game each time its page opens (mounted once, in the app's layout). */
export function GameUseTracker() {
	const path = usePathname();
	const player = usePlayer();
	const game = gameAt(path ?? "");
	// Once per visit to a game (moving inside it counts nothing more), and only for a known player
	// (games need an account; the player's id may arrive a moment after the page).
	useEffect(() => {
		if (game && player) recordGameUse(player, game);
	}, [game, player]);
	return null;
}
