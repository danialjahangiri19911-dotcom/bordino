import { useCallback, useState } from "react";

import { ENTERTAINMENT_URLS } from "@/api/urls";
import useGet from "@/libs/http/useGet";
import type { FortuneReading } from "../types/fortuneReadingType";

export default function useGetFortuneReading() {
	const [fortune, setFortune] = useState<FortuneReading | null>(null);
	const [loading, setLoading] = useState(false);
	const [error, setError] = useState(false);

	const { get } = useGet<FortuneReading>({
		onSuccess: (data) => {
			setFortune(data);
			setLoading(false);
		},
		onError: () => {
			setError(true);
			setLoading(false);
		},
	});

	const fetchFortune = useCallback(() => {
		setLoading(true);
		setError(false);
		setFortune(null);
		get(ENTERTAINMENT_URLS.RANDOM_FORTUNE);
	}, [get]);

	return { fortune, loading, error, fetchFortune };
}
