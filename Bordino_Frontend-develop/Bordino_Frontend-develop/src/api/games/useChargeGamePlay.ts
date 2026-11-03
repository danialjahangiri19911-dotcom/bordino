import { useMutation } from "@tanstack/react-query";

import type { ChargeApiResponse, GameName } from "@/api/games/types";
import { WALLET } from "@/api/urls";
import { withAuth } from "@/libs/http/query";
import requester, { type RequestError } from "@/libs/http/requester";
import { pendingRequestId, withRequestId } from "@/libs/http/requestId";

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
		mutationFn: (payload) => {
			// A charge still waiting from a version before levels were sent (its key had no level) is
			// sent again exactly as it was, so the server answers it instead of charging again.
			const legacy = payload.difficulty && pendingRequestId(`charge:${payload.game_name}`) ? `charge:${payload.game_name}` : null;
			const body = legacy ? { game_name: payload.game_name } : payload;
			const key = legacy ?? (payload.difficulty ? `charge:${payload.game_name}:${payload.difficulty}` : `charge:${payload.game_name}`);
			return withRequestId(key, async (requestId) => {
				const { data } = await withAuth((token) =>
					requester.post<ChargeApiResponse>(
						WALLET.GAME_PLAY_CHARGE,
						{ ...body, request_id: requestId },
						{ headers: { Authorization: `Bearer ${token}` } },
					),
				);
				return data;
			});
		},
	});

	return {
		chargeAsync: mutation.mutateAsync,
		isCharging: mutation.isPending,
		error: mutation.error,
	};
}
