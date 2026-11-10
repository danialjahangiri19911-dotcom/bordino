import type { ResponseApiData } from "@/libs/http/interfaces";
import useQuery from "@/libs/http/query";

export interface SpyWord {
	id: string;
	text: string;
	related: string;
	category: string;
	difficulty: 1 | 2;
	age: number;
}
export interface SpyConfig {
	enabled: boolean;
	categories: { id: string; label: string; icon: string }[];
	words: SpyWord[];
}

/** The game's switch, topics and word bank (Bordino edits them in the admin). */
export const useSpyConfig = () => useQuery<ResponseApiData<SpyConfig>>({ url: "games/spy/config/", headers: true, staleTime: 5 * 60_000 });
