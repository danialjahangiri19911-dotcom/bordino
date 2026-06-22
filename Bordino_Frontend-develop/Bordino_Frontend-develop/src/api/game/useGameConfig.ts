import type { GameConfigApiResponse } from "./types";

import { GAME_URLS } from "@/api/urls";
import type { ExtendableOptions } from "@/libs/http/interfaces";
import useQuery from "@/libs/http/query";

export default function useGameConfig(
	difficulty: string,
	gameName: string,
	options: ExtendableOptions<GameConfigApiResponse> = {},
) {
	const { data, isLoading, error, refetch } = useQuery<GameConfigApiResponse>({
		url: `${GAME_URLS.CONFIG}?difficulty_level=${difficulty}&game_name=${gameName}`,
		headers: true, // if authentication is required
		enabled: options.enabled ?? true,
		retry: options.retry ?? 1,
		staleTime: options.staleTime ?? 5 * 60 * 1000, // 5 minutes
		...options,
	});

	// Extract the actual config from the response
	const config = data?.result;

	return {
		config,
		isLoading,
		error, // raw error from useQuery
		refetch,
	};
}
