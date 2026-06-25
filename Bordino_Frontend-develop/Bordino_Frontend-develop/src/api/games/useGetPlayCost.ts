import type { GameName, PlayCostApiResponse } from "@/api/games/types";
import { WALLET } from "@/api/urls";
import type { ExtendableOptions } from "@/libs/http/interfaces";
import useQuery from "@/libs/http/query";

interface Props extends ExtendableOptions<PlayCostApiResponse> {
	gameName: GameName;
}

/** هزینهٔ هر بار بازی + موجودیِ فعلیِ کیفِ امتیاز (برای نمایش در دیالوگِ باخت). */
export default function useGetPlayCost({ gameName, ...restProps }: Props) {
	const { data, isLoading, error, refetch } = useQuery<PlayCostApiResponse>({
		url: `${WALLET.GAME_PLAY_COST}?game_name=${encodeURIComponent(gameName)}`,
		headers: true,
		enabled: !!gameName,
		...restProps,
	});
	return { data, isLoading, error, refetch };
}
