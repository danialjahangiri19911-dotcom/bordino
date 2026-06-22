"use client";

import type { ReactNode } from "react";
import { useEffect, useState } from "react";

import GameProvider from "./GameProvider";

import LoadingSkeleton from "@/_pages/PwaApp/2048/LoadingSkeleton";
import { loadGame } from "@/libs/games/2048/persistence";

export default function PersistedGameProvider({
	children,
}: {
	children: ReactNode;
}) {
	const [initialState, setInitialState] =
		useState<Awaited<ReturnType<typeof loadGame>>>(null);
	const [loading, setLoading] = useState(true);

	useEffect(() => {
		let mounted = true;
		loadGame()
			.then((data) => {
				if (mounted) {
					setInitialState(data);
					setLoading(false);
				}
			})
			.catch((err) => {
				console.error("Failed to load game:", err);
				if (mounted) {
					setInitialState(null);
					setLoading(false);
				}
			});
		return () => {
			mounted = false;
		};
	}, []);

	if (loading) {
		return <LoadingSkeleton />;
	}

	return <GameProvider initialState={initialState}>{children}</GameProvider>;
}
