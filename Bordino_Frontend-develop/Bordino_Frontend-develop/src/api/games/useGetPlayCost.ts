import type { GameName, PlayCostApiResponse } from "@/api/games/types";
import { WALLET } from "@/api/urls";
import type { ExtendableOptions } from "@/libs/http/interfaces";
import useQuery from "@/libs/http/query";

interface Props extends ExtendableOptions<PlayCostApiResponse> {
	gameName: GameName;
	/** The level the price is for (sudoku): its own price, as the server charges it. */
	difficulty?: string;
}

/** هزینهٔ هر بار بازی + موجودیِ فعلیِ کیفِ امتیاز (برای نمایش در دیالوگِ باخت). */
export default function useGetPlayCost({ gameName, difficulty, ...restProps }: Props) {
	const { data, isLoading, error, refetch } = useQuery<PlayCostApiResponse>({
		url: `${WALLET.GAME_PLAY_COST}?game_name=${encodeURIComponent(gameName)}${difficulty ? `&difficulty_level=${encodeURIComponent(difficulty)}` : ""}`,
		headers: true,
		enabled: !!gameName,
		...restProps,
	});
	return { data, isLoading, error, refetch };
}
