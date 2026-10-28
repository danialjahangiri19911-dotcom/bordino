import { useMutation } from "@tanstack/react-query";

import type { ChargeApiResponse, GameName } from "@/api/games/types";
import { WALLET } from "@/api/urls";
import { withAuth } from "@/libs/http/query";
import requester, { type RequestError } from "@/libs/http/requester";

/**
 * کسرِ هزینهٔ بازی از کیفِ امتیاز (هر بار بازی/ادامه).
 * مقدارِ کسر از `GameConfiguration.play_cost` در بک‌اند خوانده می‌شود.
 */
// One id per play being paid for, kept while its outcome is unknown (no answer, or a server error):
// tapping again sends the same id and the server returns the first charge instead of a second one.
const pending = new Map<string, string>();

function newRequestId() {
	return typeof crypto !== "undefined" && crypto.randomUUID ? crypto.randomUUID() : `${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

export default function useChargeGamePlay() {
	const mutation = useMutation<
		ChargeApiResponse,
		RequestError,
		{ game_name: GameName }
	>({
		// Through withAuth: an expired access token is renewed and the request sent again.
		mutationFn: async (payload) => {
			const requestId = pending.get(payload.game_name) ?? newRequestId();
			pending.set(payload.game_name, requestId);
			try {
				const { data } = await withAuth((token) =>
					requester.post<ChargeApiResponse>(
						WALLET.GAME_PLAY_CHARGE,
						{ ...payload, request_id: requestId },
						{ headers: { Authorization: `Bearer ${token}` } },
					),
				);
				pending.delete(payload.game_name);
				return data;
			} catch (e) {
				// A clear refusal (4xx: not enough points…) charged nothing: the next play gets a new id.
				const status = (e as { response?: { status?: number } })?.response?.status;
				if (status && status < 500) pending.delete(payload.game_name);
				throw e;
			}
		},
	});

	return {
		chargeAsync: mutation.mutateAsync,
		isCharging: mutation.isPending,
		error: mutation.error,
	};
}
