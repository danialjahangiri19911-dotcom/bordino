import React, { Suspense } from "react";

import TicketDetail from "@/_pages/PwaApp/Lottery/TicketDetail";

export default function page() {
	return (
		<Suspense>
			<TicketDetail />
		</Suspense>
	);
}
