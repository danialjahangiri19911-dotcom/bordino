"use client";

import CrashGame from "@/_pages/PwaApp/Crash";
import EngineShell from "@/bd/EngineShell";

export default function CrashPage() {
	return (
		<EngineShell game="crash" title="انفجار">
			<CrashGame />
		</EngineShell>
	);
}
