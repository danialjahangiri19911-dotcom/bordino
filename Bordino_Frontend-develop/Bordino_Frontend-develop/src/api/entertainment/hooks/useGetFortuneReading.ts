import { useCallback, useState } from "react";

import { ENTERTAINMENT_URLS } from "@/api/urls";
import requester from "@/libs/http/requester";
import useAuthStore from "@/libs/stores/authStore";
import type { FortuneReading, FortuneReadingData } from "../types/fortuneReadingType";

export default function useGetFortuneReading() {
	const [fortune, setFortune] = useState<FortuneReadingData | null>(null);
	const [loading, setLoading] = useState(false);
	const [error, setError] = useState(false);

	const fetchFortune = useCallback(async () => {
		setLoading(true);
		setError(false);
		setFortune(null);
		try {
			// Read token at call time (same pattern as query.ts:63) — keeps callback stable
			const { accessToken } = useAuthStore.getState();
			const { data } = await requester.get<FortuneReading>(
				ENTERTAINMENT_URLS.RANDOM_FORTUNE,
				{
					headers: accessToken
						? { Authorization: `Bearer ${accessToken}` }
						: undefined,
				},
			);
			// همه endpoint ها در { is_successful, result, ... } wrap می‌شوند
			setFortune(data.result);
		} catch {
			setError(true);
		} finally {
			setLoading(false);
		}
	}, []); // stable — token read at call time, not as dep

	return { fortune, loading, error, fetchFortune };
}
