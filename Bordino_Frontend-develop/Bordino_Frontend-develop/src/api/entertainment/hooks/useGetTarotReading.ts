import { useCallback, useState } from "react";

import { ENTERTAINMENT_URLS } from "@/api/urls";
import { fetchWithAuth } from "@/libs/http/query";
import useAuthStore from "@/libs/stores/authStore";

import type {
	TarotCard,
	TarotReadingResponse,
	TarotSpread,
} from "../types/tarotType";

export default function useGetTarotReading() {
	const [cards, setCards] = useState<TarotCard[] | null>(null);
	const [loading, setLoading] = useState(false);
	const [error, setError] = useState(false);

	const fetchTarot = useCallback(async (count: TarotSpread) => {
		setLoading(true);
		setError(false);
		setCards(null);
		try {
			const { accessToken } = useAuthStore.getState();
			const { data } = await fetchWithAuth(
				`${ENTERTAINMENT_URLS.TAROT}?count=${count}`,
				accessToken ? { Authorization: `Bearer ${accessToken}` } : undefined,
			);
			setCards((data as TarotReadingResponse).result ?? []);
		} catch {
			setError(true);
		} finally {
			setLoading(false);
		}
	}, []); // stable — token read at call time

	return { cards, loading, error, fetchTarot };
}
