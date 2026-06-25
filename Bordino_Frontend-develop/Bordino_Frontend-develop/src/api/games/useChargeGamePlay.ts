import { useMutation } from "@tanstack/react-query";

import type { ChargeApiResponse, GameName } from "@/api/games/types";
import { WALLET } from "@/api/urls";
import requester, { type RequestError } from "@/libs/http/requester";
import useAuthStore from "@/libs/stores/authStore";

/**
 * کسرِ هزینهٔ بازی از کیفِ امتیاز (هر بار بازی/ادامه).
 * مقدارِ کسر از `GameConfiguration.play_cost` در بک‌اند خوانده می‌شود.
 */
export default function useChargeGamePlay() {
	const { accessToken } = useAuthStore();

	const mutation = useMutation<
		ChargeApiResponse,
		RequestError,
		{ game_name: GameName }
	>({
		mutationFn: async (payload) => {
			const { data } = await requester.post<ChargeApiResponse>(
				WALLET.GAME_PLAY_CHARGE,
				payload,
				{ headers: { Authorization: `Bearer ${accessToken}` } },
			);
			return data;
		},
	});

	return {
		chargeAsync: mutation.mutateAsync,
		isCharging: mutation.isPending,
		error: mutation.error,
	};
}
