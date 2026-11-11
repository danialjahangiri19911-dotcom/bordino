import { Suspense } from "react";

import { CoinCheckoutPage } from "@/bd/coins/Coins";

export default function Page() {
	return (
		<Suspense>
			<CoinCheckoutPage />
		</Suspense>
	);
}
