import { Suspense } from "react";

import { CoinSandboxPage } from "@/bd/coins/Coins";

export default function Page() {
	return (
		<Suspense>
			<CoinSandboxPage />
		</Suspense>
	);
}
