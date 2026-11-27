"use client";

import type { GameSummary } from "./api";
import { useGmProfile } from "./api";
import type { ResponseApiData } from "@/libs/http/interfaces";
import useQuery from "@/libs/http/query";

/** Statuses a creator still has to act on before the game can go out. */
const UNFINISHED = new Set(["draft", "changes_requested", "rejected"]);

/**
 * How many of this player's own Game Master games are unfinished (0 for a player who never set up
 * creator mode: the list is only asked for once the profile says they have, so nobody else gets an
 * error or a creator profile from it).
 */
export function useCreatorDrafts(): number {
	const profile = useGmProfile().data?.result?.profile;
	const ready = !!profile?.available && !!profile?.onboarded;
	const games = useQuery<ResponseApiData<{ games: GameSummary[]; counts: Record<string, number> }>>({ url: "gm/games/", headers: true, enabled: ready });
	if (!ready) return 0;
	return (games.data?.result?.games ?? []).filter((g) => UNFINISHED.has(g.status)).length;
}
