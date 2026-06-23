import { useCallback, useState } from "react";

import { ENTERTAINMENT_URLS } from "@/api/urls";
import requester from "@/libs/http/requester";
import type { FortuneReading } from "../types/fortuneReadingType";

export default function useGetFortuneReading() {
	const [fortune, setFortune] = useState<FortuneReading | null>(null);
	const [loading, setLoading] = useState(false);
	const [error, setError] = useState(false);

	// eslint-disable-next-line react-hooks/exhaustive-deps
	const fetchFortune = useCallback(async () => {
		setLoading(true);
		setError(false);
		setFortune(null);
		try {
			const { data } = await requester.get<FortuneReading>(
				ENTERTAINMENT_URLS.RANDOM_FORTUNE,
			);
			setFortune(data);
		} catch {
			setError(true);
		} finally {
			setLoading(false);
		}
	}, []); // stable reference — no external deps that change

	return { fortune, loading, error, fetchFortune };
}
