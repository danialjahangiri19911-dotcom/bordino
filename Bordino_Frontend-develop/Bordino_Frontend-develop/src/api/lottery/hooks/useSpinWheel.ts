import { useMutation } from "@tanstack/react-query";

import type {
	SpinWheelApiResponse,
	SpinWheelRequest,
} from "@/api/lottery/types/spinWheelType";
import { LOTTERY_WHEEL } from "@/api/urls";
import requester, { type RequestError } from "@/libs/http/requester";
import useAuthStore from "@/libs/stores/authStore";

/**
 * چرخشِ سرور-محور: جایزه را سرور انتخاب می‌کند، امتیاز را کم و جایزه را واریز می‌کند.
 * از `spinAsync` (Promise) استفاده کن تا گردونه روی همان جایزه متوقف شود.
 */
export default function useSpinWheel() {
	const { accessToken } = useAuthStore();

	const mutation = useMutation<
		SpinWheelApiResponse,
		RequestError,
		SpinWheelRequest
	>({
		mutationFn: async (payload) => {
			const { data } = await requester.post<SpinWheelApiResponse>(
				LOTTERY_WHEEL.SPIN,
				payload,
				{ headers: { Authorization: `Bearer ${accessToken}` } },
			);
			return data;
		},
	});

	return {
		spinAsync: mutation.mutateAsync,
		isSpinning: mutation.isPending,
		error: mutation.error,
	};
}
