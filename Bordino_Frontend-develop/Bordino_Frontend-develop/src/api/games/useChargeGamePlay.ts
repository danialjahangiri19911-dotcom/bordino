import { useMutation } from "@tanstack/react-query";

import type { ChargeApiResponse, GameName } from "@/api/games/types";
import { WALLET } from "@/api/urls";
import { withAuth } from "@/libs/http/query";
import requester, { type RequestError } from "@/libs/http/requester";
import { withRequestId } from "@/libs/http/requestId";

/**
 * کسرِ هزینهٔ بازی از کیفِ امتیاز (هر بار بازی/ادامه).
 * مقدارِ کسر از `GameConfiguration.play_cost` در بک‌اند خوانده می‌شود.
 */
export default function useChargeGamePlay() {
	const mutation = useMutation<
		ChargeApiResponse,
		RequestError,
		{ game_name: GameName; difficulty?: string }
	>({
		// Through withAuth: an expired access token is renewed and the request sent again.
		mutationFn: (payload) =>
			// Without a level the key is as before, so a charge still waiting from an older
			// version keeps its id.
			withRequestId(payload.difficulty ? `charge:${payload.game_name}:${payload.difficulty}` : `charge:${payload.game_name}`, async (requestId) => {
				const { data } = await withAuth((token) =>
					requester.post<ChargeApiResponse>(
						WALLET.GAME_PLAY_CHARGE,
						{ ...payload, request_id: requestId },
						{ headers: { Authorization: `Bearer ${token}` } },
					),
				);
				return data;
			}),
	});

	return {
		chargeAsync: mutation.mutateAsync,
		isCharging: mutation.isPending,
		error: mutation.error,
	};
}
