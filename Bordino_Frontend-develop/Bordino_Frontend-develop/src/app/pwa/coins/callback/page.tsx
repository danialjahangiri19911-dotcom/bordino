import { Suspense } from "react";

import { CoinCallbackPage } from "@/bd/coins/Coins";

export default function Page() {
	return (
		<Suspense>
			<CoinCallbackPage />
		</Suspense>
	);
}
