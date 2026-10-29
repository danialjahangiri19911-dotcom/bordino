import { useMutation } from "@tanstack/react-query";

import type {
	SpinWheelApiResponse,
	SpinWheelRequest,
} from "@/api/lottery/types/spinWheelType";
import { LOTTERY_WHEEL } from "@/api/urls";
import { withAuth } from "@/libs/http/query";
import requester, { type RequestError } from "@/libs/http/requester";
import { withRequestId } from "@/libs/http/requestId";

/**
 * چرخشِ سرور-محور: جایزه را سرور انتخاب می‌کند، امتیاز را کم و جایزه را واریز می‌کند.
 * از `spinAsync` (Promise) استفاده کن تا گردونه روی همان جایزه متوقف شود.
 */
export default function useSpinWheel() {
	const mutation = useMutation<
		SpinWheelApiResponse,
		RequestError,
		SpinWheelRequest
	>({
		// Through withAuth: an expired access token is renewed and the spin sent again, instead
		// of a silent 401.
		// One id per spin, kept until the server answers: a retry gets the same spin back. The
		// multiplier is part of the key: a spin at another multiplier is another spin, never the
		// replay of the earlier one.
		mutationFn: (payload) =>
			withRequestId(`spin:${payload.lottery_wheel}:${payload.multiplier ?? 1}`, async (requestId) => {
				const { data } = await withAuth((token) =>
					requester.post<SpinWheelApiResponse>(
						LOTTERY_WHEEL.SPIN,
						{ ...payload, request_id: requestId },
						{ headers: { Authorization: `Bearer ${token}` } },
					),
				);
				return data;
			}),
	});

	return {
		spinAsync: mutation.mutateAsync,
		isSpinning: mutation.isPending,
		error: mutation.error,
	};
}
