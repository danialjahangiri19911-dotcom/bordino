"use client";

import GameView from "@/_pages/PwaApp/2048/GameView";
import PersistedGameProvider from "@/libs/context/2048/PersistedGameProvider";

export default function Home() {
	return (
		<PersistedGameProvider>
			<GameView />
		</PersistedGameProvider>
	);
}
