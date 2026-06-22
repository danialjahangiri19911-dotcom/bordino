import React, { Suspense } from "react";

import BuyTicket from "@/_pages/PwaApp/Lottery/BuyTicket";

export default function page() {
	return (
		<Suspense>
			<BuyTicket />
		</Suspense>
	);
}
