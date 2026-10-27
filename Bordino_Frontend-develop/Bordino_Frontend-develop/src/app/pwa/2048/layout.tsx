import React from "react";

import EngineShell from "@/bd/EngineShell";

export default function Game2048Layout({ children }: { children: React.ReactNode }) {
	return (
		<EngineShell game="game2048" title="۲۰۴۸">
			{children}
		</EngineShell>
	);
}
