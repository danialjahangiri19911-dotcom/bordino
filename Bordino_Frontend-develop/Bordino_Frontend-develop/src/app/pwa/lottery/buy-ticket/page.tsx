import { Suspense } from "react";

import BuyTicket from "@/bd/pages/BuyTicket";

export default function Page() {
	return (
		<Suspense>
			<BuyTicket />
		</Suspense>
	);
}
